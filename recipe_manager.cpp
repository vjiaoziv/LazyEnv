// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

#include "recipe_manager.h"
#include <fstream>
#include <sstream>
#include <format>
#include <algorithm>
#include <unordered_set>
#include <unordered_map>
#include <ctime>
#include <Windows.h>

namespace lazyenv {

namespace {

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 16);
    for (char c : s) {
        switch (c) {
            case '\"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned char>(c));
                    out += buf;
                } else {
                    out += c;
                }
                break;
        }
    }
    return out;
}

std::string extractJsonValue(const std::string& json, const std::string& key) {
    std::string needle = "\"" + key + "\"";
    auto pos = json.find(needle);
    if (pos == std::string::npos) return "";
    pos = json.find('\"', pos + needle.size() + 1);
    if (pos == std::string::npos) return "";
    ++pos;
    std::string result;
    for (; pos < json.size(); ++pos) {
        if (json[pos] == '\\' && pos + 1 < json.size()) {
            ++pos;
            switch (json[pos]) {
                case '\"': result += '\"'; break;
                case '\\': result += '\\'; break;
                case 'n':  result += '\n'; break;
                case 'r':  result += '\r'; break;
                case 't':  result += '\t'; break;
                default:   result += json[pos]; break;
            }
        } else if (json[pos] == '\"') {
            break;
        } else {
            result += json[pos];
        }
    }
    return result;
}

std::string getIsoTimestamp() {
    std::time_t now = std::time(nullptr);
    std::tm tmBuf{};
    gmtime_s(&tmBuf, &now);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tmBuf);
    return buf;
}

std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

} // anonymous namespace

std::string RecipeManager::serializeRecipeToJson(const EnvironmentRecipe& r) {
    std::ostringstream os;
    os << "{\n";
    os << "  \"formatVersion\": \"" << jsonEscape(r.formatVersion) << "\",\n";
    os << "  \"metadata\": {\n";
    os << "    \"name\": \"" << jsonEscape(r.metadata.name) << "\",\n";
    os << "    \"description\": \"" << jsonEscape(r.metadata.description) << "\",\n";
    os << "    \"author\": \"" << jsonEscape(r.metadata.author) << "\",\n";
    os << "    \"createdAt\": \"" << jsonEscape(r.metadata.createdAt) << "\",\n";
    os << "    \"lazyenvVersion\": \"" << jsonEscape(r.metadata.lazyenvVersion) << "\"\n";
    os << "  },\n";

    os << "  \"mirrors\": {\n";
    os << "    \"npm\": \"" << jsonEscape(r.mirrors.npm) << "\",\n";
    os << "    \"pip\": \"" << jsonEscape(r.mirrors.pip) << "\"\n";
    os << "  },\n";

    os << "  \"packages\": [\n";
    for (size_t i = 0; i < r.packages.size(); ++i) {
        const auto& p = r.packages[i];
        os << "    {\n";
        os << "      \"id\": \"" << jsonEscape(p.id) << "\",\n";
        os << "      \"name\": \"" << jsonEscape(p.name) << "\",\n";
        os << "      \"source\": \"" << jsonEscape(p.source) << "\",\n";
        os << "      \"version\": \"" << jsonEscape(p.version) << "\"\n";
        os << "    }" << (i + 1 < r.packages.size() ? "," : "") << "\n";
    }
    os << "  ],\n";

    os << "  \"environmentVariables\": [\n";
    for (size_t i = 0; i < r.environmentVariables.size(); ++i) {
        const auto& v = r.environmentVariables[i];
        os << "    {\n";
        os << "      \"name\": \"" << jsonEscape(v.name) << "\",\n";
        os << "      \"value\": \"" << jsonEscape(v.value) << "\",\n";
        os << "      \"type\": \"" << jsonEscape(v.type) << "\"\n";
        os << "    }" << (i + 1 < r.environmentVariables.size() ? "," : "") << "\n";
    }
    os << "  ],\n";

    os << "  \"paths\": [\n";
    for (size_t i = 0; i < r.paths.size(); ++i) {
        os << "    \"" << jsonEscape(r.paths[i]) << "\"" << (i + 1 < r.paths.size() ? "," : "") << "\n";
    }
    os << "  ]\n";
    os << "}\n";
    return os.str();
}

