# LazyEnv

**English** | [中文](README_zh-CN.md)

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.4.0-0078D4?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/C%2B%2B-23-blue?style=flat-square&logo=c%2B%2B" alt="C++23" />
  <img src="https://img.shields.io/badge/UI-WebView2%20%7C%20Fluent-success?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

**Developer-centric out-of-the-box environment manager, high-speed mirror switcher, and multi-source update hub.**

Version: **0.4.0**

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

### 4. 🛡️ Environment Snapshot & PATH Governance
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

This project is licensed under the [MIT License](LICENSE).
