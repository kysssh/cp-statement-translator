import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

// Offline estimates from the same adapters, extraction and chunker as the extension.
// Compile TypeScript in memory; do not generate files or contact a provider.
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } });
  module._compile(outputText, filename);
};
const { cpalgorithms } = require(resolve('src/adapters/cpalgorithms.ts'));
const { usaco } = require(resolve('src/adapters/usaco.ts'));
const { collectBlocks } = require(resolve('src/core/segmenter.ts'));
const { extract } = require(resolve('src/core/protector.ts'));
const { chunkBlocks } = require(resolve('src/core/chunker.ts'));
const { estimateRequestCost, estimateTokens } = require(resolve('src/core/estimate-tokens.ts'));
const { DOC_SYSTEM_PROMPT, DOC_GLOSSARY_VERSION } = require(resolve('src/shared/doc-prompt.ts'));
const fixtures = [
  [usaco, 'usaco-corto.html'], [usaco, 'usaco-formulas.html'], [usaco, 'usaco-tablas.html'],
  [cpalgorithms, 'cpalgorithms-corto.html'], [cpalgorithms, 'cpalgorithms-codigo.html'], [cpalgorithms, 'cpalgorithms-pestanas.html'],
];
const results = [];
for (const [adapter, file] of fixtures) {
  const dom = new JSDOM(readFileSync(`tests/fixtures/${file}`, 'utf8'));
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  const root = adapter.findStatementRoot(document);
  const blocks = collectBlocks(root, adapter.blockSelector, adapter.protection);
  const sources = blocks.map(b => ({ text: extract(b, adapter.protection).text }));
  const chunks = chunkBlocks(sources, 3000);
  const costs = chunks.map(c => estimateRequestCost(DOC_SYSTEM_PROMPT, c.blocks.map(b => b.text)));
  const cost = costs.reduce((acc, c) => ({input:acc.input+c.input,output:acc.output+c.output,total:acc.total+c.total}),{input:0,output:0,total:0});
  results.push({ site:adapter.id, fixture:file, blocks:blocks.length, batches:chunks.length, estimatedInput:cost.input, estimatedOutput:cost.output, estimatedTotal:cost.total, estimatedCachedRevisit:0 });
  dom.window.close();
}
const report = { capturedAt:new Date().toISOString(), glossaryVersion:DOC_GLOSSARY_VERSION, method:'Heuristic: 4 characters/token, output +15%, full system prompt repeated per batch, 3000 block-input tokens/batch. Excludes JSON overhead, model reasoning, retries and provider-side prompt caching. Not API usage.', systemPromptTokens:estimateTokens(DOC_SYSTEM_PROMPT), results };
writeFileSync('tools/document-token-estimates.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
