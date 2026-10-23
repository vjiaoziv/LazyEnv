// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// ============================================================================
// LazyEnv - installer.cpp
// Package installation engine implementation
// ============================================================================

#include "installer.h"
#include "rollback.h"   // For environment variable helpers

#include <Windows.h>

#include <sstream>
#include <algorithm>
#include <format>
#include <unordered_map>
#include <mutex>
#include <cctype>

namespace lazyenv {

namespace {

// Extract sequence of integer version components safely
std::vector<int> extractVersionNumbers(const std::string& str) {
    std::vector<int> numbers;
    size_t i = 0;
    while (i < str.size()) {
        if (std::isdigit(static_cast<unsigned char>(str[i]))) {
            long long val = 0;
            while (i < str.size() && std::isdigit(static_cast<unsigned char>(str[i]))) {
                if (val < 1000000) {
                    val = val * 10 + (str[i] - '0');
                }
                ++i;
            }
            numbers.push_back(static_cast<int>(val));
            if (numbers.size() >= 4) break;
            if (i < str.size() && (str[i] == '.' || str[i] == '-')) {
                ++i;
            } else {
                break;
            }
        } else {
            ++i;
        }
    }
    return numbers;
}

// Returns: 1 if v2 > v1 (update available), -1 if v2 < v1, 0 if equal/undetermined
int compareVersionStrings(const std::string& v1, const std::string& v2) {
    auto nums1 = extractVersionNumbers(v1);
    auto nums2 = extractVersionNumbers(v2);
    if (nums1.empty() || nums2.empty()) return 0;
    size_t len = (std::max)(nums1.size(), nums2.size());
    for (size_t i = 0; i < len; ++i) {
        int n1 = (i < nums1.size()) ? nums1[i] : 0;
        int n2 = (i < nums2.size()) ? nums2[i] : 0;
        if (n2 > n1) return 1;
        if (n2 < n1) return -1;
    }
    return 0;
}

std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

struct WingetUpgradeEntry {
    std::string name;
    std::string id;
    std::string version;
    std::string available;
};

std::vector<WingetUpgradeEntry> parseWingetUpgradeOutput(const std::string& output) {
    std::vector<WingetUpgradeEntry> entries;
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

        std::istringstream lineStream(line);
        std::vector<std::string> tokens;
        std::string tok;
        while (lineStream >> tok) {
            tokens.push_back(tok);
        }

        if (tokens.size() >= 4) {
            size_t n = tokens.size();
            bool hasSource = (tokens[n - 1] == "winget" || tokens[n - 1] == "msstore");
            size_t availIdx = hasSource ? (n >= 2 ? n - 2 : 0) : n - 1;
            size_t verIdx = availIdx > 0 ? availIdx - 1 : 0;
            size_t idIdx = verIdx > 0 ? verIdx - 1 : 0;

            if (availIdx < n && verIdx < n && idIdx < n && idIdx > 0) {
                WingetUpgradeEntry entry;
                entry.available = tokens[availIdx];
                entry.version = tokens[verIdx];
                entry.id = tokens[idIdx];

                std::string name;
                for (size_t i = 0; i < idIdx; ++i) {
                    if (!name.empty()) name += " ";
                    name += tokens[i];
                }
                entry.name = name;
                entries.push_back(entry);
            }
        }
    }
    return entries;
}

} // anonymous namespace

// ===========================================================================
// Installer
// ===========================================================================
Installer::Installer() = default;

void Installer::setProgressCallback(ProgressCallback cb) {
    progressCb_ = std::move(cb);
}

