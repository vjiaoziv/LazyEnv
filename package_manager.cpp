// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#include "package_manager.h"
#include <sstream>
#include <algorithm>
#include <format>
#include <cctype>
#include <Windows.h>

namespace lazyenv {

std::string sourceTypeToString(SourceType src) {
    switch (src) {
        case SourceType::Winget: return "winget";
        case SourceType::Scoop:  return "scoop";
        case SourceType::Npm:    return "npm";
        case SourceType::Pip:    return "pip";
        default:                 return "unknown";
    }
}

SourceType stringToSourceType(const std::string& str) {
    std::string s = str;
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (s == "scoop") return SourceType::Scoop;
    if (s == "npm")   return SourceType::Npm;
    if (s == "pip")   return SourceType::Pip;
    return SourceType::Winget;
}

namespace {

std::string trim(const std::string& s) {
    auto start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    auto end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

void parseAndDispatchPhase(const std::string& line, PhaseProgressCallback onPhase) {
    if (!onPhase) return;
    UpgradeProgressDetail d;

    // Check downloading patterns
    if (line.find("Downloading") != std::string::npos || line.find("正在下载") != std::string::npos ||
        line.find("fetch:") != std::string::npos || line.find("reify:") != std::string::npos) {
        d.phase = "downloading";
        d.message = "Downloading package...";

        // Extract percentage e.g. "45%"
        auto pPos = line.find('%');
        if (pPos != std::string::npos && pPos > 0) {
            size_t start = pPos;
            while (start > 0 && std::isdigit(static_cast<unsigned char>(line[start - 1]))) {
                --start;
            }
            if (start < pPos) {
                try {
                    d.percent = std::stoi(line.substr(start, pPos - start));
                } catch (...) {}
            }
        }

        // Extract detail e.g. "MB / MB"
        auto slash = line.find('/');
        if (slash != std::string::npos) {
            auto mbPos = line.find("MB", slash);
            if (mbPos != std::string::npos) {
                d.detail = trim(line.substr(0, mbPos + 2));
            }
        }
        onPhase(d);
        return;
    }

    // Check verifying patterns
    if (line.find("hash") != std::string::npos || line.find("哈希") != std::string::npos ||
        line.find("verifying") != std::string::npos || line.find("正在验证") != std::string::npos) {
        d.phase = "verifying";
        d.message = "Verifying package integrity...";
        onPhase(d);
        return;
    }

    // Check installing patterns
    if (line.find("Starting package install") != std::string::npos || line.find("正在启动") != std::string::npos ||
        line.find("Installing") != std::string::npos || line.find("Extracting") != std::string::npos ||
        line.find("Linking") != std::string::npos) {
        d.phase = "installing";
        d.message = "Installing package files...";
        onPhase(d);
        return;
    }

    // Check completed
    if (line.find("Successfully installed") != std::string::npos || line.find("成功安装") != std::string::npos ||
        line.find("added ") != std::string::npos) {
        d.phase = "completed";
        d.percent = 100;
        d.message = "Installation completed.";
        onPhase(d);
        return;
    }
}

// ---------------------------------------------------------------------------
// Winget Provider Implementation
// ---------------------------------------------------------------------------
class WingetProvider : public IPackageManager {
public:
    SourceType getSourceType() const override { return SourceType::Winget; }
    std::string getSourceName() const override { return "WinGet"; }

    bool isAvailable() override {
        return Installer::isWingetAvailable();
    }

    std::vector<PackageUpdateItem> checkUpdates() override {
        std::vector<PackageUpdateItem> items;
        if (!isAvailable()) return items;

        std::string output;
        std::string cmd = Installer::getWingetExecutable() +
                          " upgrade --include-unknown --accept-source-agreements --disable-interactivity 2>&1";
        Installer::runCommand(cmd, output, 15000);

        std::istringstream stream(output);
        std::string line;
        bool headerFound = false;

        while (std::getline(stream, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line.empty()) continue;

            if (line.find("---") != std::string::npos) {
                headerFound = true;
                continue;
            }
            if (!headerFound) continue;

            std::istringstream ls(line);
            std::vector<std::string> tokens;
            std::string t;
            while (ls >> t) tokens.push_back(t);

            if (tokens.size() >= 4) {
                size_t n = tokens.size();
                bool hasSource = (tokens[n - 1] == "winget" || tokens[n - 1] == "msstore");
                size_t availIdx = hasSource ? (n >= 2 ? n - 2 : 0) : n - 1;
                size_t verIdx   = availIdx > 0 ? availIdx - 1 : 0;
                size_t idIdx    = verIdx > 0 ? verIdx - 1 : 0;

                if (availIdx < n && verIdx < n && idIdx < n && idIdx > 0) {
                    PackageUpdateItem item;
                    item.source         = SourceType::Winget;
                    item.latestVersion  = tokens[availIdx];
                    item.currentVersion = tokens[verIdx];
                    item.id             = tokens[idIdx];

                    std::string name;
                    for (size_t i = 0; i < idIdx; ++i) {
                        if (!name.empty()) name += " ";
                        name += tokens[i];
                    }
                    item.name = name.empty() ? item.id : name;
                    items.push_back(item);
                }
            }
        }
        return items;
    }

    InstallResult upgrade(const std::string& packageId, LineCallback onOutput, PhaseProgressCallback onPhase, bool interactive) override {
        InstallResult result;
        result.packageId = packageId;

        if (onPhase) {
            UpgradeProgressDetail initD;
            initD.phase = "preparing";
            initD.percent = 0;
            initD.message = "Preparing WinGet installation for " + packageId + "...";
            onPhase(initD);
        }

        std::string modeFlag = interactive ? "--interactive" : "--silent";
        std::string cmd = std::format(
            "{} upgrade --id \"{}\" --exact {} --accept-package-agreements --accept-source-agreements",
            Installer::getWingetExecutable(), packageId, modeFlag);

        auto wrappedLog = [onOutput, onPhase](const std::string& line) {
            if (onOutput) onOutput(line);
            parseAndDispatchPhase(line, onPhase);
        };

        result.exitCode = Installer::runCommandStreaming(cmd, result.output, wrappedLog, 600000);
        result.status = (result.exitCode == 0) ? InstallStatus::Success : InstallStatus::Failed;

        if (onPhase) {
            UpgradeProgressDetail finalD;
            finalD.phase = (result.status == InstallStatus::Success) ? "completed" : "failed";
            finalD.percent = (result.status == InstallStatus::Success) ? 100 : -1;
            finalD.message = (result.status == InstallStatus::Success) ? "WinGet upgrade completed." : "WinGet upgrade failed.";
            onPhase(finalD);
        }

        return result;
    }
};

// ---------------------------------------------------------------------------
// Scoop Provider Implementation
// ---------------------------------------------------------------------------
class ScoopProvider : public IPackageManager {
public:
    static std::string getScoopExecutable() {
        if (Installer::isCommandAvailable("scoop")) return "scoop";
        wchar_t userProfile[MAX_PATH];
        if (GetEnvironmentVariableW(L"USERPROFILE", userProfile, MAX_PATH) > 0) {
            std::wstring scoopCmd = std::wstring(userProfile) + L"\\scoop\\shims\\scoop.cmd";
            DWORD attr = GetFileAttributesW(scoopCmd.c_str());
            if (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY)) {
                int len = WideCharToMultiByte(CP_UTF8, 0, scoopCmd.c_str(), -1, nullptr, 0, nullptr, nullptr);
                if (len > 0) {
                    std::string pathUtf8(len - 1, '\0');
                    WideCharToMultiByte(CP_UTF8, 0, scoopCmd.c_str(), -1, pathUtf8.data(), len, nullptr, nullptr);
                    return "\"" + pathUtf8 + "\"";
                }
            }
        }
        return "scoop";
    }

    SourceType getSourceType() const override { return SourceType::Scoop; }
    std::string getSourceName() const override { return "Scoop"; }

    bool isAvailable() override {
        if (Installer::isCommandAvailable("scoop")) return true;
        wchar_t userProfile[MAX_PATH];
        if (GetEnvironmentVariableW(L"USERPROFILE", userProfile, MAX_PATH) > 0) {
            std::wstring scoopCmd = std::wstring(userProfile) + L"\\scoop\\shims\\scoop.cmd";
            DWORD attr = GetFileAttributesW(scoopCmd.c_str());
            return (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY));
        }
        return false;
    }

