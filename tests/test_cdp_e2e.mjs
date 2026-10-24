import { spawn } from 'node:child_process';

const PORT = 9238;
const exePath = "D:\\Git\\LazyEnv\\build\\Release\\LazyEnv.exe";
console.log("=== Launching LazyEnv for CDP E2E Testing ===");

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
  const test = (name, ok) => {
    if (ok) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
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

    // Wait for document to reach 'complete'
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
    console.log("UI Version:", verText);
    test("UI shows LazyEnv v0.8.12", verText.includes("v0.8.12"));

    // 2. Test i18n dictionary for doctor.relaunchFailed
    console.log("\n[CDP Test 2: i18n relaunchFailed dictionary check]");
    const i18nRes = await send("Runtime.evaluate", {
      expression: `
        (function() {
          window.LazyEnvI18n.setLocale("en");
          const en = window.LazyEnvI18n.t("doctor.relaunchFailed");
          window.LazyEnvI18n.setLocale("zh-CN");
          const zh = window.LazyEnvI18n.t("doctor.relaunchFailed");
          return { en, zh };
        })()
      `,
      returnByValue: true
    });
    console.log("i18n translations:", i18nRes?.result?.value);
    test("i18n English contains relaunch message", i18nRes?.result?.value?.en?.includes("Failed to relaunch as Administrator"));
    test("i18n Chinese contains relaunch message", i18nRes?.result?.value?.zh?.includes("以管理员身份重启失败"));

    // 3. Test getInstalledEnvironments IPC action
    console.log("\n[CDP Test 3: IPC Contract getInstalledEnvironments]");
    const ipcRes = await send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `
        new Promise((resolve) => {
          let gotDetectStarted = false;
          const listener = (e) => {
            let data = e.data;
            if (typeof data === 'string') {
              try { data = JSON.parse(data); } catch (_) {}
            }
            if (data) {
              if (data.action === 'detectStarted') {
                gotDetectStarted = true;
              }
              if (data.action === 'environmentsDetected') {
                window.chrome.webview.removeEventListener('message', listener);
                resolve({ ok: true, gotDetectStarted, count: (data.environments || []).length });
              }
            }
          };
          window.chrome.webview.addEventListener('message', listener);
          window.chrome.webview.postMessage(JSON.stringify({ action: 'getInstalledEnvironments' }));
          setTimeout(() => resolve({ ok: false, timeout: true, gotDetectStarted }), 20000);
        })
      `
    });
    console.log("IPC getInstalledEnvironments Response:", ipcRes?.result?.value);
    test("Native backend accepted getInstalledEnvironments and returned environmentsDetected", ipcRes?.result?.value?.ok === true);

    await sleep(500);
    const cardCountRes = await send("Runtime.evaluate", {
      expression: 'document.querySelectorAll(".card-row").length',
      returnByValue: true
    });
    const cardCount = cardCountRes?.result?.value || 0;
    console.log(`Rendered environment card-rows: ${cardCount}`);
    test("Environment cards rendered on UI after getInstalledEnvironments", cardCount > 0);

    // 4. Test deleteEnvVar empty name rejection without crash
    console.log("\n[CDP Test 4: deleteEnvVar Empty Name Safe Rejection]");
    const delRes = await send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `
        new Promise((resolve) => {
          const listener = (e) => {
            let data = e.data;
            if (typeof data === 'string') {
              try { data = JSON.parse(data); } catch (_) {}
            }
            if (data && data.action === 'envVarDeleteResult') {
              window.chrome.webview.removeEventListener('message', listener);
              resolve({ ok: true, success: data.success, name: data.name });
            }
          };
          window.chrome.webview.addEventListener('message', listener);
          window.chrome.webview.postMessage(JSON.stringify({ action: 'deleteEnvVar', name: '', scope: 'user' }));
          setTimeout(() => resolve({ ok: false, timeout: true }), 5000);
        })
      `
    });
    console.log("deleteEnvVar empty name result:", delRes?.result?.value);
    test("deleteEnvVar returned success: false safely without crash", delRes?.result?.value?.ok === true && delRes?.result?.value?.success === false);

    // 5. Test relaunchFailed Toast Notification in UI
    console.log("\n[CDP Test 5: relaunchFailed Toast Notification in UI]");
    const toastRes = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (function() {
          if (typeof window.__lazyenv_handleNative === 'function') {
            window.__lazyenv_handleNative({ action: "relaunchFailed" });
          }
          
          var toast = document.querySelector(".toast.toast--warning");
          var msg = toast ? toast.textContent : "";
          return {
            hasToast: !!toast,
            message: msg
          };
        })()
      `
    });
    console.log("Toast Result:", toastRes?.result?.value);
    test("relaunchFailed Toast was displayed", toastRes?.result?.value?.hasToast === true &&
      (toastRes?.result?.value?.message?.includes("以管理员身份重启失败") || 
       toastRes?.result?.value?.message?.includes("Failed to relaunch")));

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