// ---------------------------------------------------------------------------
// Resolve winget executable path or command name safely via Win32 API
// ---------------------------------------------------------------------------
std::string Installer::getWingetExecutable() {
    static std::string cached;
    if (!cached.empty()) return cached;

    // Check if winget is directly callable in PATH
    if (isCommandAvailable("winget")) {
        cached = "winget";
        return cached;
    }

    // Check LOCALAPPDATA WindowsApps safely using Win32 GetFileAttributesW
    // Do NOT use std::filesystem::exists on AppExecutionAlias reparse points.
    wchar_t localAppData[MAX_PATH];
    if (GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH) > 0) {
        std::wstring winApps = std::wstring(localAppData) + L"\\Microsoft\\WindowsApps\\winget.exe";
        DWORD attr = GetFileAttributesW(winApps.c_str());
        if (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY)) {
            int len = WideCharToMultiByte(CP_UTF8, 0, winApps.c_str(), -1, nullptr, 0, nullptr, nullptr);
            if (len > 0) {
                std::string pathUtf8(len - 1, '\0');
                WideCharToMultiByte(CP_UTF8, 0, winApps.c_str(), -1, pathUtf8.data(), len, nullptr, nullptr);
                cached = "\"" + pathUtf8 + "\"";
                return cached;
            }
        }
    }

    cached = "winget";
    return cached;
}

// ---------------------------------------------------------------------------
// winget availability check
// ---------------------------------------------------------------------------
bool Installer::isWingetAvailable() {
    std::string output;
    std::string exe = getWingetExecutable();
    int rc = runCommand(exe + " --version", output, 10000);
    return rc == 0 && !output.empty();
}

