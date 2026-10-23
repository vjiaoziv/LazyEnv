// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#pragma once

#ifndef LAZYENV_UPDATE_MANAGER_H
#define LAZYENV_UPDATE_MANAGER_H

#include "package_manager.h"
#include "rollback.h"

#include <vector>
#include <string>
#include <memory>
#include <unordered_set>
#include <functional>

namespace lazyenv {

// Target item for upgrade queue
struct UpgradeTarget {
    std::string id;
    SourceType  source;
    std::string name;
};

// Failure diagnosis structure
struct FailureDiagnostic {
    std::string category;   // "ELEVATION_REQUIRED", "FILE_LOCKED", "HASH_MISMATCH", "NETWORK_ERROR", "UNKNOWN"
    std::string reason;     // Human-readable reason
    std::string suggestion; // Actionable suggestion
};

struct FailedItemDetail {
    std::string       id;
    std::string       name;
    SourceType        source;
    FailureDiagnostic diagnostic;
    std::string       output;
    int               exitCode = 0;
};

struct BatchUpgradeSummary {
    int                         successCount = 0;
    int                         failCount    = 0;
    int                         total        = 0;
    std::string                 snapshotId;
    std::vector<std::string>    successes;
    std::vector<FailedItemDetail> failures;
};

// Batch upgrade progress callback
using BatchProgressCallback = std::function<void(
    const UpgradeTarget& tgt,
    int current,
    int total,
    const UpgradeProgressDetail& phaseDetail
)>;

class UpdateManager {
public:
    explicit UpdateManager(RollbackManager& rollback);

    void registerProvider(std::shared_ptr<IPackageManager> provider);

    // Query updates across all registered & available package managers
    std::vector<PackageUpdateItem> checkAllUpdates();

    // Batch upgrade with snapshot creation, phase progress, and failure diagnostics
    BatchUpgradeSummary upgradeBatch(
        const std::vector<UpgradeTarget>& targets,
        BatchProgressCallback onProgress,
        LineCallback onLog,
        bool interactive = false);

    // Diagnose exit code and output text
    static FailureDiagnostic diagnoseFailure(int exitCode, const std::string& output);

    // Version pinning / ignore
    bool setPackagePinned(const std::string& packageId, bool pinned);
    bool isPackagePinned(const std::string& packageId) const;
    std::vector<std::string> getPinnedPackages() const;

private:
    RollbackManager&                              rollbackMgr_;
    std::vector<std::shared_ptr<IPackageManager>> providers_;
    std::unordered_set<std::string>               pinnedPackages_;
    std::filesystem::path                         pinnedConfigPath_;

    void loadPinnedPackages();
    void savePinnedPackages();
};

} // namespace lazyenv

#endif // LAZYENV_UPDATE_MANAGER_H
