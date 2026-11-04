import { spawn } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
const SRC = 'D:\\Git\\LazyEnv\\build\\Release';
const DIR = 'D:\\Git\\LazyEnv 测试%#';
const PORT = 9258;
rmSync(DIR, { recursive: true, force: true });
cpSync(SRC, DIR, { recursive: true });
const proc = spawn(DIR + '\\LazyEnv.exe', [], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  stdio: 'ignore'
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
try {
  let wsUrl = null;
  for (let i = 0; i < 25 && !wsUrl; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
      }
    } catch {}
  }
  if (!wsUrl) throw new Error('no CDP endpoint');
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (method, params = {}) => new Promise(resolve => {
    const reqId = id++;
    const h = ev => { const m = JSON.parse(ev.data); if (m.id === reqId) { ws.removeEventListener('message', h); resolve(m.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: reqId, method, params }));
  });
  await send('Runtime.enable');
  await sleep(1500);
  const r = await send('Runtime.evaluate', {
    expression: "document.querySelector('.sidebar__version')?.textContent || ''",
    returnByValue: true
  });
  const ver = r?.result?.value || '';
  const ok = ver.includes('v0.');
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Page loads from path with spaces/%/# - got: "${ver}"`);
  if (!ok) failed++;
  ws.close();
} catch (e) {
  console.error('  [FAIL] smoke error:', e.message); failed++;
} finally {
  try { proc.kill(); } catch {}
  await sleep(1500);   // WebView2 subprocesses release locks asynchronously
  for (let i = 0; i < 6; i++) {
    try { rmSync(DIR, { recursive: true, force: true, maxRetries: 2 }); break; }
    catch { await sleep(700); }
  }
  process.exit(failed ? 1 : 0);
}