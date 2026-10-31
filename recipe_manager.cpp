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

#include <ShlObj.h>



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



static const std::unordered_map<std::string, std::vector<std::string>> kPackageToCmds = {

    {"Microsoft.VisualStudioCode", {"code"}},

    {"Rustlang.Rustup",            {"rustup", "rustc", "cargo"}},

    {"Neovim.Neovim",              {"nvim"}},

    {"Python.Python.3.12",         {"python", "python3"}},

    {"OpenJS.NodeJS.LTS",          {"node"}},

    {"GoLang.Go",                  {"go"}},

    {"Oracle.JDK.21",              {"java", "javac"}},

    {"Kitware.CMake",              {"cmake"}},

    {"Ninja-build.Ninja",          {"ninja"}},

    {"LLVM.LLVM",                  {"clang", "clang++", "llvm"}},

    {"Git.Git",                    {"git"}},

    {"GitHub.cli",                 {"gh"}},

    {"Docker.DockerDesktop",       {"docker"}},

    {"PostgreSQL.PostgreSQL.16",   {"psql", "postgres"}},

    {"Redis.Redis",                {"redis-cli", "redis-server"}},

    {"jqlang.jq",                  {"jq"}},

    {"BurntSushi.ripgrep.MSVC",    {"rg", "ripgrep"}},

    {"sharkdp.fd",                 {"fd"}},

    {"junegunn.fzf",               {"fzf"}},

    {"WinSCP.WinSCP",              {"winscp"}},

    {"astral-sh.uv",               {"uv"}},

    {"Schniz.fnm",                 {"fnm"}},

    {"version-fox.vfox",           {"vfox"}},

    {"jdx.mise",                   {"mise"}},

    {"Microsoft.WindowsTerminal",  {"wt"}},

    {"Microsoft.PowerShell",       {"pwsh"}},

    {"Starship.Starship",          {"starship"}},

    {"ajeetdsouza.zoxide",         {"zoxide"}},

    {"sharkdp.bat",                {"bat"}},

    {"eza-community.eza",          {"eza"}},

    {"7zip.7zip",                  {"7z"}},

    {"Kubernetes.kubectl",         {"kubectl"}},

    {"Helm.Helm",                  {"helm"}},

    {"Hashicorp.Terraform",        {"terraform"}},

    {"DBeaver.DBeaver.Community",  {"dbeaver"}},

    {"Postman.Postman",            {"postman"}}

};




static size_t findMatchingJsonArrayEnd(const std::string& str, size_t openBracketPos) {
    if (openBracketPos >= str.size() || str[openBracketPos] != '[') return std::string::npos;
    bool inStr = false;
    int depth = 0;
    for (size_t i = openBracketPos; i < str.size(); ++i) {
        char c = str[i];
        if (inStr) {
            if (c == '\\' && i + 1 < str.size()) {
                ++i;
            } else if (c == '"') {
                inStr = false;
            }
        } else {
            if (c == '"') {
                inStr = true;
            } else if (c == '[') {
                depth++;
            } else if (c == ']') {
                depth--;
                if (depth == 0) return i;
            }
        }
    }
    return std::string::npos;
}

static std::string wideToUtf8(const std::wstring& ws) {
    if (ws.empty()) return {};
    int len = WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), nullptr, 0, nullptr, nullptr);
    std::string s(len, '\0');
    WideCharToMultiByte(CP_UTF8, 0, ws.data(), static_cast<int>(ws.size()), s.data(), len, nullptr, nullptr);
    return s;
}

// Match end of JSON object '{' ... '}' taking strings and escapes into account

static size_t findMatchingJsonObjectEnd(const std::string& str, size_t openBracePos) {

    if (openBracePos >= str.size() || str[openBracePos] != '{') return std::string::npos;

    bool inStr = false;

    int depth = 0;

    for (size_t i = openBracePos; i < str.size(); ++i) {

        char c = str[i];

        if (inStr) {

            if (c == '\\' && i + 1 < str.size()) {

                ++i;

            } else if (c == '\"') {

                inStr = false;

            }

        } else {

            if (c == '\"') {

                inStr = true;

            } else if (c == '{') {

                depth++;

            } else if (c == '}') {

                depth--;

                if (depth == 0) return i;

            }

        }

    }

    return std::string::npos;

}