    std::vector<PackageUpdateItem> checkUpdates() override {
        std::vector<PackageUpdateItem> items;
        if (!isAvailable()) return items;

        std::string output;
        std::string cmd = getScoopExecutable() + " status 2>&1";
        Installer::runCommand(cmd, output, 15000);

        std::istringstream stream(output);
        std::string line;
        bool inUpdateSection = false;

        while (std::getline(stream, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            line = trim(line);
            if (line.empty()) continue;

            if (line.find("Updates are available for") != std::string::npos ||
                line.find("These app(s) can be updated") != std::string::npos) {
                inUpdateSection = true;
                continue;
            }

            if (inUpdateSection) {
                auto colon = line.find(':');
                auto arrow = line.find("->");
                if (colon != std::string::npos && arrow != std::string::npos && arrow > colon) {
                    PackageUpdateItem item;
                    item.source = SourceType::Scoop;
                    item.id     = trim(line.substr(0, colon));
                    item.name   = item.id;
                    item.currentVersion = trim(line.substr(colon + 1, arrow - colon - 1));
                    item.latestVersion  = trim(line.substr(arrow + 2));
                    if (!item.id.empty()) {
                        items.push_back(item);
                    }
                }
            }
        }
        return items;
    }

    InstallResult upgrade(const std::string& packageId, LineCallback onOutput, PhaseProgressCallback onPhase, [[maybe_unused]] bool interactive) override {
        InstallResult result;
        result.packageId = packageId;

        if (onPhase) {
            UpgradeProgressDetail initD;
            initD.phase = "preparing";
            initD.message = "Preparing Scoop update for " + packageId + "...";
            onPhase(initD);
        }

        std::string cmd = getScoopExecutable() + " update \"" + packageId + "\"";
        auto wrappedLog = [onOutput, onPhase](const std::string& line) {
            if (onOutput) onOutput(line);
            parseAndDispatchPhase(line, onPhase);
        };

        result.exitCode = Installer::runCommandStreaming(cmd, result.output, wrappedLog, 300000);
        result.status = (result.exitCode == 0) ? InstallStatus::Success : InstallStatus::Failed;

        if (onPhase) {
            UpgradeProgressDetail finalD;
            finalD.phase = (result.status == InstallStatus::Success) ? "completed" : "failed";
            finalD.percent = (result.status == InstallStatus::Success) ? 100 : -1;
            finalD.message = (result.status == InstallStatus::Success) ? "Scoop update completed." : "Scoop update failed.";
            onPhase(finalD);
        }

        return result;
    }
};

// ---------------------------------------------------------------------------
// Npm Provider Implementation
// ---------------------------------------------------------------------------
class NpmProvider : public IPackageManager {
public:
    SourceType getSourceType() const override { return SourceType::Npm; }
    std::string getSourceName() const override { return "NPM (Global)"; }

