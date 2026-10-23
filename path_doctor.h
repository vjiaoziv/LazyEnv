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
};

// Complete diagnostic report
struct PathDoctorReport {
    int healthScore      = 100; // 0 - 100
    int totalEntries     = 0;
    int validEntries     = 0;
    int deadEntries      = 0;
    int duplicateEntries = 0;
    std::vector<PathEntryDiagnostic> userEntries;
    std::vector<PathEntryDiagnostic> systemEntries;
    std::vector<CommandConflictItem> conflicts;
};

class PathDoctor {
public:
    // Run full non-destructive diagnostic on User and System PATH
    static PathDoctorReport diagnose();

    // Auto-clean dead & duplicate entries with pre-clean snapshot protection
    static bool autoClean(bool cleanUser, bool cleanSystem, RollbackManager& rollback, std::string& snapshotId);
};

} // namespace lazyenv

#endif // LAZYENV_PATH_DOCTOR_H
