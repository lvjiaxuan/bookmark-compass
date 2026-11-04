import assert from 'node:assert/strict';
import test from 'node:test';

import { closeSession, createSession, detectAi, getSessionQuota, promptWithTimeout, type LanguageModelApi, type PromptSession } from '../src/lib/ai.ts';

type Scope = Record<string, unknown>;

const setApi = (api: unknown): void => {
  (globalThis as Scope).LanguageModel = api;
};

const clearApi = (): void => {
  delete (globalThis as Scope).LanguageModel;
};

test('模型可下载时报告 downloadable', async () => {
  setApi({ create: async () => ({}), availability: async () => 'downloadable' });
  const result = await detectAi();
  assert.equal(result.status, 'downloadable');
  assert.ok(result.api);
  clearApi();
});

test('模型可用时报告 available', async () => {
  setApi({ create: async () => ({}), availability: async () => 'available' });
  assert.equal((await detectAi()).status, 'available');
  clearApi();
});

test('availability 抛错时报告不可用并带上原因', async () => {
  setApi({
    create: async () => ({}),
    availability: async () => {
      throw new Error('NotAllowedError: requires a user gesture');
    },
  });

  const result = await detectAi();
  assert.equal(result.status, 'unavailable');
  assert.match(result.error ?? '', /user gesture/);
  clearApi();
});

test('没有接口时报告 unsupported', async () => {
  clearApi();
  const result = await detectAi();
  assert.equal(result.status, 'unsupported');
  assert.equal(result.api, null);
});

test('旧版 capabilities 接口也能映射', async () => {
  setApi({ create: async () => ({}), capabilities: async () => ({ available: 'after-download' }) });
  assert.equal((await detectAi()).status, 'downloadable');
  clearApi();
});

test('未知状态按不可用处理', async () => {
  setApi({ create: async () => ({}), availability: async () => 'no' });
  assert.equal((await detectAi()).status, 'unavailable');
  clearApi();
});

const quotaOf = (fields: Partial<PromptSession>) => getSessionQuota({ prompt: async () => '', ...fields });

test('读取新版会话上下文配额，优先于旧字段', () => {
  assert.deepEqual(quotaOf({ contextUsage: 256, contextWindow: 4096, inputUsage: 99, inputQuota: 1024 }),
    { used: 256, total: 4096, remaining: 3840 });
});

test('兼容旧版会话配额字段', () => {
  assert.deepEqual(quotaOf({ inputUsage: 128, inputQuota: 1024 }), { used: 128, total: 1024, remaining: 896 });
  assert.deepEqual(quotaOf({ tokensSoFar: 64, maxTokens: 512 }), { used: 64, total: 512, remaining: 448 });
});

test('空会话和用满配额均返回真实读数', () => {
  assert.deepEqual(quotaOf({ contextUsage: 0, contextWindow: 4096 }), { used: 0, total: 4096, remaining: 4096 });
  assert.deepEqual(quotaOf({ contextUsage: 4096, contextWindow: 4096 }), { used: 4096, total: 4096, remaining: 0 });
});

test('缺失、不完整或无效的配额不显示为数值', () => {
  for (const fields of [
    {}, { contextUsage: 0 }, { contextWindow: 4096 },
    { contextUsage: 100, inputQuota: 4096 },
    { contextUsage: NaN, contextWindow: 4096 },
    { contextUsage: 0, contextWindow: Infinity },
    { contextUsage: -1, contextWindow: 4096 },
    { contextUsage: 0, contextWindow: 0 },
    { contextUsage: 4097, contextWindow: 4096 },
  ]) assert.equal(quotaOf(fields), null);
});

test('超时和外部取消都会中止正在运行的提示', async () => {
  let timeoutSignal: AbortSignal | undefined;
  const session: PromptSession = {
    prompt: async (_text, options) => {
      timeoutSignal = options?.signal;
      return await new Promise<string>(() => undefined);
    },
  };
  await assert.rejects(promptWithTimeout(session, 'slow', {}, undefined, 5), /推理超时/);
  assert.equal(timeoutSignal?.aborted, true);

  const controller = new AbortController();
  const stopped = promptWithTimeout(session, 'slow', {}, controller.signal);
  controller.abort();
  await assert.rejects(stopped, { name: 'AbortError' });
});

test('用户取消创建时不重试并释放迟到创建的会话', async () => {
  let resolveCreate!: (session: PromptSession) => void;
  let destroyCount = 0;
  const api: LanguageModelApi = {
    create: () => new Promise((resolve) => { resolveCreate = resolve; }),
  };
  const controller = new AbortController();
  const creating = createSession(api, () => undefined, controller.signal);
  controller.abort();
  const session: PromptSession = { prompt: async () => '', destroy: () => { destroyCount += 1; } };
  resolveCreate(session);
  await assert.rejects(creating, { name: 'AbortError' });
  assert.equal(destroyCount, 1);
});

test('创建会话在 monitor 和回退路径都使用相同采样参数', async () => {
  const calls: Record<string, unknown>[] = [];
  const api: LanguageModelApi = {
    create: async (options = {}) => {
      calls.push(options);
      if (options.monitor) throw new TypeError('monitor unsupported');
      return { prompt: async () => '' };
    },
  };

  await createSession(api, () => undefined);
  assert.equal(calls.length, 2);
  for (const options of calls) {
    assert.equal(options.temperature, 0.2);
    assert.equal(options.topK, 3);
  }
  assert.equal(typeof calls[0]?.monitor, 'function');
  assert.equal(calls[1]?.monitor, undefined);
});

test('promptWithTimeout 将 responseConstraint 传给 Prompt API', async () => {
  const schema = { type: 'object', additionalProperties: false };
  let options: Parameters<PromptSession['prompt']>[1];
  const session: PromptSession = {
    prompt: async (_text, received) => {
      options = received;
      return '{}';
    },
  };

  await promptWithTimeout(session, '给出结果', schema);
  assert.deepEqual(options?.responseConstraint, schema);
  assert.ok(options?.signal instanceof AbortSignal);
});

test('closeSession 会释放会话且吞掉 destroy 错误', () => {
  let destroyCount = 0;
  closeSession({ prompt: async () => '', destroy: () => { destroyCount += 1; } });
  closeSession({ prompt: async () => '', destroy: () => { throw new Error('already closed'); } });
  assert.equal(destroyCount, 1);
});