    bool isAvailable() override {
        return Installer::isCommandAvailable("npm");
    }

    std::vector<PackageUpdateItem> checkUpdates() override {
        std::vector<PackageUpdateItem> items;
        if (!isAvailable()) return items;

        std::string output;
        Installer::runCommand("npm outdated -g --json 2>&1", output, 12000);

        auto jsonStart = output.find('{');
        auto jsonEnd   = output.rfind('}');
        if (jsonStart == std::string::npos || jsonEnd == std::string::npos || jsonEnd <= jsonStart)
            return items;

        std::string jsonStr = output.substr(jsonStart, jsonEnd - jsonStart + 1);

        size_t pos = 1;
        while (pos < jsonStr.size()) {
            auto q1 = jsonStr.find('\"', pos);
            if (q1 == std::string::npos) break;
            auto q2 = jsonStr.find('\"', q1 + 1);
            if (q2 == std::string::npos) break;
            std::string pkgName = jsonStr.substr(q1 + 1, q2 - q1 - 1);

            auto objOpen = jsonStr.find('{', q2 + 1);
            if (objOpen == std::string::npos) break;
            auto objClose = jsonStr.find('}', objOpen + 1);
            if (objClose == std::string::npos) break;

            std::string subObj = jsonStr.substr(objOpen, objClose - objOpen + 1);

            auto extractSub = [](const std::string& s, const std::string& k) -> std::string {
                std::string needle = "\"" + k + "\"";
                auto kp = s.find(needle);
                if (kp == std::string::npos) return "";
                auto v1 = s.find('\"', kp + needle.size() + 1);
                if (v1 == std::string::npos) return "";
                auto v2 = s.find('\"', v1 + 1);
                if (v2 == std::string::npos) return "";
                return s.substr(v1 + 1, v2 - v1 - 1);
            };

            std::string curVer    = extractSub(subObj, "current");
            std::string latestVer = extractSub(subObj, "latest");
            if (latestVer.empty()) latestVer = extractSub(subObj, "wanted");

            if (!pkgName.empty() && !latestVer.empty() && curVer != latestVer) {
                PackageUpdateItem item;
                item.id             = pkgName;
                item.name           = pkgName;
                item.currentVersion = curVer.empty() ? "installed" : curVer;
                item.latestVersion  = latestVer;
                item.source         = SourceType::Npm;
                items.push_back(item);
            }

            pos = objClose + 1;
        }

        return items;
    }