bool RecipeManager::parseRecipeFromJson(const std::string& json, EnvironmentRecipe& r) {
    if (json.empty()) return false;

    r.formatVersion           = extractJsonValue(json, "formatVersion");
    r.metadata.name           = extractJsonValue(json, "name");
    r.metadata.description    = extractJsonValue(json, "description");
    r.metadata.author         = extractJsonValue(json, "author");
    r.metadata.createdAt      = extractJsonValue(json, "createdAt");
    r.metadata.lazyenvVersion = extractJsonValue(json, "lazyenvVersion");

    r.mirrors.npm = extractJsonValue(json, "npm");
    r.mirrors.pip = extractJsonValue(json, "pip");

    // Parse packages
    auto pkgPos = json.find("\"packages\"");
    if (pkgPos != std::string::npos) {
        auto startArr = json.find('[', pkgPos);
        auto endArr   = json.find(']', startArr);
        if (startArr != std::string::npos && endArr != std::string::npos) {
            size_t pos = startArr + 1;
            while (pos < endArr) {
                auto oStart = json.find('{', pos);
                if (oStart == std::string::npos || oStart >= endArr) break;
                auto oEnd = json.find('}', oStart);
                if (oEnd == std::string::npos || oEnd > endArr) break;

                std::string itemJson = json.substr(oStart, oEnd - oStart + 1);
                RecipePackageItem item;
                item.id      = extractJsonValue(itemJson, "id");
                item.name    = extractJsonValue(itemJson, "name");
                item.source  = extractJsonValue(itemJson, "source");
                item.version = extractJsonValue(itemJson, "version");
                if (item.source.empty()) item.source = "winget";

                if (!item.id.empty()) {
                    r.packages.push_back(item);
                }
                pos = oEnd + 1;
            }
        }
    }

    // Parse environmentVariables
    auto envPos = json.find("\"environmentVariables\"");
    if (envPos != std::string::npos) {
        auto startArr = json.find('[', envPos);
        auto endArr   = json.find(']', startArr);
        if (startArr != std::string::npos && endArr != std::string::npos) {
            size_t pos = startArr + 1;
            while (pos < endArr) {
                auto oStart = json.find('{', pos);
                if (oStart == std::string::npos || oStart >= endArr) break;
                auto oEnd = json.find('}', oStart);
                if (oEnd == std::string::npos || oEnd > endArr) break;

                std::string itemJson = json.substr(oStart, oEnd - oStart + 1);
                RecipeEnvVar v;
                v.name  = extractJsonValue(itemJson, "name");
                v.value = extractJsonValue(itemJson, "value");
                v.type  = extractJsonValue(itemJson, "type");
                if (v.type.empty()) v.type = "REG_SZ";

                if (!v.name.empty()) {
                    r.environmentVariables.push_back(v);
                }
                pos = oEnd + 1;
            }
        }
    }

    return !r.metadata.name.empty() || !r.packages.empty();
}

bool RecipeManager::saveRecipeToFile(const std::string& filePath, const EnvironmentRecipe& recipe) {
    try {
        std::ofstream f(filePath, std::ios::trunc);
        if (!f.is_open()) return false;
        f << serializeRecipeToJson(recipe);
        return true;
    } catch (...) {
        return false;
    }
}