static std::wstring getUserProfileDir() {

    wchar_t buf[MAX_PATH];

    DWORD len = GetEnvironmentVariableW(L"USERPROFILE", buf, MAX_PATH);

    if (len > 0 && len < MAX_PATH) return std::wstring(buf, len);

    wchar_t* p = nullptr;

    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_Profile, 0, nullptr, &p))) {

        std::wstring ws(p);

        CoTaskMemFree(p);

        return ws;

    }

    return L"C:\\Users\\Default";

}



static std::wstring getAppDataDir() {

    wchar_t buf[MAX_PATH];

    DWORD len = GetEnvironmentVariableW(L"APPDATA", buf, MAX_PATH);

    if (len > 0 && len < MAX_PATH) return std::wstring(buf, len);

    wchar_t* p = nullptr;

    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, nullptr, &p))) {

        std::wstring ws(p);

        CoTaskMemFree(p);

        return ws;

    }

    return getUserProfileDir() + L"\\AppData\\Roaming";

}



static std::wstring utf8ToWide(const std::string& s) {

    if (s.empty()) return {};

    int len = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);

    std::wstring ws; ws.resize(len);

    MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), ws.data(), len);

    return ws;

}



static std::string readFileUtf8(const std::filesystem::path& p, size_t maxBytes = 2 * 1024 * 1024) {

    std::error_code ec;

    if (!std::filesystem::exists(p, ec) || !std::filesystem::is_regular_file(p, ec)) return "";

    auto sz = std::filesystem::file_size(p, ec);

    if (ec || sz == 0 || sz > maxBytes) return "";

    std::ifstream ifs(p, std::ios::binary);

    if (!ifs.is_open()) return "";

    std::string s(static_cast<size_t>(sz), '\0');

    ifs.read(s.data(), sz);

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

    os << "  ],\n";



    os << "  \"configFiles\": [\n";

    for (size_t i = 0; i < r.configFiles.size(); ++i) {

        const auto& c = r.configFiles[i];

        os << "    {\n";

        os << "      \"category\": \"" << jsonEscape(c.category) << "\",\n";

        os << "      \"name\": \"" << jsonEscape(c.name) << "\",\n";

        os << "      \"relativePath\": \"" << jsonEscape(c.relativePath) << "\",\n";

        os << "      \"targetDirMacro\": \"" << jsonEscape(c.targetDirMacro) << "\",\n";

        os << "      \"content\": \"" << jsonEscape(c.content) << "\",\n";

        os << "      \"isBase64\": " << (c.isBase64 ? "true" : "false") << "\n";

        os << "    }" << (i + 1 < r.configFiles.size() ? "," : "") << "\n";

    }

    os << "  ],\n";



    os << "  \"ideExtensions\": [\n";

    for (size_t i = 0; i < r.ideExtensions.size(); ++i) {

        const auto& ext = r.ideExtensions[i];

        os << "    {\n";

        os << "      \"ide\": \"" << jsonEscape(ext.ide) << "\",\n";

        os << "      \"extensionId\": \"" << jsonEscape(ext.extensionId) << "\",\n";

        os << "      \"displayName\": \"" << jsonEscape(ext.displayName) << "\"\n";

        os << "    }" << (i + 1 < r.ideExtensions.size() ? "," : "") << "\n";

    }

    os << "  ]\n";

    os << "}\n";

    return os.str();

}