    InstallResult upgrade(const std::string& packageId, LineCallback onOutput, PhaseProgressCallback onPhase, [[maybe_unused]] bool interactive) override {
        InstallResult result;
        result.packageId = packageId;

        if (onPhase) {
            UpgradeProgressDetail initD;
            initD.phase = "downloading";
            initD.message = "Installing npm package " + packageId + "@latest...";
            onPhase(initD);
        }

        std::string cmd = "npm install -g \"" + packageId + "@latest\"";
        auto wrappedLog = [onOutput, onPhase](const std::string& line) {
            if (onOutput) onOutput(line);
            parseAndDispatchPhase(line, onPhase);
        };

        result.exitCode = Installer::runCommandStreaming(cmd, result.output, wrappedLog, 300000);
        result.status = (result.exitCode == 0) ? InstallStatus::Success : InstallStatus::Failed;

        if (onPhase) {
            UpgradeProgressDetail finalD;
            finalD.phase = (result.status == InstallStatus::Success) ? "completed" : "failed";
            finalD.percent = (result.status == InstallStatus::Success) ? 100 : -1;
            finalD.message = (result.status == InstallStatus::Success) ? "NPM package upgraded." : "NPM package upgrade failed.";
            onPhase(finalD);
        }

        return result;
    }
};

// ---------------------------------------------------------------------------
// Pip Provider Implementation
// ---------------------------------------------------------------------------
class PipProvider : public IPackageManager {
public:
    SourceType getSourceType() const override { return SourceType::Pip; }
    std::string getSourceName() const override { return "Pip"; }

    bool isAvailable() override {
        return Installer::isCommandAvailable("python") || Installer::isCommandAvailable("pip");
    }

