// V0: analiza capturas suministradas por el usuario; no ejecuta scripts del HTML.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
const directory = 'tests/fixtures/';
const lines = readFileSync(directory + 'vj-urls.txt', 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const urls = new Map();
for (let i = 0; i < lines.length; i += 2) {
  if (!lines[i]?.endsWith('.html') || !lines[i + 1]?.startsWith('https://vjudge.net/')) throw new Error('Formato de URLs inválido');
  urls.set(lines[i], lines[i + 1]);
}
const context = JSON.parse(readFileSync(directory + 'vj-codeforces-context.json', 'utf8'));
if (context.context !== 'iframe' || new URL(context.url).origin !== 'https://vjudge.net' || !new URL(context.url).pathname.startsWith('/problem/description/')) throw new Error('Contexto de iframe inesperado');
const contestUrls = readFileSync(directory + 'vj-contest-urls.txt', 'utf8').match(/https:\/\/vjudge\.net\/contest\/\d+#problem\/[A-Z]+/g);
if (!contestUrls || contestUrls.length !== 2) throw new Error('Se esperaban URLs de A y B');
const contestA = new URL(contestUrls[0]);
const contestB = new URL(contestUrls[1]);
if (contestA.pathname !== contestB.pathname || contestA.hash !== '#problem/A' || contestB.hash !== '#problem/B') throw new Error('A y B deben pertenecer al mismo contest');
urls.set('vj-contest-a.html', contestUrls[0]);
urls.set('vj-contest-b.html', contestUrls[1]);
const opaque = 'pre,code,kbd,samp,script,style,img,svg,math,.katex,.MathJax,.MathJax_SVG,mjx-container,.copier,br,sub,sup';
const files = readdirSync(directory).filter(name => /^vj[.-].*\.html$/.test(name)).sort();
const captures = files.map(file => {
  const html = readFileSync(directory + file, 'utf8');
  const window = new JSDOM('<!doctype html><html><body>' + html + '</body></html>').window;
  const doc = window.document;
  const root = doc.body.firstElementChild;
  if (!root || doc.body.children.length !== 1) throw new Error('Se esperaba un contenedor único: ' + file);
  const listedName = file === 'vj.hackerrank.html' ? 'vj-hackerrank.html' : file;
  const url = urls.get(listedName);
  if (!url) throw new Error('Falta URL: ' + file);
  const counts = Object.fromEntries(['p','li','div','dd','h3','pre','code','br','sub','sup','img','svg','.katex','.MathJax','.MathJax_SVG','iframe','.vjudge_sample','.copier','.vjudge-pdf-viewer-container','canvas','.textLayer'].map(s => [s, root.querySelectorAll(s).length + Number(root.matches(s))]));
  const leaves = [...root.querySelectorAll('p,li,h1,h2,h3,h4')].filter(e => !e.closest(opaque) && !e.querySelector('p,li,h1,h2,h3,h4'));
  const clone = root.cloneNode(true);
  clone.querySelectorAll(opaque).forEach(e => e.remove());
  const looseText = [...clone.querySelectorAll('div,dd')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && /\p{L}/u.test(n.textContent))).map(e => ({tag:e.tagName,preview:[...e.childNodes].filter(n => n.nodeType === 3).map(n=>n.textContent).join(' ').trim().slice(0,100)}));
  const result = {
    file, listedName, url, sha256:createHash('sha256').update(html).digest('hex'),
    length:html.length, root:{tag:root.tagName,id:root.id,class:root.className},
    pdf:root.matches('.vjudge-pdf-viewer-container') || !!root.querySelector('.vjudge-pdf-viewer'),
    counts, headings:[...root.querySelectorAll('h1,h2,h3,h4')].map(e=>e.textContent.trim()),
    paragraphAndHeadingCandidates:leaves.length, looseText,
    images:[...root.querySelectorAll('img')].map(e=>({src:e.getAttribute('src'),alt:e.getAttribute('alt')})),
    framePlacement:'El fragmento por sí solo no prueba su contexto; consultar contextEvidence del informe.',
  };
  window.close();
  return result;
});
const report = { capturedAt:new Date().toISOString(), source:'Capturas DOM aportadas por el usuario; análisis offline.', contextEvidence:context, contestNavigation:{a:contestUrls[0],b:contestUrls[1],sameContest:true,changedPart:'hash',liveNavigationVerified:false}, captures };
writeFileSync('tools/vjudge-fixtures-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({html:captures.filter(c=>!c.pdf).length,pdf:captures.filter(c=>c.pdf).length,captures:captures.map(c=>({file:c.file,pdf:c.pdf,paragraphAndHeadingCandidates:c.paragraphAndHeadingCandidates,looseText:c.looseText.length}))},null,2));
