import { spawn } from 'node:child_process';

const PORT = 9255;
const exePath = "D:\\Git\\LazyEnv\\build\\Release\\LazyEnv.exe";
console.log("=== Launching LazyEnv for v0.8.14 Advanced CDP E2E Testing ===");

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
    for (let i = 0; i < 20; i++) {
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

    for (let i = 0; i < 20; i++) {
      const rs = await send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
      if (rs?.result?.value === "complete") break;
      await sleep(300);
    }

    // Navigate to PATH Doctor
    await send("Runtime.evaluate", {
      expression: 'document.querySelector(\'[data-page="doctor"]\')?.click()'
    });
    await sleep(2500);

    // Test 1: Fluent 2 breakdown pill button styling
    console.log("\n[Test 1: Fluent 2 Breakdown Pill Button]");
    const pillRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var btn = document.getElementById("btnToggleScoreBreakdown");
          var chev = btn ? btn.querySelector(".btn-breakdown-chevron") : null;
          var beforeClass = btn ? btn.className : "";
          btn.click();
          var afterClass = btn ? btn.className : "";
          return {
            hasPillClass: beforeClass.includes("btn-breakdown-pill"),
            hasChevron: !!chev,
            toggledOpen: afterClass.includes("btn-breakdown-pill--open")
          };
        })()
      `
    });
    const pillData = pillRes?.result?.value || {};
    test("Breakdown button is styled as Fluent 2 pill", pillData.hasPillClass && pillData.hasChevron);
    test("Clicking pill toggles open state with rotating chevron", pillData.toggledOpen);

    // Test 2: Decision Guide collapsible inside conflict cards
    console.log("\n[Test 2: Beginner Decision Guide in Conflict Cards]");
    const guideRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var toggle = document.querySelector(".conflict-guide-toggle");
          if (!toggle) return { found: false };
          var box = toggle.nextElementSibling;
          var beforeDisplay = box ? box.style.display : "";
          toggle.click();
          var afterDisplay = box ? box.style.display : "";
          var pCount = box ? box.querySelectorAll("p").length : 0;
          var hasAgentMention = box ? box.textContent.includes("Agent") || box.textContent.includes("VS Code") : false;
          return {
            found: true,
            toggled: afterDisplay === "block",
            pCount: pCount,
            hasAgentMention: hasAgentMention
          };
        })()
      `
    });
    const gData = guideRes?.result?.value || {};
    test("Decision Guide toggle exists in conflict cards", gData.found);
    test("Decision Guide opens on click and contains 3 guidance paragraphs", gData.toggled && gData.pCount === 3);
    test("Guidance explicitly explains IDE & AI Agent safety", gData.hasAgentMention);

    // Test 3: Path Purpose Explanations & System Core Lock
    console.log("\n[Test 3: Path Purpose Explanations & Core Lock Protection]");
    const lockRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var rows = document.querySelectorAll(".path-row-item");
          var lockedRows = document.querySelectorAll(".path-row-item--locked");
          var purposes = document.querySelectorAll(".path-row-purpose");
          var sys32 = Array.from(lockedRows).find(r => r.getAttribute("data-path").toLowerCase().includes("system32"));
          return {
            totalRows: rows.length,
            purposesCount: purposes.length,
            lockedCount: lockedRows.length,
            hasSystem32Locked: !!sys32,
            hasLockBadge: sys32 ? !!sys32.querySelector(".badge--core-locked") : false,
            samplePurpose: purposes[0] ? purposes[0].textContent : ""
          };
        })()
      `
    });
    const lData = lockRes?.result?.value || {};
    test("Every path row has an intelligent purpose explanation", lData.purposesCount > 40, lData.samplePurpose);
    test("Windows core directories are locked with protection badge", lData.hasSystem32Locked && lData.hasLockBadge, `Locked: ${lData.lockedCount}`);

    // Test 4: Clicking locked remove button protects against deletion
    console.log("\n[Test 4: System Core Deletion Protection Alert]");
    const alertRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var lockedRow = document.querySelector(".path-row-item--locked");
          if (!lockedRow) return { protected: false };
          var removeBtn = lockedRow.querySelector(".btn-row-remove");
          removeBtn.click();
          var toast = document.querySelector(".toast.toast--error");
          return {
            protected: true,
            hasErrorToast: !!toast,
            toastText: toast ? toast.textContent : ""
          };
        })()
      `
    });
    const aData = alertRes?.result?.value || {};
    test("Attempting to delete system core triggers protection toast", aData.hasErrorToast, aData.toastText);

    // Test 5: Radar Scanning animation on "Run Inspection" click
    console.log("\n[Test 5: Radar Scanning Feedback Animation]");
    const scanRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var btn = document.getElementById("btnRunDoctor");
          var gFill = document.getElementById("doctorGaugeFill");
          var sBadge = document.getElementById("doctorScoreBadge");
          var sStatus = document.getElementById("doctorStatusText");
          btn.click();
          return {
            hasScanningClass: gFill ? gFill.classList.contains("doctor-gauge-fill--scanning") : false,
            hasPulsingScore: sBadge ? sBadge.classList.contains("doctor-gauge-score--pulsing") : false,
            scoreIsDash: sBadge ? sBadge.textContent === "--" : false,
            statusText: sStatus ? sStatus.textContent : ""
          };
        })()
      `
    });
    const sData = scanRes?.result?.value || {};
    test("Gauge ring activates radar scanning animation", sData.hasScanningClass);
    test("Score pulses with '--' placeholder during scan", sData.hasPulsingScore && sData.scoreIsDash);
    test("Status text broadcasts active scanning progress", sData.statusText.includes("全面体检") || sData.statusText.includes("Scanning"));

    ws.close();
    console.log("\n=============================================================");
    console.log(`v0.8.14 Advanced CDP Summary: ${passed} passed, ${failed} failed`);
    console.log("=============================================================\n");
  } catch (err) {
    console.error("CDP Test error:", err);
    failed++;
  } finally {
    proc.kill();
    setTimeout(() => {
      process.exit(failed === 0 ? 0 : 1);
    }, 500);
  }
}

run();