    std::vector<PackageUpdateItem> checkUpdates() override {
        std::vector<PackageUpdateItem> items;
        if (!isAvailable()) return items;

        std::string output;
        std::string pipCmd = Installer::isCommandAvailable("python")
            ? "python -m pip list --outdated --format=json --timeout 8 2>&1"
            : "pip list --outdated --format=json --timeout 8 2>&1";
        Installer::runCommand(pipCmd, output, 12000);

        auto jsonStart = output.find('[');
        auto jsonEnd   = output.rfind(']');
        if (jsonStart == std::string::npos || jsonEnd == std::string::npos || jsonEnd <= jsonStart)
            return items;

        std::string arrStr = output.substr(jsonStart, jsonEnd - jsonStart + 1);

        size_t pos = 1;
        while (pos < arrStr.size()) {
            auto objOpen = arrStr.find('{', pos);
            if (objOpen == std::string::npos) break;
            auto objClose = arrStr.find('}', objOpen + 1);
            if (objClose == std::string::npos) break;

            std::string obj = arrStr.substr(objOpen, objClose - objOpen + 1);

            auto extractSub = [](const std::string& s, const std::string& k) -> std::string {
                std::string needle = "\"" + k + "\"";
                auto kp = s.find(needle);
                if (kp == std::string::npos) return "";
                auto v1 = s.find('\"', kp + needle.size() + 1);
                if (v1 == std::string::npos) return "";
                auto v2 = s.find('\"', v1 + 1);
                if (v2 == std::string::npos) return "";
                return s.substr(v1 + 1, v2 - v1 - 1);
            };

            std::string name   = extractSub(obj, "name");
            std::string curVer = extractSub(obj, "version");
            std::string latVer = extractSub(obj, "latest_version");

            if (!name.empty() && !latVer.empty() && curVer != latVer) {
                PackageUpdateItem item;
                item.id             = name;
                item.name           = name;
                item.currentVersion = curVer;
                item.latestVersion  = latVer;
                item.source         = SourceType::Pip;
                items.push_back(item);
            }

            pos = objClose + 1;
        }

        return items;
    }

    InstallResult upgrade(const std::string& packageId, LineCallback onOutput, PhaseProgressCallback onPhase, [[maybe_unused]] bool interactive) override {
        InstallResult result;
        result.packageId = packageId;

        if (onPhase) {
            UpgradeProgressDetail initD;
            initD.phase = "downloading";
            initD.message = "Upgrading pip package " + packageId + "...";
            onPhase(initD);
        }

        std::string cmd = Installer::isCommandAvailable("python")
            ? ("python -m pip install --upgrade \"" + packageId + "\"")
            : ("pip install --upgrade \"" + packageId + "\"");
        auto wrappedLog = [onOutput, onPhase](const std::string& line) {
            if (onOutput) onOutput(line);
            parseAndDispatchPhase(line, onPhase);
        };

        result.exitCode = Installer::runCommandStreaming(cmd, result.output, wrappedLog, 300000);
        result.status = (result.exitCode == 0) ? InstallStatus::Success : InstallStatus::Failed;

        if (onPhase) {
            UpgradeProgressDetail finalD;
            finalD.phase = (result.status == InstallStatus::Success) ? "completed" : "failed";
            finalD.percent = (result.status == InstallStatus::Success) ? 100 : -1;
            finalD.message = (result.status == InstallStatus::Success) ? "Pip package upgraded." : "Pip package upgrade failed.";
            onPhase(finalD);
        }

        return result;
    }
};

} // anonymous namespace

std::shared_ptr<IPackageManager> createWingetProvider() {
    return std::make_shared<WingetProvider>();
}

std::shared_ptr<IPackageManager> createScoopProvider() {
    return std::make_shared<ScoopProvider>();
}

std::shared_ptr<IPackageManager> createNpmProvider() {
    return std::make_shared<NpmProvider>();
}

std::shared_ptr<IPackageManager> createPipProvider() {
    return std::make_shared<PipProvider>();
}

} // namespace lazyenv
