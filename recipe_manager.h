// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#pragma once

#ifndef LAZYENV_RECIPE_MANAGER_H
#define LAZYENV_RECIPE_MANAGER_H

#include "package_manager.h"
#include "rollback.h"
#include "installer.h"
#include <string>
#include <vector>

namespace lazyenv {

struct RecipePackageItem {
    std::string id;
    std::string name;
    std::string source; // "winget", "scoop", "npm", "pip"
    std::string version;
};

struct RecipeEnvVar {
    std::string name;
    std::string value;
    std::string type; // "REG_SZ", "REG_EXPAND_SZ"
};

struct RecipeMetadata {
    std::string name;
    std::string description;
    std::string author;
    std::string createdAt;
    std::string lazyenvVersion;
};

struct RecipeMirrors {
    std::string npm;
    std::string pip;
};

struct RecipeConfigFile {
    std::string category;       // "git", "npm", "pip", "ide", "agent", "cargo"
    std::string name;           // Display name e.g. "Git Config (.gitconfig)"
    std::string relativePath;   // Relative to targetDirMacro, e.g. ".gitconfig", "pip/pip.ini", "Code/User/settings.json"
    std::string targetDirMacro; // "%USERPROFILE%" or "%APPDATA%"
    std::string content;        // text content
    bool        isBase64 = false;
};

struct RecipeIdeExtension {
    std::string ide;            // "vscode", "cursor"
    std::string extensionId;    // e.g. "ms-python.python"
    std::string displayName;    // optional
};

struct EnvironmentRecipe {
    std::string formatVersion = "2.0";
    RecipeMetadata metadata;
    RecipeMirrors mirrors;
    std::vector<RecipePackageItem> packages;
    std::vector<RecipeEnvVar> environmentVariables;
    std::vector<std::string> paths;
    std::vector<RecipeConfigFile> configFiles;          // v2.0
    std::vector<RecipeIdeExtension> ideExtensions;      // v2.0
};

struct RecipeDiffReport {
    std::string recipeName;
    std::string recipeDesc;
    std::string author;
    RecipeMirrors mirrors;
    std::vector<RecipePackageItem> installedPackages; // Already present, will skip
    std::vector<RecipePackageItem> missingPackages;   // Need to install
    std::vector<RecipeEnvVar>      varsToApply;
    std::vector<std::string>       pathsToApply;
    std::vector<RecipeConfigFile>  configsToApply;    // v2.0
    std::vector<RecipeIdeExtension> extensionsToApply;// v2.0
};

class RecipeManager {
public:
    static std::string serializeRecipeToJson(const EnvironmentRecipe& recipe);
    static bool parseRecipeFromJson(const std::string& jsonStr, EnvironmentRecipe& outRecipe);

    static bool saveRecipeToFile(const std::string& filePath, const EnvironmentRecipe& recipe);
    static bool loadRecipeFromFile(const std::string& filePath, EnvironmentRecipe& outRecipe);

    static EnvironmentRecipe createRecipeFromCurrentState(
        const std::string& name,
        const std::string& desc,
        const std::string& author,
        const std::vector<DetectedEnvItem>& detectedEnvs,
        const std::string& npmMirror,
        const std::string& pipMirror);

    // v2.0: Discover current machine's configuration files (dotfiles, IDE, Agent)
    static std::vector<RecipeConfigFile> discoverCurrentConfigFiles();

    // v2.0: Discover installed IDE extensions (VS Code, Cursor)
    static std::vector<RecipeIdeExtension> discoverIdeExtensions();

    // v2.0: Create complete 4-in-1 migration recipe
    static EnvironmentRecipe createMigrationRecipe(
        const std::string& name,
        const std::string& desc,
        const std::string& author,
        const std::vector<DetectedEnvItem>& detectedEnvs,
        const std::string& npmMirror,
        const std::string& pipMirror,
        bool includePackages,
        bool includeEnvVars,
        bool includeConfigs,
        bool includeIdeExtensions);

    // v2.0: Restore configuration files with safety backup of existing files into snapshot folder
    static bool restoreConfigFiles(
        const std::vector<RecipeConfigFile>& configs,
        const std::string& backupDir,
        LineCallback onLog);

    static RecipeDiffReport analyzeRecipeDiff(
        const EnvironmentRecipe& recipe,
        const std::vector<DetectedEnvItem>& currentEnvs);

    static bool deployRecipe(
        const RecipeDiffReport& diff,
        RollbackManager& rollback,
        LineCallback onLog,
        std::string& snapshotId);
};

} // namespace lazyenv

#endif // LAZYENV_RECIPE_MANAGER_H