bool RecipeManager::loadRecipeFromFile(const std::string& filePath, EnvironmentRecipe& outRecipe) {
    try {
        std::ifstream f(filePath, std::ios::binary);
        if (!f.is_open()) return false;
        std::string json((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
        return parseRecipeFromJson(json, outRecipe);
    } catch (...) {
        return false;
    }
}

EnvironmentRecipe RecipeManager::createRecipeFromCurrentState(
    const std::string& name,
    const std::string& desc,
    const std::string& author,
    const std::vector<DetectedEnvItem>& detectedEnvs,
    const std::string& npmMirror,
    const std::string& pipMirror) {

    EnvironmentRecipe r;
    r.formatVersion           = "1.0";
    r.metadata.name           = name.empty() ? "My-Dev-Environment" : name;
    r.metadata.description    = desc.empty() ? "Exported from LazyEnv" : desc;
    r.metadata.author         = author.empty() ? "LazyEnv User" : author;
#ifndef LAZYENV_VERSION_STRING
#define LAZYENV_VERSION_STRING "0.8.4"
#endif

    r.metadata.createdAt      = getIsoTimestamp();
    r.metadata.lazyenvVersion = LAZYENV_VERSION_STRING;

    r.mirrors.npm = npmMirror;
    r.mirrors.pip = pipMirror;

    static const std::unordered_map<std::string, std::pair<std::string, std::string>> kKnownMap = {
        {"python",  {"Python.Python.3.12", "Python 3.12"}},
        {"python3", {"Python.Python.3.12", "Python 3.12"}},
        {"node",    {"OpenJS.NodeJS.LTS", "Node.js (LTS)"}},
        {"git",     {"Git.Git", "Git"}},
        {"cmake",   {"Kitware.CMake", "CMake"}},
        {"ninja",   {"Ninja-build.Ninja", "Ninja"}},
        {"rustc",   {"Rustlang.Rustup", "Rust (rustup)"}},
        {"cargo",   {"Rustlang.Rustup", "Rust (rustup)"}},
        {"java",    {"Oracle.JDK.21", "Java JDK 21"}},
        {"code",    {"Microsoft.VisualStudioCode", "VS Code"}},
        {"docker",  {"Docker.DockerDesktop", "Docker Desktop"}},
        {"jq",      {"jqlang.jq", "jq"}},
        {"rg",      {"BurntSushi.ripgrep.MSVC", "ripgrep"}},
        {"fd",      {"sharkdp.fd", "fd"}},
        {"fzf",     {"junegunn.fzf", "fzf"}},
        {"pwsh",    {"Microsoft.PowerShell", "PowerShell"}}
    };

    for (const auto& env : detectedEnvs) {
        std::string cmd = toLower(env.command);
        RecipePackageItem item;
        item.name    = env.name;
        item.version = "latest";

        auto it = kKnownMap.find(cmd);
        if (it != kKnownMap.end()) {
            item.id     = it->second.first;
            item.source = "winget";
        } else {
            item.id     = env.command;
            item.source = "winget";
        }

        r.packages.push_back(item);
    }

    return r;
}

RecipeDiffReport RecipeManager::analyzeRecipeDiff(
    const EnvironmentRecipe& r,
    const std::vector<DetectedEnvItem>& currentEnvs) {

    RecipeDiffReport report;
    report.recipeName = r.metadata.name;
    report.recipeDesc = r.metadata.description;
    report.author     = r.metadata.author;
    report.mirrors    = r.mirrors;
    report.varsToApply  = r.environmentVariables;
    report.pathsToApply = r.paths;

    std::unordered_set<std::string> installedCmds;
    std::unordered_set<std::string> installedNames;

    for (const auto& e : currentEnvs) {
        installedCmds.insert(toLower(e.command));
        installedNames.insert(toLower(e.name));
    }

    for (const auto& p : r.packages) {
        std::string idLow   = toLower(p.id);
        std::string nameLow = toLower(p.name);

        bool alreadyInstalled = false;

        // Check if command or name matches current installed environments
        for (const auto& cmd : installedCmds) {
            if (idLow.find(cmd) != std::string::npos || nameLow.find(cmd) != std::string::npos) {
                alreadyInstalled = true;
                break;
            }
        }
        if (!alreadyInstalled) {
            for (const auto& n : installedNames) {
                if (nameLow.find(n) != std::string::npos || n.find(nameLow) != std::string::npos) {
                    alreadyInstalled = true;
                    break;
                }
            }
        }

        if (alreadyInstalled) {
            report.installedPackages.push_back(p);
        } else {
            report.missingPackages.push_back(p);
        }
    }

    return report;
}

bool RecipeManager::deployRecipe(
    const RecipeDiffReport& diff,
    RollbackManager& rollback,
    LineCallback onLog,
    std::string& snapshotId) {

    // 1. Mandatory snapshot protection
    try {
        snapshotId = rollback.createSnapshot("Pre-deploy Recipe: " + diff.recipeName);
    } catch (...) {
        snapshotId = "";
    }

    if (onLog) onLog("[LazyEnv] Pre-deployment snapshot created: " + snapshotId);

    // 2. Apply Mirrors
    if (!diff.mirrors.npm.empty()) {
        if (onLog) onLog("[LazyEnv] Setting NPM mirror: " + diff.mirrors.npm);
        std::string out;
        Installer::runCommand("npm config set registry " + diff.mirrors.npm + " 2>&1", out, 8000);
    }
    if (!diff.mirrors.pip.empty()) {
        if (onLog) onLog("[LazyEnv] Setting Pip mirror: " + diff.mirrors.pip);
        std::string out;
        Installer::runCommand("python -m pip config set global.index-url " + diff.mirrors.pip + " 2>&1", out, 8000);
    }

    // 3. Install missing packages sequentially
    for (const auto& p : diff.missingPackages) {
        if (onLog) onLog("[LazyEnv] Installing missing package: " + p.name + " (" + p.source + ")...");
        std::string cmd;
        if (p.source == "npm") {
            cmd = "npm install -g \"" + p.id + "@latest\"";
        } else if (p.source == "pip") {
            cmd = "python -m pip install \"" + p.id + "\"";
        } else if (p.source == "scoop") {
            cmd = "scoop install \"" + p.id + "\"";
        } else {
            cmd = std::format("{} install --id \"{}\" --exact --silent --accept-package-agreements --accept-source-agreements",
                              Installer::getWingetExecutable(), p.id);
        }

        std::string fullOut;
        Installer::runCommandStreaming(cmd, fullOut, onLog, 600000);
    }

    // 4. Inject Environment Variables
    for (const auto& v : diff.varsToApply) {
        if (onLog) onLog("[LazyEnv] Setting environment variable: " + v.name);
        uint32_t type = (v.type == "REG_EXPAND_SZ") ? REG_EXPAND_SZ : REG_SZ;
        RollbackManager::writeEnvVariable(v.name, v.value, type, false);
    }

    // 5. Inject PATH additions
    for (const auto& pth : diff.pathsToApply) {
        if (onLog) onLog("[LazyEnv] Adding to PATH: " + pth);
        Installer::addToUserPath(pth);
    }

    RollbackManager::broadcastEnvironmentChange();
    if (onLog) onLog("[LazyEnv] Environment deployment finished! Broadcasted changes to system.");

    return true;
}

} // namespace lazyenv
