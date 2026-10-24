#include <filesystem>
// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#include "path_doctor.h"
#include <Windows.h>
#include <sstream>
#include <algorithm>
#include <unordered_set>
#include <unordered_map>
#include <cctype>

namespace lazyenv {

namespace {

std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return {};
    int len = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
    std::wstring ws(len, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), ws.data(), len);
    return ws;
}

std::string wideToUtf8(const std::wstring& ws) {
    if (ws.empty()) return {};
    int len = WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), nullptr, 0, nullptr, nullptr);
    std::string s(len, '\0');
    WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), s.data(), len, nullptr, nullptr);
    return s;
}

std::string toLower(std::string s) {
    for (auto& c : s) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    return s;
}

std::string trim(const std::string& s) {
    auto start = s.find_first_not_of(" \t\r\n\"");
    if (start == std::string::npos) return "";
    auto end = s.find_last_not_of(" \t\r\n\"");
    return s.substr(start, end - start + 1);
}

std::string normalizePath(const std::string& input) {
    std::string s = trim(input);
    for (auto& c : s) {
        if (c == '/') c = '\\';
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    while (!s.empty() && s.back() == '\\') {
        s.pop_back();
    }
    return s;
}

std::string expandPath(const std::string& input) {
    std::wstring wInput = utf8ToWide(input);
    DWORD reqLen = ExpandEnvironmentStringsW(wInput.c_str(), nullptr, 0);
    if (reqLen == 0) return input;
    std::wstring wOutput(reqLen, L'\0');
    ExpandEnvironmentStringsW(wInput.c_str(), wOutput.data(), reqLen);
    while (!wOutput.empty() && wOutput.back() == L'\0') {
        wOutput.pop_back();
    }
    return wideToUtf8(wOutput);
}

bool directoryExists(const std::string& path) {
    if (path.empty()) return false;
    std::wstring wPath = utf8ToWide(path);
    DWORD attr = GetFileAttributesW(wPath.c_str());
    return (attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY));
}

bool fileExists(const std::string& filePath) {
    if (filePath.empty()) return false;
    std::wstring wPath = utf8ToWide(filePath);
    DWORD attr = GetFileAttributesW(wPath.c_str());
    return (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY));
}

std::vector<std::string> splitPath(const std::string& raw) {
    std::vector<std::string> res;
    std::istringstream ss(raw);
    std::string item;
    while (std::getline(ss, item, ';')) {
        item = trim(item);
        if (!item.empty()) {
            res.push_back(item);
        }
    }
    return res;
}

} // anonymous namespace

bool PathDoctor::isProcessElevated() {
    BOOL fRet = FALSE;
    HANDLE hToken = NULL;
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hToken)) {
        TOKEN_ELEVATION Elevation;
        DWORD cbSize = sizeof(TOKEN_ELEVATION);
        if (GetTokenInformation(hToken, TokenElevation, &Elevation, sizeof(Elevation), &cbSize)) {
            fRet = Elevation.TokenIsElevated;
        }
    }
    if (hToken) {
        CloseHandle(hToken);
    }
    return fRet != FALSE;
}

