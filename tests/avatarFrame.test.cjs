const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

let status = 'loading';
const react = {
  useState: () => [status, value => { status = value; }],
  createElement: (type, props) => ({ type, props }),
};
const exportsUnderTest = {};
const code = ts.transpileModule(fs.readFileSync('src/components/chat/AvatarFrameImage.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
new Function('require', 'exports', code)(name => name === 'react' ? react : '/assets/dream-frame-current.png', exportsUnderTest);
const { resolveAvatarFrame, AvatarFrameImage } = exportsUnderTest;

test('old built-in paths resolve to the current frame without changing custom images', () => {
  for (const source of ['/assets/dream-frame-old123.png', 'https://old.example/assets/dream-frame-abc_def.png']) {
    assert.equal(resolveAvatarFrame(source), '/assets/dream-frame-current.png');
  }
  for (const source of ['https://example.com/custom.png', 'data:image/png;base64,abc', '/storage/v1/object/public/avatars/dream-frame-old.png']) {
    assert.equal(resolveAvatarFrame(source), source);
  }
  assert.equal(resolveAvatarFrame(null), '');
});

test('broken frames disappear and new sources get a fresh keyed image', () => {
  status = 'loading';
  const element = AvatarFrameImage({ source: '/custom.png', className: 'frame' });
  let image = element.type(element.props);
  assert.equal(image.props.style.visibility, 'hidden');
  image.props.onLoad();
  image = element.type(element.props);
  assert.equal(image.props.style.visibility, 'visible');
  image.props.onError();
  assert.equal(element.type(element.props), null);
  assert.notEqual(AvatarFrameImage({ source: '/other.png', className: 'frame' }).props.key, element.props.key);
  assert.equal(AvatarFrameImage({ source: '', className: 'frame' }), null);
});
