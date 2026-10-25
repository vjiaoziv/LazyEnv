import { spawn } from 'node:child_process';

const PORT = 9250;
const exePath = "D:\\Git\\LazyEnv\\build\\Release\\LazyEnv.exe";
console.log("=== Launching LazyEnv for v0.8.13 CDP E2E Testing ===");

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
      await sleep(500);
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
    if (!wsUrl) throw new Error("Could not acquire CDP WebSocket URL");

    console.log("Connected to WebView2 CDP:", wsUrl);
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

    // 1. Version check on UI
    console.log("\n[CDP Test 1: UI Version Display]");
    const verRes = await send("Runtime.evaluate", {
      expression: 'document.querySelector(".sidebar__version")?.textContent',
      returnByValue: true
    });
    const verText = verRes?.result?.value || "";
    test("UI shows LazyEnv v0.8.13", verText.includes("v0.8.13"), verText);

    // Navigate to PATH Doctor
    console.log("\n[Navigating to PATH Doctor]");
    await send("Runtime.evaluate", {
      expression: 'document.querySelector(\'[data-page="doctor"]\')?.click()'
    });
    await sleep(2000);

    // 2. Fluent 2 Circular Health Gauge & Score Badge
    console.log("\n[CDP Test 2: Fluent 2 Circular Health Gauge]");
    const gaugeRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var fill = document.getElementById("doctorGaugeFill");
          var score = document.getElementById("doctorScoreBadge");
          var grade = document.getElementById("doctorGradeBadge");
          return {
            hasFill: !!fill,
            dashoffset: fill ? fill.style.strokeDashoffset : null,
            scoreVal: score ? parseInt(score.textContent, 10) : null,
            gradeText: grade ? grade.textContent : null,
            gradeClass: grade ? grade.className : null
          };
        })()
      `
    });
    const gData = gaugeRes?.result?.value || {};
    test("SVG Circular Gauge Fill rendered", gData.hasFill);
    test("Health score displayed as numeric value", typeof gData.scoreVal === 'number' && !isNaN(gData.scoreVal), `Score: ${gData.scoreVal}`);
    test("Grade badge active with status", !!gData.gradeText, gData.gradeText);

    // 3. Score Breakdown Drawer
    console.log("\n[CDP Test 3: Score Breakdown Drawer]");
    const bToggleRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var btn = document.getElementById("btnToggleScoreBreakdown");
          var drawer = document.getElementById("doctorScoreBreakdownDrawer");
          var list = document.getElementById("doctorScoreBreakdownList");
          if (btn) btn.click();
          return {
            btnVisible: btn ? btn.style.display !== 'none' : false,
            drawerVisible: drawer ? drawer.style.display === 'block' : false,
            breakdownText: list ? list.innerText : ""
          };
        })()
      `
    });
    const bData = bToggleRes?.result?.value || {};
    test("Breakdown toggle works and drawer opens", bData.drawerVisible);
    test("Breakdown list details deduction items", bData.breakdownText.length > 0, bData.breakdownText.replace(/\n/g, ' '));

    // 4. Ecosystem Conflict Cards
    console.log("\n[CDP Test 4: Ecosystem Conflict Cards & Visual Duel]");
    const ecoRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var cards = document.querySelectorAll(".eco-conflict-card");
          return {
            count: cards.length,
            cards: Array.from(cards).map(c => ({
              title: c.querySelector(".eco-header__title")?.textContent,
              hasActive: !!c.querySelector(".eco-side--active"),
              hasShadowed: !!c.querySelector(".eco-side--shadowed"),
              tipText: c.querySelector(".eco-tip-box")?.textContent,
              hasAckBtn: !!c.querySelector(".btn-ack-eco")
            }))
          };
        })()
      `
    });
    const ecoData = ecoRes?.result?.value || {};
    test("Ecosystem conflict cards rendered", ecoData.count > 0, `Count: ${ecoData.count}`);
    if (ecoData.count > 0) {
      test("Card contains Active & Shadowed visual duel", ecoData.cards[0].hasActive && ecoData.cards[0].hasShadowed);
      test("Card contains beginner-friendly explanation tip", !!ecoData.cards[0].tipText, ecoData.cards[0].tipText);
    }

    // 5. Dynamic Health Score Update (Click Acknowledge Buttons on DOM)
    console.log("\n[CDP Test 5: Dynamic Health Score Update]");
    const smartFixRes = await send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `
        new Promise((resolve) => {
          var ackButtons = document.querySelectorAll(".btn-ack-eco");
          var count = ackButtons.length;
          ackButtons.forEach(btn => btn.click());

          setTimeout(() => {
            var score = document.getElementById("doctorScoreBadge");
            var grade = document.getElementById("doctorGradeBadge");
            var fill = document.getElementById("doctorGaugeFill");
            resolve({
              ackedButtonsCount: count,
              newScore: score ? parseInt(score.textContent, 10) : null,
              newGrade: grade ? grade.textContent : null,
              strokeColor: fill ? fill.style.stroke : null
            });
          }, 800);
        })
      `
    });
    const sfData = smartFixRes?.result?.value || {};
    console.log("Score update result:", sfData);
    test("Health score dynamic update to 100", sfData.newScore === 100, `New Score: ${sfData.newScore}`);
    test("Grade updated to Optimal (100)", sfData.newGrade?.includes("100"), sfData.newGrade);

    // 6. PATH Explorer Section
    console.log("\n[CDP Test 6: Full PATH Explorer]");
    const expRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var box = document.getElementById("doctorExplorerCardBox");
          var rows = document.querySelectorAll(".path-row-item");
          var chips = document.querySelectorAll("#pathScopeFilterChips .filter-chip");
          var firstRow = rows[0];
          return {
            boxVisible: box ? box.style.display !== 'none' : false,
            totalRows: rows.length,
            chipsCount: chips.length,
            firstRowRank: firstRow ? firstRow.querySelector(".path-row-rank")?.textContent : null,
            firstRowSoftware: firstRow ? firstRow.querySelector(".path-row-software-badge")?.textContent : null,
            firstRowMain: firstRow ? firstRow.querySelector(".path-row-dir-main")?.textContent : null,
            firstRowHasActions: firstRow ? firstRow.querySelectorAll(".path-row-actions button").length >= 4 : false
          };
        })()
      `
    });
    const expData = expRes?.result?.value || {};
    test("PATH Explorer section displayed", expData.boxVisible);
    test("Explorer rows rendered (>= 40 paths)", expData.totalRows >= 40, `Count: ${expData.totalRows}`);
    test("Priority rank displayed on rows (#01)", expData.firstRowRank === "#01");
    test("Software fingerprint badge detected", !!expData.firstRowSoftware, expData.firstRowSoftware);
    test("Row contains reorder and management actions", expData.firstRowHasActions);

    // 7. PATH Explorer Search Filtering
    console.log("\n[CDP Test 7: PATH Explorer Search Filter]");
    const filterRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var searchInput = document.getElementById("pathExplorerSearch");
          if (searchInput) {
            searchInput.value = "python";
            searchInput.dispatchEvent(new Event("input"));
          }
          var rows = document.querySelectorAll(".path-row-item");
          return {
            countAfterFilter: rows.length,
            allMatchPython: Array.from(rows).every(r => r.textContent.toLowerCase().includes("python"))
          };
        })()
      `
    });
    const fData = filterRes?.result?.value || {};
    test("Search filtering works accurately", fData.countAfterFilter > 0 && fData.allMatchPython, `Matching python rows: ${fData.countAfterFilter}`);

    // Reset search
    await send("Runtime.evaluate", {
      expression: 'document.getElementById("pathExplorerSearch").value = ""; document.getElementById("pathExplorerSearch").dispatchEvent(new Event("input"));'
    });

    // 8. Buffer Progress Bar
    console.log("\n[CDP Test 8: PATH Length & Buffer Monitor Progress Bar]");
    const barRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          var barFill = document.getElementById("docBufferBarFill");
          var totLen = document.getElementById("docTotalPathLen");
          return {
            hasBar: !!barFill,
            barWidth: barFill ? barFill.style.width : null,
            barBg: barFill ? barFill.style.backgroundColor : null,
            totLenText: totLen ? totLen.textContent : null
          };
        })()
      `
    });
    const barData = barRes?.result?.value || {};
    test("Buffer progress bar rendered with width", !!barData.barWidth && barData.barWidth !== '0%', `Width: ${barData.barWidth}, Text: ${barData.totLenText}`);

    ws.close();
    console.log("\n=============================================================");
    console.log(`CDP E2E Summary: ${passed} passed, ${failed} failed`);
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