PathDoctorReport PathDoctor::diagnose() {
    PathDoctorReport report;

    std::string userRawPath = RollbackManager::readEnvVariable("Path", false);
    std::string sysRawPath  = RollbackManager::readEnvVariable("Path", true);

    report.userPathLength   = static_cast<int>(userRawPath.size());
    report.systemPathLength = static_cast<int>(sysRawPath.size());

    auto userTokens = splitPath(userRawPath);
    auto sysTokens  = splitPath(sysRawPath);

    report.totalEntries = static_cast<int>(userTokens.size() + sysTokens.size());

    std::unordered_set<std::string> seenNormalizedPaths;

    auto processList = [&](const std::vector<std::string>& tokens, bool isSys, std::vector<PathEntryDiagnostic>& outList) {
        for (const auto& raw : tokens) {
            PathEntryDiagnostic diag;
            diag.rawPath      = raw;
            diag.isSystem     = isSys;
            diag.expandedPath = expandPath(raw);
            diag.exists       = directoryExists(diag.expandedPath);

            std::string norm = normalizePath(diag.expandedPath);
            diag.isDuplicate = (seenNormalizedPaths.find(norm) != seenNormalizedPaths.end());
            seenNormalizedPaths.insert(norm);

            if (!diag.exists) {
                diag.issueDescription = "Dead path: directory does not exist on disk.";
                report.deadEntries++;
            } else if (diag.isDuplicate) {
                diag.issueDescription = "Duplicate path: already included earlier in search hierarchy.";
                report.duplicateEntries++;
            } else {
                report.validEntries++;
            }

            outList.push_back(diag);
        }
    };

    // Windows searches System PATH first, then User PATH
    processList(sysTokens, true, report.systemEntries);
    processList(userTokens, false, report.userEntries);

    // Command Shadowing & Collision detection
    static const std::vector<std::string> kToolsToCheck = {
        "python.exe", "python3.exe", "node.exe", "git.exe", "cargo.exe", "rustc.exe",
        "go.exe", "java.exe", "javac.exe", "cmake.exe", "ninja.exe", "gcc.exe",
        "g++.exe", "clang.exe", "cl.exe", "docker.exe", "npm.cmd", "pnpm.cmd", "pip.exe"
    };

    struct DirRef {
        std::string dir;
        bool isSys;
    };
    std::vector<DirRef> orderedValidDirs;
    // System PATH directories come first in Windows command resolution
    for (const auto& e : report.systemEntries) {
        if (e.exists && !e.isDuplicate) orderedValidDirs.push_back({e.expandedPath, true});
    }
    for (const auto& e : report.userEntries) {
        if (e.exists && !e.isDuplicate) orderedValidDirs.push_back({e.expandedPath, false});
    }

    for (const auto& tool : kToolsToCheck) {
        std::string activeDir;
        bool activeIsSys = false;
        bool foundFirst = false;

        for (const auto& d : orderedValidDirs) {
            std::string fullCandidate = d.dir;
            if (!fullCandidate.empty() && fullCandidate.back() != '\\') fullCandidate += '\\';
            fullCandidate += tool;

            if (fileExists(fullCandidate)) {
                if (!foundFirst) {
                    foundFirst  = true;
                    activeDir   = fullCandidate;
                    activeIsSys = d.isSys;
                } else if (normalizePath(fullCandidate) != normalizePath(activeDir)) {
                    CommandConflictItem conflict;
                    conflict.command         = tool;
                    conflict.activePath      = activeDir;
                    conflict.shadowedPath    = fullCandidate;
                    conflict.activeSource    = activeIsSys ? "system" : "user";
                    conflict.shadowedSource  = d.isSys ? "system" : "user";
                    std::string actLow = toLower(activeDir);
                    std::string shadLow = toLower(fullCandidate);
                    if (actLow.find("microsoft\\windowsapps") != std::string::npos &&
                        shadLow.find("microsoft\\windowsapps") == std::string::npos) {
                        conflict.isAliasHijack = true;
                    }
                    report.conflicts.push_back(conflict);
                }
            }
        }
    }

    // Calculate Health Score smoothly (0 - 100)
    int score = 100;
    score -= (std::min)(40, report.deadEntries * 5);
    score -= (std::min)(20, report.duplicateEntries * 2);
    score -= (std::min)(20, static_cast<int>(report.conflicts.size()) * 4);

    int totalPathLength = report.userPathLength + report.systemPathLength;
    if (totalPathLength > 2048) score -= 5;
    if (totalPathLength > 4096) score -= 5;
    if (totalPathLength > 8192) score -= 10;
    if (score < 10 && (report.validEntries > 0)) score = 15;
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    report.healthScore = score;
    return report;
}

