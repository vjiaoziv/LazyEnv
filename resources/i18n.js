/*
 * LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
 * Copyright (C) 2026 Rein
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// ============================================================================
// LazyEnv - i18n.js
// Internationalization module with locale dictionaries and translation API.
// Supports: en, zh-CN
// ============================================================================

(function () {
    "use strict";

    // -----------------------------------------------------------------------
    // Language packs
    // -----------------------------------------------------------------------
    var locales = {

        // ===================================================================
        // English
        // ===================================================================
        "en": {
            // Titlebar
            "titlebar.label":                   "LazyEnv",
            "btn.minimize":                     "Minimize",
            "btn.maximize":                     "Maximize",
            "btn.close":                        "Close",

            // Sidebar
            "sidebar.search":                   "Search pages...",
            "sidebar.overview":                 "Overview",
            "sidebar.home":                     "Home",
            "sidebar.updates":                  "Updates",
            "sidebar.recipes":                  "Recipes & Stacks",
            "sidebar.doctor":                   "PATH Doctor",
            "doctor.pageTitle":                 "PATH Doctor Health Center",
            "doctor.pageDesc":                  "Inspect, clean duplicates & dead paths, and resolve command collisions across Windows PATH.",
            "doctor.cleanNoneNeeded":           "PATH environment is already clean and optimal! No duplicate or dead entries found.",
            "sidebar.settings":                 "Settings",
            "sidebar.setup":                    "Setup",
            "sidebar.syscheck":                 "System Check",
            "sidebar.packages":                 "Packages",
            "sidebar.install":                  "Install",
            "sidebar.maintenance":              "Maintenance",
            "sidebar.recovery":                 "Recovery",
            "sidebar.summary":                  "Summary",

            // Home
            "home.title":                       "Home",
            "home.desc":                        "Detected development environments on this machine.",

            // Home Dashboard Metrics & Empty State
            "home.metric.detected":             "Detected Envs",
            "home.metric.updates":              "Pending Updates",
            "home.metric.pathScore":            "PATH Health Score",
            "home.metric.recipesLink":          "Stack Recipes",
            "home.metric.browseRecipes":        "Explore 10 Stacks →",
            "home.empty.title":                 "No Development Environments Detected",
            "home.empty.desc":                  "Get started by deploying a standardized development stack with 1 click.",
            "home.empty.btn":                   "Browse Stack Recipes",
            "home.refresh":                     "Refresh",
            "home.addManual":                   "Add",
            "home.searchPlaceholder":           "Search environments...",
            "home.addTitle":                    "Manually add environment",
            "home.addCmdPlaceholder":           "e.g. python, node, rustc, gcc",
            "home.detect":                      "Detect",
            "home.checkUpdates":                "Check Updates",
            "home.checkingUpdates":             "Checking...",
            "home.updateAvailable":             "Update to {0}",
            "home.upToDate":                    "Up to date",
            "home.btnUpdate":                   "Update",
            "home.updating":                    "Updating...",
            "home.confirmUpdateTitle":          "Update Environment",
            "home.confirmUpdate":               "Are you sure you want to update {0} to {1}? A snapshot will be created automatically before upgrading.",
            "home.updateSuccess":               "{0} updated successfully",
            "home.updateFailed":                "Failed to update {0}",
            "home.noUpdatesFound":              "All environments are up to date",
            "home.updatesFound":                "Found {0} environment update(s)",

            // Updates Hub
            "updates.title":                    "Updates Hub",
            "updates.desc":                     "Manage updates across WinGet, Scoop, NPM and Pip with snapshot rollback protection.",
            "updates.tabAll":                   "All Updates",
            "updates.tabPinned":                "Pinned / Ignored",
            "updates.checkAll":                 "Check All Sources",
            "updates.updateAll":                "Update All",
            "updates.updateSelected":           "Update Selected",
            "updates.searchPlaceholder":        "Filter updates...",
            "updates.pin":                      "Pin Version",
            "updates.unpin":                    "Unpin",
            "updates.pinnedHint":               "Version locked",
            "updates.checking":                 "Checking for updates from all sources...",
            "updates.checkingDesc":             "Scanning WinGet, Scoop, NPM and Pip concurrently in background...",
            "updates.startupFound":             "Found {0} environment update(s). Check Updates Hub to review.",
            "updates.noUpdates":                "All packages and environments are up to date!",
            "updates.batchStarting":            "Starting batch upgrade...",
            "updates.batchComplete":            "Batch upgrade finished: {0} succeeded, {1} failed.",
            "updates.confirmBatch":             "Are you sure you want to upgrade {0} package(s)? A snapshot will be created automatically before upgrading.",

            // Progress & Diagnostics
            "phase.preparing":                  "Preparing",
            "phase.downloading":                "Downloading",
            "phase.verifying":                  "Verifying",
            "phase.installing":                 "Installing",
            "phase.completed":                  "Completed",
            "phase.failed":                     "Failed",
            "diag.rollbackTitle":               "One-Click Rollback",
            "diag.rollbackConfirm":             "Do you want to restore your environment variables from snapshot {0}? All changes from this batch will be reverted.",
            "diag.rollbackSuccess":             "Environment successfully restored to pre-update snapshot.",
            "diag.retrySuccess":                "Retry triggered for failed packages.",

            // Dev Stacks Presets
            "presets.title":                    "Quick Dev Stacks (One-Click Setup)",
            "presets.btnConfigure":             "Setup",
            "presets.webTitle":                 "Web Frontend",
            "presets.webDesc":                  "Node.js LTS, pnpm, Git, VS Code",
            "presets.pythonTitle":              "Python AI & Data",
            "presets.pythonDesc":               "Python 3.12, pip, Git, VS Code, jq",
            "presets.cppTitle":                 "Modern C/C++",
            "presets.cppDesc":                  "LLVM/Clang, CMake, Ninja, Git, VS Code",
            "presets.rustTitle":                "Rust Systems",
            "presets.rustDesc":                 "Rust (rustup), Cargo, Git, VS Code",
            "presets.mobileTitle":              "Mobile & Cross-Platform",
            "presets.mobileDesc":               "Java JDK 21, Node.js LTS, Git, VS Code",

            // Mirror Accelerator
            "mirror.btn":                       "Mirror",
            "mirror.title":                     "Mirror Accelerator Settings",
            "mirror.current":                   "Current Registry: ",
            "mirror.aliyun":                    "Aliyun Mirror (High-speed & stable)",
            "mirror.tsinghua":                  "Tsinghua / npmmirror (Community & University)",
            "mirror.official":                  "Official Registry (Default)",
            "mirror.custom":                    "Custom Registry URL",
            "mirror.apply":                     "Apply Mirror",
            "mirror.success":                   "Successfully switched {0} registry to {1}",

            // PATH Doctor
            "doctor.title":                     "PATH Doctor Health Inspector",
            "doctor.statusInit":                "Click 'Run Inspection' to analyze PATH health, dead links & command shadowing.",
            "doctor.statusHealthy":             "PATH health is excellent! No dead links or critical conflicts detected.",
            "doctor.statusWarning":             "PATH issues detected: dead links or duplicate entries found.",
            "doctor.statusDanger":              "PATH needs attention: critical dead paths or command shadowing detected.",
            "doctor.btnRun":                    "Run Inspection",
            "doctor.btnRunning":                "Inspecting...",
            "doctor.btnAutoClean":              "Auto Clean & Fix",
            "doctor.validLabel":                "Valid Entries",
            "doctor.deadLabel":                 "Dead Paths",
            "doctor.dupLabel":                  "Duplicates",
            "doctor.conflictLabel":             "Conflicts",
            "doctor.conflictsTitle":            "Command Shadowing & Binary Conflicts",
            "doctor.deadTitle":                 "Dead / Non-existent Paths",
            "doctor.dupTitle":                  "Duplicate Paths",
            "doctor.active":                    "[Active]  ",
            "doctor.shadowed":                  "[Shadowed]",
            "doctor.confirmCleanTitle":         "Auto-Clean PATH Variables",
            "doctor.confirmClean":              "Are you sure you want to remove all {0} dead path(s) and {1} duplicate(s)? An environment snapshot will be created automatically before cleaning.",
            "doctor.cleanSuccess":              "PATH cleaned successfully! {0} issues resolved. Changes broadcast to system.",
            "doctor.partialCleanSuccess":       "User PATH cleaned successfully! Some system PATH entries require Administrator rights to remove.",
            "doctor.elevationBanner":           "System PATH dead links or duplicates detected. Run as Administrator to clean system-level entries.",
            "doctor.btnRelaunchAdmin":          "Relaunch as Admin",
            "doctor.pathLengthTitle":           "PATH Length & Buffer Monitor",
            "doctor.pathLengthUser":            "User PATH: {0} chars",
            "doctor.pathLengthSys":             "System PATH: {0} chars",
            "doctor.pathLengthTotal":           "Total: {0} chars",
            "doctor.pathLengthSafe":            "Normal (Safe buffer)",
            "doctor.pathLengthWarn":            "Warning (>2048 chars, legacy truncation risk)",
            "doctor.pathLengthDanger":          "Critical (>8192 chars, command prompt limit exceeded)",
            "doctor.btnExportReport":           "Export Report",
            "doctor.btnReveal":                 "Locate",
            "doctor.btnPrioritize":             "Prioritize",
            "doctor.btnRemove":                 "Remove",
            "doctor.prioritizeConfirm":         "Move directory '{0}' to the front of User PATH? An environment snapshot will be created automatically.",
            "doctor.removeConfirm":             "Remove directory '{0}' from User PATH? An environment snapshot will be created automatically.",
            "doctor.prioritizeSuccess":         "Path prioritized! Changes broadcasted to system.",
            "doctor.removeSuccess":             "Path removed! Changes broadcasted to system.",
            "doctor.reportExported":            "Diagnostic report exported successfully.",

            // Recipes Hub
            "recipes.title":                    "Environment Recipes & Stacks (.lazyenv)",
            "recipes.desc":                     "Deploy standardized development stacks with 1 click, or export/import team recipes.",
            "recipes.btnExport":                "Export Current Environment",
            "recipes.btnImport":                "Import Recipe File",
            "recipes.btnDeploy":                "Deploy & Configure Environment",
            "recipes.toInstall":                "To Install",
            "recipes.skipped":                  "Ready (Skip)",
            "recipes.mirrors":                  "Mirrors",
            "recipes.envVars":                  "Env Vars",
            "recipes.featuredTitle":            "Curated Development Stacks",
            "recipes.exportTitle":              "Export Environment Recipe",
            "recipes.exportName":               "Recipe Name",
            "recipes.exportDesc":               "Description",
            "recipes.exportAuthor":             "Author",
            "recipes.exportSuccess":            "Environment recipe successfully exported to: {0}",
            "recipes.deployStarting":           "Starting deployment of recipe: {0}...",
            "recipes.deployComplete":           "Environment recipe successfully deployed! Snapshot created for rollback.",

            // Common Actions
            "common.collapseLog":               "Collapse Log",
            "common.expandLog":                 "Expand Log",
            "common.copyLog":                   "Copy Log",
            "common.clear":                     "Clear",
            "common.dismiss":                   "Dismiss",
            "common.author":                    "Author",
            "common.ready":                     "Ready (Skip)",
            "common.deploy":                    "Deploy",
            "common.inspect":                   "Inspect",
            "common.verify":                    "Verify",
            "common.active":                    "[Active]  ",
            "common.shadowed":                  "[Shadowed]",
            "common.updating":                  "Updating...",
            "common.installed":                 "Installed",

            // Toast Notifications
            "toast.recipeExportFailed":         "Failed to export environment recipe.",
            "toast.recipeImportFailed":         "Failed to parse or validate recipe file.",
            "toast.recipeDeployFailed":         "Failed to deploy recipe environment.",
            "toast.cleanPathFailed":            "Failed to clean PATH variables.",
            "toast.mirrorSetFailed":            "Failed to set mirror registry.",
            "toast.presetsSelected":            "Presets selected! Click 'Start Installation' to proceed.",
            "toast.verifyTitle":                "Command Verification: {0}",
            "toast.selectPackages":             "Please select packages to update.",

            // Diagnostics & Failure Categorization
            "diag.titleFailures":               "Upgrade Failures Detected",
            "diag.reason.ELEVATION_REQUIRED":   "Administrator privileges required (0x80070005)",
            "diag.sugg.ELEVATION_REQUIRED":     "Please run LazyEnv as Administrator or click 'Retry Interactively (UAC)'.",
            "diag.reason.FILE_LOCKED":          "Target application is currently running (Process / File locked)",
            "diag.sugg.FILE_LOCKED":            "Please close the application and its background processes, or click 'Retry Interactively'.",
            "diag.reason.HASH_MISMATCH":        "Package hash verification failed",
            "diag.sugg.HASH_MISMATCH":          "Installer download may be corrupted or outdated. Please retry later.",
            "diag.reason.NETWORK_ERROR":        "Network connection or download timeout",
            "diag.sugg.NETWORK_ERROR":          "Please check your network connection or proxy settings.",
            "diag.reason.UNKNOWN":              "Process exited with code {0}",
            "diag.sugg.UNKNOWN":                "Check detailed console logs or try Interactive mode.",
            "diag.summary":                     "{0} package(s) failed during upgrade. Pre-update snapshot is ready for instant rollback.",
            "diag.btnRetryFailed":              "Retry Failed Packages",
            "diag.btnRetryInteractive":         "Retry Interactively (UAC)",
            "diag.btnRollback":                 "One-Click Rollback",

            // Featured Stacks
            "featured.webName":                 "Full-Stack Web Team",
            "featured.webDesc":                 "Node.js LTS, pnpm, Git, VS Code with npmmirror acceleration.",
            "featured.aiName":                  "Python AI & Deep Learning",
            "featured.aiDesc":                  "Python 3.12, uv, pip, Git, VS Code with Tsinghua PyPI mirror.",
            "featured.systemsName":             "Modern C/C++ Systems",
            "featured.systemsDesc":             "LLVM/Clang, CMake, Ninja, Git, VS Code for low-level performance.",
            "featured.rustName":                "Rust Systems Programming",
            "featured.rustDesc":                "Rust (rustup), Cargo, Git, VS Code for memory-safe development.",
            "featured.mobileName":              "Mobile & Cross-Platform",
            "featured.mobileDesc":              "Java JDK 21, Node.js LTS, Git, VS Code for cross-platform apps.",
                        "featured.uvAiName":                "Modern Python & AI Stack",
            "featured.uvAiDesc":                "Ultra-fast Python workflow powered by uv, PyPI mirror, UTF-8 environment and VS Code.",
            "featured.goCloudName":             "Go Cloud-Native Backend",
            "featured.goCloudDesc":             "Go runtime, GoProxy China mirror, Docker Desktop, and VS Code for microservices.",
            "featured.shellPowerName":          "Windows Terminal Powerhouse",
            "featured.shellPowerDesc":          "Ultimate Windows CLI experience: Terminal, PowerShell 7, Starship, zoxide, ripgrep, bat, and fzf.",
            "featured.devopsInfraName":         "DevOps & Cloud Infrastructure",
            "featured.devopsInfraDesc":         "Containerization and IaC suite: Docker, kubectl, Helm, Terraform, and GitHub CLI.",
"featured.toolkitName":             "Developer Essential Toolkit",
            "featured.toolkitDesc":             "Git, VS Code, 7-Zip, Windows Terminal for modern desktop workflows.",

            "updates.logCopied":                "Console log copied to clipboard.",
            "updates.selectRequired":           "Please select packages to update.",
            "updates.noSnapshotAvailable":      "No pre-update snapshot available.",
            "updates.startingSingle":           "Starting upgrade for {0}...",

            // Categories
            "category.language":                "Language / Runtime",
            "category.tool":                    "Dev & Build Tools",
            "category.runtime":                 "Container / VM",
            "category.utility":                 "Utility",
            "category.editor":                  "Editor / IDE",
            "category.database":                "Database",
            "category.other":                   "Other",

            // Environment cards
            "env.scanning":                     "Scanning system...",
            "env.noMatch":                      "No matching environments found.",
            "env.btnUninstall":                 "Uninstall",
            "env.confirmUninstallTitle":        "Confirm Uninstall",
            "env.confirmUninstall":             "Uninstall {0} via winget?",
            "env.uninstallSuccess":             "Uninstalled: {0}",
            "env.uninstallFailed":              "Uninstall failed.",

            // Probe
            "probe.detecting":                  "Detecting...",
            "probe.found":                      "Found: {0}",
            "probe.notFound":                   "Not found.",
            "probe.addedToast":                 "Added: {0} ({1})",

            // Settings (Environment Variable Editor)
            "settings.title":                   "Settings",
            "settings.desc":                    "Manage environment variables directly. Changes take effect immediately.",
            "settings.snapshotHint":            "A snapshot will be automatically created before any modification for safe rollback.",
            "settings.userVars":                "User Variables",
            "settings.systemVars":              "System Variables",
            "settings.addNew":                  "New Variable",
            "settings.searchPlaceholder":       "Search variables...",
            "settings.colName":                 "Name",
            "settings.colValue":                "Value",
            "settings.colActions":              "Actions",
            "settings.loading":                 "Loading environment variables...",
            "settings.noMatch":                 "No matching variables found.",
            "settings.edit":                    "Edit",
            "settings.delete":                  "Delete",
            "settings.save":                    "Save",
            "settings.type":                    "Type",
            "settings.newVarTitle":             "New Variable",
            "settings.editVarTitle":            "Edit: {0}",
            "settings.nameRequired":            "Variable name is required.",
            "settings.pathAdd":                 "Add Entry",
            "settings.saveSuccess":             "Variable saved successfully.",
            "settings.saveFailed":              "Failed to save variable: {0}",
            "settings.deleteSuccess":           "Variable deleted successfully.",
            "settings.deleteFailed":            "Failed to delete variable: {0}",
            "settings.confirmDeleteTitle":      "Confirm Delete",
            "settings.confirmDelete":           "Delete environment variable \"{0}\"?",

            // System Check
            "syscheck.title":                   "System Check",
            "syscheck.desc":                    "Verify system prerequisites before installation.",
            "syscheck.rerun":                   "Re-run Checks",
            "syscheck.goRecipes":               "Browse Stack Recipes →",
            "syscheck.goPackages":              "Browse Packages",
            "syscheck.os":                      "OS & Architecture",
            "syscheck.privilege":               "Process Privilege",
            "syscheck.privAdmin":               "Administrator (Elevated)",
            "syscheck.privUser":                "Standard User (Normal)",
            "syscheck.devMode":                 "Developer Mode",
            "syscheck.devModeOn":               "Enabled (Symlinks Allowed)",
            "syscheck.devModeOff":              "Disabled (Symlink restricted)",
            "syscheck.storage":                 "System Storage (C:)",
            "syscheck.pkgManagers":             "Package Managers Matrix",
            "syscheck.webview2":                "WebView2 Runtime",
            "syscheck.statusReady":             "Ready",
            "syscheck.statusWarning":           "Notice",
            "syscheck.statusMissing":           "Missing",

            // Install & Summary Empty States
            "install.emptyTitle":               "No Active Installation",
            "install.emptyDesc":                "Select development tools from Packages or deploy a Stack Recipe to begin installation.",
            "install.goPackages":               "Select Packages →",
            "install.goRecipes":                "Explore Stacks",
            "summary.historyTitle":             "Recent Installation History",
            "summary.viewEnvs":                 "View Environments →",
            "summary.goPackages":               "Browse Packages",
            "summary.noHistory":                "No Installation Records",
            "summary.noHistoryDesc":            "Installation results, status logs, and snapshot records will appear here after packages are installed.",

            // Settings Tabs & Preferences
            "settings.tabDoctor":               "PATH Doctor",
            "settings.tabEnvVars":              "Environment Variables",
            "settings.tabPreferences":          "Preferences",
            "settings.prefApp":                 "Application Preferences",
            "settings.prefLang":                "Interface Language",
            "settings.prefLangDesc":            "Choose display language across the application.",
            "settings.prefStartup":             "Startup Auto Update Check",
            "settings.prefStartupDesc":         "Automatically check all package managers for tool updates when LazyEnv starts.",
            "settings.prefAbout":               "About LazyEnv",
            "settings.prefOpenRepo":            "GitHub Repository",
            "syscheck.rerun":                   "Re-run Checks",
            "check.os":                         "Operating System",
            "check.webview2":                   "WebView2 Runtime",
            "check.winget":                     "winget Package Manager",
            "check.detecting":                  "Detecting...",
            "check.available":                  "Available",
            "check.checking":                   "Checking...",
            "check.notFound":                   "Not found",

            // Packages
            "packages.title":                   "Packages",
            "packages.desc":                    "Select development tools to install.",
            "packages.selectAll":               "Select All",
            "packages.deselectAll":             "Deselect All",
            "packages.searchPlaceholder":       "Search packages...",
            "packages.startInstall":            "Start Installation",
            "packages.selectedCount":           "{0} selected",

            // Install
            "install.title":                    "Installation",
            "install.desc":                     "Installing selected packages...",
            "install.progressText":             "{0} / {1} packages",
            "install.pending":                  "Pending",
            "install.installing":               "Installing...",
            "install.installed":                "Installed",
            "install.failed":                   "Failed (exit {0})",
            "install.skipped":                  "Already installed",
            "install.waitingOutput":            "Waiting for output...",
            "install.noPackages":               "No packages queued.",
            "install.btnRetry":                 "Retry",
            "install.retrying":                 "Retrying...",
            "install.waiting":                  "Waiting...",

            // Recovery
            "recovery.title":                   "Recovery",
            "recovery.desc":                    "Manage environment snapshots. Restore previous states or import/export configurations.",
            "recovery.create":                  "Create Snapshot",
            "recovery.import":                  "Import",
            "recovery.emptyState":              "No snapshots yet. Create one to get started.",
            "recovery.userCount":               "User: {0}",
            "recovery.systemCount":             "System: {0}",
            "recovery.btnRestore":              "Restore",
            "recovery.btnExport":               "Export",
            "recovery.btnDelete":               "Delete",
            "recovery.confirmRestoreTitle":     "Confirm Restore",
            "recovery.confirmRestore":          "Restore environment from this snapshot? Current variables will be overwritten.",
            "recovery.confirmDeleteTitle":      "Confirm Delete",
            "recovery.confirmDelete":           "Delete this snapshot permanently?",
            "recovery.restoreSuccess":          "Environment restored successfully.",
            "recovery.restoreFailed":           "Restore failed. Check admin permissions.",
            "recovery.exportSuccess":           "Snapshot exported successfully.",
            "recovery.exportFailed":            "Failed to export snapshot.",
            "recovery.importSuccess":           "Snapshot imported successfully.",
            "recovery.importFailed":            "Failed to import snapshot. Check file format.",
            "recovery.createTitle":             "Create Snapshot",
            "recovery.descLabel":               "Description (optional)",
            "recovery.defaultDesc":             "Manual snapshot",
            "recovery.createSuccess":           "Snapshot created successfully.",
            "recovery.createFailed":            "Failed to create snapshot. Check that the LazyEnv data folder is writable.",

            // Summary
            "summary.title":                    "Summary",
            "summary.desc":                     "Installation results overview.",
            "summary.emptyState":               "No installation data yet.",
            "summary.colName":                  "Package",
            "summary.colStatus":                "Status",
            "summary.colCommand":               "Command",
            "summary.colMessage":               "Details",
            "summary.success":                  "Success",
            "summary.failed":                   "Failed",
            "summary.skipped":                  "Skipped",

            // Dialog
            "dialog.cancel":                    "Cancel",

            // Errors
            "error.internal":                   "Internal error occurred. Please try again.",

            // Language switcher
                        // Newly Added UI Keys
            "updates.updatingBatchTitle":       "Updating packages...",
            "updates.preparingPill":            "Preparing",
            "updates.startingInstaller":        "Starting installer...",
            "updates.failedNotice":             "Some packages failed to update. A pre-update snapshot is available to restore your system anytime.",
            "recipes.diffPreflightTitle":       "Recipe Diff Preflight",
            "recipes.authorLabel":              "Author",
            "recipes.normalStatus":             "Standard",
            "packages.stickySelected":          "{0} item(s) selected",
            "syscheck.freeSpace":               "Free",
            "home.metric.envsValue":            "{0} tools",
            "home.metric.updatesValue":         "{0} available",
            "home.metric.scoreValue":           "{0} pts",
            "home.metric.healthySub":           "Healthy & Clean",
            "home.metric.inspectSub":           "Click to inspect →",
            "home.metric.conflictDupSub":       "{0} conflicts · {1} duplicates",
            "mirror.preset.aliyun":             "Aliyun Mirror",
            "mirror.preset.tencent":            "Tencent Cloud Mirror",
            "mirror.preset.huawei":             "Huawei Cloud Mirror",
            "mirror.preset.official":           "Official Registry (Default)",
            "mirror.preset.tsinghua":           "Tsinghua University Mirror",
"lang.label":                       "Language"
        },

        // ===================================================================
        // Simplified Chinese
        // ===================================================================
        "zh-CN": {
            // Titlebar
            "titlebar.label":                   "LazyEnv",
            "btn.minimize":                     "\u6700\u5c0f\u5316",
            "btn.maximize":                     "\u6700\u5927\u5316",
            "btn.close":                        "\u5173\u95ed",

            // Sidebar
            "sidebar.search":                   "\u641c\u7d22\u9875\u9762...",
            "sidebar.overview":                 "\u6982\u89c8",
            "sidebar.home":                     "\u4e3b\u9875",
            "sidebar.updates":                  "更新中心",
            "sidebar.recipes":                  "配方与开发栈",
            "sidebar.doctor":                   "PATH 治理",
            "doctor.pageTitle":                 "PATH 环境变量健康治理中心",
            "doctor.pageDesc":                  "全面检查系统与用户 PATH 变量，自动排重、清理失效路径，化解同名工具版本冲突与路径遮蔽。",
            "doctor.cleanNoneNeeded":           "PATH 环境变量已处于最佳状态，未检测到失效路径或重复项。",
            "sidebar.settings":                 "\u8bbe\u7f6e",
            "sidebar.setup":                    "\u914d\u7f6e",
            "sidebar.syscheck":                 "\u7cfb\u7edf\u68c0\u67e5",
            "sidebar.packages":                 "\u8f6f\u4ef6\u5305",
            "sidebar.install":                  "\u5b89\u88c5",
            "sidebar.maintenance":              "\u7ef4\u62a4",
            "sidebar.recovery":                 "\u6062\u590d",
            "sidebar.summary":                  "\u6458\u8981",

            // Home
            "home.title":                       "\u4e3b\u9875",
            "home.desc":                        "\u68c0\u6d4b\u5230\u7684\u672c\u673a\u5f00\u53d1\u73af\u5883\u3002",

            // 主页仪表盘指标与空状态
            "home.metric.detected":             "已检测环境",
            "home.metric.updates":              "可用更新",
            "home.metric.pathScore":            "PATH 健康评分",
            "home.metric.recipesLink":          "环境配方",
            "home.metric.browseRecipes":        "浏览 10 套开发栈 →",
            "home.empty.title":                 "未检测到本地开发环境",
            "home.empty.desc":                  "推荐从精选场景开发栈一键配齐工具链、镜像加速与环境变量。",
            "home.empty.btn":                   "浏览开发栈配方",
            "home.refresh":                     "\u5237\u65b0",
            "home.addManual":                   "\u6dfb\u52a0",
            "home.searchPlaceholder":           "\u641c\u7d22\u73af\u5883...",
            "home.addTitle":                    "\u624b\u52a8\u6dfb\u52a0\u5f00\u53d1\u73af\u5883",
            "home.addCmdPlaceholder":           "\u4f8b\u5982 python, node, rustc, gcc",
            "home.detect":                      "\u68c0\u6d4b",
            "home.checkUpdates":                "\u68c0\u6d4b\u66f4\u65b0",
            "home.checkingUpdates":             "\u6b63\u5728\u68c0\u6d4b...",
            "home.updateAvailable":             "\u53ef\u66f4\u65b0\u81f3 {0}",
            "home.upToDate":                    "\u5df2\u662f\u6700\u65b0",
            "home.btnUpdate":                   "\u66f4\u65b0",
            "home.updating":                    "\u6b63\u5728\u66f4\u65b0...",
            "home.confirmUpdateTitle":          "\u66f4\u65b0\u5f00\u53d1\u73af\u5883",
            "home.confirmUpdate":               "\u786e\u5b9a\u8981\u5c06 {0} \u66f4\u65b0\u81f3 {1} \u5417\uff1f\u7cfb\u7edf\u5c06\u5728\u5347\u7ea7\u524d\u81ea\u52a8\u521b\u5efa\u73af\u5883\u5feb\u7167\u4ee5\u4fdd\u969c\u5b89\u5168\u3002",
            "home.updateSuccess":               "{0} \u5df2\u6210\u529f\u66f4\u65b0",
            "home.updateFailed":                "{0} \u66f4\u65b0\u5931\u8d25",
            "home.noUpdatesFound":              "\u5f53\u524d\u6240\u6709\u5f00\u53d1\u73af\u5883\u5747\u5df2\u662f\u6700\u65b0\u7248\u672c",
            "home.updatesFound":                "\u53d1\u73b0 {0} \u4e2a\u73af\u5883\u6709\u53ef\u7528\u66f4\u65b0",

            // Updates Hub
            "updates.title":                    "更新中心",
            "updates.desc":                     "集中管理 WinGet、Scoop、NPM 和 Pip 的更新，并提供环境快照一键回滚保护。",
            "updates.tabAll":                   "全部更新",
            "updates.tabPinned":                "已锁定 / 忽略",
            "updates.checkAll":                 "检测所有更新源",
            "updates.updateAll":                "全部更新",
            "updates.updateSelected":           "更新所选",
            "updates.searchPlaceholder":        "筛选更新软件...",
            "updates.pin":                      "锁定版本",
            "updates.unpin":                    "解除锁定",
            "updates.pinnedHint":               "版本已锁定",
            "updates.checking":                 "正在从所有包源检测更新...",
            "updates.checkingDesc":             "正在后台并发检测 WinGet、Scoop、NPM 和 Pip 中的环境更新...",
            "updates.startupFound":             "已检测到 {0} 个环境有可用更新，前往更新中心查看。",
            "updates.noUpdates":                "当前所有软件包与开发环境均已是最新版本！",
            "updates.batchStarting":            "正在启动批量升级...",
            "updates.batchComplete":            "批量升级已完成：{0} 个成功，{1} 个失败。",
            "updates.confirmBatch":             "确定要批量升级选中的 {0} 个软件吗？系统将在升级前自动创建环境快照以保障安全。",

            // Progress & Diagnostics
            "phase.preparing":                  "准备中",
            "phase.downloading":                "下载中",
            "phase.verifying":                  "校验中",
            "phase.installing":                 "正在安装",
            "phase.completed":                  "已完成",
            "phase.failed":                     "失败",
            "diag.rollbackTitle":               "一键安全回滚",
            "diag.rollbackConfirm":             "确定要使用更新前创建的快照 {0} 回滚环境变量吗？本次更新的所有配置变更将被撤销并恢复纯净状态。",
            "diag.rollbackSuccess":             "已成功恢复至更新前的系统环境快照！",
            "diag.retrySuccess":                "已重新发起失败项的升级处理。",

            // Dev Stacks Presets
            "presets.title":                    "场景化开箱即用开发栈（一键配齐）",
            "presets.btnConfigure":             "一键配置",
            "presets.webTitle":                 "Web 前端工程栈",
            "presets.webDesc":                  "Node.js LTS, pnpm, Git, VS Code",
            "presets.pythonTitle":              "Python AI 与数据科学",
            "presets.pythonDesc":               "Python 3.12, pip, Git, VS Code, jq",
            "presets.cppTitle":                 "现代 C/C++ 极速工程",
            "presets.cppDesc":                  "LLVM/Clang, CMake, Ninja, Git, VS Code",
            "presets.rustTitle":                "Rust 系统编程栈",
            "presets.rustDesc":                 "Rust (rustup), Cargo, Git, VS Code",
            "presets.mobileTitle":              "移动端与跨平台开发",
            "presets.mobileDesc":               "Java JDK 21, Node.js LTS, Git, VS Code",

            // Mirror Accelerator
            "mirror.btn":                       "换源加速",
            "mirror.title":                     "镜像换源加速设置",
            "mirror.current":                   "当前活跃镜像源：",
            "mirror.aliyun":                    "阿里云国内高速镜像 (极速稳定，推荐)",
            "mirror.tsinghua":                  "清华大学 / npmmirror 镜像 (高校与官方维护)",
            "mirror.official":                  "官方默认原始源 (海外直连)",
            "mirror.custom":                    "自定义镜像源地址",
            "mirror.apply":                     "应用换源",
            "mirror.success":                   "已成功将 {0} 镜像源切换至 {1}",

            // PATH Doctor
            "doctor.title":                     "PATH Doctor 环境变量健康体检中心",
            "doctor.statusInit":                "点击【全面体检】深度分析 PATH 变量健康度、失效路径与命令版本冲突。",
            "doctor.statusHealthy":             "PATH 环境变量健康状况优异！未检测到失效路径或关键命令冲突。",
            "doctor.statusWarning":             "检测到 PATH 异常项：发现部分失效路径或重复包含项。",
            "doctor.statusDanger":              "PATH 存在异常隐患：检测到多项失效路径或同名开发工具版本冲突！",
            "doctor.btnRun":                    "全面体检",
            "doctor.btnRunning":                "正在体检...",
            "doctor.btnAutoClean":              "一键优化与清理",
            "doctor.validLabel":                "有效路径",
            "doctor.deadLabel":                 "失效路径",
            "doctor.dupLabel":                  "重复路径",
            "doctor.conflictLabel":             "重名冲突",
            "doctor.conflictsTitle":            "同名工具版本冲突与路径遮蔽 (PATH Shadowing)",
            "doctor.deadTitle":                 "不存在的失效路径 (Invalid Paths)",
            "doctor.dupTitle":                  "重复包含的路径 (Duplicates)",
            "doctor.active":                    "[优先生效]",
            "doctor.shadowed":                  "[被遮蔽]  ",
            "doctor.confirmCleanTitle":         "一键清理 PATH 环境变量",
            "doctor.confirmClean":              "确定要自动移除全部 {0} 个失效路径并合并 {1} 个重复项吗？系统将在清理前自动创建环境快照以保障安全。",
            "doctor.cleanSuccess":              "PATH 环境变量已成功清理修复！已解决全部 {0} 项异常，变更已广播生效。",
            "doctor.partialCleanSuccess":       "用户 PATH 环境变量已成功清理！部分系统级失效路径需要管理员权限才能移除。",
            "doctor.elevationBanner":           "检测到系统级异常（失效路径或重复项）。以管理员身份运行可清理系统级变量。",
            "doctor.btnRelaunchAdmin":          "以管理员身份重启",
            "doctor.pathLengthTitle":           "PATH 长度与缓冲区监控",
            "doctor.pathLengthUser":            "用户 PATH: {0} 字符",
            "doctor.pathLengthSys":             "系统 PATH: {0} 字符",
            "doctor.pathLengthTotal":           "总计: {0} 字符",
            "doctor.pathLengthSafe":            "正常 (安全边界内)",
            "doctor.pathLengthWarn":            "预警 (>2048 字符，存在兼容性截断隐患)",
            "doctor.pathLengthDanger":          "超限危险 (>8192 字符，超过 cmd.exe 缓冲上限)",
            "doctor.btnExportReport":           "导出体检报告",
            "doctor.btnReveal":                 "定位目录",
            "doctor.btnPrioritize":             "置顶此路径",
            "doctor.btnRemove":                 "从PATH移除",
            "doctor.prioritizeConfirm":         "确定要将目录 “{0}” 移至用户 PATH 最前面以优先加载吗？系统会自动创建环境快照。",
            "doctor.removeConfirm":             "确定要将目录 “{0}” 从用户 PATH 中移除吗？系统会自动创建环境快照。",
            "doctor.prioritizeSuccess":         "路径已成功置顶优先！系统已广播生效。",
            "doctor.removeSuccess":             "路径已成功从 PATH 中移除！系统已广播生效。",
            "doctor.reportExported":            "体检报告已成功导出。",

            // Recipes Hub
            "recipes.title":                    "开发环境配方与开发栈 (.lazyenv)",
            "recipes.desc":                     "一键增量部署标准化开发栈，或导入/导出团队环境配方。",
            "recipes.btnExport":                "导出本机环境配方",
            "recipes.btnImport":                "导入配方文件 (.lazyenv)",
            "recipes.btnDeploy":                "一键增量部署与配置",
            "recipes.toInstall":                "待安装软件",
            "recipes.skipped":                  "已就绪跳过",
            "recipes.mirrors":                  "镜像加速源",
            "recipes.envVars":                  "环境变量项",
            "recipes.featuredTitle":            "官方精选场景开发栈",
            "recipes.exportTitle":              "导出开发环境配方",
            "recipes.exportName":               "配方名称",
            "recipes.exportDesc":               "配方描述",
            "recipes.exportAuthor":             "维护者/作者",
            "recipes.exportSuccess":            "环境配方已成功导出至：{0}",
            "recipes.deployStarting":           "正在启动配方部署：{0}...",
            "recipes.deployComplete":           "开发环境配方已成功部署就绪！系统已创建前置快照以备回滚。",

            // 通用操作 (Common Actions)
            "common.collapseLog":               "折叠日志",
            "common.expandLog":                 "展开日志",
            "common.copyLog":                   "复制日志",
            "common.clear":                     "清空",
            "common.dismiss":                   "关闭",
            "common.author":                    "维护者",
            "common.ready":                     "已就绪 (跳过)",
            "common.deploy":                    "部署",
            "common.inspect":                   "查看",
            "common.verify":                    "在终端验证",
            "common.active":                    "[优先生效]",
            "common.shadowed":                  "[被遮蔽]  ",
            "common.updating":                  "正在更新...",
            "common.installed":                 "已安装",

            // 消息通知 (Toast Notifications)
            "toast.recipeExportFailed":         "导出开发环境配方失败。",
            "toast.recipeImportFailed":         "解析或核验环境配方文件失败。",
            "toast.recipeDeployFailed":         "部署开发环境配方失败。",
            "toast.cleanPathFailed":            "清理 PATH 环境变量失败。",
            "toast.mirrorSetFailed":            "切换镜像源失败。",
            "toast.presetsSelected":            "已为您预选该开发栈软件包，点击右下角【开始安装】即可配置。",
            "toast.verifyTitle":                "命令验证结果：{0}",
            "toast.selectPackages":             "请先勾选需要更新的软件包。",

            // 故障诊断与分类 (Diagnostics)
            "diag.titleFailures":               "检测到软件包升级失败",
            "diag.reason.ELEVATION_REQUIRED":   "安装过程需要 Windows 管理员权限 (0x80070005)",
            "diag.sugg.ELEVATION_REQUIRED":     "请以管理员身份运行 LazyEnv，或点击下方【交互式重试 (UAC)】调起系统提权向导。",
            "diag.reason.FILE_LOCKED":          "目标应用程序正在后台运行中，文件被系统锁定占用 (0x80070020)",
            "diag.sugg.FILE_LOCKED":            "请先关闭该应用程序及其后台进程，或点击【交互式重试】由安装器协助关闭。",
            "diag.reason.HASH_MISMATCH":        "软件包哈希校验失败",
            "diag.sugg.HASH_MISMATCH":          "安装包下载文件损坏或源缓存异常，建议稍后重试。",
            "diag.reason.NETWORK_ERROR":        "网络连接超时或源不可达",
            "diag.sugg.NETWORK_ERROR":          "请检查您的网络连接或代理设置后重试。",
            "diag.reason.UNKNOWN":              "进程异常退出 (退出码 {0})",
            "diag.sugg.UNKNOWN":                "请查看详细控制台日志排查，或尝试使用交互式安装。",
            "diag.summary":                     "共有 {0} 个软件包升级失败。系统已为您自动创建前置快照，支持一键秒级回滚。",
            "diag.btnRetryFailed":              "重试所有失败项",
            "diag.btnRetryInteractive":         "交互式重试 (UAC)",
            "diag.btnRollback":                 "一键安全回滚",

            // 精选开发栈 (Featured Stacks)
            "featured.webName":                 "Web 全栈团队工程栈",
            "featured.webDesc":                 "Node.js LTS, pnpm, Git, VS Code 并预置 npmmirror 极速镜像加速。",
            "featured.aiName":                  "Python AI 与深度学习栈",
            "featured.aiDesc":                  "Python 3.12, uv, pip, Git, VS Code 并预置清华大学 PyPI 镜像加速。",
            "featured.systemsName":             "现代 C/C++ 极速工程栈",
            "featured.systemsDesc":             "LLVM/Clang, CMake, Ninja, Git, VS Code 现代化 C/C++ 高性能系统开发套件。",
            "featured.rustName":                "Rust 现代系统编程栈",
            "featured.rustDesc":                "Rust (rustup), Cargo, Git, VS Code 内存安全系统编程栈。",
            "featured.mobileName":              "移动端与跨平台开发栈",
            "featured.mobileDesc":              "Java JDK 21, Node.js LTS, Git, VS Code 移动应用与跨端套件。",
                        "featured.uvAiName":                "现代极速 Python & AI 栈",
            "featured.uvAiDesc":                "由 uv 驱动的下一代极速 Python 工作流，预设 PyPI 镜像源与 UTF-8 编码。",
            "featured.goCloudName":             "Go 云原生后端开发栈",
            "featured.goCloudDesc":             "Go 语言运行时、国内 GoProxy 极速镜像代理、Docker 容器与 VS Code 微服务套件。",
            "featured.shellPowerName":          "Windows 终极终端效率栈",
            "featured.shellPowerDesc":          "现代化终端流：Windows Terminal、PowerShell 7、Starship 极速提示符、zoxide 智能跳转与现代 CLI 增强工具。",
            "featured.devopsInfraName":         "DevOps 云原生基础设施栈",
            "featured.devopsInfraDesc":         "容器化与基础设施即代码：Docker、Kubernetes kubectl、Helm 包管理、Terraform 与 GitHub CLI。",
"featured.toolkitName":             "开发者通用基础工具箱",
            "featured.toolkitDesc":             "Git, VS Code, 7-Zip, Windows Terminal 等通用开发者必备工具。",

            "updates.logCopied":                "控制台日志已复制到剪贴板。",
            "updates.selectRequired":           "请先勾选需要更新的软件包。",
            "updates.noSnapshotAvailable":      "暂无可用的前置环境快照。",
            "updates.startingSingle":           "正在启动 {0} 的升级程序...",

            // Categories
            "category.language":                "\u8bed\u8a00 / \u8fd0\u884c\u65f6",
            "category.tool":                    "\u6784\u5efa\u5de5\u5177",
            "category.runtime":                 "\u5bb9\u5668 / \u865a\u62df\u673a",
            "category.utility":                 "\u5b9e\u7528\u5de5\u5177",
            "category.editor":                  "\u7f16\u8f91\u5668 / IDE",
            "category.database":                "\u6570\u636e\u5e93",
            "category.other":                   "\u5176\u4ed6",

            // Environment cards
            "env.scanning":                     "\u6b63\u5728\u626b\u63cf\u7cfb\u7edf...",
            "env.noMatch":                      "\u672a\u627e\u5230\u5339\u914d\u7684\u73af\u5883\u3002",
            "env.btnUninstall":                 "\u5378\u8f7d",
            "env.confirmUninstallTitle":        "\u786e\u8ba4\u5378\u8f7d",
            "env.confirmUninstall":             "\u786e\u5b9a\u8981\u901a\u8fc7 winget \u5378\u8f7d {0} \u5417\uff1f",
            "env.uninstallSuccess":             "\u5df2\u5378\u8f7d: {0}",
            "env.uninstallFailed":              "\u5378\u8f7d\u5931\u8d25\u3002",

            // Probe
            "probe.detecting":                  "\u68c0\u6d4b\u4e2d...",
            "probe.found":                      "\u5df2\u627e\u5230: {0}",
            "probe.notFound":                   "\u672a\u627e\u5230\u3002",
            "probe.addedToast":                 "\u5df2\u6dfb\u52a0: {0} ({1})",

            // Settings (Environment Variable Editor)
            "settings.title":                   "\u8bbe\u7f6e",
            "settings.desc":                    "\u76f4\u63a5\u7ba1\u7406\u73af\u5883\u53d8\u91cf\u3002\u66f4\u6539\u7acb\u5373\u751f\u6548\u3002",
            "settings.snapshotHint":            "\u4efb\u4f55\u4fee\u6539\u524d\u4f1a\u81ea\u52a8\u521b\u5efa\u5feb\u7167\uff0c\u4ee5\u4fbf\u5b89\u5168\u56de\u6eda\u3002",
            "settings.userVars":                "\u7528\u6237\u53d8\u91cf",
            "settings.systemVars":              "\u7cfb\u7edf\u53d8\u91cf",
            "settings.addNew":                  "\u65b0\u5efa\u53d8\u91cf",
            "settings.searchPlaceholder":       "\u641c\u7d22\u53d8\u91cf...",
            "settings.colName":                 "\u540d\u79f0",
            "settings.colValue":                "\u503c",
            "settings.colActions":              "\u64cd\u4f5c",
            "settings.loading":                 "\u6b63\u5728\u52a0\u8f7d\u73af\u5883\u53d8\u91cf...",
            "settings.noMatch":                 "\u672a\u627e\u5230\u5339\u914d\u7684\u53d8\u91cf\u3002",
            "settings.edit":                    "\u7f16\u8f91",
            "settings.delete":                  "\u5220\u9664",
            "settings.save":                    "\u4fdd\u5b58",
            "settings.type":                    "\u7c7b\u578b",
            "settings.newVarTitle":             "\u65b0\u5efa\u53d8\u91cf",
            "settings.editVarTitle":            "\u7f16\u8f91: {0}",
            "settings.nameRequired":            "\u53d8\u91cf\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002",
            "settings.pathAdd":                 "\u6dfb\u52a0\u6761\u76ee",
            "settings.saveSuccess":             "\u53d8\u91cf\u5df2\u4fdd\u5b58\u3002",
            "settings.saveFailed":              "\u4fdd\u5b58\u53d8\u91cf\u5931\u8d25: {0}",
            "settings.deleteSuccess":           "\u53d8\u91cf\u5df2\u5220\u9664\u3002",
            "settings.deleteFailed":            "\u5220\u9664\u53d8\u91cf\u5931\u8d25: {0}",
            "settings.confirmDeleteTitle":      "\u786e\u8ba4\u5220\u9664",
            "settings.confirmDelete":           "\u5220\u9664\u73af\u5883\u53d8\u91cf \"{0}\"\uff1f",

            // System Check
            "syscheck.title":                   "\u7cfb\u7edf\u68c0\u67e5",
            "syscheck.desc":                    "安装与配置前验证系统先决条件、运行权限与包管理器状态。",
            "syscheck.rerun":                   "重新检查",
            "syscheck.goRecipes":               "前往开发栈配方 →",
            "syscheck.goPackages":              "浏览软件包",
            "syscheck.os":                      "操作系统与架构",
            "syscheck.privilege":               "运行权限级别",
            "syscheck.privAdmin":               "管理员 (已提权)",
            "syscheck.privUser":                "标准用户 (受限)",
            "syscheck.devMode":                 "Windows 开发者模式",
            "syscheck.devModeOn":               "已开启 (支持符号链接)",
            "syscheck.devModeOff":              "未开启 (符号链接受限)",
            "syscheck.storage":                 "系统盘可用空间 (C:)",
            "syscheck.pkgManagers":             "包管理器环境支持",
            "syscheck.webview2":                "WebView2 运行时",
            "syscheck.statusReady":             "就绪",
            "syscheck.statusWarning":           "提示",
            "syscheck.statusMissing":           "未安装",

            // 安装与摘要空状态与历史
            "install.emptyTitle":               "当前暂无正在执行的安装任务",
            "install.emptyDesc":                "您可以从软件包页面勾选所需工具，或前往环境配方一键增量部署场景开发栈。",
            "install.goPackages":               "前往挑选软件包 →",
            "install.goRecipes":                "浏览场景开发栈",
            "summary.historyTitle":             "最近安装记录",
            "summary.viewEnvs":                 "查看已配置环境 →",
            "summary.goPackages":               "继续安装软件",
            "summary.noHistory":                "暂无安装记录",
            "summary.noHistoryDesc":            "当您通过软件包或环境配方完成工具安装后，详细的结果状态与快照追溯将在此展示。",

            // 设置分栏与偏好
            "settings.tabDoctor":               "PATH Doctor 体检中心",
            "settings.tabEnvVars":              "环境变量直接管理",
            "settings.tabPreferences":          "通用偏好",
            "settings.prefApp":                 "软件运行偏好设置",
            "settings.prefLang":                "界面显示语言",
            "settings.prefLangDesc":            "自由切换软件的界面语言，设置即时生效并自动保存。",
            "settings.prefStartup":             "启动时主动检查环境更新",
            "settings.prefStartupDesc":         "每次打开软件时自动在后台并发检测所有包管理器的可用新版本。",
            "settings.prefAbout":               "关于 LazyEnv",
            "settings.prefOpenRepo":            "访问 GitHub 仓库",
            "syscheck.rerun":                   "\u91cd\u65b0\u68c0\u67e5",
            "check.os":                         "\u64cd\u4f5c\u7cfb\u7edf",
            "check.webview2":                   "WebView2 \u8fd0\u884c\u65f6",
            "check.winget":                     "winget \u5305\u7ba1\u7406\u5668",
            "check.detecting":                  "\u68c0\u6d4b\u4e2d...",
            "check.available":                  "\u53ef\u7528",
            "check.checking":                   "\u68c0\u67e5\u4e2d...",
            "check.notFound":                   "\u672a\u627e\u5230",

            // Packages
            "packages.title":                   "\u8f6f\u4ef6\u5305",
            "packages.desc":                    "\u9009\u62e9\u8981\u5b89\u88c5\u7684\u5f00\u53d1\u5de5\u5177\u3002",
            "packages.selectAll":               "\u5168\u9009",
            "packages.deselectAll":             "\u53d6\u6d88\u5168\u9009",
            "packages.searchPlaceholder":       "\u641c\u7d22\u8f6f\u4ef6\u5305...",
            "packages.startInstall":            "\u5f00\u59cb\u5b89\u88c5",
            "packages.selectedCount":           "\u5df2\u9009\u62e9 {0} \u4e2a",

            // Install
            "install.title":                    "\u5b89\u88c5",
            "install.desc":                     "\u6b63\u5728\u5b89\u88c5\u5df2\u9009\u8f6f\u4ef6\u5305...",
            "install.progressText":             "{0} / {1} \u4e2a\u8f6f\u4ef6\u5305",
            "install.pending":                  "\u7b49\u5f85\u4e2d",
            "install.installing":               "\u5b89\u88c5\u4e2d...",
            "install.installed":                "\u5df2\u5b89\u88c5",
            "install.failed":                   "\u5931\u8d25 (\u9000\u51fa\u7801 {0})",
            "install.skipped":                  "\u5df2\u5b58\u5728",
            "install.waitingOutput":            "\u7b49\u5f85\u8f93\u51fa...",
            "install.noPackages":               "\u6ca1\u6709\u6392\u961f\u7684\u8f6f\u4ef6\u5305\u3002",
            "install.btnRetry":                 "\u91cd\u8bd5",
            "install.retrying":                 "\u91cd\u8bd5\u4e2d...",
            "install.waiting":                  "\u7b49\u5f85\u4e2d...",

            // Recovery
            "recovery.title":                   "\u6062\u590d",
            "recovery.desc":                    "\u7ba1\u7406\u73af\u5883\u5feb\u7167\u3002\u53ef\u6062\u590d\u5230\u5386\u53f2\u72b6\u6001\u6216\u5bfc\u5165\u5bfc\u51fa\u914d\u7f6e\u3002",
            "recovery.create":                  "\u521b\u5efa\u5feb\u7167",
            "recovery.import":                  "\u5bfc\u5165",
            "recovery.emptyState":              "\u6682\u65e0\u5feb\u7167\u3002\u521b\u5efa\u4e00\u4e2a\u4ee5\u5f00\u59cb\u4f7f\u7528\u3002",
            "recovery.userCount":               "\u7528\u6237\u53d8\u91cf: {0}",
            "recovery.systemCount":             "\u7cfb\u7edf\u53d8\u91cf: {0}",
            "recovery.btnRestore":              "\u6062\u590d",
            "recovery.btnExport":               "\u5bfc\u51fa",
            "recovery.btnDelete":               "\u5220\u9664",
            "recovery.confirmRestoreTitle":     "\u786e\u8ba4\u6062\u590d",
            "recovery.confirmRestore":          "\u786e\u5b9a\u8981\u4ece\u6b64\u5feb\u7167\u6062\u590d\u73af\u5883\u5417\uff1f\u5f53\u524d\u53d8\u91cf\u5c06\u88ab\u8986\u76d6\u3002",
            "recovery.confirmDeleteTitle":      "\u786e\u8ba4\u5220\u9664",
            "recovery.confirmDelete":           "\u786e\u5b9a\u8981\u6c38\u4e45\u5220\u9664\u6b64\u5feb\u7167\u5417\uff1f",
            "recovery.restoreSuccess":          "\u73af\u5883\u5df2\u6210\u529f\u6062\u590d\u3002",
            "recovery.restoreFailed":           "\u6062\u590d\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u7ba1\u7406\u5458\u6743\u9650\u3002",
            "recovery.exportSuccess":           "\u5feb\u7167\u5df2\u6210\u529f\u5bfc\u51fa\u3002",
            "recovery.exportFailed":            "\u5bfc\u51fa\u5feb\u7167\u5931\u8d25\u3002",
            "recovery.importSuccess":           "\u5feb\u7167\u5df2\u6210\u529f\u5bfc\u5165\u3002",
            "recovery.importFailed":            "\u5bfc\u5165\u5feb\u7167\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u6587\u4ef6\u683c\u5f0f\u3002",
            "recovery.createTitle":             "\u521b\u5efa\u5feb\u7167",
            "recovery.descLabel":               "\u63cf\u8ff0\uff08\u53ef\u9009\uff09",
            "recovery.defaultDesc":             "\u624b\u52a8\u5feb\u7167",
            "recovery.createSuccess":           "\u5feb\u7167\u521b\u5efa\u6210\u529f\u3002",
            "recovery.createFailed":            "\u5feb\u7167\u521b\u5efa\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5 LazyEnv \u6570\u636e\u76ee\u5f55\u662f\u5426\u53ef\u5199\u3002",

            // Summary
            "summary.title":                    "\u6458\u8981",
            "summary.desc":                     "\u5b89\u88c5\u7ed3\u679c\u6982\u89c8\u3002",
            "summary.emptyState":               "\u6682\u65e0\u5b89\u88c5\u6570\u636e\u3002",
            "summary.colName":                  "\u8f6f\u4ef6\u5305",
            "summary.colStatus":                "\u72b6\u6001",
            "summary.colCommand":               "\u547d\u4ee4",
            "summary.colMessage":               "\u8be6\u60c5",
            "summary.success":                  "\u6210\u529f",
            "summary.failed":                   "\u5931\u8d25",
            "summary.skipped":                  "\u5df2\u8df3\u8fc7",

            // Dialog
            "dialog.cancel":                    "\u53d6\u6d88",

            // Errors
            "error.internal":                   "\u5185\u90e8\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5\u3002",

            // Language switcher
                        // Newly Added UI Keys
            "updates.updatingBatchTitle":       "正在更新软件包...",
            "updates.preparingPill":            "准备中",
            "updates.startingInstaller":        "正在启动安装程序...",
            "updates.failedNotice":             "部分软件包更新失败。系统已在更新前自动创建环境快照，可随时执行回滚恢复。",
            "recipes.diffPreflightTitle":       "环境配方差异预检",
            "recipes.authorLabel":              "作者",
            "recipes.normalStatus":             "标准预设",
            "packages.stickySelected":          "已选择 {0} 项",
            "syscheck.freeSpace":               "可用空间",
            "home.metric.envsValue":            "{0} 项",
            "home.metric.updatesValue":         "{0} 项可用",
            "home.metric.scoreValue":           "{0} 分",
            "home.metric.healthySub":           "环境健康无异常",
            "home.metric.inspectSub":           "点击执行健康体检 →",
            "home.metric.conflictDupSub":       "{0} 项冲突 · {1} 项重复",
            "mirror.preset.aliyun":             "阿里云镜像",
            "mirror.preset.tencent":            "腾讯云镜像",
            "mirror.preset.huawei":             "华为云镜像",
            "mirror.preset.official":           "官方默认源",
            "mirror.preset.tsinghua":           "清华大学开源镜像",
"lang.label":                       "\u8bed\u8a00"
        }
    };

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    var currentLocale = "en";

    // Detect system language
    (function detectLocale() {
        var lang = navigator.language || navigator.userLanguage || "en";
        if (lang.toLowerCase().startsWith("zh")) {
            currentLocale = "zh-CN";
        } else {
            currentLocale = "en";
        }
        // Check localStorage override
        var saved = localStorage.getItem("lazyenv_locale");
        if (saved && locales[saved]) {
            currentLocale = saved;
        }
    })();

    // -----------------------------------------------------------------------
    // Translation function
    // t(key)            -> returns translated string
    // t(key, arg1, ...) -> replaces {0}, {1}, ... with arguments
    // -----------------------------------------------------------------------
    function t(key) {
        var dict = locales[currentLocale] || locales["en"];
        var str = dict[key];
        if (str === undefined) {
            // Fallback to English
            str = locales["en"][key];
        }
        if (str === undefined) {
            // Return key itself as last resort
            return key;
        }
        // Replace placeholders {0}, {1}, ...
        if (arguments.length > 1) {
            for (var i = 1; i < arguments.length; i++) {
                str = str.replace("{" + (i - 1) + "}", arguments[i]);
            }
        }
        return str;
    }

    // -----------------------------------------------------------------------
    // Apply translations to static HTML elements
    // Elements with data-i18n attribute get their textContent replaced.
    // Elements with data-i18n-placeholder get their placeholder replaced.
    // Elements with data-i18n-title get their title replaced.
    // -----------------------------------------------------------------------
    function applyStaticTranslations() {
        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            var key = el.getAttribute("data-i18n");
            if (key) el.textContent = t(key);
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
            var key = el.getAttribute("data-i18n-placeholder");
            if (key) el.placeholder = t(key);
        });
        document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
            var key = el.getAttribute("data-i18n-title");
            if (key) el.title = t(key);
        });
    }

    // -----------------------------------------------------------------------
    // Set locale and re-apply
    // -----------------------------------------------------------------------
    function setLocale(locale) {
        if (!locales[locale]) return;
        currentLocale = locale;
        localStorage.setItem("lazyenv_locale", locale);
        document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
        applyStaticTranslations();
        // Dispatch event so dynamic content can re-render
        window.dispatchEvent(new CustomEvent("lazyenv:localeChanged", { detail: { locale: locale } }));
    }

    function getLocale() {
        return currentLocale;
    }

    function getAvailableLocales() {
        return Object.keys(locales);
    }

    // -----------------------------------------------------------------------
    // Public API (attached to window)
    // -----------------------------------------------------------------------
    window.LazyEnvI18n = {
        t: t,
        setLocale: setLocale,
        getLocale: getLocale,
        getAvailableLocales: getAvailableLocales,
        applyStaticTranslations: applyStaticTranslations
    };

    // Apply on DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            applyStaticTranslations();
        });
    } else {
        applyStaticTranslations();
    }

})();

