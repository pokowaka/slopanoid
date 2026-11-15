/* Tiny Chrome DevTools Protocol driver shared by the optional browser tests.
 * Launches a private headless Chrome (temporary profile, audio muted) on a URL. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch(url, opts) {
  opts = opts || {};
  const CHROME = opts.chrome || process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(CHROME)) return null;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-chrome-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1280,860', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  const errors = [];
  const pending = new Map();
  let ws, id = 0, target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); target = list.find(t => t.type === 'page'); } catch (e) { /* not up yet */ }
  }
  if (!target) { chrome.kill(); throw new Error('could not reach Chrome DevTools'); }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push('console.' + m.params.type + ': ' + m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log: ' + m.params.entry.text);
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalJS = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text));
    return r.result.value;
  };
  const key = async (code, k, shift) => {
    const p = { code, key: k || code, modifiers: shift ? 8 : 0 };
    await send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, p)); await sleep(40);
    await send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, p)); await sleep(60);
  };
  const mouse = async (type, x, y, button) => send('Input.dispatchMouseEvent', { type, x, y, button: button || 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  const shot = async file => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); };
  const close = async () => {
    try { ws.close(); } catch (e) { /* ignore */ }
    chrome.kill(); await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(1500);
  return { send, evalJS, key, mouse, shot, close, errors, sleep };
}

module.exports = { launch, sleep };
