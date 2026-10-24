# LazyEnv

[English](README.md) | **中文**

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.8.11-0078D4?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/C%2B%2B-23-blue?style=flat-square&logo=c%2B%2B" alt="C++23" />
  <img src="https://img.shields.io/badge/UI-WebView2%20%7C%20Fluent-success?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square" alt="License" />
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white" alt="powered by dsh" /></a>
  <a href="https://github.com/openai"><img src="https://img.shields.io/badge/built_with-Codex-000000?style=flat-square&logo=openai&logoColor=white" alt="built with Codex" /></a>
</p>

**专为 Windows 开发者打造的开箱即用环境管家、PATH 深度治理体检中心、国内极速换源与多源更新中心。**

当前版本：**v0.8.11**

---

## 核心价值定位

LazyEnv 专为解决 Windows 开发者在真实项目中经常遭遇的四大顽疾：**新机装环境繁琐耗时、多版本共存冲突遮蔽、国内镜像源配置断层、PATH 变量损坏臃肿**：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LazyEnv 四大核心价值基座                        │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 🚀 10 大黄金开发栈 │ 🇨🇳 原生多源换源    │ 🩺 PATH 深度治理体检中心     │
│ 覆盖 Web/AI/Go/Rust│ npm/pip/go/rust    │ 独立一级入口，死链深度清除、  │
│ 一键差分预检与部署 │ 国内极速镜像秒级切 │ 冲突遮蔽消除、字符超限监控   │
├────────────────────┴────────────────────┴──────────────────────────────┤
│ 🔄 多源更新中心与零污染快照：聚合 WinGet/Scoop/NPM/Pip，变更前强制快照，秒级回滚 │
└────────────────────────────────────────────────────────────────────────┘
```

> 🗺️ **更新路线图**：后续阶段演进计划见 [docs/ROADMAP.md](docs/ROADMAP.md)。

---

## 核心功能特性

### 1. 🚀 10 大黄金场景化开发栈（一键差分部署）
在【环境配方】与主页直观呈现全场景技术栈，导入即可触发 **Smart Diff 智能差分预检**，清晰呈现“已就绪项”与“待安装项”，避免重复下载：
- 🌐 **Web 全栈团队工程栈** (`web`)：Node.js LTS, pnpm, Git, VS Code，预设 npmmirror 加速源与 `NODE_ENV=development`。
- 🐍 **Python AI 与数据科学栈** (`ai`)：Python 3.12, pip, Git, VS Code, jq，预设清华源与 `PYTHONUTF8=1`。
- ⚡ **现代 Python / uv 极速开发栈** (`uv-ai`)：uv, Python 3.12, Git, VS Code, jq，由 Rust 驱动的下一代极速 Python 工作流。
- ⚙️ **现代 C/C++ 极速工程栈** (`systems`)：LLVM/Clang, CMake, Ninja, Git, VS Code，预配 `CC=clang` / `CXX=clang++`。
- 🦀 **Rust 高性能系统编程栈** (`rust`)：Rust (rustup), Cargo, Git, VS Code，预配 rsproxy 国内极速源。
- 🐹 **Go 云原生后端微服务栈** (`go-cloud`)：Go, Docker Desktop, PostgreSQL 16, Redis, Git, VS Code，预配 `GOPROXY=https://goproxy.cn,direct`。
- 📱 **移动端与跨平台工程栈** (`mobile`)：Java JDK 21, Node.js LTS, Git, VS Code，预配 `JAVA_HOME`。
- 🚀 **Windows 终极终端效率流** (`shell-powerhouse`)：Windows Terminal, PowerShell 7, Starship, zoxide, bat, eza, ripgrep, fd, fzf。
- ☁️ **云原生 DevOps & IaC 基础设施栈** (`devops-infra`)：Docker Desktop, kubectl, Helm, Terraform, GitHub CLI, jq。
- 🧰 **开发者通用基础工具箱** (`toolkit`)：Git, VS Code, 7-Zip, Windows Terminal。

### 2. 📦 36 款精选开发软件与权威通俗知识库
内置 36 款主流开发者工具，全量通过 WinGet 物理校验；在【软件包库】与【配方预检】全面采用**大卡片展开图文模式**，严格基于官方 README、官网 Slogan 与维基百科标准条目提供权威中英双语解读与新手标签：
- **现代运行时与版本管理**：uv (极速替代 pip), fnm (极速 Node 版本切换), vfox (原生多语言版本管家), mise (全能环境配置);
- **现代终端与 Shell 效率**：Windows Terminal, PowerShell 7, Starship (极速跨终端提示符), zoxide (智能秒级目录跳转), bat (语法高亮查看), eza (彩色目录列表);
- **Rust 极速命令行利器**：ripgrep (极速全盘代码搜索), fd (简明文件查找), fzf (终端交互模糊匹配), jq (命令行 JSON 处理);
- **云原生与 DevOps 基础设施**：Docker Desktop, kubectl, Helm, Terraform;
- **数据库与 API 调试套件**：DBeaver Community (全能通用数据库客户端), Postman, PostgreSQL 16, Redis;
- **系统核心工具**：7-Zip, Git, GitHub CLI, VS Code, Neovim, CMake, Ninja, LLVM/Clang, WinSCP 等。

