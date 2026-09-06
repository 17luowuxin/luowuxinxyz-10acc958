const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compile = text => ts.transpileModule(text, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const parserExports = {};
new Function('exports', compile(fs.readFileSync('src/utils/stickerImport.ts', 'utf8')))(parserExports);
const { parseStickerImport } = parserExports;

test('recognizes screenshot-style Chinese colons, spaces, GIFs and blank lines', () => {
  const text = [
    'NO:https://iili.io/CtmXPoJ.gif',
    '哇哇哇：https://iili.io/CtmX4ta.gif',
    '打脸：  https://iili.io/CtmXQFp.gif',
    '对的对的:https://iili.io/CtmXZcN.gif',
    '不对不对：　https://iili.io/CtmXpNn.gif',
    '好棒:https://iili.io/CtmXb9t.gif',
    '惊吓:https://iili.io/CtmXyts.gif',
    '挑衅:https://iili.io/CtmhHoG.gif',
    '看透:https://iili.io/CtmhdP4.gif',
    '花花:https://iili.io/CtmhFl2.gif',
    '等:https://iili.io/Ctmh3Kl.gif',
    '心:https://iili.io/Ctmhcl7.gif',
    '耶: https://iili.io/CtmhCNe.gif',
    '着急：\thttps://iili.io/CtmhpDu.gif',
  ].join('\r\n\r\n');
  const { items, invalidLines } = parseStickerImport(text);
  assert.equal(items.length, 14);
  assert.deepEqual(invalidLines, []);
  assert.equal(items[2].keywords[0], '打脸');
  assert.equal(items[2].url, 'https://iili.io/CtmXQFp.gif');
});

test('preserves query strings, pure links and multiple keywords', () => {
  const { items, invalidLines } = parseStickerImport('咬你/啃你，表情： \u200Bhttps://example.com/image.gif?a=1&b=2\nHTTPS://example.com/hello.png\nhttps://example.com/image?id=3');
  assert.equal(items.length, 3);
  assert.deepEqual(invalidLines, []);
  assert.equal(items[0].url, 'https://example.com/image.gif?a=1&b=2');
  assert.deepEqual(items[0].keywords, ['咬你', '啃你', '表情', '表情包']);
  assert.equal(items[1].keywords[0], 'hello');
});

test('reports malformed lines instead of silently discarding them', () => {
  const result = parseStickerImport('提示文字\n开心: https://example.com/a.gif\njavascript:alert(1)\nhttps://\nhttps://example.com/a b.gif\nhttps://name:password@example.com/a.gif');
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.invalidLines, [1, 3, 4, 5, 6]);
  assert.equal(result.items[0].lineNumber, 2);
});

// Exercise the actual page handler with fake persistence; never touches real accounts.
const page = ts.createSourceFile('ChatPage.tsx', fs.readFileSync('src/pages/ChatPage.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
(function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(page) === 'handleBatchImportStickers') handler = node.getText(page);
  ts.forEachChild(node, visit);
})(page);
assert.ok(handler);
const handlerCode = compile(`const ${handler}; globalThis.runImport = handleBatchImportStickers;`);

function setup(text, options = {}) {
  let nextId = 0;
  const state = { input: text, stickers: [{ id: 'existing', imageUrl: 'existing.gif' }], writes: [], toasts: [], loading: false };
  const save = async rows => {
    state.writes.push(rows);
    if (state.writes.length === options.failBatch) throw new Error('模拟网络错误');
    if (options.wait) await options.wait;
    return rows.map(row => ({ ...row, id: `test-${++nextId}` }));
  };
  const context = {
    user: { id: 'test-user' }, localMode: !!options.localMode,
    batchStickerUrls: text, stickerImportRunningRef: { current: false }, parseStickerImport,
    setImportingBatch: value => { state.loading = value; },
    setBatchStickerUrls: value => { state.input = value; },
    setUserStickers: update => { state.stickers = update(state.stickers); },
    toast: Object.fromEntries(['success', 'warning', 'error'].map(type => [type, message => state.toasts.push({ type, message })])),
    supabase: { from: table => {
      assert.equal(!!options.localMode, false);
      assert.equal(table, 'user_stickers');
      return { insert: rows => ({ select: async () => options.responseError
        ? { data: null, error: { message: '没有保存权限' } }
        : { data: await save(rows), error: null } }) };
    } },
    insertLocalRows: async (userId, table, rows) => {
      assert.equal(!!options.localMode, true);
      assert.equal(userId, 'test-user');
      assert.equal(table, 'user_stickers');
      return save(rows);
    },
  };
  vm.runInNewContext(handlerCode, context);
  return { state, run: () => context.runImport() };
}
const manyLinks = count => Array.from({ length: count }, (_, i) => `表情${i}： https://example.com/${i}.gif`).join('\n');

test('imports more than 20 links in bounded batches without replacing existing stickers', async () => {
  const { state, run } = setup(manyLinks(121));
  await run();
  assert.deepEqual(state.writes.map(rows => rows.length), [50, 50, 21]);
  assert.equal(state.stickers.length, 122);
  assert.ok(state.stickers.some(row => row.id === 'existing'));
  assert.equal(state.input, '');
  assert.equal(state.loading, false);
  assert.equal(state.toasts[0].type, 'success');
});

test('keeps malformed lines and reports partial success', async () => {
  const { state, run } = setup('说明文字\n开心： https://example.com/a.gif\n错误链接');
  await run();
  assert.equal(state.input, '说明文字\n错误链接');
  assert.equal(state.stickers.length, 2);
  assert.equal(state.toasts[0].type, 'warning');
});

test('keeps failed and unattempted links after a failed batch', async () => {
  const { state, run } = setup(manyLinks(121), { failBatch: 2 });
  await run();
  assert.equal(state.stickers.length, 51);
  assert.equal(state.input.split('\n').length, 71);
  assert.ok(state.input.startsWith('表情50：'));
  assert.equal(state.writes.length, 2);
  assert.equal(state.loading, false);
  assert.match(state.toasts[0].message, /模拟网络错误/);
});

test('keeps all input when saving fails, or when nothing can be parsed', async () => {
  for (const text of [manyLinks(2), '错误链接']) {
    const { state, run } = setup(text, { failBatch: 1 });
    await run();
    assert.equal(state.input, text);
    assert.equal(state.stickers.length, 1);
    assert.equal(state.loading, false);
  }
});

test('uses local persistence for existing local-mode users', async () => {
  const { state, run } = setup(manyLinks(3), { localMode: true });
  await run();
  assert.equal(state.stickers.length, 4);
  assert.equal(state.input, '');
});

test('reports database errors and preserves the pasted input', async () => {
  const text = manyLinks(2);
  const { state, run } = setup(text, { responseError: true });
  await run();
  assert.equal(state.input, text);
  assert.equal(state.stickers.length, 1);
  assert.match(state.toasts[0].message, /没有保存权限/);
  assert.equal(state.loading, false);
});

test('ignores repeated clicks while an import is running', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const { state, run } = setup(manyLinks(2), { wait });
  const first = run();
  await run();
  assert.equal(state.writes.length, 1);
  release();
  await first;
  assert.equal(state.stickers.length, 3);
  assert.equal(state.loading, false);
});