AutoCleanResult PathDoctor::autoClean(bool cleanUser, bool cleanSystem, RollbackManager& rollback) {
    AutoCleanResult result;

    std::string sysRaw  = RollbackManager::readEnvVariable("Path", true);
    std::string userRaw = RollbackManager::readEnvVariable("Path", false);

    auto sysTokens  = splitPath(sysRaw);
    auto userTokens = splitPath(userRaw);

    std::unordered_set<std::string> seenSystemPaths;
    std::string newSysPath;
    int sysDead = 0;
    int sysDup  = 0;

    // 1. Deduplicate & validate System PATH
    for (const auto& token : sysTokens) {
        std::string exp = expandPath(token);
        if (!directoryExists(exp)) {
            sysDead++;
        } else {
            std::string norm = normalizePath(exp);
            if (seenSystemPaths.find(norm) == seenSystemPaths.end()) {
                seenSystemPaths.insert(norm);
                if (!newSysPath.empty() && newSysPath.back() != ';') newSysPath += ';';
                newSysPath += token;
            } else {
                sysDup++;
            }
        }
    }

    // 2. Deduplicate User PATH against System PATH baseline (Cross-scope deduplication)
    // Any directory already present in System PATH is redundant in User PATH!
    std::unordered_set<std::string> seenUserPaths = seenSystemPaths;
    std::string newUserPath;
    int userDead = 0;
    int userDup  = 0;

    for (const auto& token : userTokens) {
        std::string exp = expandPath(token);
        if (!directoryExists(exp)) {
            userDead++;
        } else {
            std::string norm = normalizePath(exp);
            if (seenUserPaths.find(norm) == seenUserPaths.end()) {
                seenUserPaths.insert(norm);
                if (!newUserPath.empty() && newUserPath.back() != ';') newUserPath += ';';
                newUserPath += token;
            } else {
                userDup++;
            }
        }
    }

    bool sysChanged  = (newSysPath != sysRaw);
    bool userChanged = (newUserPath != userRaw);

    // If nothing needs cleaning, return early without creating empty snapshots
    if (!sysChanged && !userChanged) {
        result.success = true;
        result.userCleaned = false;
        result.systemCleaned = false;
        result.deadRemoved = 0;
        result.dupRemoved = 0;
        return result;
    }

    // Mandatory snapshot protection before modifying PATH
    try {
        result.snapshotId = rollback.createSnapshot("PATH Doctor: Auto-clean dead & duplicate entries");
    } catch (...) {
        result.snapshotId = "";
    }

    if (cleanSystem && sysChanged) {
        if (!isProcessElevated()) {
            result.systemRequiresElevation = true;
            result.systemCleaned = false;
        } else {
            result.systemCleaned = RollbackManager::writeEnvVariable("Path", newSysPath, REG_EXPAND_SZ, true);
            if (result.systemCleaned) {
                result.deadRemoved += sysDead;
                result.dupRemoved  += sysDup;
            } else {
                result.systemRequiresElevation = true;
            }
        }
    }

    if (cleanUser && userChanged) {
        result.userCleaned = RollbackManager::writeEnvVariable("Path", newUserPath, REG_EXPAND_SZ, false);
        if (result.userCleaned) {
            result.deadRemoved += userDead;
            result.dupRemoved  += userDup;
        }
    }

    result.success = (userChanged ? result.userCleaned : true) &&
                     ((cleanSystem && sysChanged) ? result.systemCleaned : true);

    if (result.userCleaned || result.systemCleaned) {
        RollbackManager::broadcastEnvironmentChange();
    }

    return result;
}

static std::string getDirectoryPart(const std::string& path) {
    std::filesystem::path p(utf8ToWide(path));
    if (std::filesystem::is_directory(p)) {
        return path;
    }
    return wideToUtf8(p.parent_path().wstring());
}

bool PathDoctor::prioritizePath(const std::string& targetPath, RollbackManager& rollback, std::string& outSnapshotId) {
    std::string dir = getDirectoryPart(targetPath);
    if (dir.empty()) return false;

    try {
        outSnapshotId = rollback.createSnapshot("PATH Doctor: Prioritize " + dir);
    } catch (...) {
        outSnapshotId = "";
    }

    std::string raw = RollbackManager::readEnvVariable("Path", false);
    auto tokens = splitPath(raw);
    std::string normTarget = normalizePath(expandPath(dir));

    std::vector<std::string> newTokens;
    newTokens.push_back(dir);

    for (const auto& tok : tokens) {
        if (normalizePath(expandPath(tok)) != normTarget) {
            newTokens.push_back(tok);
        }
    }

    std::string newPath;
    for (size_t i = 0; i < newTokens.size(); ++i) {
        if (i > 0) newPath += ';';
        newPath += newTokens[i];
    }

    bool ok = RollbackManager::writeEnvVariable("Path", newPath, REG_EXPAND_SZ, false);
    if (ok) {
        RollbackManager::broadcastEnvironmentChange();
    }
    return ok;
}

