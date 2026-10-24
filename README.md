# LazyEnv

**English** | [中文](README_zh-CN.md)

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.8.10-0078D4?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/C%2B%2B-23-blue?style=flat-square&logo=c%2B%2B" alt="C++23" />
  <img src="https://img.shields.io/badge/UI-WebView2%20%7C%20Fluent-success?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square" alt="License" />
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white" alt="powered by dsh" /></a>
  <a href="https://github.com/openai"><img src="https://img.shields.io/badge/built_with-Codex-000000?style=flat-square&logo=openai&logoColor=white" alt="built with Codex" /></a>
</p>

**Developer-centric Windows environment configurator, PATH Doctor health center, high-speed mirror switcher, and multi-source update hub.**

Current Version: **v0.8.10**

---

## Overview & Core Value

LazyEnv solves Windows developers' most persistent pain points in real-world workflows: **tedious new machine setup, binary version collisions and PATH shadowing, slow registry downloads behind firewalls, and corrupted, bloated PATH variables**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LazyEnv Core Value Pillars                      │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 🚀 10 Dev Stacks   │ 🇨🇳 Mirror Speedup  │ 🩺 PATH Doctor Health Center │
│ Curated setups for │ npm/pip/go/rust    │ Level-1 UI navigation, deep  │
│ Web/AI/Go/Rust with│ high-speed mirror  │ dead path cleanup, shadowing │
│ Smart Diff preflight│ switching in 1-sec│ fixes, buffer overflow alert │
├────────────────────┴────────────────────┴──────────────────────────────┤
│ 🔄 Multi-Source Updates & Rollback: WinGet/Scoop/NPM/Pip with pre-snap restore │
└────────────────────────────────────────────────────────────────────────┘
```

> 🗺️ **Roadmap**: the phased evolution plan lives in [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Key Feature Matrix

### 1. 🚀 10 Curated Technology Stacks (One-Click Diff Deployment)
Top of Home page and Recipes Hub feature production-ready stacks. Importing a stack triggers **Smart Diff Preflight** comparing against local environment to prevent redundant downloads:
- 🌐 **Full-Stack Web Team** (`web`): Node.js LTS, pnpm, Git, VS Code with npmmirror acceleration and `NODE_ENV=development`.
- 🐍 **Python AI & Data Science** (`ai`): Python 3.12, pip, Git, VS Code, jq with Tsinghua PyPI mirror and `PYTHONUTF8=1`.
- ⚡ **Modern Python / uv Stack** (`uv-ai`): uv, Python 3.12, Git, VS Code, jq powered by Rust for 10-100x faster package operations.
- ⚙️ **Modern C/C++ Systems** (`systems`): LLVM/Clang, CMake, Ninja, Git, VS Code with `CC=clang` / `CXX=clang++`.
- 🦀 **Rust Systems Programming** (`rust`): Rust (rustup), Cargo, Git, VS Code with rsproxy mirror acceleration.
- 🐹 **Go Cloud-Native Backend** (`go-cloud`): Go, Docker Desktop, PostgreSQL 16, Redis, Git, VS Code with `GOPROXY=https://goproxy.cn,direct`.
- 📱 **Mobile & Cross-Platform** (`mobile`): Java JDK 21, Node.js LTS, Git, VS Code with `JAVA_HOME` configuration.
- 🚀 **Windows Terminal Powerhouse** (`shell-powerhouse`): Windows Terminal, PowerShell 7, Starship, zoxide, bat, eza, ripgrep, fd, fzf.
- ☁️ **DevOps & Cloud Infrastructure** (`devops-infra`): Docker Desktop, kubectl, Helm, Terraform, GitHub CLI, jq.
- 🧰 **Developer Essential Toolkit** (`toolkit`): Git, VS Code, 7-Zip, Windows Terminal.

### 2. 📦 36 Curated Packages with Authoritative Knowledge Base
36 verified tools spanning 9 developer categories, all verified against WinGet with pure vector SVG icons. The Packages page and Recipe Diff modals employ an **Expanded Card Layout** with authoritative descriptions derived directly from official READMEs, slogans, and Wikipedia:
- **Modern Runtimes & Version Managers**: uv (fast pip alternative), fnm (blazing Node.js switcher), vfox (native polyglot manager), mise (dev environment manager);
- **Modern Terminal & Shell**: Windows Terminal, PowerShell 7, Starship (cross-shell prompt), zoxide (smarter cd), bat (syntax-highlighted cat), eza (vibrant modern ls);
- **Modern Rust CLI Tools**: ripgrep (blazingly fast code search), fd (user-friendly file finder), fzf (fuzzy finder), jq (command-line JSON processor);
- **Cloud-Native & DevOps**: Docker Desktop, kubectl, Helm, Terraform;
- **Databases & API Tooling**: DBeaver Community (free universal database GUI), Postman, PostgreSQL 16, Redis;
- **Core Toolchain**: 7-Zip, Git, GitHub CLI, VS Code, Neovim, CMake, Ninja, LLVM/Clang, WinSCP.

