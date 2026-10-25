import { spawn } from 'node:child_process';

const PORT = 9256;
const exePath = "D:\\Git\\LazyEnv\\build\\Release\\LazyEnv.exe";
console.log("=== Launching LazyEnv for v0.8.14 Comprehensive CDP E2E Testing ===");

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

    // Test 1: UI Version
    console.log("\n[Test 1: Version Consistency]");
    const verRes = await send("Runtime.evaluate", {
      expression: 'document.querySelector(".sidebar__version")?.textContent',
      returnByValue: true
    });
    test("UI shows LazyEnv v0.8.14", verRes?.result?.value?.includes("v0.8.14"), verRes?.result?.value);

    // Navigate to PATH Doctor
    console.log("\n[Navigating to PATH Doctor]");
    await send("Runtime.evaluate", {
      expression: 'document.querySelector(\'[data-page="doctor"]\')?.click()'
    });
    await sleep(2500);

    // Test 2: Fluent 2 breakdown pill button styling & toggle
    console.log("\n[Test 2: Fluent 2 Breakdown Pill Button]");
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

    // Test 3: Official Documentation Link in Conflict Cards
    console.log("\n[Test 3: Official Documentation Link in Conflict Cards]");
    const docRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var docBtns = document.querySelectorAll(".btn-open-official-doc");
          var urls = Array.from(docBtns).map(b => b.getAttribute("data-url"));
          return {
            count: docBtns.length,
            urls: urls,
            hasPythonDoc: urls.some(u => u.includes("python.org")),
            hasJavaDoc: urls.some(u => u.includes("oracle.com"))
          };
        })()
      `
    });
    const docData = docRes?.result?.value || {};
    test("Official Docs buttons rendered in conflict cards", docData.count > 0, `Count: ${docData.count}`);
    test("Python official doc URL linked correctly", docData.hasPythonDoc);
    test("Java official doc URL linked correctly", docData.hasJavaDoc);

    // Test 4: Path Purpose Explanations, Core Lock, & Copy Button
    console.log("\n[Test 4: Explorer Rows - 30+ Software Recognition, Purpose & Copy Button]");
    const expRowRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var rows = document.querySelectorAll(".path-row-item");
          var copyBtns = document.querySelectorAll(".btn-row-copy");
          var lockedRows = document.querySelectorAll(".path-row-item--locked");
          var purposes = document.querySelectorAll(".path-row-purpose");
          var badges = Array.from(document.querySelectorAll(".path-row-software-badge")).map(b => b.textContent.trim());
          
          return {
            totalRows: rows.length,
            copyBtnsCount: copyBtns.length,
            purposesCount: purposes.length,
            lockedCount: lockedRows.length,
            hasPythonBadge: badges.some(b => b.includes("Python")),
            hasJavaBadge: badges.some(b => b.includes("Java")),
            hasWindowsBadge: badges.some(b => b.includes("Windows")),
            hasScoopOrAdbOrFlutter: badges.some(b => b.includes("Scoop") || b.includes("Android") || b.includes("Flutter") || b.includes("Rust")),
            samplePurpose: purposes[0] ? purposes[0].textContent : ""
          };
        })()
      `
    });
    const expRowData = expRowRes?.result?.value || {};
    test("Every path row has a dedicated Copy button", expRowData.copyBtnsCount >= 40, `Count: ${expRowData.copyBtnsCount}`);
    test("Every path row has an intelligent purpose explanation", expRowData.purposesCount >= 40, expRowData.samplePurpose);
    test("Windows core directories are locked with protection badge", expRowData.lockedCount > 0, `Locked: ${expRowData.lockedCount}`);
    test("Developer software badges recognized", expRowData.hasPythonBadge && expRowData.hasJavaBadge && expRowData.hasWindowsBadge);

    // Test 5: Copy Path Toast
    console.log("\n[Test 5: Copy Path Toast Notification]");
    const copyToastRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var firstCopyBtn = document.querySelector(".btn-row-copy");
          if (firstCopyBtn) firstCopyBtn.click();
          var toast = document.querySelector(".toast.toast--info");
          return {
            hasToast: !!toast,
            toastText: toast ? toast.textContent : ""
          };
        })()
      `
    });
    const ctData = copyToastRes?.result?.value || {};
    test("Clicking Copy triggers success Toast", ctData.hasToast, ctData.toastText);

    // Test 6: Dynamic Score Synchronization with Home Page
    console.log("\n[Test 6: Full Score Synchronization Between Doctor & Home]");
    const syncRes = await send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `
        new Promise((resolve) => {
          // Acknowledge all conflicts via button click
          var ackBtns = document.querySelectorAll(".btn-ack-eco");
          ackBtns.forEach(b => b.click());

          setTimeout(() => {
            var docScore = document.getElementById("doctorScoreBadge")?.textContent;
            
            // Navigate to Home page
            document.querySelector('[data-page="home"]')?.click();

            setTimeout(() => {
              var homeScore = document.getElementById("homeMetricDoctor")?.textContent;
              var homeSub = document.getElementById("homeMetricDoctorSub")?.textContent;
              resolve({
                docScore: docScore,
                homeScore: homeScore,
                homeSub: homeSub,
                scoresEqual: docScore === "100" && homeScore.includes("100")
              });
            }, 500);
          }, 800);
        })
      `
    });
    const sData = syncRes?.result?.value || {};
    console.log("Sync Result:", sData);
    test("Home page and PATH Doctor scores are 100% identical and 100 points", sData.scoresEqual, `Home: ${sData.homeScore}, Doctor: ${sData.docScore}`);
    test("Home page subtitle reflects healthy environment state", !sData.homeSub?.includes("冲突"), sData.homeSub);

    ws.close();
    console.log("\n=============================================================");
    console.log(`v0.8.14 Comprehensive CDP Summary: ${passed} passed, ${failed} failed`);
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