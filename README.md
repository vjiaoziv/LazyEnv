# LazyEnv

**English** | [中文](README_zh-CN.md)

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.8.2-0078D4?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/C%2B%2B-23-blue?style=flat-square&logo=c%2B%2B" alt="C++23" />
  <img src="https://img.shields.io/badge/UI-WebView2%20%7C%20Fluent-success?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square" alt="License" />
</p>

**Developer-centric out-of-the-box environment manager, high-speed mirror switcher, and multi-source update hub.**

Version: **0.8.2**

---

## Overview & Core Value

LazyEnv is a next-generation Windows development environment configurator and toolchain manager. Unlike generic software stores, LazyEnv focuses on resolving developers' key pain points: **tedious new machine setup, dependency conflicts, slow registry downloads in China/behind firewalls, and broken PATH variables**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LazyEnv Core Value Pillars                      │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 🚀 Dev Stacks      │ 🇨🇳 Mirror Speedup  │ 🛡️ Snapshot & Zero Pollution  │
│ 5 role-based quick │ npm/pip high-speed │ Mandatory pre-operation snap │
│ presets in 1 click │ mirror switching   │ with 1-click instant restore │
├────────────────────┴────────────────────┴──────────────────────────────┤
│ 🔄 Multi-Source Updates Hub: WinGet, Scoop, NPM (Global), Pip with live UI     │
└────────────────────────────────────────────────────────────────────────┘
```

---

> 🗺️ **Roadmap**: the phased update plan (v0.8.2 → v0.9 → v1.0) lives in [docs/ROADMAP.md](docs/ROADMAP.md).

## Key Feature Matrix

### 1. 🚀 5 Quick Dev Stacks (One-Click Setup)
Top of Home page features curated technology stacks:
- 🌐 **Web Frontend**: Node.js LTS, pnpm, Git, VS Code
- 🐍 **Python AI & Data**: Python 3.12, pip, Git, VS Code, jq
- ⚙️ **Modern C/C++**: LLVM/Clang, CMake, Ninja, Git, VS Code
- 🦀 **Rust Systems**: Rust (rustup), Cargo, Git, VS Code
- 📱 **Mobile & Cross-Platform**: Java JDK 21, Node.js LTS, Git, VS Code

### 2. 🇨🇳 Multi-Source Mirror Accelerator
Eliminates download timeouts by instantly switching package registries to high-speed domestic mirrors:
- **Node / NPM Mirror**: Switch between **Aliyun**, **Tencent**, **Tsinghua/npmmirror**, or official registry;
- **Python / Pip Mirror**: Switch between **Tsinghua**, **Aliyun**, **Tencent**, or official PyPI;
- Directly executes underlying CLI configurations with immediate system effect.

### 3. 🔄 Centralized Updates Hub
- **Multi-Source Aggregation**: Checks updates across **WinGet**, **Scoop**, **NPM (Global)**, and **Pip**;
- **Async Parallel Acceleration**: Powered by `std::async` multi-threaded queries, reducing scan times to ~10-15s;
- **Two-Layer Detailed Progress Dashboard**: Macro queue bar + micro task stage recognition (Preparing / Downloading / Verifying / Installing / Completed) + live console drawer;
- **Intelligent Diagnostics & One-Click Rollback**: Classifies errors (0x80070005 elevation, 0x80070020 process locked) with pre-update snapshot restoration.

### 4. 🩺 PATH Doctor Environment Health Inspector (New in v0.5.0)
Advanced diagnostics and automated governance for Windows PATH variables:
- **Comprehensive Dual-Layer Audit**: Expands `%USERPROFILE%` macros across User & System registry PATHs to verify physical directory existence;
- **Command Shadowing & Collision Detection**: Scans for multi-version conflicts across Python, Node, Git, Java, C++, Rust, explicitly identifying which binary is actively executed and which is shadowed;
- **Health Score Dashboard (0-100)**: Visual breakdown of Valid Entries, Dead Paths, Duplicates, and Collisions;
- **1-Click Auto Clean with Snapshot**: Safely purges dead directories and merges duplicates with automated pre-clean snapshot protection.

### 5. 📦 .lazyenv Stack Recipes & Team Standardization (New in v0.6.0)
Declarative development environment sharing for onboarding, new PCs, and team parity:
- **Declarative Recipe Specification (`.lazyenv` JSON)**: Self-contained definition of multi-source packages (WinGet, Scoop, NPM, Pip), high-speed mirror registries, and environment variables;
- **Smart Diff Preflight**: Compares incoming recipes against local machine state, clearly distinguishing `[Ready (Skip)]` and `[To Install]` items;
- **1-Click Incremental Deployment**: Automatically creates a rollback snapshot, applies mirror acceleration, deploys missing tools, and injects PATH variables seamlessly.

### 6. 🛡️ Environment Snapshot & PATH Governance
- Automatically creates environment snapshots before any mutating operation;
- Native registry editor for user/system variables and segmented PATH;
- Immediately broadcasts `WM_SETTINGCHANGE` across the Windows subsystem.

---

## Building from Source

```powershell
# Clone the repository
git clone https://github.com/vjiaoziv/LazyEnv.git
cd LazyEnv

# Configure with CMake
cmake -B build -A x64

# Build Release binary
cmake --build build --config Release

# Output binary located at build/Release/LazyEnv.exe
```

---

## Contributors

Special thanks to everyone contributing to LazyEnv! Issues and Pull Requests are warmly welcome.

- [@vjiaoziv](https://github.com/vjiaoziv) - Project Maintainer & Core Developer
- [@ListerOvO1211](https://github.com/ListerOvO1211) - Core Contributor

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
