// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#pragma once

#ifndef LAZYENV_PATH_DOCTOR_H
#define LAZYENV_PATH_DOCTOR_H

#include "rollback.h"
#include <string>
#include <vector>

namespace lazyenv {

// Diagnostic detail for a single path segment
struct PathEntryDiagnostic {
    std::string rawPath;
    std::string expandedPath;
    bool        isSystem;
    bool        exists;
    bool        isDuplicate;
    std::string issueDescription;
};

// Collision / Shadowing between identical command binaries
struct CommandConflictItem {
    std::string command;
    std::string activePath;
    std::string shadowedPath;
    std::string activeSource;   // "user" or "system"
    std::string shadowedSource; // "user" or "system"
    bool        isAliasHijack = false;
};

// Complete diagnostic report
struct PathDoctorReport {
    int healthScore      = 100; // 0 - 100
    int totalEntries     = 0;
    int validEntries     = 0;
    int deadEntries      = 0;
    int duplicateEntries = 0;
    int userPathLength   = 0;
    int systemPathLength = 0;
    std::vector<PathEntryDiagnostic> userEntries;
    std::vector<PathEntryDiagnostic> systemEntries;
    std::vector<CommandConflictItem> conflicts;
};

// Result of auto-clean execution
struct AutoCleanResult {
    bool        success                 = false;
    bool        userCleaned             = false;
    bool        systemCleaned           = false;
    bool        systemRequiresElevation = false;
    int         deadRemoved             = 0;
    int         dupRemoved              = 0;
    std::string snapshotId;
};

class PathDoctor {
public:
    // Check if current process has elevated administrator token
    static bool isProcessElevated();

    // Run full non-destructive diagnostic on User and System PATH
    static PathDoctorReport diagnose();

    // Auto-clean dead & duplicate entries with pre-clean snapshot protection and graceful UAC elevation fallback
    static AutoCleanResult autoClean(bool cleanUser, bool cleanSystem, RollbackManager& rollback);

    // Prioritize a path/directory to the front of User PATH
    static bool prioritizePath(const std::string& targetPath, RollbackManager& rollback, std::string& outSnapshotId);

    // Switch active version of a tool, atomically reordering PATH and cascading relevant env vars (e.g. JAVA_HOME, GOROOT)
    static bool switchActiveVersion(const std::string& toolType, const std::string& targetBinPath, RollbackManager& rollback, std::string& outSnapshotId);

    // Remove a directory from User PATH
    static bool removeFromPath(const std::string& targetPath, RollbackManager& rollback, std::string& outSnapshotId);

    // Reorder a path entry within User or System PATH ("up", "down", "top", "bottom")
    static bool reorderPath(const std::string& targetPath, const std::string& direction, bool isSystem, RollbackManager& rollback, std::string& outSnapshotId);

    // Add a directory to User or System PATH with snapshot protection
    static bool addPath(const std::string& targetPath, bool isSystem, RollbackManager& rollback, std::string& outSnapshotId);

    // Remove a directory from User or System PATH with snapshot protection
    static bool removePath(const std::string& targetPath, bool isSystem, RollbackManager& rollback, std::string& outSnapshotId);
};

} // namespace lazyenv

#endif // LAZYENV_PATH_DOCTOR_H