bool RecipeManager::parseRecipeFromJson(const std::string& json, EnvironmentRecipe& r) {

    if (json.empty()) return false;



    r.formatVersion = extractJsonValue(json, "formatVersion");

    if (r.formatVersion.empty()) r.formatVersion = "1.0";



    // Scope isolation: extract from "metadata" block to prevent collision with packages

    std::string metaBlock = json;

    auto metaPos = json.find("\"metadata\"");

    if (metaPos != std::string::npos) {

        auto mOpen = json.find('{', metaPos);

        if (mOpen != std::string::npos) {

            auto mClose = json.find('}', mOpen);

            if (mClose != std::string::npos) {

                metaBlock = json.substr(mOpen, mClose - mOpen + 1);

            }

        }

    }

    r.metadata.name           = extractJsonValue(metaBlock, "name");

    r.metadata.description    = extractJsonValue(metaBlock, "description");

    r.metadata.author         = extractJsonValue(metaBlock, "author");

    r.metadata.createdAt      = extractJsonValue(metaBlock, "createdAt");

    r.metadata.lazyenvVersion = extractJsonValue(metaBlock, "lazyenvVersion");



    // Scope isolation: extract from "mirrors" block

    std::string mirrorBlock = json;

    auto mirPos = json.find("\"mirrors\"");

    if (mirPos != std::string::npos) {

        auto mirOpen = json.find('{', mirPos);

        if (mirOpen != std::string::npos) {

            auto mirClose = json.find('}', mirOpen);

            if (mirClose != std::string::npos) {

                mirrorBlock = json.substr(mirOpen, mirClose - mirOpen + 1);

            }

        }

    }

    r.mirrors.npm = extractJsonValue(mirrorBlock, "npm");

    r.mirrors.pip = extractJsonValue(mirrorBlock, "pip");



    // Parse packages
    auto pkgPos = json.find("\"packages\"");
    if (pkgPos != std::string::npos) {
        auto startArr = json.find('[', pkgPos);
        if (startArr != std::string::npos) {
            auto endArr = findMatchingJsonArrayEnd(json, startArr);
            if (endArr != std::string::npos) {
                size_t pos = startArr + 1;
                while (pos < endArr) {
                    auto oStart = json.find('{', pos);
                    if (oStart == std::string::npos || oStart >= endArr) break;
                    auto oEnd = findMatchingJsonObjectEnd(json, oStart);
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
    }

    // Parse environmentVariables
    auto envPos = json.find("\"environmentVariables\"");
    if (envPos != std::string::npos) {
        auto startArr = json.find('[', envPos);
        if (startArr != std::string::npos) {
            auto endArr = findMatchingJsonArrayEnd(json, startArr);
            if (endArr != std::string::npos) {
                size_t pos = startArr + 1;
                while (pos < endArr) {
                    auto oStart = json.find('{', pos);
                    if (oStart == std::string::npos || oStart >= endArr) break;
                    auto oEnd = findMatchingJsonObjectEnd(json, oStart);
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
    }

    // Parse paths
    auto pathPos = json.find("\"paths\"");
    if (pathPos != std::string::npos) {
        auto startArr = json.find('[', pathPos);
        if (startArr != std::string::npos) {
            auto endArr = findMatchingJsonArrayEnd(json, startArr);
            if (endArr != std::string::npos) {
                size_t pos = startArr + 1;
                while (pos < endArr) {
                    auto q1 = json.find('"', pos);
                    if (q1 == std::string::npos || q1 >= endArr) break;
                    auto q2 = json.find('"', q1 + 1);
                    if (q2 == std::string::npos || q2 > endArr) break;
                    std::string p = json.substr(q1 + 1, q2 - q1 - 1);
                    if (!p.empty()) r.paths.push_back(p);
                    pos = q2 + 1;
                }
            }
        }
    }

    // Parse configFiles (v2.0)
    auto cfgPos = json.find("\"configFiles\"");
    if (cfgPos != std::string::npos) {
        auto startArr = json.find('[', cfgPos);
        if (startArr != std::string::npos) {
            auto endArr = findMatchingJsonArrayEnd(json, startArr);
            if (endArr != std::string::npos) {
                size_t pos = startArr + 1;
                while (pos < endArr) {
                    auto oStart = json.find('{', pos);
                    if (oStart == std::string::npos || oStart >= endArr) break;
                    auto oEnd = findMatchingJsonObjectEnd(json, oStart);
                    if (oEnd == std::string::npos || oEnd > endArr) break;

                    std::string itemJson = json.substr(oStart, oEnd - oStart + 1);
                    RecipeConfigFile cfg;
                    cfg.category       = extractJsonValue(itemJson, "category");
                    cfg.name           = extractJsonValue(itemJson, "name");
                    cfg.relativePath   = extractJsonValue(itemJson, "relativePath");
                    cfg.targetDirMacro = extractJsonValue(itemJson, "targetDirMacro");
                    cfg.content        = extractJsonValue(itemJson, "content");
                    std::string b64Str = extractJsonValue(itemJson, "isBase64");
                    cfg.isBase64       = (b64Str == "true" || itemJson.find("\"isBase64\": true") != std::string::npos);

                    if (!cfg.relativePath.empty()) {
                        r.configFiles.push_back(cfg);
                    }
                    pos = oEnd + 1;
                }
            }
        }
    }

    // Parse ideExtensions (v2.0)
    auto extPos = json.find("\"ideExtensions\"");
    if (extPos != std::string::npos) {
        auto startArr = json.find('[', extPos);
        if (startArr != std::string::npos) {
            auto endArr = findMatchingJsonArrayEnd(json, startArr);
            if (endArr != std::string::npos) {
                size_t pos = startArr + 1;
                while (pos < endArr) {
                    auto oStart = json.find('{', pos);
                    if (oStart == std::string::npos || oStart >= endArr) break;
                    auto oEnd = findMatchingJsonObjectEnd(json, oStart);
                    if (oEnd == std::string::npos || oEnd > endArr) break;

                    std::string itemJson = json.substr(oStart, oEnd - oStart + 1);
                    RecipeIdeExtension ideExt;
                    ideExt.ide         = extractJsonValue(itemJson, "ide");
                    ideExt.extensionId = extractJsonValue(itemJson, "extensionId");
                    ideExt.displayName = extractJsonValue(itemJson, "displayName");

                    if (!ideExt.extensionId.empty()) {
                        r.ideExtensions.push_back(ideExt);
                    }
                    pos = oEnd + 1;
                }
            }
        }
    }

    return !r.metadata.name.empty() || !r.packages.empty() || !r.configFiles.empty() || !r.paths.empty();

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

#define LAZYENV_VERSION_STRING "0.9.0"

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

        {"pwsh",      {"Microsoft.PowerShell", "PowerShell"}},

        {"uv",        {"astral-sh.uv", "uv"}},

        {"fnm",       {"Schniz.fnm", "fnm"}},

        {"vfox",      {"version-fox.vfox", "vfox"}},

        {"mise",      {"jdx.mise", "mise"}},

        {"starship",  {"Starship.Starship", "Starship"}},

        {"zoxide",    {"ajeetdsouza.zoxide", "zoxide"}},

        {"bat",       {"sharkdp.bat", "bat"}},

        {"eza",       {"eza-community.eza", "eza"}},

        {"7z",        {"7zip.7zip", "7-Zip"}},

        {"kubectl",   {"Kubernetes.kubectl", "kubectl"}},

        {"helm",      {"Helm.Helm", "Helm"}},

        {"terraform", {"Hashicorp.Terraform", "Terraform"}}

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



// ---------------------------------------------------------------------------

// v2.0: Discovery and Migration Engine

// ---------------------------------------------------------------------------

std::vector<RecipeConfigFile> RecipeManager::discoverCurrentConfigFiles() {

    std::vector<RecipeConfigFile> results;

    std::wstring userProfile = getUserProfileDir();

    std::wstring appData = getAppDataDir();



    // 1. Git config

    {

        std::filesystem::path p = std::filesystem::path(userProfile) / ".gitconfig";

        std::string content = readFileUtf8(p);

        if (!content.empty()) {

            results.push_back({ "git", "Git Global Config (.gitconfig)", ".gitconfig", "%USERPROFILE%", content });

        }

    }



    // 2. NPM config

    {

        std::filesystem::path p = std::filesystem::path(userProfile) / ".npmrc";

        std::string content = readFileUtf8(p);

        if (!content.empty()) {

            results.push_back({ "npm", "NPM Global Config (.npmrc)", ".npmrc", "%USERPROFILE%", content });

        }

    }



    // 3. Pip config

    {

        std::filesystem::path p1 = std::filesystem::path(appData) / "pip" / "pip.ini";

        std::filesystem::path p2 = std::filesystem::path(userProfile) / "pip" / "pip.ini";

        std::string content = readFileUtf8(p1);

        if (!content.empty()) {

            results.push_back({ "pip", "Pip Config (pip.ini)", "pip/pip.ini", "%APPDATA%", content });

        } else {

            content = readFileUtf8(p2);

            if (!content.empty()) {

                results.push_back({ "pip", "Pip Config (pip.ini)", "pip/pip.ini", "%USERPROFILE%", content });

            }

        }

    }



    // 4. Conda config

    {

        std::filesystem::path p = std::filesystem::path(userProfile) / ".condarc";

        std::string content = readFileUtf8(p);

        if (!content.empty()) {

            results.push_back({ "pip", "Conda Config (.condarc)", ".condarc", "%USERPROFILE%", content });

        }

    }



    // 5. Cargo (Rust) config

    {

        std::filesystem::path p = std::filesystem::path(userProfile) / ".cargo" / "config.toml";

        std::string content = readFileUtf8(p);

        if (!content.empty()) {

            results.push_back({ "cargo", "Cargo Config (config.toml)", ".cargo/config.toml", "%USERPROFILE%", content });

        }

    }



    // 6. VS Code settings & keybindings

    {

        std::filesystem::path pSettings = std::filesystem::path(appData) / "Code" / "User" / "settings.json";

        std::string content = readFileUtf8(pSettings);

        if (!content.empty()) {

            results.push_back({ "ide", "VS Code Settings (settings.json)", "Code/User/settings.json", "%APPDATA%", content });

        }

        std::filesystem::path pKeys = std::filesystem::path(appData) / "Code" / "User" / "keybindings.json";

        content = readFileUtf8(pKeys);

        if (!content.empty()) {

            results.push_back({ "ide", "VS Code Keybindings", "Code/User/keybindings.json", "%APPDATA%", content });

        }

    }



    // 7. Cursor settings

    {

        std::filesystem::path p = std::filesystem::path(appData) / "Cursor" / "User" / "settings.json";

        std::string content = readFileUtf8(p);

        if (!content.empty()) {

            results.push_back({ "ide", "Cursor Settings (settings.json)", "Cursor/User/settings.json", "%APPDATA%", content });

        }

    }



    // 8. AI Agent / Codex Configs

    {

        std::filesystem::path pConf = std::filesystem::path(userProfile) / ".codex" / "config.toml";

        std::string content = readFileUtf8(pConf);

        if (!content.empty()) {

            results.push_back({ "agent", "Codex Agent Config (config.toml)", ".codex/config.toml", "%USERPROFILE%", content });

        }

        std::filesystem::path pAgents = std::filesystem::path(userProfile) / ".codex" / "AGENTS.md";

        content = readFileUtf8(pAgents);

        if (!content.empty()) {

            results.push_back({ "agent", "Codex Agent Guidelines (AGENTS.md)", ".codex/AGENTS.md", "%USERPROFILE%", content });

        }

    }



    return results;

}



std::vector<RecipeIdeExtension> RecipeManager::discoverIdeExtensions() {

    std::vector<RecipeIdeExtension> results;

    std::wstring userProfile = getUserProfileDir();



    auto scanExtensionsDir = [&](const std::filesystem::path& dir, const std::string& ide) {

        std::error_code ec;

        if (!std::filesystem::exists(dir, ec) || !std::filesystem::is_directory(dir, ec)) return;



        for (const auto& entry : std::filesystem::directory_iterator(dir, ec)) {

            if (entry.is_directory(ec)) {

                std::string folderName = entry.path().filename().string();

                if (folderName == ".obsolete" || folderName.empty()) continue;



                auto lastDash = folderName.rfind('-');

                std::string extId = folderName;

                if (lastDash != std::string::npos && lastDash > 0) {

                    bool hasDigitAfter = false;

                    for (size_t i = lastDash + 1; i < folderName.size(); ++i) {

                        if (std::isdigit(static_cast<unsigned char>(folderName[i]))) {

                            hasDigitAfter = true;

                            break;

                        }

                    }

                    if (hasDigitAfter) {

                        extId = folderName.substr(0, lastDash);

                    }

                }

                if (!extId.empty()) {

                    results.push_back({ ide, extId, folderName });

                }

            }

        }

    };



    scanExtensionsDir(std::filesystem::path(userProfile) / ".vscode" / "extensions", "vscode");

    scanExtensionsDir(std::filesystem::path(userProfile) / ".cursor" / "extensions", "cursor");



    return results;

}



EnvironmentRecipe RecipeManager::createMigrationRecipe(

    const std::string& name,

    const std::string& desc,

    const std::string& author,

    const std::vector<DetectedEnvItem>& detectedEnvs,

    const std::string& npmMirror,

    const std::string& pipMirror,

    bool includePackages,

    bool includeEnvVars,

    bool includeConfigs,

    bool includeIdeExtensions)

{

    EnvironmentRecipe r = createRecipeFromCurrentState(name, desc, author, detectedEnvs, npmMirror, pipMirror);

    r.formatVersion = "2.0";



    if (!includePackages) {

        r.packages.clear();

    }



    if (!includeEnvVars) {

        r.environmentVariables.clear();

        r.paths.clear();

    }



    if (includeConfigs) {

        r.configFiles = discoverCurrentConfigFiles();

    }



    if (includeIdeExtensions) {

        r.ideExtensions = discoverIdeExtensions();

    }



    return r;

}



bool RecipeManager::restoreConfigFiles(

    const std::vector<RecipeConfigFile>& configs,

    const std::string& backupDir,

    LineCallback onLog)

{

    std::wstring userProfile = getUserProfileDir();

    std::wstring appData = getAppDataDir();



    for (const auto& c : configs) {
        // Security check: relativePath must not escape baseDir
        std::string relNorm = c.relativePath;
        for (char& ch : relNorm) { if (ch == '/') ch = '\\'; }
        if (relNorm.find("..\\") != std::string::npos || relNorm.find("\\..") != std::string::npos ||
            relNorm.starts_with("..") || relNorm.find(':') != std::string::npos) {
            if (onLog) onLog("[LazyEnv] Security warning: skipped suspicious relative path: " + c.relativePath);
            continue;
        }


        std::filesystem::path baseDir;

        if (c.targetDirMacro == "%APPDATA%") {
            baseDir = std::filesystem::path(appData);
        } else if (c.targetDirMacro == "%USERPROFILE%") {
            baseDir = std::filesystem::path(userProfile);
        } else {
            baseDir = std::filesystem::path(utf8ToWide(c.targetDirMacro));
        }



        std::filesystem::path targetFile = baseDir / utf8ToWide(c.relativePath);



        // Backup existing file if present

        if (!backupDir.empty() && std::filesystem::exists(targetFile)) {

            std::filesystem::path bkpFile = std::filesystem::path(utf8ToWide(backupDir)) / utf8ToWide(c.relativePath);

            try {

                std::filesystem::create_directories(bkpFile.parent_path());

                std::filesystem::copy_file(targetFile, bkpFile, std::filesystem::copy_options::overwrite_existing);

                if (onLog) onLog("[LazyEnv] Backed up original config: " + c.relativePath);

            } catch (...) {}

        }



        // Write new configuration file

        try {

            std::filesystem::create_directories(targetFile.parent_path());

            std::ofstream ofs(targetFile, std::ios::binary);

            if (ofs.is_open()) {

                ofs.write(c.content.data(), c.content.size());

                if (onLog) onLog("[LazyEnv] Restored configuration file: " + c.name + " (" + c.relativePath + ")");

            }

        } catch (const std::exception& e) {

            if (onLog) onLog("[LazyEnv] Error restoring config " + c.relativePath + ": " + e.what());

        }

    }

    return true;

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

        bool alreadyInstalled = false;

        auto it = kPackageToCmds.find(p.id);

        if (it != kPackageToCmds.end()) {

            for (const auto& cmd : it->second) {

                if (installedCmds.find(toLower(cmd)) != installedCmds.end()) {

                    alreadyInstalled = true;

                    break;

                }

            }

        } else {

            std::string idLow = toLower(p.id);

            std::string nameLow = toLower(p.name);

            for (const auto& cmd : installedCmds) {

                if (idLow == cmd || nameLow == cmd) {

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



    report.configsToApply = r.configFiles;

    report.extensionsToApply = r.ideExtensions;



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



    // 1.5 Restore Configuration Files with backup

    if (!diff.configsToApply.empty()) {

        std::string bkpDir;

        if (!snapshotId.empty()) {

            bkpDir = wideToUtf8((rollback.getStorageDir() / snapshotId / "configs").wstring());

        }

        if (onLog) onLog("[LazyEnv] Restoring " + std::to_string(diff.configsToApply.size()) + " configuration file(s)...");

        restoreConfigFiles(diff.configsToApply, bkpDir, onLog);

    }



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

    auto catalog = getDefaultCatalog();

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

        int exitCode = Installer::runCommandStreaming(cmd, fullOut, onLog, 600000);

        if (exitCode == 0 || fullOut.find("already installed") != std::string::npos ||

            fullOut.find("No available upgrade") != std::string::npos) {

            for (const auto& catPkg : catalog) {

                bool idMatch = false;

                if (catPkg.id.size() == p.id.size()) {

                    idMatch = true;

                    for (size_t i = 0; i < p.id.size(); ++i) {

                        if (std::tolower(static_cast<unsigned char>(catPkg.id[i])) !=

                            std::tolower(static_cast<unsigned char>(p.id[i]))) {

                            idMatch = false;

                            break;

                        }

                    }

                }

                if (idMatch && catPkg.addToPath && !catPkg.defaultPath.empty()) {

                    if (onLog) onLog("[LazyEnv] Auto-injecting default PATH for " + catPkg.displayName + ": " + catPkg.defaultPath);

                    Installer::addToUserPath(catPkg.defaultPath);

                    break;

                }

            }

        }

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