### 3. 🩺 PATH Doctor Health Center (Primary Navigation)
A dedicated diagnostic and governance suite for Windows PATH variables:
- **Deep Invalid Path Cleanup**: Expands `%USERPROFILE%` macros across User & System registry PATHs to physically verify directory existence, purging dead links and duplicates;
- **Command Shadowing & Collision Detection**: Scans for multi-version conflicts across Python, Node, Git, Java, C++, Rust, clearly distinguishing which binary is active and which is shadowed;
- **RapidEE-Grade Buffer & Length Monitoring**: Real-time character counts for User, System, and Combined PATH with threshold warnings at 2048 chars (legacy truncation risk) and 8192 chars (CMD buffer limit);
- **Exact-Token Remediation with Broadcast**: Applies changes using atomic exact-token matching and broadcasts `WM_SETTINGCHANGE` across the Windows subsystem immediately.

### 4. 🇨🇳 Multi-Source Mirror Accelerator
Instantly switches package registries to high-speed domestic mirrors to eliminate download timeouts:
- **NPM Mirror**: Instant 1-click switching between Aliyun, Tencent, Huawei, npmmirror, or official registry;
- **Python / Pip Mirror**: Instant 1-click switching between Tsinghua, Aliyun, Tencent, or official PyPI;
- Executes official package manager CLIs directly with immediate system effect.

### 5. 🔄 Centralized Multi-Source Updates Hub & Version Pinning
- **Unified Multi-Source Management**: Native concurrent checks across **WinGet, Scoop, NPM (Global), and Pip**;
- **Parallel Query Acceleration**: Powered by `std::async` multi-threaded workers, completing full scans in 10-15s;
- **Two-Layer Detailed Progress Dashboard**: Macro progress bar + micro sub-task status (Preparing / Downloading / Verifying / Installing / Completed) + live output drawer;
- **Version Pinning (Pin)**: Lock specific tool versions to ignore future update prompts;
- **Intelligent Failure Diagnostics**: Recognizes elevation errors (`0x80070005`) and process lock errors (`0x80070020`) with 1-click rollback restoration.

### 6. 🛡️ Environment Snapshots & Non-Destructive Recovery
- Mandatory automatic registry and environment snapshots prior to any mutating operation;
- Native graphical registry editor for user/system environment variables and segmented PATH;
- Built-in authoritative encyclopedia descriptions for core environment variables (`JAVA_HOME`, `PYTHONUTF8`, `GOPROXY`, etc.).

---

## Repository Architecture

```
LazyEnv/
|-- main.cpp                 // WinMain entry, borderless DPI-aware window, native<->web bridge
|-- webview_host.cpp/h       // WebView2 host lifecycle and thread-safe message pump
|-- installer.cpp/h          // 36 verified packages, silent installation, atomic PATH mutations
|-- package_manager.cpp/h    // Multi-source package manager abstraction (WinGet, Scoop, NPM, Pip)
|-- update_manager.cpp/h     // Updates Hub scheduler, concurrent querying, failure diagnosis
|-- path_doctor.cpp/h        // PATH Doctor health inspection, collision detection & length monitor
|-- recipe_manager.cpp/h     // .lazyenv declarative stack engine, smart diff & team deployment
|-- rollback.cpp/h           // Environment registry snapshot and non-destructive rollback engine
|-- resources/
|   |-- index.html           // Windows 11 Fluent UI structure with full i18n data attributes
|   |-- style.css            // Dark theme styling, expanded card layouts & responsive animations
|   |-- script.js            // Frontend pipeline, precise command maps & recipe diff engine
|   |-- i18n.js              // Complete bilingual dictionary (517 keys with 100% symmetry)
|   |-- icons.js             // Dedicated high-fidelity vector SVG icons for all 36 tools
|-- CMakeLists.txt           // Single-source version definition and CMake build configuration
|-- .github/workflows/       // Production GitHub Actions CI build and Release deployment pipelines
```

---

## Building from Source

### Prerequisites
- Windows 10 (1903+) or Windows 11
- Visual Studio (2022 / 2026 BuildTools with C++ Desktop Development workload, C++23 support)
- CMake 3.24+
- Microsoft Edge WebView2 Runtime (pre-installed on Windows 10/11)

### Build Steps

```powershell
# Clone the repository
git clone https://github.com/vjiaoziv/LazyEnv.git
cd LazyEnv

# Configure with CMake
cmake -B build -A x64

# Build Release binary
cmake --build build --config Release

# Output binary located at build/Release/LazyEnv.exe with web resources synchronized
```

---

## Contributors

Special thanks to everyone contributing to LazyEnv! Issues and Pull Requests are warmly welcome.

- [@vjiaoziv](https://github.com/vjiaoziv) - Project Maintainer & Core Developer
- [@ListerOvO1211](https://github.com/ListerOvO1211) - Core Contributor

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
[![](https://img.shields.io/badge/built_with-Codex-000000?style=flat-square&logo=openai&logoColor=white)](https://github.com/openai)

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
