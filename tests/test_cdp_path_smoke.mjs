import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
import { cpSync, rmSync } from 'node:fs';
const SRC = join(ROOT, 'build', 'Release');
const DIR = join(ROOT, 'build', 'smoke 测试%#');
const PORT = 9258;
rmSync(DIR, { recursive: true, force: true });
cpSync(SRC, DIR, { recursive: true });
console.log('[diag] args-env=' + (process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS || '<unset>'));
const proc = spawn(DIR + '\\LazyEnv.exe', [], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  stdio: ['ignore', 'pipe', 'pipe']
});
let appOutput = '';
proc.stdout?.on('data', d => { appOutput += d; });
proc.stderr?.on('data', d => { appOutput += d; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
try {
  let wsUrl = null;
  for (let i = 0; i < 75 && !wsUrl; i++) {
    if (proc.exitCode !== null) break;
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
      }
    } catch {}
  }
  if (!wsUrl) {
    const state = proc.exitCode === null ? 'app still running (slow start?)' : `app exited code=${proc.exitCode}`;
    const tail = appOutput ? ` | app output: ${appOutput.slice(-600)}` : '';
      let wv = '<n/a>'; try { wv = execSync('tasklist /FI "IMAGENAME eq msedgewebview2.exe" /NH', { encoding: 'utf8' }).trim().replace(/\r?\n/g, ' | '); } catch {}
      try { wv += ' || cmd: ' + execSync('powershell -NoProfile -File tests/dump-webview2.ps1', { encoding: 'utf8' }).trim().replace(/\r?\n/g, ' ~~ ' ).slice(0, 2000); } catch (e) { wv += ' || cmd-err: ' + e.message; }
    throw new Error(`no CDP endpoint (${state})${tail} | webview2: ${wv}`);
  }
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