### 3. 🩺 PATH Doctor 环境变量健康治理中心（独立一级主功能）
针对 Windows 长期使用导致的 PATH 臃肿失效、命令意外遮蔽等痛点，提供专业级治理引擎：
- **失效路径深度清理**：自动展开 `%USERPROFILE%` 等宏变量，严格物理核验用户与系统 PATH 的目录存在性，一键剔除无效死链与重复项；
- **同名工具版本冲突与路径遮蔽 (PATH Shadowing)**：精准扫描 Python、Node、Git、Java、C++、Rust 等多版本共存状态，明确标出系统优先调用的有效路径与被遮蔽路径；
- **RapidEE 级长度与缓冲区超限监控**：实时监控用户 PATH、系统 PATH 与合成 PATH 字符数，超过 2048 字符（早期 API 截断阈值）或 8192 字符（CMD 缓冲上限）时发出分级预警；
- **一键原子修复与广播**：严格采用单 Token 边界匹配，修改后即时广播 `WM_SETTINGCHANGE` 消息通知全系统生效。

### 4. 🇨🇳 原生多源换源加速器
- **NPM 镜像加速**：一键秒切阿里云、腾讯云、华为云、npmmirror 极速镜像源；
- **Python / Pip 镜像加速**：一键秒切清华大学开源镜像、阿里云、腾讯云、官方源；
- 换源直接调用底层官方 CLI，安全可靠。

### 5. 🔄 多源更新中心与版本锁定
- **多源聚合统一管理**：打破单一工具限制，原生聚合管理 **WinGet、Scoop、NPM 全局包、Pip**；
- **异步并发查询**：采用 `std::async` 多线程并行探测，全源扫描缩短至 10~15 秒；
- **双层详细进度看板**：宏观进度队列 + 微观子任务卡片（准备、下载、校验、安装等子阶段及进度百分比）；
- **版本锁定 (Pin)**：对特定版本支持一键锁定，忽略升级并不再打扰；
- **智能失败诊断与秒级回滚**：自动识别权限不足 (0x80070005) 与文件被占用 (0x80070020)，提供针对性引导并可直接一键回滚。

### 6. 🛡️ 环境变量快照回滚与零污染治理
- 任何安装、更新或环境变更前**强制自动创建系统环境快照**；
- 原生支持 Windows 用户级与系统级注册表环境变量查看、新建、编辑与删除；
- 内置核心环境变量百科释义（如 `JAVA_HOME`、`PYTHONUTF8`、`GOPROXY` 等），新手一目了然。

---

## 仓库架构一览

```
LazyEnv/
|-- main.cpp                 // WinMain 入口，无边框 DPI 自适应窗口，Native<->Web 消息桥接
|-- webview_host.cpp/h       // WebView2 宿主管理与进程安全消息泵
|-- installer.cpp/h          // 36 款官方验证软件包目录、静默安装管道与 PATH 原子维护
|-- package_manager.cpp/h    // 多源包管理器抽象层 (WinGet, Scoop, NPM, Pip)
|-- update_manager.cpp/h     // 更新中心调度器、并发探测、失败诊断规则库
|-- path_doctor.cpp/h        // PATH Doctor 环境变量健康体检、冲突遮蔽与长度监控引擎
|-- recipe_manager.cpp/h     // .lazyenv 声明式环境配方引擎、智能差分预检与团队标准化部署
|-- rollback.cpp/h           // 注册表环境快照与无损回滚引擎
|-- resources/
|   |-- index.html           // Windows 11 Fluent 页面骨架与全量多语言挂载
|   |-- style.css            // 现代深色模式主题、大卡片展开图文排版与响应式动效
|   |-- script.js            // 前端流水线调度、精准命令映射表与配方差分逻辑
|   |-- i18n.js              // 完善的中英双语国际化字典（517 对完整对称，无机翻）
|   |-- icons.js             // 36 款工具专属高保真纯矢量 SVG 图标集
|-- CMakeLists.txt           // CMake 单源版本控制与自动化构建规范
|-- .github/workflows/       // 完整的 GitHub Actions CI 检查与 Release 发布流水线
```

---

## 构建指南

### 前置要求
- Windows 10 (1903+) 或 Windows 11
- Visual Studio (2022 / 2026 BuildTools，包含 C++ 桌面开发工作负载，支持 C++23)
- CMake 3.24+
- Microsoft Edge WebView2 运行时 (Windows 10/11 通常已内置)

### 本地编译

```powershell
# 克隆仓库
git clone https://github.com/vjiaoziv/LazyEnv.git
cd LazyEnv

# 使用 CMake 配置
cmake -B build -A x64

# 编译 Release 目标
cmake --build build --config Release

# 产物生成于 build/Release/LazyEnv.exe，配套 web 资源自动同步
```

---

## 贡献与鸣谢 (Contributors)

感谢所有对 LazyEnv 做出贡献的开发者！欢迎提交 Issue 与 Pull Request。

- [@vjiaoziv](https://github.com/vjiaoziv) - 项目维护者与核心开发者
- [@ListerOvO1211](https://github.com/ListerOvO1211) - 核心贡献者

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
[![](https://img.shields.io/badge/built_with-Codex-000000?style=flat-square&logo=openai&logoColor=white)](https://github.com/openai)

---

## 许可证

本项目采用 [GNU General Public License v3.0 (GPL-3.0)](LICENSE) 许可证。
