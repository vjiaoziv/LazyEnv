# LazyEnv

**English** | [中文](README_zh-CN.md)

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.3.0-0078D4?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/C%2B%2B-23-blue?style=flat-square&logo=c%2B%2B" alt="C++23" />
  <img src="https://img.shields.io/badge/UI-WebView2%20%7C%20Fluent-success?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

**Cross-platform, recoverable, zero-pollution dev environment configurator & multi-source update hub.**

Version: **0.3.0**

---

## Overview

LazyEnv is a modern Windows desktop application that streamlines development environment setup and ongoing toolchain maintenance. Combining a native Win32 + WebView2 architecture with Windows 11 Fluent Design, it provides clean package installation, comprehensive registry environment variable management, snapshot-based rollback, and a centralized **Multi-Source Updates Hub (WinGet, Scoop, NPM Global, Pip)** with intelligent failure diagnostics.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Cross-Platform Architecture** | Modular backend decoupled from OS APIs; native Win32 + WebView2 implementation on Windows (P0) |
| **Recoverable & Zero Pollution** | Automatic pre-operation snapshots before any install/upgrade; 100% reversible with zero hidden side-effects (P1) |
| **Multi-Source Governance** | Seamlessly aggregates system packages (WinGet), portable shims (Scoop), Node toolchains (NPM), and Python packages (Pip) (P2) |

---

## Key Features

### 1. Dedicated Updates Hub & Multi-Source Management
- **Multi-Source Aggregation**: Simultaneously checks updates across WinGet, Scoop, NPM (global), and Pip.
- **Async Parallel Acceleration**: Powered by `std::async` multi-threaded querying, cutting scan times from 35s+ down to 10~15s.
- **Categorized Source Filtering**: Easily switch between `All`, `WinGet`, `Scoop`, `NPM`, `Pip`, and `Pinned` tabs with real-time package counts.
- **Version Pinning (Pin / Ignore)**: Lock specific tool versions to prevent unwanted upgrades and suppress update badges.

### 2. Two-Layer Detailed Progress Dashboard & Live Terminal Logs
- **Macro Queue Overview**: Displays overall queue status (e.g. `Updating 2 / 5 packages`) and global percentage bar.
- **Micro Sub-Task Card**: Intelligently parses command output into structured stages:
  - `Preparing`: Dependency and metadata synchronization
  - `Downloading`: Real-time percentage, downloaded/total size, and download speeds
  - `Verifying`: Installer checksum and hash validation
  - `Installing`: File extraction, deployment, and shims setup
  - `Completed` / `Failed`
- **Console Log Drawer**: Expandable real-time stdout/stderr log stream with one-click clipboard copying.

### 3. Intelligent Failure Diagnostics & One-Click Rollback
- **Automated Root-Cause Categorization**:
  - `ELEVATION_REQUIRED`: Privilege errors (0x80070005) with interactive UAC retry option
  - `FILE_LOCKED`: Process lock errors (0x80070020) prompting the user to close active instances
  - `HASH_MISMATCH`: Corrupted packages or upstream cache drift
  - `NETWORK_ERROR`: Connection timeout and proxy issues
- **One-Click Pre-Update Rollback**: Instantly revert environment variables and PATH back to the pre-update state directly from the diagnostic banner.

### 4. Environment Variable & PATH Governance
- View, edit, and add user and system environment variables;
- Interactive segmented PATH editor;
- Instantly broadcasts `WM_SETTINGCHANGE` to ensure changes take effect immediately across the OS without reboots.

---

## Architecture

```
LazyEnv/
|-- main.cpp                 // WinMain entry, window message pump, WebMessage bridge
|-- webview_host.cpp/h       // WebView2 controller with fail-fast exception guards
|-- installer.cpp/h          // Command execution engine, mutex handle locking, PATH management
|-- package_manager.cpp/h    // IPackageManager abstraction (WinGet, Scoop, NPM, Pip)
|-- update_manager.cpp/h     // Updates Hub orchestrator, parallel detection, diagnostics engine
|-- rollback.cpp/h           // Environment variable snapshot & restore engine
|-- resources/
|   |-- index.html           // Fluent UI structure
|   |-- style.css            // Windows 11 Fluent Design styles
|   |-- script.js            // Frontend pipeline & state management
|   |-- i18n.js              // Full bilingual internationalization (en, zh-CN)
|   |-- icons.js             // Vector icon dictionary
|-- LazyEnv.rc               // Icon and v0.3.0 version resource script
|-- CMakeLists.txt           // Build configuration
```

---

## Building from Source

### Prerequisites
- Windows 10 (version 1903+) or Windows 11
- Visual Studio (2022 or 2026 BuildTools with C++ Desktop workload)
- CMake 3.24+
- Microsoft Edge WebView2 Runtime (pre-installed on modern Windows)

### Build Steps

```powershell
# Clone the repository
git clone https://github.com/vjiaoziv/LazyEnv.git
cd LazyEnv

# Configure with CMake (automatically downloads WebView2 SDK and WIL via NuGet)
cmake -B build -A x64

# Build Release binary
cmake --build build --config Release

# Output binary located at build/Release/LazyEnv.exe with resources synced automatically
```

---

## Contributors

Special thanks to everyone contributing to LazyEnv! Issues and Pull Requests are warmly welcome.

- [@vjiaoziv](https://github.com/vjiaoziv) - Project Maintainer & Core Developer
- [@ListerOvO1211](https://github.com/ListerOvO1211) - Core Contributor

---

## License

This project is licensed under the [MIT License](LICENSE).
