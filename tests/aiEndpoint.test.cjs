const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const compile = text => ts.transpileModule(text, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = {};
new Function('exports', compile(fs.readFileSync('supabase/functions/_shared/ai-endpoint.ts', 'utf8')))(mod);
const { buildChatCompletionsUrl, looksLikeHtml, describeAiError, readAiJson } = mod;

test('bare domain gets /v1/chat/completions', () => {
  assert.equal(buildChatCompletionsUrl('https://api.aixoras.com/'), 'https://api.aixoras.com/v1/chat/completions');
});

test('address ending in /v1 or another version only gets /chat/completions', () => {
  assert.equal(buildChatCompletionsUrl('https://api.siliconflow.cn/v1'), 'https://api.siliconflow.cn/v1/chat/completions');
  assert.equal(buildChatCompletionsUrl('https://open.bigmodel.cn/api/paas/v4'), 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
});

test('full chat/completions address is kept as is', () => {
  assert.equal(buildChatCompletionsUrl('https://x.com/v1/chat/completions'), 'https://x.com/v1/chat/completions');
});

test('a web page reply is recognised as HTML, a JSON reply is not', () => {
  assert.equal(looksLikeHtml('<!doctype html><html lang="zh-CN"><head>'), true);
  assert.equal(looksLikeHtml('{"choices":[]}', 'application/json'), false);
});

test('wrong key error names the key', () => {
  assert.match(describeAiError(401, '{"error":{"message":"invalid api key"}}'), /密钥/);
});

test('reading a web page as AI reply throws a clear Chinese error', async () => {
  const res = new Response('<!DOCTYPE html><html><head><script src="/static/js/a.js"></script></head></html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(() => readAiJson(res, 'https://x.com/chat/completions'), /API地址填错了/);
});
