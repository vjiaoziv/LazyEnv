# LazyEnv 更新路线图（v0.8.1 → v0.9 → v1.0）

> 依据 2026-10 网络调研（UniGetUI 机制对标、同类项目格局、声明式配置竞品分析）与仓库现状核验制定。
> 各阶段独立实施、独立验收；版本号遵循 SemVer。

## 一、现状基线（核验事实）

| 维度 | 现状 |
|---|---|
| 版本 | v0.8.0（`CMakeLists.txt` `project(LazyEnv VERSION 0.8.0)`），C++23 + WebView2 |
| CI/CD | **无**：`.github/` 不存在，发版靠手工打包 zip |
| 自更新 | **无**：全仓无 WinHTTP/网络代码，`checkUpdates` 仅查工具链包更新 |
| 包源 | 仅 4 源：`SourceType {Winget, Scoop, Npm, Pip}`（`package_manager.h:23-28`） |
| 配方 | `.lazyenv` formatVersion 1.0 = metadata/mirrors/packages/env vars/paths；无 OS 设置、post-install、幂等语义 |
| 许可证 | ⚠️ **矛盾待决**：README 声称 MIT，`LICENSE` 与源码头为 GPLv3 |
| 仓库卫生 | `versionmodifier.bat` 硬编码失效路径 `E:\Dev\LazyEnv`；`test_*.exe` 无对应源码；`LazyEnv-Release/`、`*.zip` 未忽略 |

## 二、阶段 0 — P0 治理与发布基线（v0.8.1）

1. **许可证统一（唯一需维护者拍板项）**：MIT 或 GPL-3.0 二选一 → 同步 `LICENSE`、`README.md` 徽章、`README_zh-CN.md`、全部 `.cpp/.h` 文件头。
2. **版本号单一来源**：以 `CMakeLists.txt project(VERSION)` 为准；修复 `versionmodifier.bat`（相对路径）或删除改为构建期同步 `LazyEnv.rc` 与前端版本显示。
3. **仓库卫生**：`.gitignore` 增加 `LazyEnv-Release/`、`*.zip`；补回 7 个 `test_*.exe` 的源码或移除二进制。
4. **CI**：GitHub Actions `windows-latest` + MSVC + `cmake -B build -A x64`，push/PR 触发，上传可运行 artifact。
5. **发版自动化**：tag `v*` 触发 → 打包 x64 zip + 生成 `SHA256SUMS.txt` 写入 Release（对标 UniGetUI 每资产公示 SHA256）。

**验收**：tag 推送后 GitHub Release 自动产出 zip + SHA256；CI 绿勾且 artifact 可下载运行。

## 三、阶段 1 — P0 内置自更新与分发（v0.9.0）

1. **self_updater 模块**（对标 UniGetUI 更新机制）：
   - WinHTTP（系统自带，零新依赖）请求 GitHub `releases/latest`，**双源回退**；
   - semver 比较 → 下载 zip → **BCrypt SHA256 校验** → 旁路替换重启（文件占用复用 `diagnoseFailure` 的 0x80070020 分类）；
   - 设置页「关于」加 Check for Updates，i18n 中英双语。
2. **分发渠道**：先自建 Scoop bucket（可控、即时），再提 winget-pkgs 清单（zip/portable，审核慢故后置）。

**验收**：`scoop install lazyenv` 可装；旧版应用内能用本地 fake feed 完成检测 + 自升级。

## 四、阶段 2 — P1 差异化加深（v0.9.x，护城河）

> 调研结论：这些能力 UniGetUI / mise / Dev Home 均不具备，是 LazyEnv 的差异化壁垒。

1. 镜像加速扩展：rsproxy/crates（Rust 栈）、`goproxy.cn`（Go）、阿里 Maven（Mobile 栈）。
2. PATH Doctor 加深：scoop shims、winget link 冲突、符号链接识别；健康报告导出。
3. 快照回滚扩展：镜像与环境变量变更全部纳入变更前快照。

**验收**：每项附手动测试步骤清单并逐一执行。

## 五、阶段 3 — P1 声明式 1.1 与 CLI（v1.0.0）

1. **`.lazyenv` formatVersion 1.1**（对标 mise / Windows Developer Configurations）：
   - 新增 `osSettings`、`postInstall`（命令列表）、幂等语义（Smart Diff 对 postInstall 记录已执行 hash，safe to re-run）；
   - 向后兼容 1.0（`formatVersion` 字段已预留，旧配方行为不变）。
2. **CLI 模式**（对标 UniGetUI docs/CLI.md）：`LazyEnv.exe --cli <cmd> [--json]`，子命令 `check-updates / deploy / doctor / mirror`，配 `docs/CLI.md`，stdout 输出 JSON。
3. **发布政策**：新增 `CHANGELOG.md`（Keep a Changelog + SemVer，minor 约 4–8 周一批）。

**验收**：`LazyEnv.exe --cli doctor --json` 输出合法 JSON；1.0 配方在 1.1 引擎上部署结果不变。

## 六、风险与边界

- **无代码签名证书** → 自更新暂以 SHA256 + 版本校验兜底；EV/OSPP 签名列为 v1.x 展望。
- **仅 x64** → win-arm64 构建（UniGetUI 已支持）列入 v1.x 展望。
- 自更新替换自身 exe 会遇文件锁 → 旁路 updater + 重启替换，复用现有错误分类。
- winget-pkgs 审核周期不可控 → Scoop bucket 先行；若许可证选 GPL-3.0，清单如实声明。
- 非平凡逻辑（semver 比较、1.1 幂等 diff）各留一个 assert 自检。

## 七、调研依据来源

- [UniGetUI Releases（v2026.1.0 双源回退 + SHA256 + 签名校验）](https://github.com/Devolutions/UniGetUI/releases/tag/v2026.1.0)
- [Devolutions 官方博客：UniGetUI 2026-03 被收购（MIT 不变，300K+ MAU）](https://devolutions.net/blog/unigetui-update-all-your-windows-software-in-one-place)
- [Microsoft Windows Developer Configurations](https://learn.microsoft.com/en-us/windows/dev-configs)
- [mise](https://mise.jdx.dev/)
- [winstall.app：UniGetUI 版本节奏](https://winstall.app/apps/Devolutions.UniGetUI)
- [Dmitry Yarygin：Windows 包管理器对比评测](https://yarygintech.com/articles/windows-package-managers)