bool PathDoctor::switchActiveVersion(
    const std::string& toolType,
    const std::string& targetBinPath,
    RollbackManager& rollback,
    std::string& outSnapshotId)
{
    std::string dir = getDirectoryPart(targetBinPath);
    if (dir.empty()) return false;

    std::string label = toolType.empty() ? "Environment" : toolType;
    try {
        outSnapshotId = rollback.createSnapshot("LazyEnv Switch: " + label + " -> " + dir);
    } catch (...) {
        outSnapshotId = "";
    }

    // 1. Move target directory to the very front of User PATH
    std::string raw = RollbackManager::readEnvVariable("Path", false);
    auto tokens = splitPath(raw);
    std::string normTarget = normalizePath(expandPath(dir));

    std::vector<std::string> newTokens;
    newTokens.push_back(dir);

    for (const auto& tok : tokens) {
        if (normalizePath(expandPath(tok)) != normTarget) {
            newTokens.push_back(tok);
        }
    }

    std::string newPath;
    for (size_t i = 0; i < newTokens.size(); ++i) {
        if (i > 0) newPath += ';';
        newPath += newTokens[i];
    }
    bool ok = RollbackManager::writeEnvVariable("Path", newPath, REG_EXPAND_SZ, false);

    // 2. Cascading environment variable updates
    std::string lowTool = toLower(toolType);
    std::string lowPath = toLower(targetBinPath);

    // Cascading JAVA_HOME for Java
    if (lowTool == "java" || lowTool == "jdk" || lowPath.find("java.exe") != std::string::npos || lowPath.find("jdk") != std::string::npos) {
        std::filesystem::path p(expandPath(dir));
        if (toLower(p.filename().string()) == "bin") {
            std::string javaHome = p.parent_path().string();
            if (!javaHome.empty()) {
                RollbackManager::writeEnvVariable("JAVA_HOME", javaHome, REG_SZ, false);
            }
        }
    }
    // Cascading GOROOT for Go
    else if (lowTool == "go" || lowPath.find("go.exe") != std::string::npos || lowPath.find("go\\bin") != std::string::npos) {
        std::filesystem::path p(expandPath(dir));
        if (toLower(p.filename().string()) == "bin") {
            std::string goRoot = p.parent_path().string();
            if (!goRoot.empty()) {
                RollbackManager::writeEnvVariable("GOROOT", goRoot, REG_SZ, false);
            }
        }
    }

    if (ok) {
        RollbackManager::broadcastEnvironmentChange();
    }
    return ok;
}

bool PathDoctor::removeFromPath(const std::string& targetPath, RollbackManager& rollback, std::string& outSnapshotId) {
    std::string dir = getDirectoryPart(targetPath);
    if (dir.empty()) return false;

    try {
        outSnapshotId = rollback.createSnapshot("PATH Doctor: Remove " + dir);
    } catch (...) {
        outSnapshotId = "";
    }

    std::string raw = RollbackManager::readEnvVariable("Path", false);
    auto tokens = splitPath(raw);
    std::string normTarget = normalizePath(expandPath(dir));

    std::string newPath;
    for (const auto& tok : tokens) {
        if (normalizePath(expandPath(tok)) != normTarget) {
            if (!newPath.empty() && newPath.back() != ';') newPath += ';';
            newPath += tok;
        }
    }

    bool ok = RollbackManager::writeEnvVariable("Path", newPath, REG_EXPAND_SZ, false);
    if (ok) {
        RollbackManager::broadcastEnvironmentChange();
    }
    return ok;
}

} // namespace lazyenv
