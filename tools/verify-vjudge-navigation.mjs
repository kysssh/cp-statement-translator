import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// V2: extensión unpacked y capturas HTML; no usa sesión ni llama a proveedores reales.
// Only the Groq HTTP response is simulated in the worker; no real key is used.
const executable = process.env.CPT_TEST_BROWSER ?? 'C:/Users/PERCY/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
assert(existsSync(executable), 'Set CPT_TEST_BROWSER to a Chromium executable supporting unpacked extensions');
const profile = mkdtempSync(join(tmpdir(), 'vjudge-v2-'));
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

  report.translation = 'Extensión real; HTML de capturas servido por CDP, navegación simulada y HTTP de Groq simulado. No verifica sesión real ni aplicación remota.';
  const { JSDOM } = await import('jsdom');
  const { readFileSync } = await import('node:fs');
  const captured = name => readFileSync('tests/fixtures/' + name, 'utf8');
  const clean = (html, keepFrame = false) => {
    const dom = new JSDOM('<!doctype html>' + html);
    dom.window.document.querySelectorAll('script,link').forEach(n=>n.remove());
    dom.window.document.querySelectorAll('iframe').forEach(n=>{
      if (!keepFrame || n.parentElement.id !== 'frame-description-container') n.remove();
    });
    const result = dom.window.document.body.innerHTML;
    dom.window.close();
    return result;
  };
  const shellHtml = '<!doctype html><html data-bs-theme="light"><head><style>body{font:16px system-ui;margin:20px}.katex-mathml{position:absolute;clip:rect(1px,1px,1px,1px)}.katex{font-family:serif}#contest-overview-meta-panel,#contest-problem-list-view,#contest-tabs,nav,.body-footer,.modal,#page-panel-toggle-slot{display:none!important}#contest-problem-detail-view{display:block!important}iframe{border:0;width:100%}[data-bs-theme=dark]{background:#171a24;color:#eee}</style></head><body>' + clean(captured('vj-contest-shell-a.html'),true) + '</body></html>';
  const descriptionHtml = body => '<!doctype html><html><head><style>body{font:16px system-ui;margin:12px}.katex-mathml{position:absolute;clip:rect(1px,1px,1px,1px)}</style></head><body>' + clean(body) + '</body></html>';
  const descriptions = {
    '321177558442991': descriptionHtml(captured('vj-contest-a.html')),
    '999999': descriptionHtml(captured('vj-contest-b.html')),
    '888888': descriptionHtml('<div id="description-container" lang="es"><p>Para cada entrada dado el valor de los números, la salida debe indicar el resultado de cada una.</p></div>'),
    '777777': descriptionHtml(captured('vj-uva.html')),
  };
  const origins = ['codeforces', 'atcoder', 'poj', 'gym', 'codechef', 'hackerrank', 'kattis', 'usaco'];
  origins.forEach((origin, index) => {
    descriptions[String(600000 + index)] = descriptionHtml('<div id="description-container">' + captured('vj-' + origin + '.html') + '</div>');
  });
  await evaluate(workerSession, String.raw`(async () => {
    globalThis.__v2Requests=0;
    globalThis.__v2Sizes=[];
    globalThis.__v2Hold=false;
    globalThis.fetch=async(url,options)=>{
      if(String(url)!=='https://api.groq.com/openai/v1/chat/completions') throw new Error('V2 blocked unexpected worker request');
      const body=JSON.parse(options.body);
      const blocks=JSON.parse(body.messages.find(m=>m.role==='user').content).blocks;
      globalThis.__v2Requests++;
      globalThis.__v2Sizes.push(blocks.length);
      if(globalThis.__v2Hold) {
        globalThis.__v2Hold=false;
        await new Promise(resolve=>{globalThis.__v2Release=resolve;});
      }
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({blocks:blocks.map(t=>globalThis.__v2BreakAlice && t.includes('Alice has a cake') && t.includes('⟦') ? 'Respuesta sin los marcadores de fórmulas' : '[V2] '+t)})}}]}),{status:200,headers:{'content-type':'application/json'}});
    };
    await chrome.storage.local.clear();
    await chrome.storage.local.set({provider:'groq',keys:{groq:'V2_FAKE_KEY_NEVER_SENT'},models:{}});
  })()`);
  const {targetId} = await send('Target.createTarget',{url:'about:blank'});
  const {sessionId:page} = await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Page.enable',{},page);
  await send('Runtime.enable',{},page);
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false},page);
  await send('Fetch.enable',{patterns:[{urlPattern:'https://*',requestStage:'Request'}]},page);
  const oldHandler=socket.onmessage;
  let intercepted=0;
  socket.onmessage=e=>{
    oldHandler(e);
    const m=JSON.parse(e.data);
    if(m.method!=='Fetch.requestPaused' || m.sessionId!==page) return;
    void (async()=>{
      const url=new URL(m.params.request.url);
      let html;
      if(url.origin==='https://vjudge.net'){
        if(/^\/contest\/855562$/.test(url.pathname)||url.pathname==='/problem/CodeForces-1654C')html=shellHtml;
        const id=/^\/problem\/description\/(\d+)$/.exec(url.pathname)?.[1];
        if(id)html=descriptions[id];
      }
      intercepted++;
      if(html)await send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(html).toString('base64')},page);
      else await send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'},page);
    })().catch(error=>report.consoleErrors.push({interceptionError:error.message}));
  };
  const ev=expression=>evaluate(page,expression);
  const requests=()=>evaluate(workerSession,'globalThis.__v2Requests');
  const check=(name,details={})=>{report.checks.push({name,passed:true,...details});console.log(name);};
  const waitUi=state=>wait(()=>ev("document.querySelector('.cpt-root')?.dataset.state==="+JSON.stringify(state)),'UI '+state);
  const setupSwitch=function(letter,kind='html'){
    location.hash='#problem/'+letter;
    const source=letter==='A'?'CodeForces-1654C':'CodeForces-1279C';
    document.querySelector('#problem-title').innerHTML='<a href="/problem/'+source+'">'+letter+'</a>';
    document.querySelectorAll('#problem-nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('num')===letter));
    const id=kind==='spanish'?'888888':kind==='pdf'?'777777':letter==='A'?'321177558442991':'999999';
    const item=document.querySelector('#prob-descs .active');
    item.dataset.key=id;
    item.dataset.lang=kind==='spanish'?'es':'en';
    document.querySelector('#frame-description-container iframe').src='/problem/description/'+id;
  };
  await send('Page.navigate',{url:'https://vjudge.net/contest/855562#problem/A'},page);
  await waitUi('idle');
  await ev('window.__v2Switch='+setupSwitch.toString());
  assert.equal(await ev("document.querySelectorAll('.cpt-root').length"),1);
  assert.equal(await ev("document.querySelector('#frame-description-container iframe').contentDocument.querySelectorAll('.cpt-root').length"),0);
  check('Barra única en página padre y acceso a iframe real mismo origen');
  await ev("document.querySelector('.cpt-primary').click()");
  await waitUi('done');
  assert.equal(await requests(),1);
  assert(await ev("document.querySelector('#frame-description-container iframe').contentDocument.body.textContent.includes('[V2]')"));
  check('Traducción con content script, mensajes y service worker reales');
  await ev("document.querySelectorAll('.cpt-seg button')[1].click()");
  assert(!(await ev("document.querySelector('#frame-description-container iframe').contentDocument.body.textContent.includes('[V2]')")));
  await ev("document.querySelectorAll('.cpt-seg button')[0].click()");
  check('Alternancia EN/ES');
  await ev("document.querySelector('.cpt-root').scrollIntoView({block:'start'})");
  for(const theme of ['light','dark']){
    await ev("document.documentElement.dataset.bsTheme="+JSON.stringify(theme));
    const screenshot=await send('Page.captureScreenshot',{format:'png'},page);
    writeFileSync('tools/vjudge-preview-'+theme+'.png',Buffer.from(screenshot.data,'base64'));
  }
  check('Capturas de barra con tema claro y oscuro');
  await ev("window.__v2Switch('B')");
  await waitUi('idle');
  assert.equal(await requests(),1);
  await ev("document.querySelector('.cpt-primary').click()");
  await waitUi('done');
  assert.equal(await requests(),2);
  await ev("window.__v2Switch('A')");
  await waitUi('idle');
  await ev("document.querySelector('.cpt-primary').click()");
  await waitUi('done');
  assert.equal(await requests(),2);
  check('A/B/A: cambio reinicia UI; regreso usa caché sin nueva petición');
  await ev("window.__v2Switch('A','spanish')");
  await waitUi('idle');
  await ev("document.querySelector('.cpt-primary').click()");
  await waitUi('error');
  assert.equal(await requests(),2);
  check('Versión es: aviso sin llamada');
  await ev("window.__v2Switch('A','pdf')");
  await wait(()=>ev("!!document.querySelector('#frame-description-container iframe').contentDocument.querySelector('.vjudge-pdf-viewer') && !document.querySelector('.cpt-root')"),'PDF sin botón');
  check('PDF real de UVA sin botón');
  await send('Page.navigate',{url:'https://vjudge.net/problem/CodeForces-1654C'},page);
  await waitUi('idle');
  await ev("document.querySelector('.cpt-primary').click()");
  await waitUi('done');
  assert.equal(await requests(),2);
  check('Ruta de problema suelto comparte caché de origen con contest (carcasa reconstruida)');
  await send('Page.navigate',{url:'https://vjudge.net/contest/855562#problem/A'},page);
  await waitUi('idle');
  await ev('window.__v2Switch='+setupSwitch.toString());
  await evaluate(workerSession,"chrome.storage.local.clear().then(()=>chrome.storage.local.set({provider:'groq',keys:{groq:'V2_FAKE_KEY_NEVER_SENT'},models:{}}))");
  await evaluate(workerSession,'globalThis.__v2Hold=true');
  await ev("document.querySelector('.cpt-primary').click()");
  await wait(async()=>await requests()===3,'petición retenida');
  await ev("window.__v2Switch('B')");
  await waitUi('idle');
  await evaluate(workerSession,'globalThis.__v2Release();true');
  await pause(300);
  assert(!(await ev("document.querySelector('#frame-description-container iframe').contentDocument.body.textContent.includes('[V2]')")));
  check('Respuesta tardía de A descartada tras navegar a B');
  // Cobertura de los ocho jueces en navegador, sin afirmar navegación remota real.
  for (const [index, origin] of origins.entries()) {
    await ev(`(() => {
      const item = document.querySelector('#prob-descs .active');
      item.dataset.key = ${JSON.stringify(String(600000 + index))};
      item.dataset.lang = 'en';
      document.querySelector('#frame-description-container iframe').src = '/problem/description/' + item.dataset.key;
    })()`);
    await waitUi('idle');
    await wait(() => ev(`(() => {
      const frame = document.querySelector('#frame-description-container iframe');
      return frame?.contentDocument?.URL.includes('/problem/description/${600000 + index}') && frame.contentDocument.readyState === 'complete';
    })()`), 'carga de captura ' + origin);
    await pause(100);
    await waitUi('idle');
    await ev(`(() => {
      const root = document.querySelector('#frame-description-container iframe').contentDocument.querySelector('#description-container');
      window.__v2Opaque = [...root.querySelectorAll('.katex,.MathJax_SVG,pre,code,img,svg,.vjudge_sample,br,sub,sup')].map(node => ({node, html:node.outerHTML}));
      window.__v2Original = root.innerHTML;
    })()`);
    const beforeRequests = await requests();
    await ev("document.querySelector('.cpt-primary').click()");
    try { await waitUi('done'); } catch (error) { console.log(await ev("({state:document.querySelector('.cpt-root')?.dataset.state,message:document.querySelector('.cpt-msg')?.textContent})")); throw error; }
    assert((await requests()) > beforeRequests, 'Expected translation request for ' + origin);
    assert(await ev("window.__v2Opaque.every(({node,html}) => node.isConnected && node.outerHTML === html)"), 'Opaque nodes changed for ' + origin);
    await ev("document.querySelectorAll('.cpt-seg button')[1].click()");
    assert(await ev("document.querySelector('#frame-description-container iframe').contentDocument.querySelector('#description-container').innerHTML === window.__v2Original"), 'Original HTML changed for ' + origin);
    await ev("document.querySelectorAll('.cpt-seg button')[0].click()");
    assert(await ev("window.__v2Opaque.every(({node,html}) => node.isConnected && node.outerHTML === html)"), 'Opaque nodes changed after toggle for ' + origin);
    assert.equal(await ev("document.querySelectorAll('.cpt-root').length"), 1);
    check('Captura ' + origin + ': traducción, HTML original EN e identidad de opacos EN/ES');
  }
  for (const mode of ['empty', 'error', 'no-access', 'overview', 'spanish-text']) {
    await send('Page.navigate', {url:'https://vjudge.net/contest/855562?cpt-test=' + mode + '#problem/A'}, page);
    await waitUi('idle');
    const beforeRequests = await requests();
    await ev(`(() => {
      const mode = ${JSON.stringify(mode)};
      const root = document.querySelector('#frame-description-container iframe').contentDocument.querySelector('#description-container');
      if (mode === 'empty') root.replaceChildren();
      if (mode === 'error') root.innerHTML = '<p role="alert">Error loading statement</p>';
      if (mode === 'no-access') document.querySelector('#frame-description-container').replaceChildren();
      if (mode === 'overview') location.hash = '#overview';
      if (mode === 'spanish-text') {
        document.querySelector('#prob-descs .active').dataset.lang = '';
        root.innerHTML = '<p>Para cada entrada dado el valor de los números, la salida debe indicar el resultado de cada una.</p>';
      }
    })()`);
    if (mode === 'spanish-text') {
      await pause(150);
      await waitUi('idle');
      await ev("document.querySelector('.cpt-primary').click()");
      await waitUi('error');
      assert(await ev("document.querySelector('.cpt-msg').textContent.includes('ya está en español')"));
    } else {
      await wait(() => ev("!document.querySelector('.cpt-root')"), 'sin barra: ' + mode);
      await pause(600); // Incluye un ciclo de polling: no debe reaparecer la barra.
      assert(await ev("!document.querySelector('.cpt-root')"));
    }
    assert.equal(await requests(), beforeRequests);
    check('Estado sintético ' + mode + ': sin petición y UI adecuada');
  }
  await send('Page.navigate', {url:'https://vjudge.net/contest/855562?cpt-test=fallback#problem/A'}, page);
  await waitUi('idle');
  await evaluate(workerSession, "chrome.storage.local.clear().then(()=>chrome.storage.local.set({provider:'groq',keys:{groq:'V2_FAKE_KEY_NEVER_SENT'},models:{}}))");
  await evaluate(workerSession, 'globalThis.__v2BreakAlice=true');
  await ev(`(() => {
    const doc = document.querySelector('#frame-description-container iframe').contentDocument;
    const paragraph = [...doc.querySelectorAll('#description-container p')].find(node=>node.textContent.startsWith('Alice has a cake'));
    window.__v2AliceMath = [...paragraph.querySelectorAll('.katex')].map(node=>({node, html:node.outerHTML}));
  })()`);
  const fallbackRequests = await requests();
  await ev("document.querySelector('.cpt-primary').click()");
  await waitUi('done');
  assert.equal(await requests(), fallbackRequests + 3);
  assert(await ev(`(() => {
    const doc = document.querySelector('#frame-description-container iframe').contentDocument;
    const paragraph = [...doc.querySelectorAll('#description-container p')].find(node=>node.textContent.includes('Alice has a cake'));
    return paragraph.textContent.startsWith('[V2] Alice has a cake') && !paragraph.classList.contains('cpt-skipped') &&
      window.__v2AliceMath.every(({node,html})=>paragraph.contains(node) && node.outerHTML===html);
  })()`));
  check('Alice: dos respuestas sin marcadores recuperadas mediante fragmentos, fórmulas intactas');
  report.localOnly='Verificado en tests/vjudge-integration.spec.ts con proveedor local simulado y cero mensajes TRANSLATE.';
  report.requestCount=await requests();
  report.blockCounts=await evaluate(workerSession,'globalThis.__v2Sizes');
  report.intercepted=intercepted;
  report.passed=report.exceptions.length===0 && report.consoleErrors.length===0;
  assert(report.passed,'Unexpected runtime errors');
  writeFileSync('tools/vjudge-navigation-report.json',JSON.stringify(report,null,2)+'\n');
  await send('Browser.close');
} catch(error) {
  report.passed=false;
  report.failure={message:error.message,stack:error.stack};
  writeFileSync('tools/vjudge-navigation-report.json',JSON.stringify(report,null,2)+'\n');
  throw error;
} finally {socket?.close();browser.kill();}

