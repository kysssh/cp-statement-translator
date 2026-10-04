import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const profile = mkdtempSync(join(tmpdir(), 'vjudge-v0-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir='+profile, 'about:blank'], { windowsHide: true });
let socket;
const report = {capturedAt:new Date().toISOString(), pages:[]};
try {
  const endpoint = await new Promise((resolve,reject)=>{
    let log='';
    browser.stderr.on('data',b=>{log+=b;const m=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)resolve(m[1]);});
    browser.on('error',reject);
    setTimeout(()=>reject(new Error('Browser startup timeout')),20000).unref();
  });
  socket=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let id=0;
  const pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params,sessionId}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const call=(method,params)=>send(method,params,sessionId);
  await call('Page.enable');
  await call('Network.enable');
  let requests=[];
  const oldHandler=socket.onmessage;
  socket.onmessage=e=>{oldHandler(e);const m=JSON.parse(e.data);if(m.method==='Network.responseReceived' && m.sessionId===sessionId)requests.push({url:m.params.response.url,status:m.params.response.status,type:m.params.type});};
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const pages=[
    ['codeforces','https://vjudge.net/problem/CodeForces-1692A'],
    ['atcoder','https://vjudge.net/problem/AtCoder-abc086_a'],
    ['hdu','https://vjudge.net/problem/HDU-1000'],
    ['spoj','https://vjudge.net/problem/SPOJ-TEST'],
    ['uva','https://vjudge.net/problem/UVA-100'],
    ['contest-list','https://vjudge.net/contest'],
  ];
  for(const [name,url] of pages){
    requests=[];
    await call('Page.navigate',{url});
    await new Promise(resolve=>setTimeout(resolve,12000));
    const data=await evaluate(`(() => {
      const selectors=['#problem-name','#problem-body','.problem-statement','.problem-description','iframe','pre','sub','sup','br','mjx-container','.MathJax','.katex'];
      return {url:location.href,title:document.title,text:document.body.innerText.slice(0,1500),
        counts:Object.fromEntries(selectors.map(s=>[s,document.querySelectorAll(s).length])),
        frames:Array.from(document.querySelectorAll('iframe')).map(f=>({id:f.id,src:f.src,accessible:!!f.contentDocument,html:f.contentDocument?.body?.outerHTML})),
        html:document.documentElement.outerHTML,
        links:Array.from(document.querySelectorAll('a[href]')).map(a=>({text:a.textContent.trim(),href:a.href})).filter(a=>/contest\\/|problem\\//.test(a.href)).slice(0,30)};
    })()`);

    delete data.html;
    data.frames.forEach(f=>{delete f.html;});
    data.requests=requests.filter(r=>r.url.startsWith('https://vjudge.net/') && ['Document','XHR','Fetch'].includes(r.type));
    report.pages.push({name,requestedUrl:url,...data});
    writeFileSync('tools/vjudge-dom-report.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({name,url:data.url,title:data.title,counts:data.counts,frames:data.frames.map(f=>({id:f.id,src:f.src,accessible:f.accessible})),text:data.text.slice(0,300)}));
  }
  await send('Browser.close');
} finally {socket?.close();browser.kill();}
