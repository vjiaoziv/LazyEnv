# LazyEnv

[English](README.md) | **中文**

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.8.7-0078D4?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/C%2B%2B-23-blue?style=flat-square&logo=c%2B%2B" alt="C++23" />
  <img src="https://img.shields.io/badge/UI-WebView2%20%7C%20Fluent-success?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square" alt="License" />
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white" alt="powered by dsh" /></a>
  <a href="https://github.com/openai"><img src="https://img.shields.io/badge/built_with-Codex-000000?style=flat-square&logo=openai&logoColor=white" alt="built with Codex" /></a>
</p>

**专为开发者打造的开箱即用开发环境管家、极速换源与多源更新中心。**

版本: **0.8.4**

---

## 概述与核心价值定位

LazyEnv 是一款针对 Windows 平台深度定制的现代化开发环境配置与治理工具。不同于常规的通用大而全软件商店，LazyEnv 专注于解决开发者“**新机装环境难、依赖版本混乱、国内镜像下载超时、PATH 环境变量易被搞崩**”四大核心痛点：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LazyEnv 四大核心价值支柱                        │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 🚀 场景化开发栈    │ 🇨🇳 原生换源加速器  │ 🛡️ 快照回滚与零污染治理      │
│ 5 大角色预设一键装 │ npm/pip 极速镜像源 │ 注册表与 PATH 强制自动备份，  │
│ 齐依赖工具链与变量 │ 一键秒级生效切换   │ 秒级无损一键还原             │
├────────────────────┴────────────────────┴──────────────────────────────┤
│ 🔄 现代多源更新中心：聚合 WinGet、Scoop、NPM 全局包、Pip，带双层进度与智能诊断 │
└────────────────────────────────────────────────────────────────────────┘
```

---

> 🗺️ **路线图**：分阶段更新计划（v0.8.7 → v0.9 → v1.0）见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## 核心功能矩阵

### 1. 🚀 5 大热门场景化开发栈（一键配齐）
在主页顶部直观呈现常见角色开发栈，点击即可一键选定依赖组合并安装：
- 🌐 **Web 前端工程栈**：Node.js LTS, pnpm, Git, VS Code
- 🐍 **Python AI 与数据科学**：Python 3.12, pip, Git, VS Code, jq
- ⚙️ **现代 C/C++ 极速工程**：LLVM/Clang, CMake, Ninja, Git, VS Code
- 🦀 **Rust 系统编程栈**：Rust (rustup), Cargo, Git, VS Code
- 📱 **移动端与跨平台开发**：Java JDK 21, Node.js LTS, Git, VS Code

### 2. 🇨🇳 多源极速换源加速器 (Mirror Accelerator)
针对国内网络环境下 npm 与 pip 下载慢、更新卡顿的顽疾，在环境卡片中提供一键换源：
- **Node / NPM 换源**：支持一键切换为 **阿里云镜像**、**腾讯云镜像**、**淘宝 / npmmirror 镜像** 或官方源；
- **Python / Pip 换源**：支持一键切换为 **清华大学开源镜像**、**阿里云镜像**、**腾讯云镜像** 或官方源；
- 换源直接调用底层官方 CLI，秒级写入全局配置并立即生效。

### 3. 🔄 专属多源更新中心 (Updates Hub)
- **多包源聚合统一管理**：打破单一 WinGet 局限，原生支持 **WinGet、Scoop、NPM 全局包、Pip**；
- **并发异步提速**：采用 `std::async` 并行调度探测，单次全源检测缩短至 10~15 秒；
- **双层详细进度看板**：宏观任务队列总览 + 微观活动任务卡片（动态展示准备、下载、校验、安装等子阶段及精准传输百分比）；
- **智能失败诊断与一键安全回滚**：自动识别权限不足 (0x80070005) 与文件占用 (0x80070020)，失败提供针对性建议与绑定前置快照的【一键回滚】。
- **版本锁定 (Pin)**：对特定版本支持一键锁定，忽略更新并不再角标打扰。

### 4. 🩺 PATH Doctor 环境变量健康诊断器 (全新上线)
针对 Windows 长期开发导致的 PATH 臃肿死链与命令冲突痛点，提供专业级体检中心：
- **全量双层体检**：深入 Windows 注册表，自动展开 `%USERPROFILE%` 等宏变量，严格审计用户与系统 PATH 的物理存在性与规范性；
- **命令遮蔽与版本冲突诊断 (Command Shadowing)**：精准检测 Python、Node、Git、Java、C++、Rust 等主流工具的多版本共存状态，明确标出当前 Windows 实际优先调用的是哪个路径、哪些路径被意外遮蔽；
- **健康评分仪表板 (0~100)**：直观展现有效路径、失效死链、重复项与冲突项；
- **一键智能无损清理**：自动创建前置快照，秒级安全剔除所有物理死链与重复项，并即时广播 `WM_SETTINGCHANGE` 令全局生效。

### 5. 📦 .lazyenv 开发栈配方与团队标准化 (全新上线)
针对团队协作、入职新电脑、环境同步等场景，提供标准声明式配方导入/导出体系：
- **声明式配方格式 (`.lazyenv` JSON 规范)**：自包含全套多源软件包清单 (WinGet / Scoop / NPM / Pip)、国内镜像加速源、关键环境变量与 PATH；
- **智能差分预检 (Preflight & Diff)**：导入配方时自动与本机当前已安装环境对比，自动识别 `[已就绪跳过]` 与 `[待安装软件]`，指标清晰，避免重复安装；
- **一键增量安全部署**：部署前强制自动创建环境快照，先切换国内镜像加速，再并发部署缺失软件并注入环境变量，新机器一键达到开箱即用状态。

### 6. 🛡️ 环境变量快照回滚与零污染治理
- 任何安装、更新或变更前**强制自动创建系统环境快照**；
- 原生支持 Windows 用户级与系统级注册表环境变量查看与编辑；
- 提供可视化的分段式 PATH 变量编辑器，保存后即时广播 `WM_SETTINGCHANGE` 消息使变动全局生效。

---

## 架构

```
LazyEnv/
|-- main.cpp                 // WinMain 入口，窗口消息循环与 WebMessage 桥接 (包含换源 Action)
|-- webview_host.cpp/h       // WebView2 宿主管理与进程安全消息泵
|-- installer.cpp/h          // 原生命令执行管道、进程互斥安全锁与 UTF-8 编码自适应
|-- package_manager.cpp/h    // IPackageManager 抽象引擎 (WinGet, Scoop, NPM, Pip)
|-- update_manager.cpp/h     // 更新中心调度器、并发查询、失败诊断规则库
|-- path_doctor.cpp/h        // PATH Doctor 环境变量健康体检与冲突诊断引擎
|-- recipe_manager.cpp/h     // .lazyenv 声明式环境配方引擎、差分核验与团队标准化部署
|-- rollback.cpp/h           // 环境变量快照与回滚引擎
|-- resources/
|   |-- index.html           // Fluent UI 页面布局 (场景推荐卡片、更新中心看板等)
|   |-- style.css            // Windows 11 Fluent 视觉样式与动效
|   |-- script.js            // 前端流水线调度、预设栈联动与换源交互
|   |-- i18n.js              // 完善的中英双语国际化支持
|   |-- icons.js             // 开发工具与包源专属高保真矢量图标集
|-- LazyEnv.rc               // 原版天蓝色发光圆球图标与 v0.4.0 版本资源配置
|-- CMakeLists.txt           // CMake 跨平台构建规范
```

---

## 构建指南

### 前置要求
- Windows 10 (1903+) 或 Windows 11
- Visual Studio (2022 / 2026 BuildTools，包含 C++ 桌面开发工作负载)
- CMake 3.24+
- Microsoft Edge WebView2 运行时 (Windows 10/11 默认已预装)

### 构建步骤

```powershell
# 克隆仓库
git clone https://github.com/vjiaoziv/LazyEnv.git
cd LazyEnv

# 使用 CMake 配置
cmake -B build -A x64

# 编译 Release 目标
cmake --build build --config Release

# 产物生成于 build/Release/LazyEnv.exe，配套资源自动同步至 build/Release/resources/
```

---

## 贡献者 (Contributors)

感谢所有对 LazyEnv 做出贡献的开发者！欢迎提交 Issue 与 Pull Request 共同完善。

- [@vjiaoziv](https://github.com/vjiaoziv) - 项目维护者与核心开发者
- [@ListerOvO1211](https://github.com/ListerOvO1211) - 核心贡献者

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
[![](https://img.shields.io/badge/built_with-Codex-000000?style=flat-square&logo=openai&logoColor=white)](https://github.com/openai)

---

## 许可证

本项目采用 [GNU General Public License v3.0（GPL-3.0）](LICENSE) 许可证。
