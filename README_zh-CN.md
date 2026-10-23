# LazyEnv

[English](README.md) | **中文**

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.3.0-0078D4?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/C%2B%2B-23-blue?style=flat-square&logo=c%2B%2B" alt="C++23" />
  <img src="https://img.shields.io/badge/UI-WebView2%20%7C%20Fluent-success?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

**跨平台、可恢复、零污染的问卷式开发环境配置与多源更新中心。**

版本: **0.3.0**

---

## 概览

LazyEnv 是一款面向 Windows 平台的新一代现代开发环境配置与管理工具。它通过符合 Windows 11 Fluent Design 的现代化用户界面，引导开发者一键配置所需的工具链。同时具备强大的环境变量注册表管理、环境快照秒级回滚，以及基于 **WinGet、Scoop、NPM 全局包、Python Pip** 的多源更新大厅与智能故障诊断恢复体系。

### 核心设计原则

| 原则 | 描述 |
|-----------|-------------|
| **跨平台架构** | 抽象架构与平台后端解耦；Windows 上通过 Win32 + WebView2 提供极致的原生流畅体验 (P0) |
| **可恢复与零污染** | 任何安装或升级前**强制自动创建系统环境快照**；变更全程追踪可逆，彻底杜绝隐蔽的系统级污染 (P1) |
| **多源统一治理** | 统一纳管桌面安装器 (WinGet)、便携命令行生态 (Scoop)、Node 全局开发包 (NPM) 与 Python 模块 (Pip) (P2) |

---

## 核心功能特性

### 1. 专属更新中心 (Updates Hub) 与多源包管理
- **多源引擎聚合**：支持同时检索系统级软件 (WinGet)、便携免提权工具 (Scoop)、前端开发链 (NPM) 以及 Python 环境包 (Pip)。
- **并发异步提速**：采用 `std::async` 多源并行检测，检索耗时从 30s+ 大幅压缩至 10~15s 内。
- **分类标签过滤**：支持按来源标签 (`WinGet`, `Scoop`, `NPM`, `Pip`) 与版本锁定 (`Pinned`) 多维筛选。
- **版本锁定 (Pin / Ignore)**：针对项目强绑定的开发环境支持一键“锁定版本”，忽略非必要更新并不再在角标提示。

### 2. 双层详细进度看板与实时日志
- **宏观队列总览**：实时显示当前更新进度（如 `更新中 2 / 5 项`）及全局总百分比进度条。
- **微观子任务卡片**：动态识别并呈现子阶段：
  - `准备中 (Preparing)`：元数据与依赖检查
  - `下载中 (Downloading)`：精准解析已下载大小、总大小与百分比进度
  - `校验中 (Verifying)`：安装包签名与哈希校验
  - `安装中 (Installing)`：解压部署与 Shims 建立
  - `已完成 (Completed)` / `失败 (Failed)`
- **控制台日志抽屉**：支持实时展开/折叠终端原始输出，提供一键复制日志排错。

### 3. 全周期智能诊断与一键安全回滚
- **智能错误识别**：自动分析底层退出码与报错输出，分类提示：
  - `ELEVATION_REQUIRED`：权限不足，提供交互式 UAC 提权重试；
  - `FILE_LOCKED`：目标应用正在运行，引导关闭后台进程后重试；
  - `HASH_MISMATCH`：下载包损坏，建议重新下载；
  - `NETWORK_ERROR`：网络或代理故障提示。
- **一键安全回滚**：升级失败直接提供【一键回滚环境】按钮，直接绑定关联的升级前快照，秒级撤销环境变量与注册表变动。

### 4. 环境变量与注册表管理
- 原生读写 Windows 用户级与系统级环境变量；
- 具备可视化 PATH 变量分段编辑器；
- 修改后立即向 Windows 系统广播 `WM_SETTINGCHANGE` 消息，令变动无缝生效。

---

## 架构

```
LazyEnv/
|-- main.cpp                 // WinMain 入口，窗口消息循环与 WebMessage 桥接
|-- webview_host.cpp/h       // WebView2 宿主管理与进程安全消息泵
|-- installer.cpp/h          // 原生命令执行管道、进程互斥安全锁与 PATH 管理
|-- package_manager.cpp/h    // IPackageManager 抽象引擎 (WinGet, Scoop, NPM, Pip)
|-- update_manager.cpp/h     // 更新中心调度器、并发查询、失败诊断规则库
|-- rollback.cpp/h           // 环境变量快照与回滚引擎
|-- resources/
|   |-- index.html           // Fluent UI 页面布局 (主页, 更新中心, 设置, 恢复等)
|   |-- style.css            // Windows 11 Fluent 视觉样式
|   |-- script.js            // 前端状态管理与异步更新流水线调度
|   |-- i18n.js              // 完善的中英双语国际化支持
|   |-- icons.js             // 开发工具专属矢量图标集
|-- LazyEnv.rc               // 应用程序图标与 v0.3.0 版本资源配置
|-- CMakeLists.txt           // CMake 跨平台构建规范
```

---

## 构建指南

### 前置要求
- Windows 10 (1903+) 或 Windows 11
- 安装有 C++ 桌面开发工作负载的 Visual Studio (推荐 VS 2022 / 2026 BuildTools)
- CMake 3.24+
- Microsoft Edge WebView2 运行时 (Windows 10/11 默认已预装)

### 构建步骤

```powershell
# 克隆仓库
git clone https://github.com/vjiaoziv/LazyEnv.git
cd LazyEnv

# 使用 CMake 配置 (自动下载与接入 WebView2 SDK 与 WIL)
cmake -B build -A x64

# 编译 Release 目标
cmake --build build --config Release

# 产物生成于 build/Release/LazyEnv.exe，配套资源自动同步至 build/Release/resources/
```

---

## 使用方法

1. **启动应用**：运行 `LazyEnv.exe`；
2. **主页概览**：自动扫描本机已安装的环境，支持一键单独检测更新与卸载；
3. **更新中心**：点击左侧【更新中心】，一键并发检索所有包源，支持单包或全选一键更新；
4. **批量升级**：点击【全部更新】，系统自动创建环境快照并开启双层进度看板；
5. **故障排错**：若遇更新失败，在顶栏诊断卡片中查看建议，支持一键重试或一键秒级快照回滚；
6. **环境变量设置**：在【设置】页面直接查看、新增、编辑用户/系统环境变量与 PATH。

---

## 贡献者 (Contributors)

感谢所有对 LazyEnv 做出贡献的开发者！欢迎提交 Issue 与 Pull Request 共同完善。

- [@vjiaoziv](https://github.com/vjiaoziv) - 项目维护者与核心开发者
- [@ListerOvO1211](https://github.com/ListerOvO1211) - 核心贡献者

---

## 许可证

本项目采用 [MIT License](LICENSE) 许可证。