// ---------------------------------------------------------------------------
// Single package install
// ---------------------------------------------------------------------------
InstallResult Installer::installPackage(const PackageInfo& pkg) {
    InstallResult result;
    result.packageId = pkg.id;
    result.status    = InstallStatus::Running;

    if (progressCb_)
        progressCb_(pkg.id, InstallStatus::Running,
                    "Installing " + pkg.displayName + "...");

    // Build winget command
    std::string cmd = std::format(
        "{} install --id {} --exact --silent "
        "--accept-package-agreements --accept-source-agreements",
        getWingetExecutable(), pkg.id);

    result.exitCode = runCommand(cmd, result.output, 600000); // 10 min timeout

    if (result.exitCode == 0) {
        result.status = InstallStatus::Success;

        // Add to PATH if requested
        if (pkg.addToPath && !pkg.defaultPath.empty()) {
            addToUserPath(pkg.defaultPath);
        }

        if (progressCb_)
            progressCb_(pkg.id, InstallStatus::Success,
                        pkg.displayName + " installed successfully.");
    } else {
        // Check if already installed (winget returns specific codes)
        if (result.output.find("already installed") != std::string::npos ||
            result.output.find("No available upgrade") != std::string::npos) {
            result.status = InstallStatus::Skipped;
            if (progressCb_)
                progressCb_(pkg.id, InstallStatus::Skipped,
                            pkg.displayName + " is already installed.");
        } else {
            result.status = InstallStatus::Failed;
            if (progressCb_)
                progressCb_(pkg.id, InstallStatus::Failed,
                            std::format("{} installation failed (exit code {}).",
                                        pkg.displayName, result.exitCode));
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Batch install
// ---------------------------------------------------------------------------
std::vector<InstallResult> Installer::installBatch(
    const std::vector<PackageInfo>& packages) {

    std::vector<InstallResult> results;
    results.reserve(packages.size());
    for (auto& pkg : packages) {
        results.push_back(installPackage(pkg));
    }
    return results;
}

// ---------------------------------------------------------------------------
// Hybrid update check (winget + fallback)
// ---------------------------------------------------------------------------
std::vector<UpdateInfo> Installer::checkUpdates(const std::vector<DetectedEnvItem>& installedEnvs) {
    std::vector<UpdateInfo> updates;
    updates.reserve(installedEnvs.size());

    static const std::unordered_map<std::string, std::pair<std::string, std::string>> kKnownPackageMap = {
        {"python",       {"Python.Python.3.12", "Python 3.12"}},
        {"python3",      {"Python.Python.3.12", "Python 3.12"}},
        {"node",         {"OpenJS.NodeJS.LTS", "Node.js (LTS)"}},
        {"go",           {"GoLang.Go", "Go"}},
        {"rustc",        {"Rustlang.Rustup", "Rust (rustup)"}},
        {"cargo",        {"Rustlang.Rustup", "Rust (rustup)"}},
        {"java",         {"Oracle.JDK.21", "Java JDK 21"}},
        {"git",          {"Git.Git", "Git"}},
        {"cmake",        {"Kitware.CMake", "CMake"}},
        {"ninja",        {"Ninja-build.Ninja", "Ninja"}},
        {"clang",        {"LLVM.LLVM", "LLVM/Clang"}},
        {"gh",           {"GitHub.cli", "GitHub CLI"}},
        {"code",         {"Microsoft.VisualStudioCode", "VS Code"}},
        {"nvim",         {"Neovim.Neovim", "Neovim"}},
        {"docker",       {"Docker.DockerDesktop", "Docker Desktop"}},
        {"jq",           {"jqlang.jq", "jq"}},
        {"rg",           {"BurntSushi.ripgrep.MSVC", "ripgrep"}},
        {"fd",           {"sharkdp.fd", "fd"}},
        {"fzf",          {"junegunn.fzf", "fzf"}},
        {"pwsh",         {"Microsoft.PowerShell", "PowerShell"}},
        {"ffmpeg",       {"Gyan.FFmpeg", "FFmpeg"}},
        {"curl",         {"curl.curl", "curl"}}
    };

    try {
        // Layer 1: Query winget upgrade list
        std::string wingetOut;
        std::string wingetCmd = getWingetExecutable() + " upgrade --include-unknown --accept-source-agreements --disable-interactivity 2>&1";
        runCommand(wingetCmd, wingetOut, 15000);

        auto wingetUpgrades = parseWingetUpgradeOutput(wingetOut);

        for (const auto& env : installedEnvs) {
            UpdateInfo info;
            info.command        = env.command;
            info.name           = env.name;
            info.currentVersion = env.version;
            info.hasUpdate      = false;

            std::string cmdLower  = toLower(env.command);
            std::string nameLower = toLower(env.name);

            auto it = kKnownPackageMap.find(cmdLower);
            if (it != kKnownPackageMap.end()) {
                info.packageId = it->second.first;
            }

            // Check if matched in winget upgrades
            bool matched = false;
            for (const auto& wEntry : wingetUpgrades) {
                std::string widLower   = toLower(wEntry.id);
                std::string wnameLower = toLower(wEntry.name);

                bool idMatch = (!info.packageId.empty() && widLower == toLower(info.packageId));
                bool nameMatch = (!widLower.empty() && widLower.find(cmdLower) != std::string::npos) ||
                                 (!wnameLower.empty() && (wnameLower.find(cmdLower) != std::string::npos ||
                                                          wnameLower.find(nameLower) != std::string::npos));

                if (idMatch || nameMatch) {
                    info.packageId     = wEntry.id;
                    info.latestVersion = wEntry.available;
                    info.hasUpdate     = true;
                    info.updateSource  = "winget";
                    matched            = true;
                    break;
                }
            }

            // Layer 2: Tool-specific fallbacks
            if (!matched) {
                if (cmdLower == "rustc" || cmdLower == "cargo") {
                    std::string rustupOut;
                    int rc = runCommand("rustup check 2>&1", rustupOut, 8000);
                    if (rc == 0 && (rustupOut.find("Update available") != std::string::npos ||
                                    rustupOut.find("update available") != std::string::npos)) {
                        info.hasUpdate     = true;
                        info.latestVersion = "Latest (rustup)";
                        info.updateSource  = "rustup";
                        matched            = true;
                    }
                } else if (cmdLower == "npm") {
                    std::string npmOut;
                    int rc = runCommand("npm view npm version 2>&1", npmOut, 8000);
                    if (rc == 0 && !npmOut.empty()) {
                        auto nl = npmOut.find('\n');
                        std::string latestVer = npmOut.substr(0, nl == std::string::npos ? npmOut.size() : nl);
                        while (!latestVer.empty() && (latestVer.back() == '\r' || latestVer.back() == ' '))
                            latestVer.pop_back();

                        if (!latestVer.empty() && compareVersionStrings(env.version, latestVer) > 0) {
                            info.hasUpdate     = true;
                            info.latestVersion = latestVer;
                            info.updateSource  = "npm";
                            matched            = true;
                        }
                    }
                }
            }

            updates.push_back(info);
        }
    } catch (...) {
        // Fallback: return current env list with hasUpdate=false rather than crashing
        for (const auto& env : installedEnvs) {
            UpdateInfo info;
            info.command        = env.command;
            info.name           = env.name;
            info.currentVersion = env.version;
            info.hasUpdate      = false;
            updates.push_back(info);
        }
    }

    return updates;
}

// ---------------------------------------------------------------------------
// Upgrade specific environment
// ---------------------------------------------------------------------------
InstallResult Installer::upgradeEnvironment(const std::string& command,
                                            const std::string& packageId,
                                            const std::string& displayName) {
    InstallResult result;
    result.packageId = packageId.empty() ? command : packageId;
    result.status    = InstallStatus::Running;

    if (progressCb_)
        progressCb_(result.packageId, InstallStatus::Running,
                    "Upgrading " + displayName + "...");

    std::string cmd;
    if (!packageId.empty()) {
        cmd = std::format(
            "{} upgrade --id {} --exact --silent "
            "--accept-package-agreements --accept-source-agreements",
            getWingetExecutable(), packageId);
    } else {
        std::string cmdLower = toLower(command);
        if (cmdLower == "rustc" || cmdLower == "cargo") {
            cmd = "rustup update";
        } else if (cmdLower == "npm") {
            cmd = "npm install -g npm@latest";
        } else {
            cmd = std::format("{} upgrade --name \"{}\" --silent --accept-package-agreements --accept-source-agreements",
                              getWingetExecutable(), displayName);
        }
    }

    result.exitCode = runCommand(cmd, result.output, 600000); // 10 min timeout

    if (result.exitCode == 0) {
        result.status = InstallStatus::Success;
        if (progressCb_)
            progressCb_(result.packageId, InstallStatus::Success,
                        displayName + " upgraded successfully.");
    } else {
        result.status = InstallStatus::Failed;
        if (progressCb_)
            progressCb_(result.packageId, InstallStatus::Failed,
                        std::format("{} upgrade failed (exit code {}).",
                                    displayName, result.exitCode));
    }

    return result;
}

// ---------------------------------------------------------------------------
// PATH management
// ---------------------------------------------------------------------------
bool Installer::addToUserPath(const std::string& directory) {
    std::string currentPath = RollbackManager::readEnvVariable("Path", false);

    // Normalize: ensure no trailing backslash for comparison
    std::string normalized = directory;
    while (!normalized.empty() && (normalized.back() == '\\' || normalized.back() == '/'))
        normalized.pop_back();

    // Check if already present (case-insensitive)
    std::string lowerPath = currentPath;
    std::string lowerDir  = normalized;
    std::transform(lowerPath.begin(), lowerPath.end(), lowerPath.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    std::transform(lowerDir.begin(), lowerDir.end(), lowerDir.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    if (lowerPath.find(lowerDir) != std::string::npos)
        return true; // Already in PATH

    // Append with semicolon separator
    std::string newPath = currentPath;
    if (!newPath.empty() && newPath.back() != ';')
        newPath += ';';
    newPath += normalized;

    bool ok = RollbackManager::writeEnvVariable("Path", newPath, REG_EXPAND_SZ, false);
    if (ok)
        RollbackManager::broadcastEnvironmentChange();
    return ok;
}

bool Installer::removeFromUserPath(const std::string& directory) {
    std::string currentPath = RollbackManager::readEnvVariable("Path", false);

    std::string normalized = directory;
    while (!normalized.empty() && (normalized.back() == '\\' || normalized.back() == '/'))
        normalized.pop_back();

    // Case-insensitive removal
    std::string lowerPath = currentPath;
    std::string lowerDir  = normalized;
    std::transform(lowerPath.begin(), lowerPath.end(), lowerPath.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    std::transform(lowerDir.begin(), lowerDir.end(), lowerDir.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    auto pos = lowerPath.find(lowerDir);
    if (pos == std::string::npos)
        return true; // Not present, nothing to do

    // Remove the entry and surrounding semicolons
    size_t end = pos + normalized.size();
    if (end < currentPath.size() && currentPath[end] == ';') ++end;
    else if (pos > 0 && currentPath[pos - 1] == ';') --pos;

    std::string newPath = currentPath.substr(0, pos) + currentPath.substr(end);

    bool ok = RollbackManager::writeEnvVariable("Path", newPath, REG_EXPAND_SZ, false);
    if (ok)
        RollbackManager::broadcastEnvironmentChange();
    return ok;
}

bool Installer::isCommandAvailable(const std::string& command) {
    std::string output;
    std::string cmd = "where " + command;
    int rc = runCommand(cmd, output, 5000);
    return rc == 0 && !output.empty();
}

// ---------------------------------------------------------------------------
// Command execution helpers (shared pipe setup)
// ---------------------------------------------------------------------------
namespace {

static std::mutex s_processMutex;

struct PipeHandles {
    HANDLE hRead  = nullptr;
    HANDLE hWrite = nullptr;
};

bool createOutputPipe(PipeHandles& ph) {
    SECURITY_ATTRIBUTES sa{};
    sa.nLength = sizeof(sa);
    sa.bInheritHandle = TRUE;
    if (!CreatePipe(&ph.hRead, &ph.hWrite, &sa, 0))
        return false;
    SetHandleInformation(ph.hRead, HANDLE_FLAG_INHERIT, 0);
    return true;
}

bool launchProcess(const std::string& cmdLine, HANDLE hWritePipe,
                   PROCESS_INFORMATION& pi) {
    STARTUPINFOW si{};
    si.cb         = sizeof(si);
    si.dwFlags    = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    si.hStdOutput = hWritePipe;
    si.hStdError  = hWritePipe;
    si.wShowWindow = SW_HIDE;

    std::string fullCmd = "cmd /c " + cmdLine;

    int wlen = MultiByteToWideChar(CP_UTF8, 0, fullCmd.c_str(), -1, nullptr, 0);
    if (wlen <= 0) return false;
    std::wstring wcmd(wlen, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, fullCmd.c_str(), -1, &wcmd[0], wlen);

    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);

    BOOL ok = CreateProcessW(
        nullptr,
        wcmd.data(),
        nullptr,
        nullptr,
        TRUE,
        CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP,
        nullptr,
        nullptr,
        &si,
        &pi
    );

    return ok != FALSE;
}

} // anonymous namespace

// ---------------------------------------------------------------------------
// Blocking command execution with full output capture
// ---------------------------------------------------------------------------
int Installer::runCommand(const std::string& cmdLine,
                          std::string& output,
                          uint32_t timeoutMs) {
    output.clear();

    PipeHandles ph;
    PROCESS_INFORMATION pi{};

    {
        std::lock_guard<std::mutex> lock(s_processMutex);
        if (!createOutputPipe(ph)) return -1;

        if (!launchProcess(cmdLine, ph.hWrite, pi)) {
            CloseHandle(ph.hRead);
            CloseHandle(ph.hWrite);
            return -1;
        }
        CloseHandle(ph.hWrite);
    }

    // Read all output
    char buf[4096];
    DWORD bytesRead = 0;
    while (ReadFile(ph.hRead, buf, sizeof(buf) - 1, &bytesRead, nullptr) && bytesRead > 0) {
        buf[bytesRead] = '\0';
        output += buf;
    }

    CloseHandle(ph.hRead);

    DWORD waitRes = WaitForSingleObject(pi.hProcess, timeoutMs);
    if (waitRes == WAIT_TIMEOUT) {
        TerminateProcess(pi.hProcess, static_cast<UINT>(-1));
    }

    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    return static_cast<int>(exitCode);
}

// ---------------------------------------------------------------------------
// Streaming command execution with line-by-line callback
// ---------------------------------------------------------------------------
int Installer::runCommandStreaming(const std::string& cmdLine,
                                  std::string& fullOutput,
                                  LineCallback onLine,
                                  uint32_t timeoutMs) {
    fullOutput.clear();

    PipeHandles ph;
    PROCESS_INFORMATION pi{};

    {
        std::lock_guard<std::mutex> lock(s_processMutex);
        if (!createOutputPipe(ph)) return -1;

        if (!launchProcess(cmdLine, ph.hWrite, pi)) {
            CloseHandle(ph.hRead);
            CloseHandle(ph.hWrite);
            return -1;
        }
        CloseHandle(ph.hWrite);
    }

    // Read output and split into lines, calling onLine for each
    std::string lineBuffer;
    char buf[1024];
    DWORD bytesRead = 0;

    while (ReadFile(ph.hRead, buf, sizeof(buf) - 1, &bytesRead, nullptr) && bytesRead > 0) {
        buf[bytesRead] = '\0';
        fullOutput += buf;

        // Split into lines
        for (DWORD i = 0; i < bytesRead; ++i) {
            if (buf[i] == '\n') {
                if (!lineBuffer.empty() && lineBuffer.back() == '\r')
                    lineBuffer.pop_back();
                if (onLine && !lineBuffer.empty())
                    onLine(lineBuffer);
                lineBuffer.clear();
            } else {
                lineBuffer += buf[i];
            }
        }
    }

    // Flush remaining partial line
    if (!lineBuffer.empty()) {
        if (lineBuffer.back() == '\r') lineBuffer.pop_back();
        if (onLine && !lineBuffer.empty())
            onLine(lineBuffer);
    }

    CloseHandle(ph.hRead);

    WaitForSingleObject(pi.hProcess, timeoutMs);

    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    return static_cast<int>(exitCode);
}

// ===========================================================================
// Default package catalog
// ===========================================================================
std::vector<PackageInfo> getDefaultCatalog() {
    return {
        // --- Languages ---
        {"Python.Python.3.12", "Python 3.12", "language",
         "General-purpose programming language",
         "C:\\Python312;C:\\Python312\\Scripts", true},

        {"OpenJS.NodeJS.LTS", "Node.js (LTS)", "language",
         "JavaScript runtime built on V8",
         "", true},

        {"Rustlang.Rustup", "Rust (rustup)", "language",
         "Systems programming language",
         "%USERPROFILE%\\.cargo\\bin", true},

        {"GoLang.Go", "Go", "language",
         "Statically typed compiled language by Google",
         "C:\\Program Files\\Go\\bin", true},

        {"Oracle.JDK.21", "Java JDK 21", "language",
         "Java Development Kit",
         "", true},

        // --- Build tools ---
        {"Kitware.CMake", "CMake", "tool",
         "Cross-platform build system generator",
         "", true},

        {"Ninja-build.Ninja", "Ninja", "tool",
         "Small, fast build system",
         "", true},

        {"LLVM.LLVM", "LLVM/Clang", "tool",
         "Compiler infrastructure and C/C++ compiler",
         "C:\\Program Files\\LLVM\\bin", true},

        // --- Version control ---
        {"Git.Git", "Git", "tool",
         "Distributed version control system",
         "C:\\Program Files\\Git\\cmd", true},

        {"GitHub.cli", "GitHub CLI", "tool",
         "GitHub command-line tool",
         "", true},

        // --- Editors ---
        {"Microsoft.VisualStudioCode", "VS Code", "editor",
         "Lightweight code editor by Microsoft",
         "", false},

        {"Neovim.Neovim", "Neovim", "editor",
         "Hyperextensible Vim-based text editor",
         "", true},

        // --- Containers & VMs ---
        {"Docker.DockerDesktop", "Docker Desktop", "runtime",
         "Container platform for development",
         "", false},

        // --- Databases ---
        {"PostgreSQL.PostgreSQL.16", "PostgreSQL 16", "database",
         "Advanced open-source relational database",
         "C:\\Program Files\\PostgreSQL\\16\\bin", true},

        {"Redis.Redis", "Redis", "database",
         "In-memory data structure store",
         "", true},

        // --- Utilities ---
        {"jqlang.jq", "jq", "utility",
         "Lightweight command-line JSON processor",
         "", true},

        {"BurntSushi.ripgrep.MSVC", "ripgrep", "utility",
         "Blazingly fast grep alternative",
         "", true},

        {"sharkdp.fd", "fd", "utility",
         "Fast and user-friendly find alternative",
         "", true},

        {"junegunn.fzf", "fzf", "utility",
         "Command-line fuzzy finder",
         "", true},

        {"WinSCP.WinSCP", "WinSCP", "utility",
         "SFTP/SCP/FTP client for Windows",
         "", false},
    };
}

} // namespace lazyenv
