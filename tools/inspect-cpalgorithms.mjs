import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const profile = mkdtempSync(join(tmpdir(), 'cpalg-t48-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    browser.stderr.on('data', b => { log += b; const m = log.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) resolve(m[1]); });
    browser.on('error', reject);
    setTimeout(() => reject(new Error('Browser startup timeout')), 20000).unref();
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket.send(JSON.stringify({ id:n, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url:'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten:true });
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable');
  const evaluate = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true }); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const pages = [
    ['cpalgorithms-corto.html', 'algebra/euclid-algorithm.html'],
    ['cpalgorithms-codigo.html', 'data_structures/segment_tree.html'],
    ['cpalgorithms-pestanas.html', 'graph/breadth-first-search.html'],
  ];
  const results = [];
  for (const [file, path] of pages) {
    const url = `https://cp-algorithms.com/${path}`;
    await call('Page.navigate', { url });
    await evaluate(`new Promise(resolve => { const start=Date.now(); const t=setInterval(() => { if(document.readyState==='complete' && document.querySelector('article.md-content__inner') && document.querySelector('mjx-container')) { clearInterval(t); resolve(true); } else if(Date.now()-start>25000) { clearInterval(t); resolve(false); } },200); })`);
    const data = await evaluate(`(() => { const root=document.querySelector('article.md-content__inner'); if(!root) throw new Error('Missing article'); const selectors=['p','li','h1','h2','h3','h4','pre','code','mjx-container','.MathJax','.arithmatex','a.headerlink','table','.tabbed-set','.tabbed-labels','.tabbed-content','.admonition','details','summary','input','button','script']; return { title:document.title, url:location.href, rootCount:document.querySelectorAll('article.md-content__inner').length, html:root.outerHTML, counts:Object.fromEntries(selectors.map(s=>[s,root.querySelectorAll(s).length])), config:JSON.parse(document.querySelector('#__config').textContent), mathConfig:window.MathJax?.config?.tex, topChildren:Array.from(root.children).map(n=>({tag:n.tagName,class:n.className})), scripts:Array.from(document.scripts).map(s=>s.src).filter(Boolean) }; })()`);
    writeFileSync(`tests/fixtures/${file}`, `<!-- Source: ${url}; captured ${new Date().toISOString()}; rendered Chrome DOM; CC BY-SA 4.0 -->\n${data.html}\n`);
    delete data.html;
    if(path.includes('breadth-first')) {
      data.tabExperiment = await evaluate(`(() => { const root=document.querySelector('article.md-content__inner'); const inputs=Array.from(root.querySelectorAll('.tabbed-set > input')); if(inputs.length<2)return {available:false}; const p=root.querySelector('p'); p.append(document.createTextNode(' T48_PROBE')); const label=root.querySelector('label[for="'+inputs[1].id+'"]'); label.click(); return {available:true,checked:inputs[1].checked,paragraphPreserved:root.querySelector('p')===p,editPreserved:p.textContent.includes('T48_PROBE')}; })()`);
      await evaluate('window.__t48Sentinel = true');
      await evaluate(`(() => { const link=Array.from(document.querySelectorAll("a[href]")).find(a=>a.href===new URL("../algebra/binary-exp.html",location.href).href); if(!link) throw new Error("Navigation link missing"); link.click(); })()`);
      await new Promise(resolve=>setTimeout(resolve,3000));
      data.navigationExperiment = await evaluate('({url:location.href,sentinelSurvived:window.__t48Sentinel===true})');
    }
    results.push({file,...data});
    console.log(JSON.stringify({file,counts:data.counts,tabs:data.tabExperiment,navigation:data.navigationExperiment}));
  }
  writeFileSync('tests/fixtures/cpalgorithms-dom-report.json', JSON.stringify({capturedAt:new Date().toISOString(),results},null,2)+'\n');
  await send('Browser.close');
} finally { socket?.close(); browser.kill(); }
