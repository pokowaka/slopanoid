/* Drives tools/browser-test.html in real headless Chrome over the DevTools
 * protocol (no dependencies: Node's built-in fetch + WebSocket), waits for the
 * scripted run to finish, prints the report and saves a real screenshot.
 *   node tools/browser-run.js [chromePath]
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const chrome = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = 'file://' + path.join(__dirname, 'browser-test.html');
const port = 9333;
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=/tmp/bt-chrome-cdp',
  '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--window-size=1280,900', url], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch (e) { await sleep(200); } }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const consoleLines = [];
  const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') consoleLines.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) consoleLines.push(d.params.type + ' ' + d.params.args.map((a) => a.value || a.description).join(' '));
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload');
  await sleep(21000);
  const r = await send('Runtime.evaluate', { expression: "document.getElementById('report').textContent" });
  console.log(r.result.value);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'browser_shot.png'), Buffer.from(shot.data, 'base64'));
  console.log('console errors/warnings:', consoleLines.length ? '\n' + consoleLines.join('\n') : 'none');
  ws.close(); proc.kill();
  process.exit(0);
})().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
