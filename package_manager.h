// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#pragma once

#ifndef LAZYENV_PACKAGE_MANAGER_H
#define LAZYENV_PACKAGE_MANAGER_H

#include "installer.h"
#include <string>
#include <vector>
#include <memory>
#include <functional>

namespace lazyenv {

// Package manager source type
enum class SourceType {
    Winget,
    Scoop,
    Npm,
    Pip
};

std::string sourceTypeToString(SourceType src);
SourceType stringToSourceType(const std::string& str);

// Unified update item
struct PackageUpdateItem {
    std::string id;             // Unique package identifier
    std::string name;           // Display name
    std::string currentVersion; // Currently installed version
    std::string latestVersion;  // Available update version
    SourceType  source;         // Package manager source
    bool        isPinned = false;
};

// Sub-phase progress information
struct UpgradeProgressDetail {
    std::string phase = "preparing"; // "preparing", "downloading", "verifying", "installing", "completed", "failed"
    int         percent = -1;        // 0-100, or -1 if indeterminate
    std::string detail;              // e.g. "12.5 MB / 28.0 MB"
    std::string message;             // e.g. "Downloading package..."
};

using PhaseProgressCallback = std::function<void(const UpgradeProgressDetail& progress)>;

// Abstract package manager Provider interface
class IPackageManager {
public:
    virtual ~IPackageManager() = default;
    virtual SourceType getSourceType() const = 0;
    virtual std::string getSourceName() const = 0;
    virtual bool isAvailable() = 0;

    // Query available updates from this provider
    virtual std::vector<PackageUpdateItem> checkUpdates() = 0;

    // Execute package upgrade with line output and sub-phase callback
    virtual InstallResult upgrade(
        const std::string& packageId,
        LineCallback onOutput,
        PhaseProgressCallback onPhase,
        bool interactive = false) = 0;
};

// Provider factory functions
std::shared_ptr<IPackageManager> createWingetProvider();
std::shared_ptr<IPackageManager> createScoopProvider();
std::shared_ptr<IPackageManager> createNpmProvider();
std::shared_ptr<IPackageManager> createPipProvider();

} // namespace lazyenv

#endif // LAZYENV_PACKAGE_MANAGER_H
