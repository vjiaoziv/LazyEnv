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
// LazyEnv - script.js
// Frontend: sidebar navigation, home env detection, settings env-var editor,
// install progress with streaming log, retry, window drag, i18n support
// ============================================================================

(function () {
    "use strict";

    // -----------------------------------------------------------------------
    // i18n shorthand
    // -----------------------------------------------------------------------
    var t = window.LazyEnvI18n.t;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    var currentPage = "home";
    var catalog = [];
    var selectedPackages = new Set();
    var installResults = new Map();
    var installLogs = new Map();
    var preInstallSnapshotId = "";
    var detectedEnvironments = [];
    var manualEnvironments = [];
    var installTotal = 0;
    var installCurrent = 0;
    var isMaximized = false;
    var environmentUpdates = new Map();
    var hubUpdates = [];
    var currentHubFilter = "all";
    var lastDoctorScore = null;
    var currentMirrorType = "npm";
    var pathDoctorReport = null;
    var isDoctorRunning = false;
    var currentRecipeDiff = null;
    var selectedHubUpdateIds = new Set();
    var isCheckingHubUpdates = false;
    var isBatchUpgrading = false;
    var lastBatchSummary = null;
    var isCheckingUpdates = false;

    // Settings state
    var envVarScope = "user";   // "user" or "system"
    var envVarCache = [];       // [{name, value, type}]

    // -----------------------------------------------------------------------
    // Native bridge
    // -----------------------------------------------------------------------
    function sendNative(obj) {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify(obj));
        } else {
            console.log("[LazyEnv -> Native]", obj);
            handleMock(obj);
        }
    }

    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener("message", function (e) {
            var data;
            try { data = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (_) { return; }
            handleNative(data);
        });
    }

    // -----------------------------------------------------------------------
    // Native response handler
    // -----------------------------------------------------------------------
    function handleNative(d) {
        switch (d.action) {
            case "error":
                // Surface native-side failures (e.g. exceptions caught at the
                // COM boundary) instead of silently ignoring them.
                showToast(d.message || t("error.internal"), "error");
                break;

            case "environmentsDetected":
                detectedEnvironments = d.environments || [];
                renderEnvironments();
                break;

            case "exportRecipeResult":
                if (d.success) {
                    showToast(t("recipes.exportSuccess", d.filePath), "success");
                } else {
                    showToast(t("toast.recipeExportFailed"), "error");
                }
                break;

            case "recipeDiffReport":
                if (d.success && d.diff) {
                    currentRecipeDiff = d.diff;
                    renderRecipeDiff(d.diff);
                } else {
                    showToast(t("toast.recipeImportFailed"), "error");
                }
                break;

            case "deployRecipeComplete":
                if (d.success) {
                    showToast(t("recipes.deployComplete"), "success");
                    var rBox = document.getElementById("recipeDiffBox");
                    if (rBox) rBox.style.display = "none";
                    sendNative({ action: "detectEnvironments" });
                } else {
                    showToast(t("toast.recipeDeployFailed"), "error");
                }
                break;

            case "pathDoctorReport":
                isDoctorRunning = false;
                var btnDoc = document.getElementById("btnRunDoctor");
                if (btnDoc) {
                    btnDoc.classList.remove("btn--loading");
                    btnDoc.disabled = false;
                    var s = btnDoc.querySelector("span");
                    if (s) s.textContent = t("doctor.btnRun");
                }
                pathDoctorReport = d.report || null;
                if (pathDoctorReport) {
                    renderDoctorReport(pathDoctorReport);
                }
                break;

            case "pathDoctorCleanResult":
                if (d.success) {
                    if (d.systemRequiresElevation && !d.systemCleaned) {
                        showToast(t("doctor.partialCleanSuccess"), "warning");
                    } else {
                        showToast(t("doctor.cleanSuccess", (pathDoctorReport ? pathDoctorReport.deadEntries + pathDoctorReport.duplicateEntries : 0)), "success");
                    }
                    loadEnvVars();
                    sendNative({ action: "pathDoctorDiagnose" });
                } else {
                    showToast(t("toast.cleanPathFailed"), "error");
                }
                break;

            case "mirrorSourceInfo":
                showMirrorDialog(d.type, d.currentUrl);
                break;

            case "mirrorSourceSetResult":
                if (d.success) {
                    showToast(t("mirror.success", (d.type || "").toUpperCase(), d.url), "success");
                } else {
                    showToast(t("toast.mirrorSetFailed"), "error");
                }
                break;

            case "allUpdatesDetected":
                isCheckingHubUpdates = false;
                var btnHub = document.getElementById("btnCheckAllUpdates");
                if (btnHub) {
                    btnHub.classList.remove("btn--loading");
                    btnHub.disabled = false;
                    var s = btnHub.querySelector("span");
                    if (s) s.textContent = t("updates.checkAll");
                }
                hubUpdates = d.updates || [];
                updateSidebarBadge();
                renderUpdatesHub(document.getElementById("updatesSearch") ? document.getElementById("updatesSearch").value : "");
                if (currentPage !== "updates" && unpinnedCount > 0) {
                    showToast(t("updates.startupFound", unpinnedCount), "info");
                }
                break;

            case "upgradeBatchProgress":
                var pBox = document.getElementById("batchProgressBox");
                if (pBox) pBox.style.display = "block";

                // Overall progress
                var pTitle = document.getElementById("batchProgressTitle");
                if (pTitle) pTitle.textContent = "Updating (" + d.current + " / " + d.total + ")...";
                var pCount = document.getElementById("batchProgressCount");
                if (pCount) pCount.textContent = d.current + " / " + d.total;

                var overallPct = Math.round(((d.current - 1 + (d.percent > 0 ? d.percent / 100 : 0.4)) / d.total) * 100);
                var pFill = document.getElementById("batchProgressFill");
                if (pFill) pFill.style.width = Math.min(100, Math.max(5, overallPct)) + "%";

                // Subtask detailed progress card
                var sName = document.getElementById("subtaskName");
                if (sName) sName.textContent = d.name || d.packageId;

                var sSource = document.getElementById("subtaskSource");
                if (sSource && d.source) {
                    sSource.textContent = d.source.toUpperCase();
                    sSource.className = "badge--source tag--" + d.source.toLowerCase();
                }

                var sPhase = document.getElementById("subtaskPhase");
                if (sPhase && d.phase) {
                    sPhase.textContent = t("phase." + d.phase) || d.phase;
                    sPhase.className = "phase-pill phase-pill--" + d.phase;
                }

                var sProgressFill = document.getElementById("subtaskProgressFill");
                if (sProgressFill) {
                    if (d.percent >= 0) {
                        sProgressFill.style.width = d.percent + "%";
                        sProgressFill.style.opacity = "1";
                    } else {
                        sProgressFill.style.width = "75%";
                        sProgressFill.style.opacity = "0.7";
                    }
                }

                var sMsg = document.getElementById("subtaskMsg");
                if (sMsg) sMsg.textContent = d.message || "";

                var sDetail = document.getElementById("subtaskDetail");
                if (sDetail) sDetail.textContent = d.detail || "";
                break;

            case "upgradeBatchLog":
                var lPanel = document.getElementById("batchLogPanel");
                if (lPanel) {
                    var el = document.createElement("div");
                    el.className = "log-line";
                    el.textContent = d.line;
                    lPanel.appendChild(el);
                    lPanel.scrollTop = lPanel.scrollHeight;
                }
                break;

            case "upgradeBatchComplete":
                isBatchUpgrading = false;
                lastBatchSummary = d;
                showToast(t("updates.batchComplete", d.successCount, d.failCount), d.failCount === 0 ? "success" : "warning");

                // Auto-refresh home environments if any succeeded
                if (d.successCount > 0) {
                    sendNative({ action: "detectEnvironments" });
                }

                // Show or hide diagnostic card
                if (d.failCount > 0 && d.failures && d.failures.length > 0) {
                    renderFailureDiagnostics(d);
                } else {
                    var diagBox = document.getElementById("failureDiagnosticBox");
                    if (diagBox) diagBox.style.display = "none";
                }

                // Refresh updates list
                sendNative({ action: "getAllUpdates" });
                break;

            case "pinResult":
                if (d.success) {
                    hubUpdates.forEach(function (u) {
                        if (u.id === d.packageId) {
                            u.isPinned = d.pinned;
                        }
                    });
                    updateSidebarBadge();
                    renderUpdatesHub(document.getElementById("updatesSearch") ? document.getElementById("updatesSearch").value : "");
                if (currentPage !== "updates" && unpinnedCount > 0) {
                    showToast(t("updates.startupFound", unpinnedCount), "info");
                }
                }
                break;

            case "updatesDetected":
                isCheckingUpdates = false;
                var btnCheck = document.getElementById("btnCheckUpdates");
                if (btnCheck) {
                    btnCheck.classList.remove("btn--loading");
                    btnCheck.disabled = false;
                    var span = btnCheck.querySelector("span");
                    if (span) span.textContent = t("home.checkUpdates");
                }
                environmentUpdates.clear();
                var updates = d.updates || [];
                var updateCount = 0;
                updates.forEach(function (u) {
                    if (u.command) {
                        environmentUpdates.set(u.command, u);
                        if (u.hasUpdate) updateCount++;
                    }
                });
                renderEnvironments(document.getElementById("homeSearch").value);
                if (updateCount > 0) {
                    showToast(t("home.updatesFound", updateCount), "info");
                } else {
                    showToast(t("home.noUpdatesFound"), "success");
                }
                break;

            case "verifyResult":
                showDialog(
                    t("toast.verifyTitle", d.command),
                    "<div class='log-panel' style='max-height:160px; font-size:13px; font-family:var(--font-mono);'>" + esc(d.output || "No output returned") + "</div>",
                    [{ text: t("dialog.ok"), cls: "btn--accent" }]
                );
                break;

            case "upgradeResult":
                if (d.success) {
                    showToast(t("home.updateSuccess", d.command), "success");
                    environmentUpdates.delete(d.command);
                    sendNative({ action: "probeCommand", command: d.command });
                } else {
                    showToast(t("home.updateFailed", d.command), "error");
                }
                renderEnvironments(document.getElementById("homeSearch").value);
                break;

            case "probeResult":
                handleProbeResult(d);
                break;

            case "systemCheckResults":
                systemCheckData = d;
                renderChecks();
                break;

            case "wingetStatus":
                renderCheckItem("winget", d.available);
                break;

            case "catalogData":
                catalog = d.packages || [];
                renderCatalog();
                break;

            case "installStarted":
                preInstallSnapshotId = d.snapshotId || "";
                break;

            case "installProgress":
                installResults.set(d.packageId, {
                    status: d.status,
                    message: d.message || "",
                    command: d.command || (installResults.has(d.packageId) ? installResults.get(d.packageId).command : ""),
                    output: d.output || "",
                    exitCode: d.exitCode
                });
                if (typeof d.current === "number") installCurrent = d.current;
                if (typeof d.total === "number") installTotal = d.total;
                renderInstallList();
                updateProgressBar();
                break;

            case "installLog":
                if (!installLogs.has(d.packageId)) installLogs.set(d.packageId, []);
                var lines = installLogs.get(d.packageId);
                lines.push(d.line);
                if (lines.length > 200) lines.splice(0, lines.length - 200);
                updateLogPanel(d.packageId);
                break;

            case "installComplete":
                preInstallSnapshotId = d.snapshotId || preInstallSnapshotId;
                updateProgressBar();
                renderInstallList();
                break;

            case "snapshotCreated":
                if (d.error) {
                    showToast(t("recovery.createFailed"), "error");
                } else {
                    showToast(t("recovery.createSuccess"), "success");
                    loadSnapshots();
                }
                break;

            case "snapshotList":
                renderSnapshots(d.snapshots || []);
                break;

            case "restoreResult":
                if (d.success) showToast(t("recovery.restoreSuccess"), "success");
                else showToast(t("recovery.restoreFailed"), "error");
                break;

            case "deleteResult":
                loadSnapshots();
                break;

            case "exportResult":
                if (d.success) showToast(t("recovery.exportSuccess"), "success");
                else showToast(t("recovery.exportFailed"), "error");
                break;

            case "importResult":
                if (d.success) {
                    showToast(t("recovery.importSuccess"), "success");
                    loadSnapshots();
                } else {
                    showToast(t("recovery.importFailed"), "error");
                }
                break;

            case "windowState":
                isMaximized = d.maximized;
                updateMaxBtn();
                break;

            case "uninstallResult":
                if (d.success) {
                    showToast(t("env.uninstallSuccess", d.command), "success");
                    sendNative({ action: "detectEnvironments" });
                } else {
                    showToast(t("env.uninstallFailed"), "error");
                }
                break;

            // Settings: environment variable responses
            case "envVarList":
                envVarCache = d.variables || [];
                renderEnvVarTable();
                break;

            case "envVarWriteResult":
                if (d.success) {
                    showToast(t("settings.saveSuccess"), "success");
                    loadEnvVars();
                } else {
                    showToast(t("settings.saveFailed", d.message || ""), "error");
                }
                break;

            case "envVarDeleteResult":
                if (d.success) {
                    showToast(t("settings.deleteSuccess"), "success");
                    loadEnvVars();
                } else {
                    showToast(t("settings.deleteFailed", d.message || ""), "error");
                }
                break;
        }
    }

    // -----------------------------------------------------------------------
    // Mock for dev (no native host)
    // -----------------------------------------------------------------------
    function handleMock(obj) {
        if (obj.action === "detectEnvironments") {
            setTimeout(function () {
                handleNative({
                    action: "environmentsDetected",
                    environments: [
                        { name: "Python", command: "python", version: "Python 3.12.0", category: "language" },
                        { name: "Node.js", command: "node", version: "v22.13.0", category: "language" },
                        { name: "Git", command: "git", version: "git version 2.43.0", category: "tool" },
                        { name: "CMake", command: "cmake", version: "cmake version 3.28.1", category: "tool" },
                        { name: "Rust (rustc)", command: "rustc", version: "rustc 1.75.0", category: "language" },
                        { name: "Docker", command: "docker", version: "Docker version 24.0.7", category: "runtime" },
                        { name: "curl", command: "curl", version: "curl 8.4.0", category: "utility" },
                    ]
                });
            }, 800);
        }
        if (obj.action === "probeCommand") {
            setTimeout(function () {
                handleNative({
                    action: "probeResult",
                    found: true,
                    name: obj.command,
                    command: obj.command,
                    version: obj.command + " 0.6.1 (mock)",
                    category: obj.category || "other"
                });
            }, 600);
        }
        if (obj.action === "openUrl") {
            window.open(obj.url, "_blank");
        }
        if (obj.action === "runSystemChecks") {
            setTimeout(function () {
                handleNative({
                    action: "systemCheckResults",
                    os: "Windows 11 (Build 26300, x64)",
                    isElevated: true,
                    devMode: true,
                    diskFree: "85.4 GB",
                    winget: true,
                    scoop: true,
                    npm: true,
                    pip: true,
                    webview2: true
                });
            }, 300);
        }
        if (obj.action === "checkWinget") {
            setTimeout(function () { handleNative({ action: "wingetStatus", available: true }); }, 300);
        }
        if (obj.action === "getCatalog") {
            setTimeout(function () {
                handleNative({
                    action: "catalogData",
                    packages: [
                        { id: "Python.Python.3.12", name: "Python 3.12", category: "language", description: "General-purpose programming language" },
                        { id: "OpenJS.NodeJS.LTS", name: "Node.js (LTS)", category: "language", description: "JavaScript runtime built on V8" },
                        { id: "Rustlang.Rustup", name: "Rust (rustup)", category: "language", description: "Systems programming language" },
                        { id: "GoLang.Go", name: "Go", category: "language", description: "Statically typed compiled language" },
                        { id: "Git.Git", name: "Git", category: "tool", description: "Distributed version control" },
                        { id: "Kitware.CMake", name: "CMake", category: "tool", description: "Build system generator" },
                        { id: "Microsoft.VisualStudioCode", name: "VS Code", category: "editor", description: "Code editor by Microsoft" },
                        { id: "Docker.DockerDesktop", name: "Docker Desktop", category: "runtime", description: "Container platform" },
                    ]
                });
            }, 200);
        }
        if (obj.action === "install") {
            setTimeout(function () { handleNative({ action: "installStarted", snapshotId: "mock-snap" }); }, 100);
            var pkgs = obj.packages || [];
            pkgs.forEach(function (id, i) {
                var cmd = "winget install --id " + id + " --exact --silent --accept-package-agreements --accept-source-agreements";
                setTimeout(function () {
                    handleNative({ action: "installProgress", packageId: id, status: "running", message: "Installing...", command: cmd, current: i, total: pkgs.length });
                }, 300 + i * 2500);
                for (var l = 0; l < 5; l++) {
                    (function(line, pkgId) {
                        setTimeout(function () {
                            handleNative({ action: "installLog", packageId: pkgId, line: "  [mock] Processing step " + (line + 1) + "..." });
                        }, 600 + i * 2500 + line * 300);
                    })(l, id);
                }
                var success = Math.random() > 0.3;
                setTimeout(function () {
                    handleNative({
                        action: "installProgress", packageId: id,
                        status: success ? "success" : "failed",
                        message: success ? "Done" : "Error: package not found",
                        command: cmd,
                        output: success ? "" : "ERROR: No package found matching input criteria.",
                        exitCode: success ? 0 : 1,
                        current: i + 1, total: pkgs.length
                    });
                }, 1800 + i * 2500);
            });
            setTimeout(function () { handleNative({ action: "installComplete", snapshotId: "mock-snap" }); }, 2500 + pkgs.length * 2500);
        }
        if (obj.action === "retryInstall") {
            var rid = obj.packageId;
            var rcmd = "winget install --id " + rid + " --exact --silent --accept-package-agreements --accept-source-agreements";
            setTimeout(function () { handleNative({ action: "installProgress", packageId: rid, status: "running", message: "Retrying...", command: rcmd }); }, 200);
            setTimeout(function () { handleNative({ action: "installProgress", packageId: rid, status: "success", message: "Done", command: rcmd, output: "", exitCode: 0 }); }, 2000);
        }
        if (obj.action === "listSnapshots") {
            setTimeout(function () { handleNative({ action: "snapshotList", snapshots: [] }); }, 200);
        }
        if (obj.action === "listEnvVars") {
            setTimeout(function () {
                handleNative({
                    action: "envVarList",
                    variables: [
                        { name: "PATH", value: "C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\Git\\cmd", type: "REG_EXPAND_SZ" },
                        { name: "JAVA_HOME", value: "C:\\Program Files\\Java\\jdk-21", type: "REG_SZ" },
                        { name: "GOPATH", value: "C:\\Users\\Rein\\go", type: "REG_SZ" },
                        { name: "CARGO_HOME", value: "C:\\Users\\Rein\\.cargo", type: "REG_SZ" },
                        { name: "TEMP", value: "%USERPROFILE%\\AppData\\Local\\Temp", type: "REG_EXPAND_SZ" },
                    ]
                });
            }, 300);
        }
        if (obj.action === "writeEnvVar") {
            setTimeout(function () { handleNative({ action: "envVarWriteResult", success: true }); }, 300);
        }
        if (obj.action === "deleteEnvVar") {
            setTimeout(function () { handleNative({ action: "envVarDeleteResult", success: true }); }, 300);
        }
        if (obj.action === "exportRecipeDialog") {
            setTimeout(function () {
                handleNative({ action: "exportRecipeResult", success: true, filePath: "C:\\Users\\Rein\\my-dev-stack.lazyenv" });
            }, 500);
        }
        if (obj.action === "importRecipeDialog") {
            setTimeout(function () {
                handleNative({
                    action: "recipeDiffReport",
                    success: true,
                    diff: {
                        recipeName: "FullStack-AI-Team-Stack",
                        recipeDesc: "Standardized development stack for Web & AI teams",
                        author: "vjiaoziv",
                        npmMirror: "https://registry.npmmirror.com",
                        pipMirror: "https://pypi.tuna.tsinghua.edu.cn/simple",
                        missingPackages: [
                            { id: "Python.Python.3.12", name: "Python 3.12", source: "winget" },
                            { id: "pnpm", name: "pnpm", source: "npm" }
                        ],
                        installedPackages: [
                            { id: "Git.Git", name: "Git", source: "winget" },
                            { id: "OpenJS.NodeJS.LTS", name: "Node.js (LTS)", source: "winget" }
                        ],
                        varsCount: 1,
                        pathsCount: 1
                    }
                });
            }, 600);
        }
        if (obj.action === "deployRecipe") {
            setTimeout(function () {
                handleNative({ action: "deployRecipeComplete", success: true, snapshotId: "snap-recipe-mock" });
            }, 1200);
        }
        if (obj.action === "pathDoctorDiagnose") {
            setTimeout(function () {
                handleNative({
                    action: "pathDoctorReport",
                    report: {
                        healthScore: 78,
                        totalEntries: 24,
                        validEntries: 18,
                        deadEntries: 3,
                        duplicateEntries: 2,
                        userEntries: [
                            { rawPath: "C:\\Users\\Rein\\old_python", expandedPath: "C:\\Users\\Rein\\old_python", exists: false, isDuplicate: false, issue: "Dead path" },
                            { rawPath: "C:\\Users\\Rein\\.cargo\\bin", expandedPath: "C:\\Users\\Rein\\.cargo\\bin", exists: true, isDuplicate: false, issue: "" }
                        ],
                        systemEntries: [
                            { rawPath: "C:\\Program Files\\Git\\cmd", expandedPath: "C:\\Program Files\\Git\\cmd", exists: true, isDuplicate: false, issue: "" },
                            { rawPath: "C:\\Program Files\\Git\\cmd", expandedPath: "C:\\Program Files\\Git\\cmd", exists: true, isDuplicate: true, issue: "Duplicate path" }
                        ],
                        conflicts: [
                            { command: "python.exe", activePath: "C:\\Python312\\python.exe", shadowedPath: "C:\\Python310\\python.exe", activeSource: "user", shadowedSource: "system" }
                        ]
                    }
                });
            }, 600);
        }
        if (obj.action === "pathDoctorAutoClean") {
            setTimeout(function () {
                handleNative({ action: "pathDoctorCleanResult", success: true, snapshotId: "mock-snap-doctor" });
            }, 600);
        }
        if (obj.action === "getMirrorSource") {
            setTimeout(function () {
                handleNative({
                    action: "mirrorSourceInfo",
                    type: obj.type,
                    currentUrl: obj.type === "npm" ? "https://registry.npmjs.org/" : "https://pypi.org/simple"
                });
            }, 300);
        }
        if (obj.action === "setMirrorSource") {
            setTimeout(function () {
                handleNative({
                    action: "mirrorSourceSetResult",
                    type: obj.type,
                    url: obj.url,
                    success: true
                });
            }, 500);
        }
        if (obj.action === "getAllUpdates") {
            setTimeout(function () {
                handleNative({
                    action: "allUpdatesDetected",
                    updates: [
                        { id: "Git.Git", name: "Git", currentVersion: "2.43.0", latestVersion: "2.44.0", source: "winget", isPinned: false },
                        { id: "OpenJS.NodeJS.LTS", name: "Node.js (LTS)", currentVersion: "20.10.0", latestVersion: "22.13.0", source: "winget", isPinned: false },
                        { id: "ripgrep", name: "ripgrep", currentVersion: "14.0.0", latestVersion: "14.1.0", source: "scoop", isPinned: false },
                        { id: "pnpm", name: "pnpm", currentVersion: "9.1.0", latestVersion: "9.15.0", source: "npm", isPinned: false },
                        { id: "ruff", name: "ruff", currentVersion: "0.2.0", latestVersion: "0.4.1", source: "pip", isPinned: true },
                    ]
                });
            }, 800);
        }
        if (obj.action === "upgradeBatch") {
            var tgts = obj.targets || [];
            tgts.forEach(function (t, idx) {
                setTimeout(function () {
                    handleNative({ action: "upgradeBatchProgress", packageId: t.id, current: idx + 1, total: tgts.length, message: "Upgrading " + t.name + "..." });
                    handleNative({ action: "upgradeBatchLog", line: "Successfully updated " + t.name });
                }, (idx + 1) * 600);
            });
            setTimeout(function () {
                handleNative({ action: "upgradeBatchComplete", successCount: tgts.length, failCount: 0 });
            }, (tgts.length + 1) * 600);
        }
        if (obj.action === "togglePinPackage") {
            setTimeout(function () {
                handleNative({ action: "pinResult", packageId: obj.packageId, pinned: obj.pinned, success: true });
            }, 200);
        }
        if (obj.action === "checkUpdates") {
            setTimeout(function () {
                var envs = obj.environments || [];
                var mockUpdates = envs.map(function (e) {
                    var hasUp = (e.command === "python" || e.command === "node" || e.command === "git");
                    return {
                        command: e.command,
                        name: e.name,
                        currentVersion: e.version,
                        latestVersion: hasUp ? "9.9.0" : e.version,
                        packageId: e.command + ".MockId",
                        updateSource: "mock",
                        hasUpdate: hasUp
                    };
                });
                handleNative({
                    action: "updatesDetected",
                    updates: mockUpdates
                });
            }, 1000);
        }
        if (obj.action === "upgradeEnvironment") {
            setTimeout(function () {
                handleNative({
                    action: "upgradeResult",
                    command: obj.command,
                    success: true,
                    output: "Successfully upgraded (mock)"
                });
            }, 1200);
        }
        if (obj.action === "windowMinimize" || obj.action === "windowMaximize" || obj.action === "windowClose" || obj.action === "windowDragStart") {
            console.log("Window action:", obj.action);
        }
    }

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------
    function navigateTo(page) {
        currentPage = page;
        document.querySelectorAll(".page").forEach(function (p) {
            p.classList.remove("page--active");
        });
        var target = document.getElementById("page-" + page);
        if (target) target.classList.add("page--active");

        document.querySelectorAll(".sidebar__item").forEach(function (item) {
            item.classList.toggle("sidebar__item--active", item.dataset.page === page);
        });

        if (page === "home") {
            sendNative({ action: "detectEnvironments" });
            renderHomeMetrics();
        }
        if (page === "updates") {
            if (hubUpdates.length === 0) sendNative({ action: "getAllUpdates" });
            else renderUpdatesHub();
            renderHomeMetrics();
        }
        if (page === "install") {
            var emptyBox = document.getElementById("installEmptyBox");
            var actBox = document.getElementById("installActiveBox");
            if (installTotal === 0 && installResults.size === 0) {
                if (emptyBox) emptyBox.style.display = "flex";
                if (actBox) actBox.style.display = "none";
                var pDesc = document.getElementById("installPageDesc");
                if (pDesc) pDesc.textContent = t("install.emptyTitle");
            } else {
                if (emptyBox) emptyBox.style.display = "none";
                if (actBox) actBox.style.display = "block";
                var pDesc = document.getElementById("installPageDesc");
                if (pDesc) pDesc.textContent = t("install.desc");
            }
        }
        if (page === "settings") {
            if (currentSettingsSubTab === "envvars") {
                loadEnvVars();
            } else if (currentSettingsSubTab === "doctor") {
                if (!pathDoctorReport) sendNative({ action: "inspectPathDoctor" });
            }
        }
        if (page === "recipes") renderFeaturedRecipes();
        if (page === "syscheck") initCheck();
        if (page === "packages" && catalog.length === 0) sendNative({ action: "getCatalog" });
        if (page === "recovery") loadSnapshots();
        if (page === "summary") renderSummary();
    }

    document.getElementById("sidebarNav").addEventListener("click", function (e) {
        var item = e.target.closest(".sidebar__item");
        if (item && item.dataset.page) navigateTo(item.dataset.page);
    });

    // Sidebar search - filter nav items
    document.getElementById("sidebarSearch").addEventListener("input", function (e) {
        var q = e.target.value.toLowerCase();
        document.querySelectorAll(".sidebar__item").forEach(function (item) {
            var text = item.textContent.toLowerCase();
            item.style.display = (!q || text.includes(q)) ? "" : "none";
        });
        document.querySelectorAll(".sidebar__section-label").forEach(function (label) {
            label.style.display = q ? "none" : "";
        });
    });

    // -----------------------------------------------------------------------
    // Language switcher
    // -----------------------------------------------------------------------
    var langSelect = document.getElementById("langSelect");

    // Auto-detect system language and restore saved preference
    var savedLang = localStorage.getItem("lazyenv_lang");
    if (!savedLang) {
        var sysLang = (navigator.language || navigator.userLanguage || "en").toLowerCase();
        savedLang = (sysLang.startsWith("zh")) ? "zh-CN" : "en";
    }
    if (savedLang) {
        langSelect.value = savedLang;
        window.LazyEnvI18n.setLocale(savedLang);
    }

    langSelect.addEventListener("change", function () {
        var chosen = langSelect.value;
        localStorage.setItem("lazyenv_lang", chosen);
        window.LazyEnvI18n.setLocale(chosen);
    });

    window.addEventListener("lazyenv:localeChanged", function () {
        t = window.LazyEnvI18n.t;
        renderEnvironments(document.getElementById("homeSearch") ? document.getElementById("homeSearch").value : "");
        if (currentPage === "updates") {
            renderUpdatesHub(document.getElementById("updatesSearch") ? document.getElementById("updatesSearch").value : "");
            if (lastBatchSummary && lastBatchSummary.failCount > 0) {
                renderFailureDiagnostics(lastBatchSummary);
            }
        }
        if (currentPage === "recipes") {
            renderFeaturedRecipes();
            if (currentRecipeDiff) renderRecipeDiff(currentRecipeDiff);
        }
        if (currentPage === "settings") {
            renderEnvVarTable();
            if (pathDoctorReport) renderDoctorReport(pathDoctorReport);
        }
        if (currentPage === "syscheck") renderChecks();
        if (catalog.length > 0) renderCatalog(document.getElementById("pkgSearch") ? document.getElementById("pkgSearch").value : "");
        updatePkgCount();
        if (installResults.size > 0) {
            renderInstallList();
            updateProgressBar();
        }
        if (currentPage === "recovery") loadSnapshots();
        if (currentPage === "summary") renderSummary();
    });

    // -----------------------------------------------------------------------
    // Window controls
    // -----------------------------------------------------------------------
    document.getElementById("btnMin").addEventListener("click", function () {
        sendNative({ action: "windowMinimize" });
    });
    document.getElementById("btnMax").addEventListener("click", function () {
        sendNative({ action: "windowMaximize" });
    });
    document.getElementById("btnClose").addEventListener("click", function () {
        sendNative({ action: "windowClose" });
    });

    document.getElementById("dragRegion").addEventListener("dblclick", function () {
        sendNative({ action: "windowMaximize" });
    });

    document.getElementById("dragRegion").addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) return;
        sendNative({ action: "windowDragStart" });
    });

    function updateMaxBtn() {
        var svg = document.getElementById("btnMax").querySelector("svg");
        if (isMaximized) {
            svg.innerHTML = '<rect x="2" y="0" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none"/><rect x="0" y="2" width="7" height="7" stroke="currentColor" stroke-width="1" fill="var(--bg-base)"/>';
        } else {
            svg.innerHTML = '<rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none"/>';
        }
    }

    // -----------------------------------------------------------------------
    // Home: Installed Environments
    // -----------------------------------------------------------------------
    function getAllEnvironments() {
        var seen = new Set();
        var all = [];
        detectedEnvironments.forEach(function (e) {
            seen.add(e.command.toLowerCase());
            all.push(e);
        });
        manualEnvironments.forEach(function (e) {
            if (!seen.has(e.command.toLowerCase())) {
                seen.add(e.command.toLowerCase());
                all.push(e);
            }
        });
        return all;
    }

    function getCategoryLabel(cat) {
        var key = "category." + cat;
        var result = t(key);
        return result === key ? cat : result;
    }

    function renderEnvironments(filter) {
        var container = document.getElementById("envList");
        var envs = getAllEnvironments();

        if (filter) {
            var f = filter.toLowerCase();
            envs = envs.filter(function (e) {
                return e.name.toLowerCase().includes(f) || e.version.toLowerCase().includes(f) || e.category.toLowerCase().includes(f);
            });
        }

        if (envs.length === 0) {
            container.innerHTML = '<div class="empty-state">' +
                (detectedEnvironments.length === 0 && manualEnvironments.length === 0 ? t("env.scanning") : t("env.noMatch")) +
                '</div>';
            return;
        }

        var groups = {};
        var order = ["language", "tool", "runtime", "utility", "editor", "database", "other"];
        envs.forEach(function (e) {
            var cat = e.category || "other";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(e);
        });

        var html = "";
        order.concat(Object.keys(groups).filter(function (k) { return order.indexOf(k) === -1; })).forEach(function (cat) {
            if (!groups[cat]) return;
            html += '<div class="card-section"><div class="card-section__title">' + esc(getCategoryLabel(cat)) + ' (' + groups[cat].length + ')</div>';
            groups[cat].forEach(function (e) {
                var iconSvg = window.LazyEnvIcons.getIcon(e.command || e.name, e.category);
                var upInfo = environmentUpdates.get(e.command);
                var badgeHtml = "";
                var updateBtnHtml = "";
                if (upInfo) {
                    if (upInfo.isPinned) {
                        badgeHtml = ' <span class="badge badge--neutral">' + esc(t("updates.pinnedHint")) + '</span>';
                    } else if (upInfo.hasUpdate) {
                        badgeHtml = ' <span class="badge badge--update">&#8679; ' + esc(t("home.updateAvailable", upInfo.latestVersion)) + '</span>';
                        updateBtnHtml = '<button class="btn btn--sm btn--accent btn-update" data-cmd="' + esc(e.command) + '" data-pkg="' + esc(upInfo.packageId || "") + '" data-name="' + esc(e.name) + '" data-cur="' + esc(e.version) + '" data-lat="' + esc(upInfo.latestVersion) + '">' + esc(t("home.btnUpdate")) + '</button>';
                    } else {
                        badgeHtml = ' <span class="badge badge--uptodate">' + esc(t("home.upToDate")) + '</span>';
                    }
                }
                var mirrorBtnHtml = "";
                var cmdLow = (e.command || "").toLowerCase();
                var nameLow = (e.name || "").toLowerCase();
                if (cmdLow === "node" || cmdLow === "npm" || cmdLow === "pnpm" || nameLow.includes("node")) {
                    mirrorBtnHtml = '<button class="btn btn--sm btn-mirror" data-type="npm">' + esc(t("mirror.btn")) + '</button>';
                } else if (cmdLow === "python" || cmdLow === "python3" || cmdLow === "pip" || nameLow.includes("python")) {
                    mirrorBtnHtml = '<button class="btn btn--sm btn-mirror" data-type="pip">' + esc(t("mirror.btn")) + '</button>';
                }

                html += '<div class="card-row" data-cmd="' + esc(e.command) + '">' +
                    '<div class="card-row__icon">' + iconSvg + '</div>' +
                    '<div class="card-row__body">' +
                    '<div class="card-row__title">' + esc(e.name) + badgeHtml + '</div>' +
                    '<div class="card-row__subtitle">' + esc(e.version) + '</div>' +
                    '</div>' +
                    '<div class="card-row__actions">' +
                    mirrorBtnHtml +
                    updateBtnHtml +
                    '<button class="btn btn--sm btn-uninstall">' + esc(t("env.btnUninstall")) + '</button>' +
                    '</div></div>';
            });
            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll(".btn-uninstall").forEach(function (btn) {
            btn.addEventListener("click", function (ev) {
                ev.stopPropagation();
                var row = btn.closest(".card-row");
                var name = row.querySelector(".card-row__title").textContent;
                showDialog(
                    t("env.confirmUninstallTitle"),
                    t("env.confirmUninstall", name),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("env.btnUninstall"), cls: "btn--danger", action: function () { sendNative({ action: "uninstallPackage", command: name }); } }
                    ]
                );
            });
        });

        container.querySelectorAll(".btn-mirror").forEach(function (btn) {
            btn.addEventListener("click", function (ev) {
                ev.stopPropagation();
                var type = btn.getAttribute("data-type") || "npm";
                currentMirrorType = type;
                sendNative({ action: "getMirrorSource", type: type });
            });
        });

        container.querySelectorAll(".btn-update").forEach(function (btn) {
            btn.addEventListener("click", function (ev) {
                ev.stopPropagation();
                var cmd = btn.getAttribute("data-cmd");
                var pkgId = btn.getAttribute("data-pkg");
                var name = btn.getAttribute("data-name");
                var latVer = btn.getAttribute("data-lat");

                showDialog(
                    t("home.confirmUpdateTitle"),
                    t("home.confirmUpdate", name, latVer),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        {
                            text: t("home.btnUpdate"),
                            cls: "btn--accent",
                            action: function () {
                                btn.disabled = true;
                                btn.textContent = t("home.updating");
                                sendNative({
                                    action: "upgradeEnvironment",
                                    command: cmd,
                                    packageId: pkgId,
                                    name: name
                                });
                            }
                        }
                    ]
                );
            });
        });
    }

    document.getElementById("homeSearch").addEventListener("input", function (e) {
        renderEnvironments(e.target.value);
    });

    document.getElementById("btnRefreshEnv").addEventListener("click", function () {
        document.getElementById("envList").innerHTML = '<div class="empty-state">' + t("env.scanning") + '</div>';
        detectedEnvironments = [];
        environmentUpdates.clear();
        sendNative({ action: "detectEnvironments" });
    });

    document.getElementById("btnCheckUpdates").addEventListener("click", function () {
        if (isCheckingUpdates) return;
        var btn = document.getElementById("btnCheckUpdates");
        btn.classList.add("btn--loading");
        btn.disabled = true;
        var span = btn.querySelector("span");
        if (span) span.textContent = t("home.checkingUpdates");
        isCheckingUpdates = true;

        sendNative({
            action: "checkUpdates",
            environments: getAllEnvironments()
        });
    });


    // -----------------------------------------------------------------------
    // Home: Manual Add Environment
    // -----------------------------------------------------------------------
    var addEnvPanel = document.getElementById("addEnvPanel");

    document.getElementById("btnAddEnv").addEventListener("click", function () {
        addEnvPanel.classList.toggle("add-panel--visible");
        if (addEnvPanel.classList.contains("add-panel--visible")) {
            document.getElementById("addEnvCmd").focus();
        }
    });

    document.getElementById("btnCloseAddPanel").addEventListener("click", function () {
        addEnvPanel.classList.remove("add-panel--visible");
    });

    document.getElementById("btnDetectEnv").addEventListener("click", function () {
        var cmd = document.getElementById("addEnvCmd").value.trim();
        if (!cmd) return;
        var cat = document.getElementById("addEnvCategory").value;
        sendNative({ action: "probeCommand", command: cmd, category: cat });
    });

    document.getElementById("addEnvCmd").addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("btnDetectEnv").click();
        }
    });

    function handleProbeResult(d) {
        if (d.found) {
            manualEnvironments.push({
                name: d.name,
                command: d.command,
                version: d.version,
                category: d.category || "other"
            });
            document.getElementById("addEnvCmd").value = "";
            renderEnvironments(document.getElementById("homeSearch").value);
            showToast(t("probe.addedToast", d.name, d.version), "success");
        } else {
            showToast(d.message || t("probe.notFound"), "error");
        }
    }

    // -----------------------------------------------------------------------
    // Settings: Environment Variable Editor
    // -----------------------------------------------------------------------
    function loadEnvVars() {
        sendNative({ action: "listEnvVars", scope: envVarScope });
    }

    // Tab switching
    document.getElementById("envvarTabs").addEventListener("click", function (e) {
        var tab = e.target.closest(".tab");
        if (!tab || !tab.dataset.scope) return;
        envVarScope = tab.dataset.scope;
        document.querySelectorAll("#envvarTabs .tab").forEach(function (t) {
            t.classList.toggle("tab--active", t.dataset.scope === envVarScope);
        });
        loadEnvVars();
    });

    function renderEnvVarTable() {
        var tbody = document.getElementById("envvarBody");
        var filter = document.getElementById("envvarSearch").value.toLowerCase();
        var vars = envVarCache;

        if (filter) {
            vars = vars.filter(function (v) {
                return v.name.toLowerCase().includes(filter) || v.value.toLowerCase().includes(filter);
            });
        }

        if (vars.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">' +
                (envVarCache.length === 0 ? t("settings.loading") : t("settings.noMatch")) +
                '</td></tr>';
            return;
        }

        var html = "";
        vars.forEach(function (v) {
            var isPath = v.name.toUpperCase() === "PATH" || v.name.toUpperCase() === "PATHEXT";
            var displayVal = v.value;
            if (isPath && displayVal.length > 80) {
                displayVal = displayVal.substring(0, 80) + "...";
            }
            html += '<tr data-name="' + esc(v.name) + '">' +
                '<td class="envvar-name">' + esc(v.name) +
                (v.type === "REG_EXPAND_SZ" ? ' <span class="envvar-type">EXP</span>' : '') +
                '</td>' +
                '<td class="envvar-value">' + esc(displayVal) + '</td>' +
                '<td class="envvar-actions">' +
                '<button class="btn btn--sm btn-edit-var" title="' + esc(t("settings.edit")) + '">' +
                '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>' +
                '</button>' +
                '<button class="btn btn--sm btn--danger btn-delete-var" title="' + esc(t("settings.delete")) + '">' +
                '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1H13a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>' +
                '</button>' +
                '</td></tr>';
        });

        tbody.innerHTML = html;

        // Bind edit buttons
        tbody.querySelectorAll(".btn-edit-var").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var name = btn.closest("tr").dataset.name;
                var v = envVarCache.find(function (x) { return x.name === name; });
                if (v) showEnvVarEditDialog(v.name, v.value, v.type, false);
            });
        });

        // Bind delete buttons
        tbody.querySelectorAll(".btn-delete-var").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var name = btn.closest("tr").dataset.name;
                showDialog(
                    t("settings.confirmDeleteTitle"),
                    t("settings.confirmDelete", name),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("settings.delete"), cls: "btn--danger", action: function () {
                            sendNative({ action: "deleteEnvVar", name: name, scope: envVarScope });
                        }}
                    ]
                );
            });
        });
    }

    document.getElementById("envvarSearch").addEventListener("input", function () {
        renderEnvVarTable();
    });

    // New variable button
    document.getElementById("btnAddEnvVar").addEventListener("click", function () {
        showEnvVarEditDialog("", "", "REG_SZ", true);
    });

    function showEnvVarEditDialog(name, value, type, isNew) {
        var isPathVar = name.toUpperCase() === "PATH";
        var title = isNew ? t("settings.newVarTitle") : t("settings.editVarTitle", name);

        var bodyHtml = '<div class="dialog-form">';
        bodyHtml += '<div class="dialog-form__group">';
        bodyHtml += '<label class="dialog-form__label">' + esc(t("settings.colName")) + '</label>';
        bodyHtml += '<input type="text" class="input" id="dlgVarName" value="' + esc(name) + '"' + (isNew ? '' : ' readonly') + '>';
        bodyHtml += '</div>';

        bodyHtml += '<div class="dialog-form__group">';
        bodyHtml += '<label class="dialog-form__label">' + esc(t("settings.colValue")) + '</label>';

        if (isPathVar) {
            // PATH editor: one entry per line
            var pathEntries = value.split(";").filter(function (p) { return p.trim(); });
            bodyHtml += '<div class="path-editor" id="dlgPathEditor">';
            pathEntries.forEach(function (entry, idx) {
                bodyHtml += '<div class="path-entry">' +
                    '<input type="text" class="input input--mono path-input" value="' + esc(entry) + '">' +
                    '<button class="btn--icon path-remove" data-idx="' + idx + '">' +
                    '<svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>' +
                    '</button></div>';
            });
            bodyHtml += '</div>';
            bodyHtml += '<button class="btn btn--sm mt-sm" id="dlgPathAdd">' + esc(t("settings.pathAdd")) + '</button>';
        } else {
            bodyHtml += '<textarea class="input input--mono dialog-form__textarea" id="dlgVarValue" rows="4">' + esc(value) + '</textarea>';
        }
        bodyHtml += '</div>';

        bodyHtml += '<div class="dialog-form__group">';
        bodyHtml += '<label class="dialog-form__label">' + esc(t("settings.type")) + '</label>';
        bodyHtml += '<select class="input" id="dlgVarType">';
        bodyHtml += '<option value="REG_SZ"' + (type === "REG_SZ" ? ' selected' : '') + '>REG_SZ</option>';
        bodyHtml += '<option value="REG_EXPAND_SZ"' + (type === "REG_EXPAND_SZ" ? ' selected' : '') + '>REG_EXPAND_SZ</option>';
        bodyHtml += '</select>';
        bodyHtml += '</div>';
        bodyHtml += '</div>';

        showDialogRaw(title, bodyHtml, [
            { text: t("dialog.cancel"), cls: "" },
            { text: t("settings.save"), cls: "btn--accent", action: function () {
                var newName = document.getElementById("dlgVarName").value.trim();
                if (!newName) { showToast(t("settings.nameRequired"), "error"); return false; }
                var newValue;
                if (isPathVar || (newName.toUpperCase() === "PATH")) {
                    var inputs = document.querySelectorAll("#dlgPathEditor .path-input");
                    var parts = [];
                    inputs.forEach(function (inp) { if (inp.value.trim()) parts.push(inp.value.trim()); });
                    newValue = parts.join(";");
                } else {
                    newValue = document.getElementById("dlgVarValue").value;
                }
                var newType = document.getElementById("dlgVarType").value;
                sendNative({
                    action: "writeEnvVar",
                    name: newName,
                    value: newValue,
                    type: newType,
                    scope: envVarScope
                });
            }}
        ]);

        // PATH editor: add/remove entries
        if (isPathVar) {
            var editor = document.getElementById("dlgPathEditor");
            document.getElementById("dlgPathAdd").addEventListener("click", function () {
                var div = document.createElement("div");
                div.className = "path-entry";
                div.innerHTML = '<input type="text" class="input input--mono path-input" value="">' +
                    '<button class="btn--icon path-remove"><svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.5"/></svg></button>';
                editor.appendChild(div);
                div.querySelector("input").focus();
                div.querySelector(".path-remove").addEventListener("click", function () { div.remove(); });
            });
            editor.querySelectorAll(".path-remove").forEach(function (btn) {
                btn.addEventListener("click", function () { btn.closest(".path-entry").remove(); });
            });
        }
    }

    // -----------------------------------------------------------------------
    // System Check
    // -----------------------------------------------------------------------
    var systemCheckData = null;

    function initCheck() {
        sendNative({ action: "runSystemChecks" });
        renderChecks();
    }

    function renderChecks() {
        var container = document.getElementById("syscheckGrid");
        if (!container) return;

        if (!systemCheckData) {
            container.innerHTML = '<div class="card" style="grid-column:1/-1;padding:36px 24px;text-align:center;">' +
                '<div class="spinner-sm" style="margin:0 auto 12px auto;"></div>' +
                '<span class="text-secondary">' + esc(t("check.checking")) + '</span>' +
                '</div>';
            return;
        }

        var d = systemCheckData;
        var cards = [
            {
                icon: "💻",
                title: t("syscheck.os"),
                value: d.os || "Windows (x64)",
                status: t("syscheck.statusReady"),
                badgeCls: "tag--winget"
            },
            {
                icon: "🛡️",
                title: t("syscheck.privilege"),
                value: d.isElevated ? t("syscheck.privAdmin") : t("syscheck.privUser"),
                status: d.isElevated ? t("syscheck.statusReady") : t("syscheck.statusWarning"),
                badgeCls: d.isElevated ? "tag--winget" : "tag--pip"
            },
            {
                icon: "🛠️",
                title: t("syscheck.devMode"),
                value: d.devMode ? t("syscheck.devModeOn") : t("syscheck.devModeOff"),
                status: d.devMode ? t("syscheck.statusReady") : t("syscheck.statusWarning"),
                badgeCls: d.devMode ? "tag--winget" : "tag--pip"
            },
            {
                icon: "💾",
                title: t("syscheck.storage"),
                value: (d.diskFree || "Unknown") + " " + (currentLanguage === "zh-CN" ? "可用空间" : "Free"),
                status: t("syscheck.statusReady"),
                badgeCls: "tag--winget"
            },
            {
                icon: "📦",
                title: t("syscheck.pkgManagers"),
                value: "WinGet: " + (d.winget ? "✓" : "✗") + " • NPM: " + (d.npm ? "✓" : "✗") + " • Pip: " + (d.pip ? "✓" : "✗") + " • Scoop: " + (d.scoop ? "✓" : "✗"),
                status: (d.winget && d.npm) ? t("syscheck.statusReady") : t("syscheck.statusWarning"),
                badgeCls: (d.winget && d.npm) ? "tag--winget" : "tag--pip"
            },
            {
                icon: "🌐",
                title: t("syscheck.webview2"),
                value: t("check.available"),
                status: t("syscheck.statusReady"),
                badgeCls: "tag--winget"
            }
        ];

        var html = "";
        cards.forEach(function (c) {
            html += '<div class="syscheck-card">' +
                '<div class="syscheck-card__header">' +
                '<span class="syscheck-card__icon">' + c.icon + '</span>' +
                '<span class="badge--source ' + c.badgeCls + '">' + esc(c.status) + '</span>' +
                '</div>' +
                '<div class="syscheck-card__title">' + esc(c.title) + '</div>' +
                '<div class="syscheck-card__value">' + esc(c.value) + '</div>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    var btnRunChk = document.getElementById("btnRunChecks");
    if (btnRunChk) {
        btnRunChk.addEventListener("click", function () {
            systemCheckData = null;
            initCheck();
        });
    }

    var btnChkRec = document.getElementById("btnSysCheckGoRecipes");
    if (btnChkRec) {
        btnChkRec.addEventListener("click", function () { navigateTo("recipes"); });
    }

    var btnChkPkg = document.getElementById("btnSysCheckGoPackages");
    if (btnChkPkg) {
        btnChkPkg.addEventListener("click", function () { navigateTo("packages"); });
    }

    // -----------------------------------------------------------------------
    // Packages
    // -----------------------------------------------------------------------
    function renderCatalog(filter) {
        var container = document.getElementById("packageList");
        var pkgs = catalog;

        if (filter) {
            var f = filter.toLowerCase();
            pkgs = pkgs.filter(function (p) {
                return p.name.toLowerCase().includes(f) || p.id.toLowerCase().includes(f) || p.category.toLowerCase().includes(f);
            });
        }

        var groups = {};
        var order = ["language", "tool", "editor", "runtime", "database", "utility"];
        pkgs.forEach(function (p) {
            var cat = p.category || "other";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        });

        var html = "";
        order.concat(Object.keys(groups).filter(function (k) { return order.indexOf(k) === -1; })).forEach(function (cat) {
            if (!groups[cat]) return;
            html += '<div class="card-section"><div class="card-section__title">' + esc(getCategoryLabel(cat)) + '</div>';
            groups[cat].forEach(function (p) {
                var sel = selectedPackages.has(p.id);
                var iconSvg = window.LazyEnvIcons.getIcon(p.id || p.name, p.category);
                var isInstalled = false;
                var low = (p.id + " " + p.name).toLowerCase();
                detectedEnvironments.forEach(function (e) {
                    var elow = ((e.command || "") + " " + (e.name || "")).toLowerCase();
                    if (low.includes((e.command || "").toLowerCase()) || elow.includes((p.name || "").toLowerCase())) {
                        isInstalled = true;
                    }
                });
                var instBadge = isInstalled ? ' <span class="badge--source" style="background:rgba(255,255,255,0.06);color:var(--text-tertiary);margin-left:6px;font-size:10px;">' + esc(t("common.installed")) + '</span>' : '';
                html += '<div class="card-row card-row--selectable' + (sel ? ' card-row--selected' : '') + '" data-id="' + esc(p.id) + '">' +
                    '<div class="card-row__check">' +
                    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>' +
                    '</div>' +
                    '<div class="card-row__icon">' + iconSvg + '</div>' +
                    '<div class="card-row__body">' +
                    '<div class="card-row__title">' + esc(p.name) + instBadge + '</div>' +
                    '<div class="card-row__subtitle">' + esc(p.description) + '</div>' +
                    '</div></div>';
            });
            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll(".card-row--selectable").forEach(function (row) {
            row.addEventListener("click", function () {
                var id = row.dataset.id;
                if (selectedPackages.has(id)) { selectedPackages.delete(id); row.classList.remove("card-row--selected"); }
                else { selectedPackages.add(id); row.classList.add("card-row--selected"); }
                updatePkgCount();
            });
        });
    }

    function updatePkgCount() {
        var n = selectedPackages.size;
        document.getElementById("pkgSelectedCount").textContent = t("packages.selectedCount", n);
        document.getElementById("btnStartInstall").disabled = n === 0;
    }

    document.getElementById("pkgSearch").addEventListener("input", function (e) {
        renderCatalog(e.target.value);
    });

    document.getElementById("btnSelectAll").addEventListener("click", function () {
        catalog.forEach(function (p) { selectedPackages.add(p.id); });
        renderCatalog(document.getElementById("pkgSearch").value);
        updatePkgCount();
    });

    document.getElementById("btnDeselectAll").addEventListener("click", function () {
        selectedPackages.clear();
        renderCatalog(document.getElementById("pkgSearch").value);
        updatePkgCount();
    });

    document.getElementById("btnStartInstall").addEventListener("click", function () {
        if (selectedPackages.size === 0) return;
        navigateTo("install");
        startInstall();
    });

    // -----------------------------------------------------------------------
    // Installation
    // -----------------------------------------------------------------------
    function startInstall() {
        installResults.clear();
        installLogs.clear();
        installTotal = selectedPackages.size;
        installCurrent = 0;
        selectedPackages.forEach(function (id) {
            installResults.set(id, { status: "pending", message: t("install.waiting"), command: "", output: "" });
            installLogs.set(id, []);
        });
        renderInstallList();
        updateProgressBar();
        sendNative({ action: "install", packages: Array.from(selectedPackages) });
    }

    function renderInstallList() {
        var list = document.getElementById("installList");
        var html = "";

        installResults.forEach(function (r, id) {
            var pkg = catalog.find(function (p) { return p.id === id; });
            var name = pkg ? pkg.name : id;
            var iconHtml = "";
            var cls = "";
            var statusText = "";

            switch (r.status) {
                case "pending":
                    iconHtml = '<div class="status-dot status-dot--pending"></div>';
                    statusText = t("install.pending");
                    break;
                case "running":
                    iconHtml = '<div class="spinner-sm"></div>';
                    cls = " card-row--running";
                    statusText = t("install.installing");
                    break;
                case "success":
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 16 16" fill="var(--success)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
                    cls = " card-row--success";
                    statusText = t("install.installed");
                    break;
                case "failed":
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 16 16" fill="var(--error)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>';
                    cls = " card-row--failed";
                    statusText = t("install.failed", r.exitCode);
                    break;
            }

            var pkgIcon = window.LazyEnvIcons.getIcon(id || name, pkg ? pkg.category : "");
            html += '<div class="install-item' + cls + '" data-pkg-id="' + esc(id) + '">';
            html += '<div class="card-row">';
            html += '<div class="card-row__icon">' + pkgIcon + '</div>';
            html += '<div class="card-row__status">' + iconHtml + '</div>';
            html += '<div class="card-row__body">';
            html += '<div class="card-row__title">' + esc(name) + '</div>';
            html += '<div class="card-row__subtitle">' + esc(statusText) + '</div>';
            html += '</div>';
            if (r.status === "failed") {
                html += '<div class="card-row__actions"><button class="btn btn--sm btn--accent btn-retry" data-id="' + esc(id) + '">' + esc(t("install.btnRetry")) + '</button></div>';
            }
            html += '</div>';

            // Command + log
            if (r.command) {
                html += '<div class="install-item__cmd">' + esc(r.command) + '</div>';
            }

            var logLines = installLogs.get(id) || [];
            if (logLines.length > 0 || r.status === "running") {
                html += '<div class="install-item__log" id="log-' + esc(id) + '">';
                logLines.forEach(function (line) {
                    html += '<div class="log-line">' + esc(line) + '</div>';
                });
                if (r.status === "running" && logLines.length === 0) {
                    html += '<div class="log-line log-line--dim">' + esc(t("install.waitingOutput")) + '</div>';
                }
                html += '</div>';
            }

            if (r.status === "failed" && r.output) {
                html += '<div class="install-item__error">' + esc(r.output) + '</div>';
            }

            html += '</div>';
        });

        list.innerHTML = html || '<div class="empty-state">' + esc(t("install.noPackages")) + '</div>';

        // Retry buttons
        list.querySelectorAll(".btn-retry").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pkgId = btn.dataset.id;
                installResults.set(pkgId, { status: "pending", message: t("install.retrying"), command: "", output: "" });
                installLogs.set(pkgId, []);
                renderInstallList();
                sendNative({ action: "retryInstall", packageId: pkgId });
            });
        });

        // Auto-scroll logs
        installResults.forEach(function (r, id) {
            if (r.status === "running") {
                var logEl = document.getElementById("log-" + id);
                if (logEl) logEl.scrollTop = logEl.scrollHeight;
            }
        });
    }

    function updateLogPanel(packageId) {
        var logEl = document.getElementById("log-" + packageId);
        if (!logEl) { renderInstallList(); return; }
        var lines = installLogs.get(packageId) || [];
        var html = "";
        lines.forEach(function (line) {
            html += '<div class="log-line">' + esc(line) + '</div>';
        });
        logEl.innerHTML = html;
        logEl.scrollTop = logEl.scrollHeight;
    }

    function updateProgressBar() {
        var fill = document.getElementById("installProgressFill");
        var text = document.getElementById("installProgress");
        var pct = document.getElementById("installPercent");

        var done = 0;
        var failed = 0;
        installResults.forEach(function (r) {
            if (r.status === "success" || r.status === "skipped" || r.status === "failed") done++;
            if (r.status === "failed") failed++;
        });

        var total = installResults.size || 1;
        var percent = Math.round((done / total) * 100);

        fill.style.width = percent + "%";
        if (failed > 0 && done === total) fill.classList.add("progress-bar__fill--error");
        else fill.classList.remove("progress-bar__fill--error");

        text.textContent = t("install.progressText", done, total);
        pct.textContent = percent + "%";
    }

    // -----------------------------------------------------------------------
    // Recovery
    // -----------------------------------------------------------------------
    function loadSnapshots() {
        sendNative({ action: "listSnapshots" });
    }

    function renderSnapshots(snaps) {
        var list = document.getElementById("snapshotList");
        if (snaps.length === 0) {
            list.innerHTML = '<div class="empty-state">' + esc(t("recovery.emptyState")) + '</div>';
            return;
        }

        var html = "";
        snaps.forEach(function (s) {
            html += '<div class="card-row" data-id="' + esc(s.id) + '">' +
                '<div class="card-row__icon"><svg width="18" height="18" viewBox="0 0 16 16" fill="var(--accent)"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg></div>' +
                '<div class="card-row__body">' +
                '<div class="card-row__title">' + esc(s.description) + '</div>' +
                '<div class="card-row__subtitle">' + esc(s.timestamp) + ' | ' + t("recovery.userCount", s.userVarCount || 0) + ' | ' + t("recovery.systemCount", s.systemVarCount || 0) + '</div>' +
                '</div>' +
                '<div class="card-row__actions">' +
                '<button class="btn btn--sm btn-restore">' + esc(t("recovery.btnRestore")) + '</button>' +
                '<button class="btn btn--sm btn-export">' + esc(t("recovery.btnExport")) + '</button>' +
                '<button class="btn btn--sm btn--danger btn-delete">' + esc(t("recovery.btnDelete")) + '</button>' +
                '</div></div>';
        });

        list.innerHTML = html;

        list.querySelectorAll(".card-row").forEach(function (row) {
            var id = row.dataset.id;
            if (!id) return;
            row.querySelector(".btn-restore").addEventListener("click", function (e) {
                e.stopPropagation();
                showDialog(
                    t("recovery.confirmRestoreTitle"),
                    t("recovery.confirmRestore"),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("recovery.btnRestore"), cls: "btn--accent", action: function () { sendNative({ action: "restoreSnapshot", snapshotId: id }); } }
                    ]
                );
            });
            row.querySelector(".btn-export").addEventListener("click", function (e) {
                e.stopPropagation();
                sendNative({ action: "exportSnapshot", snapshotId: id });
            });
            row.querySelector(".btn-delete").addEventListener("click", function (e) {
                e.stopPropagation();
                showDialog(
                    t("recovery.confirmDeleteTitle"),
                    t("recovery.confirmDelete"),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("recovery.btnDelete"), cls: "btn--danger", action: function () { sendNative({ action: "deleteSnapshot", snapshotId: id }); } }
                    ]
                );
            });
        });
    }

    document.getElementById("btnCreateSnapshot").addEventListener("click", function () {
        showDialogRaw(
            t("recovery.createTitle"),
            '<div class="dialog-form"><div class="dialog-form__group">' +
            '<label class="dialog-form__label">' + esc(t("recovery.descLabel")) + '</label>' +
            '<input type="text" class="input" id="dlgSnapDesc" value="">' +
            '</div></div>',
            [
                { text: t("dialog.cancel"), cls: "" },
                { text: t("recovery.create"), cls: "btn--accent", action: function () {
                    var desc = document.getElementById("dlgSnapDesc").value.trim() || t("recovery.defaultDesc");
                    sendNative({ action: "createSnapshot", description: desc });
                }}
            ]
        );
        setTimeout(function () { var el = document.getElementById("dlgSnapDesc"); if (el) el.focus(); }, 100);
    });

    document.getElementById("btnImportSnapshot").addEventListener("click", function () {
        sendNative({ action: "importSnapshot" });
    });

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    function renderSummary() {
        var container = document.getElementById("summaryContent");
        if (!container) return;

        if (installResults.size === 0) {
            var lastHist = null;
            try {
                var raw = localStorage.getItem("lazyenv_last_install");
                if (raw) lastHist = JSON.parse(raw);
            } catch(e) {}

            if (lastHist && lastHist.items && lastHist.items.length > 0) {
                var dStr = new Date(lastHist.time).toLocaleString();
                var sCount = lastHist.items.filter(function(x) { return x.status === "success"; }).length;
                var html = '<div class="card-box mb-lg">' +
                    '<div class="flex-between mb-sm">' +
                    '<div style="font-weight:600;font-size:15px;">' + esc(t("summary.historyTitle")) + '</div>' +
                    '<span class="text-secondary" style="font-size:12px;">' + esc(dStr) + '</span>' +
                    '</div>' +
                    '<div class="doctor-metrics-grid mb-md">' +
                    '<div class="metric-mini-card"><div class="metric-mini-card__label">' + esc(t("summary.colStatus")) + '</div><div class="metric-mini-card__value text-success">' + sCount + ' / ' + lastHist.total + '</div></div>' +
                    '<div class="metric-mini-card"><div class="metric-mini-card__label">' + esc(t("recovery.createSuccess")) + '</div><div class="metric-mini-card__value" style="font-size:13px;word-break:break-all;">' + esc(lastHist.snapshotId ? lastHist.snapshotId.substring(0, 16) + '...' : 'None') + '</div></div>' +
                    '</div>' +
                    '<table class="data-table mb-md"><thead><tr><th>' + esc(t("summary.colName")) + '</th><th>' + esc(t("summary.colStatus")) + '</th><th>' + esc(t("summary.colMessage")) + '</th></tr></thead><tbody>';
                lastHist.items.forEach(function (it) {
                    var pkg = catalog.find(function (p) { return p.id === it.id; });
                    var name = pkg ? pkg.name : it.id;
                    var badgeCls = it.status === "success" ? "badge--source tag--winget" : "badge--source tag--pip";
                    html += '<tr><td>' + esc(name) + '</td><td><span class="' + badgeCls + '">' + esc(it.status) + '</span></td><td>' + esc(it.message) + '</td></tr>';
                });
                html += '</tbody></table>' +
                    '<div class="toolbar" style="margin-bottom:0">' +
                    '<button class="btn btn--accent" id="btnSummGoHome">' + esc(t("summary.viewEnvs")) + '</button>' +
                    '<button class="btn" id="btnSummGoPackages">' + esc(t("summary.goPackages")) + '</button>' +
                    '</div></div>';
                container.innerHTML = html;
                var bHome = document.getElementById("btnSummGoHome");
                if (bHome) bHome.addEventListener("click", function () { navigateTo("home"); });
                var bPkg = document.getElementById("btnSummGoPackages");
                if (bPkg) bPkg.addEventListener("click", function () { navigateTo("packages"); });
                return;
            }

            container.innerHTML = '<div class="empty-state" style="padding:48px 24px;">' +
                '<div class="empty-state__icon">📋</div>' +
                '<div style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">' + esc(t("summary.noHistory")) + '</div>' +
                '<div class="empty-state__text mb-lg" style="margin-bottom:16px;">' + esc(t("summary.noHistoryDesc")) + '</div>' +
                '<button class="btn btn--accent" id="btnSummaryGoPkg">' + esc(t("summary.goPackages")) + '</button>' +
                '</div>';
            var bGo = document.getElementById("btnSummaryGoPkg");
            if (bGo) bGo.addEventListener("click", function () { navigateTo("packages"); });
            return;
        }

        var html = '<table class="data-table"><thead><tr>' +
            '<th>' + esc(t("summary.colName")) + '</th>' +
            '<th>' + esc(t("summary.colStatus")) + '</th>' +
            '<th>' + esc(t("summary.colCommand")) + '</th>' +
            '<th>' + esc(t("summary.colMessage")) + '</th>' +
            '</tr></thead><tbody>';

        installResults.forEach(function (r, id) {
            var pkg = catalog.find(function (p) { return p.id === id; });
            var name = pkg ? pkg.name : id;
            var statusClass = r.status === "success" ? "text-success" : (r.status === "error" ? "text-error" : "text-secondary");
            html += '<tr>' +
                '<td>' + esc(name) + '</td>' +
                '<td class="' + statusClass + '">' + esc(r.status) + '</td>' +
                '<td class="font-mono text-secondary" style="font-size:11px;">' + esc(r.command || "") + '</td>' +
                '<td>' + esc(r.message || "") + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    }

    // -----------------------------------------------------------------------
    // Dialog
    // -----------------------------------------------------------------------
    function showDialog(title, message, buttons) {
        showDialogRaw(title, '<p>' + esc(message) + '</p>', buttons);
    }

    function showDialogRaw(title, bodyHtml, buttons) {
        var overlay = document.getElementById("dialogOverlay");
        document.getElementById("dialogTitle").textContent = title;
        document.getElementById("dialogBody").innerHTML = bodyHtml;

        var footer = document.getElementById("dialogFooter");
        footer.innerHTML = "";
        buttons.forEach(function (b) {
            var btn = document.createElement("button");
            btn.className = "btn " + (b.cls || "");
            btn.textContent = b.text;
            btn.addEventListener("click", function () {
                if (b.action) {
                    var result = b.action();
                    if (result === false) return; // prevent close
                }
                overlay.classList.remove("dialog-overlay--visible", "dialog-overlay--active");
            });
            footer.appendChild(btn);
        });

        overlay.classList.add("dialog-overlay--visible", "dialog-overlay--active");
    }

    document.getElementById("dialogOverlay").addEventListener("click", function (e) {
        if (e.target === this) this.classList.remove("dialog-overlay--visible", "dialog-overlay--active");
    });

    // -----------------------------------------------------------------------
    // Toast notification
    // -----------------------------------------------------------------------
    function showToast(msg, type) {
        var container = document.getElementById("toastContainer");
        var el = document.createElement("div");
        el.className = "toast" + (type ? " toast--" + type : "");
        el.textContent = msg;
        container.appendChild(el);
        requestAnimationFrame(function () { el.classList.add("toast--visible"); });
        setTimeout(function () { el.classList.remove("toast--visible"); }, 3000);
        setTimeout(function () { el.remove(); }, 3500);
    }

    // -----------------------------------------------------------------------
    // Utility
    // -----------------------------------------------------------------------
    function esc(s) {
        if (!s) return "";
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Updates Hub Logic & UI
    // -----------------------------------------------------------------------
    function updateSidebarBadge() {
        var unpinnedCount = 0;
        var counts = { all: 0, winget: 0, scoop: 0, npm: 0, pip: 0, pinned: 0 };

        hubUpdates.forEach(function (u) {
            var src = (u.source || "").toLowerCase();
            if (u.isPinned) {
                counts.pinned++;
            } else {
                unpinnedCount++;
                counts.all++;
                if (counts[src] !== undefined) {
                    counts[src]++;
                }
            }
        });

        var badge = document.getElementById("updatesBadge");
        if (badge) {
            if (unpinnedCount > 0) {
                badge.textContent = unpinnedCount;
                badge.style.display = "inline-block";
            } else {
                badge.style.display = "none";
            }
        }

        // Update Tab Badges
        var setBadge = function (id, num) {
            var el = document.getElementById(id);
            if (el) el.textContent = num;
        };
        if (isCheckingHubUpdates && hubUpdates.length === 0) {
            setBadge("tabBadgeAll", "-");
            setBadge("tabBadgeWinget", "-");
            setBadge("tabBadgeScoop", "-");
            setBadge("tabBadgeNpm", "-");
            setBadge("tabBadgePip", "-");
            setBadge("tabBadgePinned", "-");
        } else {
            setBadge("tabBadgeAll", counts.all);
            setBadge("tabBadgeWinget", counts.winget);
            setBadge("tabBadgeScoop", counts.scoop);
            setBadge("tabBadgeNpm", counts.npm);
            setBadge("tabBadgePip", counts.pip);
            setBadge("tabBadgePinned", counts.pinned);
        }
    }

    function renderUpdatesHub(filterText) {
        var container = document.getElementById("updatesList");
        if (!container) return;

        // Display checking state instead of false zero
        if (isCheckingHubUpdates && hubUpdates.length === 0) {
            container.innerHTML = '<div class="card-box" style="text-align:center; padding:36px 16px;">' +
                '<div class="btn__icon-spin" style="display:inline-block; margin-bottom:12px; width:28px; height:28px; color:var(--accent);">' +
                '<svg viewBox="0 0 16 16" width="28" height="28" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg></div>' +
                '<div style="font-size:15px; font-weight:600; margin-bottom:6px;">' + esc(t("updates.checking")) + '</div>' +
                '<div class="text-secondary" style="font-size:12px;">' + esc(t("updates.checkingDesc")) + '</div>' +
                '</div>';
            return;
        }

        var items = hubUpdates.slice();

        // 1. Source filter
        if (currentHubFilter === "pinned") {
            items = items.filter(function (it) { return it.isPinned; });
        } else if (currentHubFilter !== "all") {
            items = items.filter(function (it) { return it.source.toLowerCase() === currentHubFilter && !it.isPinned; });
        } else {
            items = items.filter(function (it) { return !it.isPinned; });
        }

        // 2. Search filter
        if (filterText) {
            var ft = filterText.toLowerCase();
            items = items.filter(function (it) {
                return it.name.toLowerCase().includes(ft) || it.id.toLowerCase().includes(ft) || it.source.toLowerCase().includes(ft);
            });
        }

        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state">' + esc(t("updates.noUpdates")) + '</div>';
            return;
        }

        var html = '<div class="card-section"><div class="card-section__title">' +
                   esc(currentHubFilter.toUpperCase()) + ' (' + items.length + ')</div>';

        items.forEach(function (it) {
            var isSel = selectedHubUpdateIds.has(it.id);
            var srcClass = "tag--" + esc(it.source.toLowerCase());
            var iconSvg = window.LazyEnvIcons ? window.LazyEnvIcons.getIcon(it.name || it.id, "tool", it.source) : "";

            html += '<div class="card-row card-row--selectable ' + (isSel ? 'card-row--selected' : '') + '" data-id="' + esc(it.id) + '">' +
                '<div class="card-row__check"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z"/></svg></div>' +
                '<div class="card-row__icon">' + iconSvg + '</div>' +
                '<div class="card-row__body">' +
                '<div class="card-row__title">' + esc(it.name) + ' <span class="badge--source ' + srcClass + '">' + esc(it.source) + '</span>' +
                (it.isPinned ? ' <span class="badge badge--neutral">' + esc(t("updates.pinnedHint")) + '</span>' : '') +
                '</div>' +
                '<div class="card-row__subtitle">' + esc(it.currentVersion) + ' &rarr; <span class="text-accent" style="font-weight:600">' + esc(it.latestVersion) + '</span></div>' +
                '</div>' +
                '<div class="card-row__actions">' +
                '<button class="btn-pin ' + (it.isPinned ? 'btn-pin--active' : '') + '" data-id="' + esc(it.id) + '" data-pinned="' + (it.isPinned ? 'true' : 'false') + '">' +
                (it.isPinned ? esc(t("updates.unpin")) : esc(t("updates.pin"))) + '</button>' +
                '<button class="btn btn--sm btn--accent btn-update-single" data-id="' + esc(it.id) + '" data-name="' + esc(it.name) + '" data-src="' + esc(it.source) + '" data-lat="' + esc(it.latestVersion) + '">' +
                esc(t("home.btnUpdate")) + '</button>' +
                '</div></div>';
        });

        html += '</div>';
        container.innerHTML = html;

        // Selection checkbox click
        container.querySelectorAll(".card-row--selectable").forEach(function (row) {
            row.addEventListener("click", function (e) {
                if (e.target.closest("button") || e.target.closest(".btn-pin")) return;
                var id = row.getAttribute("data-id");
                if (selectedHubUpdateIds.has(id)) {
                    selectedHubUpdateIds.delete(id);
                    row.classList.remove("card-row--selected");
                } else {
                    selectedHubUpdateIds.add(id);
                    row.classList.add("card-row--selected");
                }
            });
        });

        // Pin toggle click
        container.querySelectorAll(".btn-pin").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                var id = btn.getAttribute("data-id");
                var isPinned = btn.getAttribute("data-pinned") === "true";
                sendNative({
                    action: "togglePinPackage",
                    packageId: id,
                    pinned: !isPinned
                });
            });
        });

        // Single upgrade click
        container.querySelectorAll(".btn-update-single").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                var id = btn.getAttribute("data-id");
                var name = btn.getAttribute("data-name");
                var src = btn.getAttribute("data-src");
                var latVer = btn.getAttribute("data-lat");

                showDialog(
                    t("home.confirmUpdateTitle"),
                    t("home.confirmUpdate", name, latVer),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        {
                            text: t("home.btnUpdate"),
                            cls: "btn--accent",
                            action: function () {
                                btn.disabled = true;
                                btn.textContent = t("home.updating");
                                var pBox = document.getElementById("batchProgressBox");
                                if (pBox) {
                                    pBox.style.display = "block";
                                    pBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                }
                                var pTitle = document.getElementById("batchProgressTitle");
                                if (pTitle) pTitle.textContent = "Upgrading " + name + "...";
                                var pCount = document.getElementById("batchProgressCount");
                                if (pCount) pCount.textContent = "1 / 1";
                                var pFill = document.getElementById("batchProgressFill");
                                if (pFill) pFill.style.width = "10%";
                                var panel = document.getElementById("batchLogPanel");
                                if (panel) panel.innerHTML = "<div class='log-line'>[LazyEnv] Starting upgrade for " + esc(name) + "...</div>";
                                showToast(t("updates.startingSingle", name), "info");
                                sendNative({
                                    action: "upgradeBatch",
                                    targets: [{ id: id, name: name, source: src }]
                                });
                            }
                        }
                    ]
                );
            });
        });
    }

    // Source Tabs binding
    var srcTabs = document.getElementById("updatesSourceTabs");
    if (srcTabs) {
        srcTabs.addEventListener("click", function (e) {
            var tab = e.target.closest(".tab");
            if (!tab) return;
            srcTabs.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("tab--active"); });
            tab.classList.add("tab--active");
            currentHubFilter = tab.getAttribute("data-src") || "all";
            renderUpdatesHub(document.getElementById("updatesSearch") ? document.getElementById("updatesSearch").value : "");
                if (currentPage !== "updates" && unpinnedCount > 0) {
                    showToast(t("updates.startupFound", unpinnedCount), "info");
                }
        });
    }

    // Check all sources button
    var btnCheckAll = document.getElementById("btnCheckAllUpdates");
    if (btnCheckAll) {
        btnCheckAll.addEventListener("click", function () {
            if (isCheckingHubUpdates) return;
            btnCheckAll.classList.add("btn--loading");
            btnCheckAll.disabled = true;
            var span = btnCheckAll.querySelector("span");
            if (span) span.textContent = t("home.checkingUpdates");
            isCheckingHubUpdates = true;
            sendNative({ action: "getAllUpdates" });
        });
    }

    // Update all button
    var btnUpAll = document.getElementById("btnUpdateAllPackages");
    if (btnUpAll) {
        btnUpAll.addEventListener("click", function () {
            var unpinned = hubUpdates.filter(function (it) { return !it.isPinned; });
            if (unpinned.length === 0) {
                showToast(t("updates.noUpdates"), "info");
                return;
            }

            showDialog(
                t("home.confirmUpdateTitle"),
                t("updates.confirmBatch", unpinned.length),
                [
                    { text: t("dialog.cancel"), cls: "" },
                    {
                        text: t("updates.updateAll"),
                        cls: "btn--accent",
                        action: function () {
                            var targets = unpinned.map(function (it) {
                                return { id: it.id, name: it.name, source: it.source };
                            });
                            var pBox = document.getElementById("batchProgressBox");
                            if (pBox) {
                                pBox.style.display = "block";
                                pBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            }
                            var pTitle = document.getElementById("batchProgressTitle");
                            if (pTitle) pTitle.textContent = t("updates.batchStarting");
                            var pCount = document.getElementById("batchProgressCount");
                            if (pCount) pCount.textContent = "0 / " + targets.length;
                            var pFill = document.getElementById("batchProgressFill");
                            if (pFill) pFill.style.width = "5%";
                            var panel = document.getElementById("batchLogPanel");
                            if (panel) panel.innerHTML = "<div class='log-line'>[LazyEnv] Starting batch upgrade for " + targets.length + " packages...</div>";
                            showToast(t("updates.batchStarting"), "info");
                            sendNative({ action: "upgradeBatch", targets: targets });
                        }
                    }
                ]
            );
        });
    }

    // Update selected button
    var btnUpSel = document.getElementById("btnUpdateSelected");
    if (btnUpSel) {
        btnUpSel.addEventListener("click", function () {
            var selected = hubUpdates.filter(function (it) { return selectedHubUpdateIds.has(it.id); });
            if (selected.length === 0) {
                showToast(t("updates.selectRequired"), "info");
                return;
            }

            showDialog(
                t("home.confirmUpdateTitle"),
                t("updates.confirmBatch", selected.length),
                [
                    { text: t("dialog.cancel"), cls: "" },
                    {
                        text: t("updates.updateSelected"),
                        cls: "btn--accent",
                        action: function () {
                            var targets = selected.map(function (it) {
                                return { id: it.id, name: it.name, source: it.source };
                            });
                            var pBox = document.getElementById("batchProgressBox");
                            if (pBox) {
                                pBox.style.display = "block";
                                pBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            }
                            var pTitle = document.getElementById("batchProgressTitle");
                            if (pTitle) pTitle.textContent = t("updates.batchStarting");
                            var pCount = document.getElementById("batchProgressCount");
                            if (pCount) pCount.textContent = "0 / " + targets.length;
                            var pFill = document.getElementById("batchProgressFill");
                            if (pFill) pFill.style.width = "5%";
                            var panel = document.getElementById("batchLogPanel");
                            if (panel) panel.innerHTML = "<div class='log-line'>[LazyEnv] Starting batch upgrade for " + targets.length + " packages...</div>";
                            showToast(t("updates.batchStarting"), "info");
                            sendNative({ action: "upgradeBatch", targets: targets });
                        }
                    }
                ]
            );
        });
    }

    var upSearch = document.getElementById("updatesSearch");
    if (upSearch) {
        upSearch.addEventListener("input", function (e) {
            renderUpdatesHub(e.target.value);
        });
    }

    
    // -----------------------------------------------------------------------
    // Failure Diagnostics & Rollback Handlers
    // -----------------------------------------------------------------------
    function renderFailureDiagnostics(summary) {
        var box = document.getElementById("failureDiagnosticBox");
        if (!box) return;
        box.style.display = "block";
        box.scrollIntoView({ behavior: "smooth", block: "nearest" });

        var summaryText = document.getElementById("diagSummaryText");
        if (summaryText) {
            summaryText.textContent = t("diag.summary", summary.failCount);
        }

        var list = document.getElementById("diagFailuresList");
        if (!list) return;

        var html = "";
        summary.failures.forEach(function (f) {
            var cat = f.category || "UNKNOWN";
            var reasonText = t("diag.reason." + cat, f.exitCode) || f.reason || "Installation error";
            var suggText = t("diag.sugg." + cat) || f.suggestion || "Please check error log.";
            html += '<div class="diag-item">' +
                '<div class="diag-item__header">' +
                '<span style="font-weight:600">' + esc(f.name || f.id) + '</span>' +
                '<span class="diag-category-badge">' + esc(cat) + '</span>' +
                '</div>' +
                '<div class="diag-item__reason">' + esc(reasonText) + '</div>' +
                '<div class="diag-item__sugg">&bull; ' + esc(suggText) + '</div>' +
                '</div>';
        });
        list.innerHTML = html;

        // One-Click Rollback Button
        var btnRollback = document.getElementById("btnOneClickRollback");
        if (btnRollback) {
            btnRollback.onclick = function () {
                if (!summary.snapshotId) {
                    showToast(t("updates.noSnapshotAvailable"), "error");
                    return;
                }
                showDialog(
                    t("diag.rollbackTitle"),
                    t("diag.rollbackConfirm", summary.snapshotId),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        {
                            text: t("diag.rollbackTitle"),
                            cls: "btn--danger",
                            action: function () {
                                sendNative({
                                    action: "restoreSnapshot",
                                    id: summary.snapshotId
                                });
                                showToast(t("diag.rollbackSuccess"), "success");
                                box.style.display = "none";
                                sendNative({ action: "detectEnvironments" });
                                sendNative({ action: "getAllUpdates" });
                            }
                        }
                    ]
                );
            };
        }

        // Retry Failed Button
        var btnRetry = document.getElementById("btnRetryFailed");
        if (btnRetry) {
            btnRetry.onclick = function () {
                var targets = summary.failures.map(function (f) {
                    return { id: f.id, name: f.name, source: f.source };
                });
                box.style.display = "none";
                var pBox = document.getElementById("batchProgressBox");
                if (pBox) pBox.style.display = "block";
                sendNative({
                    action: "upgradeBatch",
                    targets: targets,
                    interactive: false
                });
            };
        }

        // Interactive Retry Button
        var btnInteractive = document.getElementById("btnRetryInteractive");
        if (btnInteractive) {
            btnInteractive.onclick = function () {
                var targets = summary.failures.map(function (f) {
                    return { id: f.id, name: f.name, source: f.source };
                });
                box.style.display = "none";
                var pBox = document.getElementById("batchProgressBox");
                if (pBox) pBox.style.display = "block";
                sendNative({
                    action: "upgradeBatch",
                    targets: targets,
                    interactive: true
                });
            };
        }

        var btnCloseDiag = document.getElementById("btnCloseDiagBox");
        if (btnCloseDiag) {
            btnCloseDiag.onclick = function () {
                box.style.display = "none";
            };
        }
    }

    // Terminal Log Actions
    var btnToggleLog = document.getElementById("btnToggleBatchLog");
    if (btnToggleLog) {
        btnToggleLog.addEventListener("click", function () {
            var panel = document.getElementById("batchLogPanel");
            if (!panel) return;
            if (panel.style.display === "none") {
                panel.style.display = "block";
                btnToggleLog.textContent = t("common.collapseLog");
            } else {
                panel.style.display = "none";
                btnToggleLog.textContent = t("common.expandLog");
            }
        });
    }

    var btnCopyLog = document.getElementById("btnCopyBatchLog");
    if (btnCopyLog) {
        btnCopyLog.addEventListener("click", function () {
            var panel = document.getElementById("batchLogPanel");
            if (!panel) return;
            navigator.clipboard.writeText(panel.innerText || panel.textContent).then(function () {
                showToast(t("updates.logCopied"), "info");
            });
        });
    }

    var btnClearLog = document.getElementById("btnClearBatchLog");
    if (btnClearLog) {
        btnClearLog.addEventListener("click", function () {
            var panel = document.getElementById("batchLogPanel");
            if (panel) panel.innerHTML = "";
        });
    }

    
    // -----------------------------------------------------------------------
    // Mirror Accelerator Dialog & Presets Handler
    // -----------------------------------------------------------------------
    var MIRRORS = {
        npm: [
            { name: "Aliyun (阿里云镜像)", url: "https://registry.npmmirror.com" },
            { name: "Tencent (腾讯云镜像)", url: "https://mirrors.cloud.tencent.com/npm/" },
            { name: "Huawei (华为云镜像)", url: "https://repo.huaweicloud.com/repository/npm/" },
            { name: "Official (官方默认源)", url: "https://registry.npmjs.org/" }
        ],
        pip: [
            { name: "Tsinghua (清华大学开源镜像)", url: "https://pypi.tuna.tsinghua.edu.cn/simple" },
            { name: "Aliyun (阿里云镜像)", url: "https://mirrors.aliyun.com/pypi/simple/" },
            { name: "Tencent (腾讯云镜像)", url: "https://mirrors.cloud.tencent.com/pypi/simple" },
            { name: "Official (官方默认源)", url: "https://pypi.org/simple" }
        ]
    };

    function showMirrorDialog(type, currentUrl) {
        var list = MIRRORS[type] || MIRRORS.npm;
        var bodyHtml = '<div style="margin-bottom:12px;">' +
            '<span class="text-secondary">' + esc(t("mirror.current")) + '</span>' +
            '<code class="code-badge" style="display:block; margin-top:4px; word-break:break-all;">' + esc(currentUrl) + '</code>' +
            '</div>' +
            '<div class="mirror-radio-group">';

        list.forEach(function (m, idx) {
            var checked = (currentUrl.trim() === m.url.trim() || (idx === 0 && !currentUrl)) ? "checked" : "";
            bodyHtml += '<label class="mirror-option">' +
                '<input type="radio" name="mirrorUrlChoice" value="' + esc(m.url) + '" ' + checked + '>' +
                '<div><div style="font-weight:600; font-size:13px;">' + esc(m.name) + '</div>' +
                '<div class="text-secondary" style="font-size:11px;">' + esc(m.url) + '</div></div>' +
                '</label>';
        });

        bodyHtml += '</div>';

        showDialogRaw(
            t("mirror.title") + " (" + type.toUpperCase() + ")",
            bodyHtml,
            [
                { text: t("dialog.cancel"), cls: "" },
                {
                    text: t("mirror.apply"),
                    cls: "btn--accent",
                    action: function () {
                        var chosen = document.querySelector('input[name="mirrorUrlChoice"]:checked');
                        if (chosen && chosen.value) {
                            sendNative({
                                action: "setMirrorSource",
                                type: type,
                                url: chosen.value
                            });
                        }
                    }
                }
            ]
        );
    }

    function renderHomeMetrics() {
        var elEnvs = document.getElementById("homeMetricEnvs");
        var elUpdates = document.getElementById("homeMetricUpdates");
        var elDoctor = document.getElementById("homeMetricDoctor");

        var totalEnvs = detectedEnvironments.length + manualEnvironments.length;
        if (elEnvs) {
            elEnvs.textContent = totalEnvs + " " + (currentLanguage === "zh-CN" ? "项" : "tools");
        }

        if (elUpdates) {
            if (isCheckingHubUpdates) {
                elUpdates.textContent = t("home.checkingUpdates");
            } else if (hubUpdates.length > 0) {
                elUpdates.textContent = hubUpdates.length + " " + (currentLanguage === "zh-CN" ? "项可用" : "available");
            } else {
                elUpdates.textContent = t("home.upToDate");
            }
        }

        if (elDoctor) {
            if (lastDoctorScore !== null) {
                elDoctor.textContent = lastDoctorScore + " " + (currentLanguage === "zh-CN" ? "分" : "pts");
            } else {
                elDoctor.textContent = "--";
            }
        }
    }

    var cardUp = document.getElementById("cardHomeUpdates");
    if (cardUp) {
        cardUp.addEventListener("click", function () { navigateTo("updates"); });
    }

    var cardDoc = document.getElementById("cardHomeDoctor");
    if (cardDoc) {
        cardDoc.addEventListener("click", function () {
            navigateTo("settings");
            sendNative({ action: "inspectPathDoctor" });
        });
    }

    var cardRec = document.getElementById("cardHomeRecipes");
    if (cardRec) {
        cardRec.addEventListener("click", function () { navigateTo("recipes"); });
    }

    // -----------------------------------------------------------------------
    // PATH Doctor Logic & UI
    // -----------------------------------------------------------------------
    function renderDoctorReport(rep) {
        var badge = document.getElementById("doctorScoreBadge");
        var statusText = document.getElementById("doctorStatusText");
        var metricsGrid = document.getElementById("doctorMetricsGrid");
        var btnClean = document.getElementById("btnAutoCleanPath");
        var drawer = document.getElementById("doctorDetailsDrawer");
        var list = document.getElementById("doctorIssuesList");

        if (metricsGrid) metricsGrid.style.display = "grid";
        var elValid = document.getElementById("docValidCount");
        if (elValid) elValid.textContent = rep.validEntries;
        var elDead = document.getElementById("docDeadCount");
        if (elDead) elDead.textContent = rep.deadEntries;
        var elDup = document.getElementById("docDupCount");
        if (elDup) elDup.textContent = rep.duplicateEntries;
        var elConf = document.getElementById("docConflictCount");
        if (elConf) elConf.textContent = rep.conflicts ? rep.conflicts.length : 0;

        if (badge) {
            badge.textContent = rep.healthScore;
            badge.className = "health-score-badge";
            if (rep.healthScore >= 90) {
                badge.classList.add("health-score-badge--perfect");
                if (statusText) statusText.textContent = t("doctor.statusHealthy");
            } else if (rep.healthScore >= 70) {
                badge.classList.add("health-score-badge--warning");
                if (statusText) statusText.textContent = t("doctor.statusWarning");
            } else {
                badge.classList.add("health-score-badge--danger");
                if (statusText) statusText.textContent = t("doctor.statusDanger");
            }
        }

        if (btnClean) {
            if (rep.deadEntries > 0 || rep.duplicateEntries > 0) {
                btnClean.style.display = "inline-flex";
            } else {
                btnClean.style.display = "none";
            }
        }

        var hasIssues = (rep.deadEntries > 0 || rep.duplicateEntries > 0 || (rep.conflicts && rep.conflicts.length > 0));
        if (drawer && list) {
            if (!hasIssues) {
                drawer.style.display = "none";
                list.innerHTML = "";
                return;
            }

            drawer.style.display = "block";
            var html = "";

            // 1. Conflicts
            if (rep.conflicts && rep.conflicts.length > 0) {
                html += '<div class="mb-sm" style="font-weight:600; font-size:13px; color:var(--accent);">' +
                        esc(t("doctor.conflictsTitle")) + ' (' + rep.conflicts.length + ')</div>';
                rep.conflicts.forEach(function (c) {
                    html += '<div class="conflict-card">' +
                        '<div class="conflict-card__title">Collision: ' + esc(c.command) + '</div>' +
                        '<div class="conflict-path-row text-success"><span style="font-weight:600">' + esc(t("doctor.active")) + '</span> (' + esc(c.activeSource) + ') ' + esc(c.activePath) + '</div>' +
                        '<div class="conflict-path-row text-secondary"><span style="font-weight:600">' + esc(t("doctor.shadowed")) + '</span> (' + esc(c.shadowedSource) + ') ' + esc(c.shadowedPath) + '</div>' +
                        '</div>';
                });
            }

            // 2. Dead paths
            var deads = [];
            (rep.userEntries || []).concat(rep.systemEntries || []).forEach(function (e) {
                if (!e.exists) deads.push(e);
            });
            if (deads.length > 0) {
                html += '<div class="mt-md mb-sm" style="font-weight:600; font-size:13px; color:var(--status-error);">' +
                        esc(t("doctor.deadTitle")) + ' (' + deads.length + ')</div>';
                deads.forEach(function (d) {
                    html += '<div class="doc-dead-item">' + (d.isSystem ? '[System] ' : '[User] ') + esc(d.rawPath) + '</div>';
                });
            }

            // 3. Duplicate paths
            var dups = [];
            (rep.userEntries || []).concat(rep.systemEntries || []).forEach(function (e) {
                if (e.isDuplicate) dups.push(e);
            });
            if (dups.length > 0) {
                html += '<div class="mt-md mb-sm" style="font-weight:600; font-size:13px; color:var(--status-warning);">' +
                        esc(t("doctor.dupTitle")) + ' (' + dups.length + ')</div>';
                dups.forEach(function (d) {
                    html += '<div class="doc-dup-item">' + (d.isSystem ? '[System] ' : '[User] ') + esc(d.rawPath) + '</div>';
                });
            }

            // Check if any system entry has dead paths
            var hasSystemDead = (rep.systemEntries || []).some(function (e) { return !e.exists; });
            if (hasSystemDead) {
                html += '<div class="elevation-notice-box" style="margin-top:14px; display:flex; align-items:center; justify-content:space-between; background:rgba(252,225,0,0.08); border:1px solid rgba(252,225,0,0.3); padding:10px 14px; border-radius:var(--radius-sm);">' +
                    '<span style="font-size:12px; color:var(--text-primary);">&#9888; ' + esc(t("doctor.elevationBanner")) + '</span>' +
                    '<button class="btn btn--sm btn--accent" id="btnRelaunchAdmin">' + esc(t("doctor.btnRelaunchAdmin")) + '</button>' +
                    '</div>';
            }

            list.innerHTML = html;

            var btnAdmin = document.getElementById("btnRelaunchAdmin");
            if (btnAdmin) {
                btnAdmin.addEventListener("click", function () {
                    sendNative({ action: "relaunchAsAdmin" });
                });
            }
        }
    }

    var btnRunDoc = document.getElementById("btnRunDoctor");
    if (btnRunDoc) {
        btnRunDoc.addEventListener("click", function () {
            if (isDoctorRunning) return;
            btnRunDoc.classList.add("btn--loading");
            btnRunDoc.disabled = true;
            var s = btnRunDoc.querySelector("span");
            if (s) s.textContent = t("doctor.btnRunning");
            isDoctorRunning = true;
            sendNative({ action: "pathDoctorDiagnose" });
        });
    }

    var btnCleanDoc = document.getElementById("btnAutoCleanPath");
    if (btnCleanDoc) {
        btnCleanDoc.addEventListener("click", function () {
            if (!pathDoctorReport) return;
            showDialog(
                t("doctor.confirmCleanTitle"),
                t("doctor.confirmClean", pathDoctorReport.deadEntries, pathDoctorReport.duplicateEntries),
                [
                    { text: t("dialog.cancel"), cls: "" },
                    {
                        text: t("doctor.btnAutoClean"),
                        cls: "btn--accent",
                        action: function () {
                            sendNative({
                                action: "pathDoctorAutoClean",
                                cleanUser: true,
                                cleanSystem: true
                            });
                        }
                    }
                ]
            );
        });
    }

    
    // -----------------------------------------------------------------------
    // Recipes Hub Logic & UI
    // -----------------------------------------------------------------------
    function getFeaturedRecipes() {
        return [
            {
                key: "web",
                name: t("featured.webName"),
                desc: t("featured.webDesc"),
                author: "LazyEnv",
                icon: "🌐",
                tags: ["Node.js", "pnpm", "Git", "VS Code"],
                packages: [
                    { id: "OpenJS.NodeJS.LTS", name: "Node.js (LTS)", source: "winget" },
                    { id: "pnpm", name: "pnpm", source: "npm" },
                    { id: "Git.Git", name: "Git", source: "winget" },
                    { id: "Microsoft.VisualStudioCode", name: "VS Code", source: "winget" }
                ],
                mirrors: { npm: "https://registry.npmmirror.com", pip: "" },
                envVars: [
                    { name: "NODE_ENV", value: "development" }
                ]
            },
            {
                key: "ai",
                name: t("featured.aiName"),
                desc: t("featured.aiDesc"),
                author: "LazyEnv",
                icon: "🐍",
                tags: ["Python 3.12", "pip", "Git", "VS Code", "jq"],
                packages: [
                    { id: "Python.Python.3.12", name: "Python 3.12", source: "winget" },
                    { id: "Git.Git", name: "Git", source: "winget" },
                    { id: "Microsoft.VisualStudioCode", name: "VS Code", source: "winget" },
                    { id: "jqlang.jq", name: "jq", source: "winget" }
                ],
                mirrors: { npm: "", pip: "https://pypi.tuna.tsinghua.edu.cn/simple" },
                envVars: [
                    { name: "PYTHONUTF8", value: "1" }
                ]
            },
            {
                key: "systems",
                name: t("featured.systemsName"),
                desc: t("featured.systemsDesc"),
                author: "LazyEnv",
                icon: "⚙️",
                tags: ["LLVM/Clang", "CMake", "Ninja", "Git", "VS Code"],
                packages: [
                    { id: "LLVM.LLVM", name: "LLVM/Clang", source: "winget" },
                    { id: "Kitware.CMake", name: "CMake", source: "winget" },
                    { id: "Ninja-build.Ninja", name: "Ninja", source: "winget" },
                    { id: "Git.Git", name: "Git", source: "winget" },
                    { id: "Microsoft.VisualStudioCode", name: "VS Code", source: "winget" }
                ],
                mirrors: { npm: "", pip: "" },
                envVars: [
                    { name: "CC", value: "clang" },
                    { name: "CXX", value: "clang++" }
                ]
            },
            {
                key: "rust",
                name: t("featured.rustName"),
                desc: t("featured.rustDesc"),
                author: "LazyEnv",
                icon: "🦀",
                tags: ["Rust (rustup)", "Cargo", "Git", "VS Code"],
                packages: [
                    { id: "Rustlang.Rustup", name: "Rust (rustup)", source: "winget" },
                    { id: "Git.Git", name: "Git", source: "winget" },
                    { id: "Microsoft.VisualStudioCode", name: "VS Code", source: "winget" }
                ],
                mirrors: { npm: "", pip: "" },
                envVars: [
                    { name: "RUSTUP_DIST_SERVER", value: "https://rsproxy.cn" }
                ]
            },
            {
                key: "mobile",
                name: t("featured.mobileName"),
                desc: t("featured.mobileDesc"),
                author: "LazyEnv",
                icon: "📱",
                tags: ["Java JDK 21", "Node.js LTS", "Git", "VS Code"],
                packages: [
                    { id: "Oracle.JDK.21", name: "Java JDK 21", source: "winget" },
                    { id: "OpenJS.NodeJS.LTS", name: "Node.js (LTS)", source: "winget" },
                    { id: "Git.Git", name: "Git", source: "winget" },
                    { id: "Microsoft.VisualStudioCode", name: "VS Code", source: "winget" }
                ],
                mirrors: { npm: "https://registry.npmmirror.com", pip: "" },
                envVars: [
                    { name: "JAVA_HOME", value: "%ProgramFiles%\\Java\\jdk-21" }
                ]
            },
            {
                key: "toolkit",
                name: t("featured.toolkitName"),
                desc: t("featured.toolkitDesc"),
                author: "LazyEnv",
                icon: "🧰",
                tags: ["Git", "VS Code", "7-Zip", "Windows Terminal"],
                packages: [
                    { id: "Git.Git", name: "Git", source: "winget" },
                    { id: "Microsoft.VisualStudioCode", name: "VS Code", source: "winget" },
                    { id: "7zip.7zip", name: "7-Zip", source: "winget" },
                    { id: "Microsoft.WindowsTerminal", name: "Windows Terminal", source: "winget" }
                ],
                mirrors: { npm: "", pip: "" },
                envVars: []
            }
        ];
    }

    function renderFeaturedRecipes() {
        var container = document.getElementById("featuredRecipesList");
        if (!container) return;

        var html = "";
        getFeaturedRecipes().forEach(function (r, idx) {
            var tagsHtml = "";
            if (r.tags) {
                tagsHtml = '<div class="stack-card__tags mb-sm" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">' +
                    r.tags.map(function(tg) { return '<span class="badge--source tag--winget" style="font-size:10px;padding:2px 6px;">' + esc(tg) + '</span>'; }).join('') +
                    '</div>';
            }
            html += '<div class="stack-card">' +
                '<div class="flex-between">' +
                '<div class="stack-card__icon" style="background:rgba(96,205,255,0.15); color:var(--accent); font-weight:700;font-size:16px;">' + (r.icon || (idx + 1)) + '</div>' +
                '<span class="badge--source tag--winget">' + esc(r.author) + '</span>' +
                '</div>' +
                '<div class="stack-card__title" style="margin-top:8px;">' + esc(r.name) + '</div>' +
                '<div class="stack-card__desc">' + esc(r.desc) + '</div>' +
                tagsHtml +
                '<div class="stack-card__footer" style="margin-top:10px;">' +
                '<button class="btn btn--sm btn--accent btn-inspect-featured" data-key="' + esc(r.key) + '" style="width:100%" data-i18n="common.deploy">' + t("common.deploy") + '</button>' +
                '</div></div>';
        });
        container.innerHTML = html;

        container.querySelectorAll(".btn-inspect-featured").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var k = btn.getAttribute("data-key");
                var item = getFeaturedRecipes().find(function (f) { return f.key === k; });
                if (!item) return;

                // Build a diff against current installed environments
                var installedCmds = new Set(getAllEnvironments().map(function (e) { return (e.command || "").toLowerCase(); }));
                var missing = [];
                var ready = [];

                item.packages.forEach(function (p) {
                    var low = (p.name || p.id).toLowerCase();
                    var found = false;
                    installedCmds.forEach(function (c) {
                        if (low.includes(c)) found = true;
                    });
                    if (found) ready.push(p);
                    else missing.push(p);
                });

                var diff = {
                    recipeName: item.name,
                    recipeDesc: item.desc,
                    author: item.author,
                    npmMirror: item.mirrors.npm,
                    pipMirror: item.mirrors.pip,
                    missingPackages: missing,
                    installedPackages: ready,
                    varsCount: 1,
                    pathsCount: 1
                };

                currentRecipeDiff = diff;
                renderRecipeDiff(diff);
            });
        });
    }

    function renderRecipeDiff(diff) {
        var box = document.getElementById("recipeDiffBox");
        if (!box) return;
        box.style.display = "block";
        box.scrollIntoView({ behavior: "smooth", block: "nearest" });

        var elName = document.getElementById("diffRecipeName");
        if (elName) elName.textContent = diff.recipeName || "Recipe Preflight";

        var elAuthor = document.getElementById("diffRecipeAuthor");
        if (elAuthor) elAuthor.textContent = diff.author || "Standard";

        var elDesc = document.getElementById("diffRecipeDesc");
        if (elDesc) elDesc.textContent = diff.recipeDesc || "";

        var elMissing = document.getElementById("diffMissingCount");
        if (elMissing) elMissing.textContent = diff.missingPackages ? diff.missingPackages.length : 0;

        var elReady = document.getElementById("diffInstalledCount");
        if (elReady) elReady.textContent = diff.installedPackages ? diff.installedPackages.length : 0;

        var elMirrors = document.getElementById("diffMirrorsCount");
        if (elMirrors) elMirrors.textContent = (diff.npmMirror ? 1 : 0) + (diff.pipMirror ? 1 : 0);

        var elVars = document.getElementById("diffVarsCount");
        if (elVars) elVars.textContent = (diff.varsCount || 0) + (diff.pathsCount || 0);

        var list = document.getElementById("diffItemsList");
        if (list) {
            var html = "";

            // Mirrors section
            if (diff.npmMirror || diff.pipMirror) {
                html += '<div class="mb-sm" style="font-size:12px; font-weight:600; color:var(--accent);">Mirrors to Apply:</div>';
                if (diff.npmMirror) html += '<div class="conflict-path-row">&bull; [NPM] ' + esc(diff.npmMirror) + '</div>';
                if (diff.pipMirror) html += '<div class="conflict-path-row">&bull; [Pip] ' + esc(diff.pipMirror) + '</div>';
            }

            // Missing packages (need install)
            if (diff.missingPackages && diff.missingPackages.length > 0) {
                html += '<div class="mt-md mb-sm" style="font-size:12px; font-weight:600; color:var(--text-primary);">' +
                        esc(t("recipes.toInstall")) + ' (' + diff.missingPackages.length + '):</div>';
                diff.missingPackages.forEach(function (p) {
                    html += '<div class="diag-item flex-between" style="padding:6px 10px; margin-bottom:4px;">' +
                        '<span>' + esc(p.name || p.id) + '</span>' +
                        '<span class="badge--source tag--' + esc((p.source || "winget").toLowerCase()) + '">Deploy</span>' +
                        '</div>';
                });
            }

            // Already installed packages (skip)
            if (diff.installedPackages && diff.installedPackages.length > 0) {
                html += '<div class="mt-md mb-sm" style="font-size:12px; font-weight:600; color:var(--status-success);">' +
                        esc(t("recipes.skipped")) + ' (' + diff.installedPackages.length + '):</div>';
                diff.installedPackages.forEach(function (p) {
                    html += '<div class="diag-item flex-between" style="padding:6px 10px; margin-bottom:4px; opacity:0.7;">' +
                        '<span>' + esc(p.name || p.id) + '</span>' +
                        '<span class="badge badge--uptodate">Installed</span>' +
                        '</div>';
                });
            }

            list.innerHTML = html;
        }
    }

    var btnExportRec = document.getElementById("btnExportRecipe");
    if (btnExportRec) {
        btnExportRec.addEventListener("click", function () {
            showDialogRaw(
                t("recipes.exportTitle"),
                '<div class="dialog-form">' +
                '<div class="dialog-form__group"><label class="dialog-form__label">' + esc(t("recipes.exportName")) + '</label>' +
                '<input type="text" class="input" id="dlgRecName" value="FullStack-Team-Stack"></div>' +
                '<div class="dialog-form__group"><label class="dialog-form__label">' + esc(t("recipes.exportDesc")) + '</label>' +
                '<input type="text" class="input" id="dlgRecDesc" value="Standardized development environment for team collaboration"></div>' +
                '<div class="dialog-form__group"><label class="dialog-form__label">' + esc(t("recipes.exportAuthor")) + '</label>' +
                '<input type="text" class="input" id="dlgRecAuthor" value="vjiaoziv"></div>' +
                '</div>',
                [
                    { text: t("dialog.cancel"), cls: "" },
                    {
                        text: t("recipes.btnExport"),
                        cls: "btn--accent",
                        action: function () {
                            var n = document.getElementById("dlgRecName").value.trim();
                            var d = document.getElementById("dlgRecDesc").value.trim();
                            var a = document.getElementById("dlgRecAuthor").value.trim();
                            sendNative({
                                action: "exportRecipeDialog",
                                name: n,
                                description: d,
                                author: a,
                                environments: getAllEnvironments()
                            });
                        }
                    }
                ]
            );
        });
    }

    var btnImportRec = document.getElementById("btnImportRecipe");
    if (btnImportRec) {
        btnImportRec.addEventListener("click", function () {
            sendNative({ action: "importRecipeDialog" });
        });
    }

    var btnCancelD = document.getElementById("btnCancelDiff");
    if (btnCancelD) {
        btnCancelD.addEventListener("click", function () {
            var box = document.getElementById("recipeDiffBox");
            if (box) box.style.display = "none";
        });
    }

    var btnDeployRec = document.getElementById("btnDeployRecipe");
    if (btnDeployRec) {
        btnDeployRec.addEventListener("click", function () {
            if (!currentRecipeDiff) return;

            showDialog(
                t("recipes.btnDeploy"),
                t("updates.confirmBatch", currentRecipeDiff.missingPackages ? currentRecipeDiff.missingPackages.length : 0),
                [
                    { text: t("dialog.cancel"), cls: "" },
                    {
                        text: t("recipes.btnDeploy"),
                        cls: "btn--accent",
                        action: function () {
                            var pids = (currentRecipeDiff.missingPackages || []).map(function (p) { return p.id; });
                            sendNative({
                                action: "deployRecipe",
                                recipeName: currentRecipeDiff.recipeName,
                                npmMirror: currentRecipeDiff.npmMirror || "",
                                pipMirror: currentRecipeDiff.pipMirror || "",
                                missingPackageIds: pids
                            });
                            showToast(t("recipes.deployStarting", currentRecipeDiff.recipeName), "info");
                        }
                    }
                ]
            );
        });
    }

        navigateTo("home");
    renderHomeMetrics();

    // Actively check for updates across all sources on startup
    setTimeout(function () {
        if (!isCheckingHubUpdates && hubUpdates.length === 0) {
            isCheckingHubUpdates = true;
            var btnHub = document.getElementById("btnCheckAllUpdates");
            if (btnHub) {
                btnHub.classList.add("btn--loading");
                btnHub.disabled = true;
                var s = btnHub.querySelector("span");
                if (s) s.textContent = t("home.checkingUpdates");
            }
            updateSidebarBadge();
            sendNative({ action: "getAllUpdates" });
        }
    }, 200);

})();


    // -----------------------------------------------------------------------
    // Settings Sub-Tabs & Preferences
    // -----------------------------------------------------------------------
    var currentSettingsSubTab = "doctor";
    var settingsTabs = document.getElementById("settingsSubTabs");
    if (settingsTabs) {
        settingsTabs.addEventListener("click", function (e) {
            var tab = e.target.closest(".tab");
            if (!tab || !tab.dataset.subtab) return;
            currentSettingsSubTab = tab.dataset.subtab;

            settingsTabs.querySelectorAll(".tab").forEach(function (t) {
                t.classList.toggle("tab--active", t.dataset.subtab === currentSettingsSubTab);
            });

            document.querySelectorAll(".settings-tab-pane").forEach(function (pane) {
                pane.style.display = "none";
            });

            var activePane = document.getElementById("subtab-" + currentSettingsSubTab);
            if (activePane) activePane.style.display = "block";

            if (currentSettingsSubTab === "doctor" && !pathDoctorReport) {
                sendNative({ action: "inspectPathDoctor" });
            } else if (currentSettingsSubTab === "envvars") {
                loadEnvVars();
            }
        });
    }

    var sLang = document.getElementById("settingsLangSelect");
    if (sLang) {
        sLang.value = currentLanguage;
        sLang.addEventListener("change", function () {
            var mainSel = document.getElementById("langSelect");
            if (mainSel) {
                mainSel.value = sLang.value;
                mainSel.dispatchEvent(new Event("change"));
            }
        });
    }

    var btnGh = document.getElementById("btnOpenGitHub");
    if (btnGh) {
        btnGh.addEventListener("click", function () {
            sendNative({ action: "openUrl", url: "https://github.com/vjiaoziv/LazyEnv" });
        });
    }

    var chkStartup = document.getElementById("chkStartupUpdates");
    if (chkStartup) {
        var savedPref = localStorage.getItem("lazyenv_startup_updates");
        if (savedPref !== null) {
            chkStartup.checked = savedPref === "1";
        }
        chkStartup.addEventListener("change", function () {
            localStorage.setItem("lazyenv_startup_updates", chkStartup.checked ? "1" : "0");
        });
    }
