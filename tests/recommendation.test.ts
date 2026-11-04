import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRecommendation, recommendationSchema } from '../src/lib/recommendation.ts';

const ids = new Set(['10', '100']);

test('接受候选列表中的文件夹', () => {
  assert.deepEqual(parseRecommendation('{"folderId":"10","confidence":82}', ids), {
    kind: 'recommendation',
    folderId: '10',
    confidence: 82,
  });
});

test('接受 none', () => {
  assert.deepEqual(parseRecommendation('{"folderId":"none","confidence":0}', ids), { kind: 'none' });
});

test('结构化输出 Schema 只允许本次候选 ID 和 none', () => {
  assert.deepEqual(recommendationSchema(ids), {
    type: 'object',
    properties: {
      folderId: { type: 'string', enum: ['10', '100', 'none'] },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
    },
    required: ['folderId', 'confidence'],
    additionalProperties: false,
  });
});

test('拒绝 Markdown 代码块和 JSON 外的说明文字', () => {
  assert.equal(parseRecommendation('```json\\n{"folderId":"100","confidence":40}\\n```', ids).kind, 'invalid');
  assert.equal(parseRecommendation('结果如下：{"folderId":"100","confidence":40}', ids).kind, 'invalid');
});

test('拒绝候选之外的 id', () => {
  const result = parseRecommendation('{"folderId":"999","confidence":50}', ids);
  assert.equal(result.kind, 'invalid');
});

test('拒绝越界或非整数置信度', () => {
  assert.equal(parseRecommendation('{"folderId":"10","confidence":101}', ids).kind, 'invalid');
  assert.equal(parseRecommendation('{"folderId":"10","confidence":50.5}', ids).kind, 'invalid');
  assert.equal(parseRecommendation('{"folderId":"10"}', ids).kind, 'invalid');
});

test('拒绝额外字段', () => {
  const result = parseRecommendation('{"folderId":"10","confidence":50,"reason":"x"}', ids);
  assert.equal(result.kind, 'invalid');
});

test('拒绝非 JSON 和非字符串输入', () => {
  assert.equal(parseRecommendation('我觉得应该放在开发里', ids).kind, 'invalid');
  assert.equal(parseRecommendation(null, ids).kind, 'invalid');
  assert.equal(parseRecommendation('[]', ids).kind, 'invalid');
});
