import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { selectRescueBackup } from './rescueBackup';

test('免登录备份保留角色聊天表情包，不导出接口密钥', () => {
  const backup = selectRescueBackup({ format: 'dream-phone-local-backup', version: 2, exportedAt: '2026-11-12', userId: 'device-user', tables: { characters: [{ id: 'c1' }], chat_messages: [{ content: '你好' }], user_stickers: [{ image_url: 'sticker.png' }], api_keys: [{ api_key: 'private-test-key' }] }, assets: [{ sourceUrl: 'sticker.png', dataUrl: 'data:image/png;base64,AA==' }] });
  assert.equal(backup.tables.characters[0].id, 'c1');
  assert.equal(backup.tables.chat_messages[0].content, '你好');
  assert.equal(backup.tables.user_stickers[0].image_url, 'sticker.png');
  assert.equal(backup.assets.length, 1);
  assert.equal('api_keys' in backup.tables, false);
});