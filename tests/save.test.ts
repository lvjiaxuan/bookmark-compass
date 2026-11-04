import assert from 'node:assert/strict';
import test from 'node:test';

import { saveBookmark } from '../src/lib/save.ts';
import type { SaveAdapter } from '../src/lib/save.ts';

const page = { title: '示例页面', url: 'https://example.com' };

function makeAdapter(overrides: Partial<SaveAdapter> = {}): { adapter: SaveAdapter; created: () => number } {
  let created = 0;
  const adapter: SaveAdapter = {
    get: async () => [{ id: '10' }],
    create: async () => {
      created += 1;
      return { id: 'new' };
    },
    ...overrides,
  };
  return { adapter, created: () => created };
}

test('目标存在时创建书签', async () => {
  const { adapter, created } = makeAdapter();
  const result = await saveBookmark(adapter, '10', page);
  assert.deepEqual(result, { ok: true, id: 'new' });
  assert.equal(created(), 1);
});

test('目标文件夹已消失时不创建', async () => {
  const { adapter, created } = makeAdapter({ get: async () => [] });
  const result = await saveBookmark(adapter, '10', page);
  assert.equal(result.ok, false);
  assert.equal(created(), 0);
});

test('读取目标失败时不创建', async () => {
  const { adapter, created } = makeAdapter({
    get: async () => {
      throw new Error('not found');
    },
  });
  const result = await saveBookmark(adapter, '10', page);
  assert.equal(result.ok, false);
  assert.equal(created(), 0);
});

test('目标不是文件夹时不创建', async () => {
  const { adapter, created } = makeAdapter({ get: async () => [{ id: '10', url: 'https://example.com' }] });
  const result = await saveBookmark(adapter, '10', page);
  assert.equal(result.ok, false);
  assert.equal(created(), 0);
});

test('创建失败时返回原因', async () => {
  const { adapter } = makeAdapter({
    create: async () => {
      throw new Error('quota exceeded');
    },
  });
  const result = await saveBookmark(adapter, '10', page);
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.reason : '', /quota exceeded/);
});

test('缺少目标或网址时直接拒绝', async () => {
  const { adapter, created } = makeAdapter();
  assert.equal((await saveBookmark(adapter, '', page)).ok, false);
  assert.equal((await saveBookmark(adapter, '10', { title: 't', url: '' })).ok, false);
  assert.equal(created(), 0);
});
