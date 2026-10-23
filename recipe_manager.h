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

struct EnvironmentRecipe {
    std::string formatVersion = "1.0";
    RecipeMetadata metadata;
    RecipeMirrors mirrors;
    std::vector<RecipePackageItem> packages;
    std::vector<RecipeEnvVar> environmentVariables;
    std::vector<std::string> paths;
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
