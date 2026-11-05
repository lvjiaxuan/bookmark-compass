import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPrompt } from '../src/lib/prompt.ts';

const page = {
  title: '示例文章',
  url: 'https://example.com/article',
};

const candidates = [
  { id: '10', path: '收藏栏 / 开发' },
  { id: '20', path: '收藏栏 / 阅读' },
];

test('提示词只描述归类任务，结构由 responseConstraint 提供', () => {
  const prompt = buildPrompt(page, candidates);

  assert.match(prompt, /在候选文件夹中选一个最合适的/);
  assert.match(prompt, /10: 收藏栏 \/ 开发/);
  assert.doesNotMatch(prompt, /只输出一个 JSON 对象/);
  assert.doesNotMatch(prompt, /输出格式/);
  assert.doesNotMatch(prompt, /folderId.*confidence/);
});
