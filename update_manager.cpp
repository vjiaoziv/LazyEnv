// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#include "update_manager.h"
#include <ShlObj.h>
#include <future>
#include <fstream>
#include <sstream>
#include <format>
#include <algorithm>

namespace lazyenv {

UpdateManager::UpdateManager(RollbackManager& rollback)
    : rollbackMgr_(rollback) {

    wchar_t* appdata = nullptr;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &appdata))) {
        pinnedConfigPath_ = std::filesystem::path(appdata) / L"LazyEnv" / L"pinned_packages.json";
        CoTaskMemFree(appdata);
    } else {
        pinnedConfigPath_ = std::filesystem::path("C:/LazyEnv/pinned_packages.json");
    }

    loadPinnedPackages();

    // Register default providers
    registerProvider(createWingetProvider());
    registerProvider(createScoopProvider());
    registerProvider(createNpmProvider());
    registerProvider(createPipProvider());
}

void UpdateManager::registerProvider(std::shared_ptr<IPackageManager> provider) {
    if (provider) {
        providers_.push_back(provider);
    }
}

std::vector<PackageUpdateItem> UpdateManager::checkAllUpdates() {
    std::vector<PackageUpdateItem> allItems;

    // Parallel multi-source query across all available providers
    std::vector<std::future<std::vector<PackageUpdateItem>>> futures;
    for (const auto& provider : providers_) {
        if (!provider || !provider->isAvailable()) continue;
        futures.push_back(std::async(std::launch::async, [provider]() {
            try {
                return provider->checkUpdates();
            } catch (...) {
                return std::vector<PackageUpdateItem>{};
            }
        }));
    }

    for (auto& f : futures) {
        try {
            auto items = f.get();
            for (auto& item : items) {
                item.isPinned = isPackagePinned(item.id);
                allItems.push_back(item);
            }
        } catch (...) {}
    }

    return allItems;
}

FailureDiagnostic UpdateManager::diagnoseFailure(int exitCode, const std::string& output) {
    FailureDiagnostic diag;

    // Check Elevation / UAC
    if (output.find("0x80070005") != std::string::npos ||
        output.find("Access is denied") != std::string::npos ||
        output.find("Administrator") != std::string::npos ||
        output.find("权限不足") != std::string::npos) {
        diag.category   = "ELEVATION_REQUIRED";
        diag.reason     = "Administrator privileges required (0x80070005)";
        diag.suggestion = "Try running LazyEnv as Administrator or use Interactive Retry.";
        return diag;
    }

    // Check File Locked
    if (output.find("0x80070020") != std::string::npos ||
        output.find("used by another process") != std::string::npos ||
        output.find("being used") != std::string::npos ||
        output.find("文件被占用") != std::string::npos) {
        diag.category   = "FILE_LOCKED";
        diag.reason     = "Target application is currently running (0x80070020)";
        diag.suggestion = "Please close the application and its background processes, then retry.";
        return diag;
    }

    // Check Hash Mismatch
    if (output.find("hash mismatch") != std::string::npos ||
        output.find("hash check failed") != std::string::npos ||
        output.find("哈希不匹配") != std::string::npos) {
        diag.category   = "HASH_MISMATCH";
        diag.reason     = "Package hash verification failed";
        diag.suggestion = "Installer download may be corrupted or outdated. Please retry later.";
        return diag;
    }

    // Check Network Error
    if (output.find("0x80072ee7") != std::string::npos ||
        output.find("timeout") != std::string::npos ||
        output.find("connection") != std::string::npos ||
        output.find("网络") != std::string::npos) {
        diag.category   = "NETWORK_ERROR";
        diag.reason     = "Network connection or download timeout";
        diag.suggestion = "Please check your network connection or proxy settings.";
        return diag;
    }

    // Default unknown
    diag.category   = "UNKNOWN";
    diag.reason     = std::format("Process exited with code {}", exitCode);
    diag.suggestion = "Check detailed console logs or try Interactive mode.";
    return diag;
}

