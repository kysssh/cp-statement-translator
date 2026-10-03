import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// T51: runs the actual unpacked dist extension in a disposable Chromium profile.
// Only the Groq HTTP response is simulated in the worker; no real key is used.
const executable = process.env.CPT_TEST_BROWSER ?? 'C:/Users/PERCY/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
assert(existsSync(executable), 'Set CPT_TEST_BROWSER to a Chromium executable supporting unpacked extensions');
const profile = mkdtempSync(join(tmpdir(), 'cpalg-t51-'));
const dist = resolve('dist');
const report = { capturedAt: new Date().toISOString(), browser: executable, extension: dist, translation: 'Simulated Groq HTTP response in isolated test worker; actual content script, messaging, queue and storage', checks: [], exceptions: [], consoleErrors: [] };
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--disable-extensions-except=${dist}`, `--load-extension=${dist}`, 'about:blank'], { windowsHide: true });
let socket;
const pause = ms => new Promise(r => setTimeout(r, ms));
let send;
try {
  const endpoint = await new Promise((resolveEndpoint, reject) => {
    let log = '';
    browser.stderr.on('data', b => { log += b; const m = log.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) resolveEndpoint(m[1]); });
    browser.on('error', reject);
    browser.on('exit', code => reject(new Error(`Browser exited: ${code}`)));
    setTimeout(() => reject(new Error('Browser startup timeout')), 20000).unref();
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolveOpen, reject) => { socket.onopen = resolveOpen; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') report.exceptions.push({ sessionId: m.sessionId, ...m.params.exceptionDetails });
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.consoleErrors.push({ sessionId: m.sessionId, args: m.params.args.map(a => a.value ?? a.description), stack: m.params.stackTrace });
  };
  send = (method, params = {}, sessionId) => new Promise((resolveSend, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); reject(new Error(`CDP timeout: ${method}`)); }, 45000);
    pending.set(n, { resolve: resolveSend, reject, timer });
    socket.send(JSON.stringify({ id:n, method, params, sessionId }));
  });
  const evaluate = async (sessionId, expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true }, sessionId);
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const wait = async (fn, description, ms = 30000) => {
    const deadline = Date.now()+ms;
    while (Date.now()<deadline) { if (await fn()) return; await pause(200); }
    throw new Error(`Timeout: ${description}`);
  };
  let worker;
  await wait(async () => { worker = (await send('Target.getTargets')).targetInfos.find(t => t.type==='service_worker' && t.url.startsWith('chrome-extension://') && t.url.endsWith('/service-worker-loader.js')); return !!worker; }, 'extension service worker', 15000);
  const extensionOrigin = worker.url.split('/').slice(0,3).join('/');
  report.worker = worker;
  report.browserVersion = await send('Browser.getVersion');
  report.extensionOrigin = extensionOrigin;
  const { sessionId: workerSession } = await send('Target.attachToTarget', { targetId:worker.targetId, flatten:true });
  await send('Runtime.enable', {}, workerSession);
  await wait(() => evaluate(workerSession, 'typeof chrome !== \"undefined\" && !!chrome.storage?.local'), 'extension storage initialization', 15000);
  await evaluate(workerSession, `(async () => {
    globalThis.__t51Requests = 0;
    globalThis.__t51Counts = [];
    globalThis.fetch = async (url, options) => {
      if (String(url) !== 'https://api.groq.com/openai/v1/chat/completions') throw new Error('T51 blocked unexpected worker request');
      const body=JSON.parse(options.body);
      const blocks=JSON.parse(body.messages.find(m=>m.role==='user').content).blocks;
      globalThis.__t51Requests++;
      globalThis.__t51Counts.push(blocks.length);
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({blocks:blocks.map(t=>'[T51] '+t)})}}]}),{status:200,headers:{'content-type':'application/json'}});
    };
    await chrome.storage.local.set({provider:'groq', keys:{groq:'T51_FAKE_KEY_NEVER_SENT'}, models:{}});
    return true;
  })()`);
  const { targetId } = await send('Target.createTarget', { url:'about:blank' });
  const { sessionId: page } = await send('Target.attachToTarget', { targetId, flatten:true });
  await send('Page.enable', {}, page);
  await send('Runtime.enable', {}, page);
  const ev = expression => evaluate(page, expression);
  const currentRequests = () => evaluate(workerSession, 'globalThis.__t51Requests');
  const check = (name, data) => { report.checks.push({ name, ...data }); console.log(JSON.stringify({name,...data})); };
  const ready = async path => {
    await wait(() => ev(`location.pathname===${JSON.stringify(path)} && document.readyState==='complete' && document.querySelectorAll('.cpt-root').length===1 && !!document.querySelector('article.md-content__inner')`), `article and single extension UI: ${path}`);
    await ev('window.MathJax?.startup?.promise ?? Promise.resolve()');
    await pause(500);
  };
  const translate = async () => {
    await ev(`document.querySelector('.cpt-primary').click()`);
    await wait(() => ev(`['done','error'].includes(document.querySelector('.cpt-root')?.dataset.state)`), 'translation complete');
    const state = await ev(`({state:document.querySelector('.cpt-root').dataset.state,message:document.querySelector('.cpt-msg').textContent,attributions:document.querySelectorAll('.cpt-attribution').length,paragraph:document.querySelector('article p').textContent})`);
    assert.equal(state.state, 'done', state.message);
    assert.equal(state.attributions, 1);
    assert(state.paragraph.startsWith('[T51]'));
    return state;
  };

  const bfs='/graph/breadth-first-search.html';
  await send('Page.navigate', {url:'https://cp-algorithms.com'+bfs}, page);
  await ready(bfs);
  check('extension mounted on initial article', await ev(`({url:location.href,uiCount:document.querySelectorAll('.cpt-root').length,state:document.querySelector('.cpt-root').dataset.state})`));
  await ev(`window.__t51Code=Array.from(document.querySelectorAll('article pre')).map(n=>n.outerHTML);window.__t51UI=document.querySelector('.cpt-root');window.__t51Sentinel=true`);
  const first = await translate();
  assert(await ev(`JSON.stringify(window.__t51Code)===JSON.stringify(Array.from(document.querySelectorAll('article pre')).map(n=>n.outerHTML))`));
  check('translation through real extension messaging and worker', {...first,requests:await currentRequests()});
  await ev(`document.querySelector('label[for="__tabbed_1_2"]').click()`);
  assert(await ev(`document.querySelector('#__tabbed_1_2').checked && document.querySelector('.cpt-root')===window.__t51UI && document.querySelector('article p').textContent.startsWith('[T51]')`));
  check('code tab retains translation and UI', {passed:true});
  await ev(`document.querySelector('article h2 a.headerlink').click()`);
  await pause(300);
  assert(await ev(`window.__t51Sentinel===true && document.querySelector('.cpt-root')===window.__t51UI && document.querySelectorAll('.cpt-root').length===1`));
  check('heading hash preserves translated article', {passed:true,hash:await ev('location.hash')});
  await ev(`Array.from(document.querySelectorAll('.cpt-seg button')).find(b=>b.textContent==='EN').click()`);
  assert(await ev(`!document.querySelector('article p').textContent.startsWith('[T51]') && document.querySelector('#__tabbed_1_2').checked`));
  await ev(`Array.from(document.querySelectorAll('.cpt-seg button')).find(b=>b.textContent==='ES').click()`);
  assert(await ev(`document.querySelector('article p').textContent.startsWith('[T51]') && document.querySelector('#__tabbed_1_2').checked`));
  check('EN/ES preserves selected language tab', {passed:true});

  await ev(`(() => {const a=Array.from(document.querySelectorAll('a[href]')).find(a=>a.href==='https://cp-algorithms.com/algebra/binary-exp.html');if(!a)throw new Error('Missing navigation link');a.click();})()`);
  await ready('/algebra/binary-exp.html');
  assert(await ev(`window.__t51Sentinel===undefined && document.querySelector('.cpt-root').dataset.state==='idle'`));
  check('article link loads new document and fresh extension UI', await ev(`({url:location.href,uiCount:document.querySelectorAll('.cpt-root').length,state:document.querySelector('.cpt-root').dataset.state,sentinelSurvived:window.__t51Sentinel===true})`));
  check('new article translates', await translate());
  await send('Page.reload', {}, page);
  await ready('/algebra/binary-exp.html');
  const beforeCache=await currentRequests();
  const cacheState=await translate();
  assert.equal(await currentRequests(), beforeCache, 'reload should restore translated blocks from cache without requests');
  assert(cacheState.message.includes('caché'));
  check('reload reattaches UI and uses persistent block cache', {...cacheState,newRequests:0});

  const history=await send('Page.getNavigationHistory',{},page);
  const bfsEntry=[...history.entries].reverse().find(e=>new URL(e.url).pathname===bfs && !new URL(e.url).hash);
  assert(bfsEntry,'BFS history entry');
  await send('Page.navigateToHistoryEntry',{entryId:bfsEntry.id},page);
  await ready(bfs);
  const backState=await ev(`document.querySelector('.cpt-root').dataset.state`);
  const beforeBack=await currentRequests();
  if(backState!=='done') await translate();
  assert.equal(await currentRequests(),beforeBack);
  assert(await ev(`document.querySelectorAll('.cpt-root').length===1 && document.querySelector('article p').textContent.startsWith('[T51]')`));
  check('history back returns functional UI and translated content', {passed:true,initialState:backState,newRequests:0});
  const extensionErrors=report.exceptions.filter(e=>JSON.stringify(e).includes(extensionOrigin));
  const extensionConsoleErrors=report.consoleErrors.filter(e=>JSON.stringify(e).includes(extensionOrigin));
  assert.equal(extensionErrors.length,0,'Extension runtime exceptions');
  assert.equal(extensionConsoleErrors.length,0,'Extension console errors');
  report.passed=true;
  report.requestCount=await currentRequests();
  report.batchSizes=await evaluate(workerSession,'globalThis.__t51Counts');
  check('no extension runtime or console errors', {passed:true});
} catch(error) {
  report.passed=false;
  report.failure=String(error.stack ?? error);
  console.error(report.failure);
  process.exitCode=1;
} finally {
  writeFileSync('tools/cpalgorithms-navigation-report.json',JSON.stringify(report,null,2)+'\n');
  if(send && socket?.readyState===WebSocket.OPEN) {try{await send('Browser.close');}catch{}}
  socket?.close();
  browser.kill();
}
