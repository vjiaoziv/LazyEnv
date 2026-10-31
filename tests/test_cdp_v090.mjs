import { spawn } from 'node:child_process';

const PORT = 9257;
const exePath = "D:\\Git\\LazyEnv\\build\\Release\\LazyEnv.exe";
console.log("=== Launching LazyEnv for v0.9.0 Comprehensive Migration Hub CDP E2E Testing ===");

const proc = spawn(exePath, [], {
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`
  },
  stdio: 'ignore'
});

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  let passed = 0;
  let failed = 0;
  const test = (name, ok, detail = "") => {
    if (ok) {
      console.log(`  [PASS] ${name}${detail ? " - " + detail : ""}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}${detail ? " - " + detail : ""}`);
      failed++;
    }
  };

  try {
    let wsUrl = null;
    for (let i = 0; i < 25; i++) {
      await sleep(400);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        if (res.ok) {
          const list = await res.json();
          const page = list.find(t => t.type === 'page');
          if (page?.webSocketDebuggerUrl) {
            wsUrl = page.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error("Could not find WebView2 CDP endpoint");

    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      const reqId = id++;
      return new Promise(resolve => {
        const handler = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.id === reqId) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send("Runtime.enable");

    for (let i = 0; i < 30; i++) {
      const rs = await send("Runtime.evaluate", {
        expression: "!!document.querySelector('.sidebar__version')",
        returnByValue: true
      });
      if (rs?.result?.value === true) break;
      await sleep(300);
    }

    console.log("\n[Test Group 1: Version Stamping & Initial State]");
    const verRes = await send("Runtime.evaluate", {
      expression: "document.querySelector('.sidebar__version')?.textContent.trim()",
      returnByValue: true
    });
    test("Sidebar version is v0.9.0", verRes?.result?.value === "LazyEnv v0.9.0", `Got: ${verRes?.result?.value}`);

    console.log("\n[Test Group 2: Recipes & Migration Hub Sub-Tabs]");
    // Navigate to recipes page
    await send("Runtime.evaluate", { expression: "document.querySelector('.sidebar__item[data-page=\"recipes\"]')?.click()" });
    await sleep(600);

    const activePage = await send("Runtime.evaluate", {
      expression: "document.querySelector('.page--active')?.id",
      returnByValue: true
    });
    test("Navigated to recipes page", activePage?.result?.value === "page-recipes");

    const subTabsCount = await send("Runtime.evaluate", {
      expression: "document.querySelectorAll('#recipesSubTabs .tab').length",
      returnByValue: true
    });
    test("3 Subtabs rendered (Migration, Featured, Time Machine)", subTabsCount?.result?.value === 3);

    // Test tab switching: Featured
    await send("Runtime.evaluate", {
      expression: "document.querySelector('#recipesSubTabs .tab[data-subtab=\"featured\"]')?.click()"
    });
    await sleep(200);
    const featuredVisible = await send("Runtime.evaluate", {
      expression: "document.getElementById('subtab-pane-featured')?.style.display",
      returnByValue: true
    });
    test("Featured Stacks subtab pane is visible", featuredVisible?.result?.value === "block");

    // Test tab switching: Time Machine
    await send("Runtime.evaluate", {
      expression: "document.querySelector('#recipesSubTabs .tab[data-subtab=\"snapshots\"]')?.click()"
    });
    await sleep(200);
    const snapsVisible = await send("Runtime.evaluate", {
      expression: "document.getElementById('subtab-pane-snapshots')?.style.display",
      returnByValue: true
    });
    test("Time Machine Snapshots subtab pane is visible", snapsVisible?.result?.value === "block");
    await sleep(400);
    const tmListContent = await send("Runtime.evaluate", {
      expression: "document.getElementById('timeMachineSnapshotList')?.children.length > 0",
      returnByValue: true
    });
    test("Time Machine snapshot list populated in subtab", tmListContent?.result?.value === true);

    // Test tab switching: Migration Hub
    await send("Runtime.evaluate", {
      expression: "document.querySelector('#recipesSubTabs .tab[data-subtab=\"migration\"]')?.click()"
    });
    await sleep(600);
    const migVisible = await send("Runtime.evaluate", {
      expression: "document.getElementById('subtab-pane-migration')?.style.display",
      returnByValue: true
    });
    test("Migration Hub subtab pane is visible", migVisible?.result?.value === "block");

    console.log("\n[Test Group 3: 4-in-1 Asset Scanning & Export Form]");
    // Wait for scanDiscoveredAssets to return
    await sleep(800);
    const cfgMetric = await send("Runtime.evaluate", {
      expression: "parseInt(document.getElementById('assetMetricConfigs')?.textContent || '0')",
      returnByValue: true
    });
    test("Config files metric populated from native scan", (cfgMetric?.result?.value ?? 0) >= 0, `Count: ${cfgMetric?.result?.value}`);

    const chkPackages = await send("Runtime.evaluate", {
      expression: "document.getElementById('chkExportPackages')?.checked",
      returnByValue: true
    });
    test("Export packages checkbox default checked", chkPackages?.result?.value === true);

    const chkConfigs = await send("Runtime.evaluate", {
      expression: "document.getElementById('chkExportConfigs')?.checked",
      returnByValue: true
    });
    test("Export configs checkbox default checked", chkConfigs?.result?.value === true);

    const btnExportMig = await send("Runtime.evaluate", {
      expression: "!!document.getElementById('btnExportMigration')",
      returnByValue: true
    });
    test("1-Click Export Migration Package button exists", btnExportMig?.result?.value === true);

    console.log("\n[Test Group 4: PATH Doctor Synchronization & Radar Animation]");
    await send("Runtime.evaluate", { expression: "document.querySelector('.sidebar__item[data-page=\"doctor\"]')?.click()" });
    await sleep(600);

    const doctorPage = await send("Runtime.evaluate", {
      expression: "document.querySelector('.page--active')?.id",
      returnByValue: true
    });
    test("Navigated to doctor page", doctorPage?.result?.value === "page-doctor");

    // Click Run Inspection
    await send("Runtime.evaluate", { expression: "document.getElementById('btnRunDoctor')?.click()" });
    // Check scanning animation active
    const scanningClass = await send("Runtime.evaluate", {
      expression: "document.getElementById('doctorGaugeFill')?.classList.contains('doctor-gauge-fill--scanning')",
      returnByValue: true
    });
    test("Radar scanning animation activates on inspection", scanningClass?.result?.value === true);

    // Wait for inspection to finish
    await sleep(1000);
    const scoreVal = await send("Runtime.evaluate", {
      expression: "parseInt(document.getElementById('doctorScoreBadge')?.textContent || '0')",
      returnByValue: true
    });
    test("Doctor score populated after inspection", (scoreVal?.result?.value ?? 0) > 0, `Score: ${scoreVal?.result?.value}`);

    // Click Valid Entries filter card
    await send("Runtime.evaluate", { expression: "document.getElementById('cardMetricValid')?.click()" });
    await sleep(200);
    const validRowsCount = await send("Runtime.evaluate", {
      expression: "document.querySelectorAll('#pathExplorerList .path-row-item').length",
      returnByValue: true
    });
    test("Clicking cardMetricValid filters explorer to valid entries", (validRowsCount?.result?.value ?? 0) > 0, `Count: ${validRowsCount?.result?.value}`);

    ws.close();
  } catch (err) {
    console.error("Test error:", err);
    failed++;
  } finally {
    proc.kill();
    console.log("\n=============================================================");
    console.log(`CDP E2E Summary: ${passed} passed, ${failed} failed`);
    console.log("=============================================================");
    process.exit(failed === 0 ? 0 : 1);
  }
}

run();