BatchUpgradeSummary UpdateManager::upgradeBatch(
    const std::vector<UpgradeTarget>& targets,
    BatchProgressCallback onProgress,
    LineCallback onLog,
    bool interactive) {

    BatchUpgradeSummary summary;
    summary.total = static_cast<int>(targets.size());
    if (targets.empty()) return summary;

    // Create snapshot before batch upgrade
    std::string snapName = std::format("Pre-update batch: {} packages", targets.size());
    try {
        summary.snapshotId = rollbackMgr_.createSnapshot(snapName);
    } catch (...) {}

    for (int i = 0; i < summary.total; ++i) {
        const auto& tgt = targets[i];

        // Find matching provider
        std::shared_ptr<IPackageManager> targetProvider = nullptr;
        for (const auto& p : providers_) {
            if (p && p->getSourceType() == tgt.source) {
                targetProvider = p;
                break;
            }
        }

        UpgradeProgressDetail curDetail;
        curDetail.phase   = "preparing";
        curDetail.percent = 0;
        curDetail.message = "Preparing " + tgt.name + "...";

        if (onProgress) {
            onProgress(tgt, i + 1, summary.total, curDetail);
        }

        auto phaseCb = [onProgress, tgt, i, total = summary.total](const UpgradeProgressDetail& pd) {
            if (onProgress) {
                onProgress(tgt, i + 1, total, pd);
            }
        };

        InstallResult res;
        res.packageId = tgt.id;
        if (targetProvider && targetProvider->isAvailable()) {
            try {
                res = targetProvider->upgrade(tgt.id, onLog, phaseCb, interactive);
            } catch (const std::exception& e) {
                res.status   = InstallStatus::Failed;
                res.exitCode = -1;
                res.output   = e.what();
            }
        } else {
            res.status   = InstallStatus::Failed;
            res.exitCode = -1;
            res.output   = "Provider not available for source: " + sourceTypeToString(tgt.source);
        }

        if (res.status == InstallStatus::Success) {
            summary.successCount++;
            summary.successes.push_back(tgt.id);
        } else {
            summary.failCount++;
            FailedItemDetail fail;
            fail.id         = tgt.id;
            fail.name       = tgt.name;
            fail.source     = tgt.source;
            fail.exitCode   = res.exitCode;
            fail.output     = res.output.substr(0, 1000);
            fail.diagnostic = diagnoseFailure(res.exitCode, res.output);
            summary.failures.push_back(fail);
        }
    }

    // Broadcast environment changes after upgrades
    RollbackManager::broadcastEnvironmentChange();

    return summary;
}

bool UpdateManager::setPackagePinned(const std::string& packageId, bool pinned) {
    if (packageId.empty()) return false;
    if (pinned) {
        pinnedPackages_.insert(packageId);
    } else {
        pinnedPackages_.erase(packageId);
    }
    savePinnedPackages();
    return true;
}

bool UpdateManager::isPackagePinned(const std::string& packageId) const {
    return pinnedPackages_.find(packageId) != pinnedPackages_.end();
}

std::vector<std::string> UpdateManager::getPinnedPackages() const {
    return std::vector<std::string>(pinnedPackages_.begin(), pinnedPackages_.end());
}

void UpdateManager::loadPinnedPackages() {
    pinnedPackages_.clear();
    std::error_code ec;
    if (!std::filesystem::exists(pinnedConfigPath_, ec)) return;

    std::ifstream f(pinnedConfigPath_);
    if (!f.is_open()) return;

    std::string content((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    size_t i = 0;
    while (i < content.size()) {
        auto q1 = content.find('\"', i);
        if (q1 == std::string::npos) break;
        auto q2 = content.find('\"', q1 + 1);
        if (q2 == std::string::npos) break;
        std::string id = content.substr(q1 + 1, q2 - q1 - 1);
        if (!id.empty()) {
            pinnedPackages_.insert(id);
        }
        i = q2 + 1;
    }
}

void UpdateManager::savePinnedPackages() {
    try {
        std::filesystem::create_directories(pinnedConfigPath_.parent_path());
        std::ofstream f(pinnedConfigPath_, std::ios::trunc);
        if (!f.is_open()) return;

        f << "[\n";
        bool first = true;
        for (const auto& id : pinnedPackages_) {
            if (!first) f << ",\n";
            first = false;
            f << "  \"" << id << "\"";
        }
        f << "\n]\n";
    } catch (...) {}
}

} // namespace lazyenv
