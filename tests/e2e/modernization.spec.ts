import type { BrowserContext, Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

type AiStage = 'detect' | 'create' | 'prompt';
type Outcome = 'resolve' | 'reject';
type MockConfig = { queryError?: string; freezeClock?: boolean };
type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;
type CreateInput = chrome.bookmarks.CreateDetails;
type MockSession = {
  prompt: (text: string, options?: { signal?: AbortSignal }) => Promise<string>;
  destroy: () => void;
};
type MockCreateOptions = {
  signal?: AbortSignal;
  monitor?: (monitor: {
    addEventListener: (type: string, listener: (event: { loaded: number }) => void) => void;
  }) => void;
};
type MockSnapshot = {
  availabilityCalls: number;
  createCalls: number;
  promptCalls: number;
  saveCalls: CreateInput[];
  createAborted: boolean;
  promptAborted: boolean;
  destroyedSessions: number;
  progressEvents: number;
  closeCalls: number;
};
type MockHooks = {
  read: () => MockSnapshot;
  finishAi: (stage: AiStage, outcome: Outcome, value?: string) => void;
  finishSave: (index: number, outcome: Outcome) => void;
  progress: (loaded: number) => void;
  flush: () => Promise<void>;
};
type MockScope = { __modernization: MockHooks };

/** 该函数会被序列化；所有运行时数据和依赖都在函数体内定义。 */
const installModernizationMocks = ({ queryError }: MockConfig): void => {
  type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: Error) => void;
  };
  const deferred = <T>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };

  // 故意不提供 id "1"，默认位置必须来自实际目录，而不是收藏栏文案。
  const tree: BookmarkNode[] = [{
    id: '0', title: '', syncing: false, children: [
      { id: '10', title: '测试收纳箱', syncing: false, children: [{ id: '11', title: '手动目录', syncing: false, children: [] }] },
      {
        id: '20', title: '参考资料', syncing: false, children: [
          { id: '21', title: '技术', syncing: false, children: [{ id: '22', title: '浏览器', syncing: false, children: [] }] },
        ],
      },
    ],
  }];
  const nodes = new Map<string, BookmarkNode>();
  const indexNodes = (entries: BookmarkNode[]): void => {
    for (const node of entries) {
      nodes.set(node.id, node);
      indexNodes(node.children ?? []);
    }
  };
  indexNodes(tree);

  const availability = deferred<string>();
  const creation = deferred<MockSession>();
  const inference = deferred<string>();
  const saves: Array<Deferred<BookmarkNode>> = [];
  const saveCalls: CreateInput[] = [];
  const progressListeners: Array<(event: { loaded: number }) => void> = [];
  let availabilityCalls = 0;
  let createCalls = 0;
  let promptCalls = 0;
  let destroyedSessions = 0;
  let progressEvents = 0;
  let closeCalls = 0;
  let createSignal: AbortSignal | undefined;
  let promptSignal: AbortSignal | undefined;

  const session: MockSession = {
    prompt: async (_text, options) => {
      promptCalls++;
      promptSignal = options?.signal;
      // 故意不响应 abort，模拟底层推理晚到；应用的 abort race 应先结束等待。
      return await inference.promise;
    },
    destroy: () => { destroyedSessions++; },
  };
  Object.defineProperty(globalThis, 'LanguageModel', {
    configurable: true,
    value: {
      availability: async (): Promise<string> => {
        availabilityCalls++;
        return await availability.promise;
      },
      create: async (options?: MockCreateOptions): Promise<MockSession> => {
        createCalls++;
        createSignal = options?.signal;
        options?.monitor?.({
          addEventListener: (_type, listener) => { progressListeners.push(listener); },
        });
        return await creation.promise;
      },
    },
  });

  Object.defineProperty(chrome.tabs, 'query', {
    configurable: true,
    value: async (_info: chrome.tabs.QueryInfo) => {
      if (queryError) throw new Error(queryError);
      return [{ id: 777, url: 'https://example.com/modernization', title: '现代化测试文章' }];
    },
  });
  Object.defineProperty(chrome.scripting, 'executeScript', {
    configurable: true,
    value: async () => [{ frameId: 0, result: {} }],
  });
  Object.defineProperty(chrome.bookmarks, 'getTree', {
    configurable: true,
    value: async (): Promise<BookmarkNode[]> => structuredClone(tree),
  });
  Object.defineProperty(chrome.bookmarks, 'get', {
    configurable: true,
    value: async (ids: string | string[]): Promise<BookmarkNode[]> => {
      const found = (Array.isArray(ids) ? ids : [ids])
        .map((id) => nodes.get(id))
        .filter((node): node is BookmarkNode => node !== undefined);
      return structuredClone(found);
    },
  });
  Object.defineProperty(chrome.bookmarks, 'create', {
    configurable: true,
    value: async (input: CreateInput): Promise<BookmarkNode> => {
      const pending = deferred<BookmarkNode>();
      saveCalls.push({ ...input });
      saves.push(pending);
      return await pending.promise;
    },
  });
  Object.defineProperty(window, 'close', {
    configurable: true,
    value: () => { closeCalls++; },
  });

  (globalThis as unknown as MockScope).__modernization = {
    read: () => ({
      availabilityCalls, createCalls, promptCalls, saveCalls: structuredClone(saveCalls),
      createAborted: createSignal?.aborted ?? false,
      promptAborted: promptSignal?.aborted ?? false,
      destroyedSessions, progressEvents, closeCalls,
    }),
    finishAi: (stage, outcome, value) => {
      const error = new Error(`迟到的 ${stage} 测试异常`);
      if (stage === 'detect') {
        if (outcome === 'reject') availability.reject(error);
        else availability.resolve(value ?? 'available');
      } else if (stage === 'create') {
        if (outcome === 'reject') creation.reject(error);
        else creation.resolve(session);
      } else {
        if (outcome === 'reject') inference.reject(error);
        else inference.resolve(value ?? '{"folderId":"22","confidence":91}');
      }
    },
    finishSave: (index, outcome) => {
      const pending = saves[index];
      const input = saveCalls[index];
      if (!pending || !input) throw new Error(`尚未开始第 ${index + 1} 次保存`);
      if (outcome === 'reject') pending.reject(new Error('模拟书签写入失败'));
      else pending.resolve({ id: `saved-${index}`, title: input.title ?? '', syncing: false, ...input });
    },
    progress: (loaded) => {
      for (const listener of progressListeners) {
        progressEvents++;
        listener({ loaded });
      }
    },
    flush: async () => {
      // abort race 会在旧 promise 完成前 reject。跨任务屏障让 catch/finally 与其
      // 微任务先完成，不能只把 finishAi() 当作所有 continuation 的完成信号。
      for (let turn = 0; turn < 3; turn++) {
        await new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            channel.port2.close();
            resolve();
          };
          channel.port2.postMessage(null);
        });
      }
    },
  };
};

const openPopup = async (context: BrowserContext, popupUrl: string, config: MockConfig = {}) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (config.freezeClock) {
    const time = new Date('2026-11-11T00:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date('2026-11-11T00:01:00Z'));
  }
  await page.addInitScript(installModernizationMocks, config);
  await page.goto(popupUrl);
  await expect(page.locator('#tree input[value="10"]')).toBeVisible();
  return { page, errors };
};

const readMock = async (page: Page): Promise<MockSnapshot> =>
  await page.evaluate(() => (globalThis as unknown as MockScope).__modernization.read());

const flushUi = async (page: Page): Promise<void> => {
  await page.evaluate(async () => await (globalThis as unknown as MockScope).__modernization.flush());
};

const finishAi = async (page: Page, stage: AiStage, outcome: Outcome = 'resolve', value?: string): Promise<void> => {
  await page.evaluate(async ({ stage, outcome, value }) => {
    const hooks = (globalThis as unknown as MockScope).__modernization;
    hooks.finishAi(stage, outcome, value);
    await hooks.flush();
  }, { stage, outcome, value });
};

const finishSave = async (page: Page, outcome: Outcome, index = 0): Promise<void> => {
  await page.evaluate(async ({ index, outcome }) => {
    const hooks = (globalThis as unknown as MockScope).__modernization;
    hooks.finishSave(index, outcome);
    await hooks.flush();
  }, { index, outcome });
};

const emitProgress = async (page: Page, loaded: number): Promise<void> => {
  await page.evaluate(async (loaded) => {
    const hooks = (globalThis as unknown as MockScope).__modernization;
    hooks.progress(loaded);
    await hooks.flush();
  }, loaded);
};

const prepareAiStage = async (page: Page, stage: AiStage): Promise<void> => {
  await expect.poll(async () => (await readMock(page)).availabilityCalls).toBe(1);
  if (stage === 'detect') return;
  await finishAi(page, 'detect', 'resolve', stage === 'create' ? 'downloadable' : 'available');
  if (stage === 'create') {
    await expect(page.locator('#ai-action')).toHaveText('下载本地模型');
    await page.locator('#ai-action').click();
  }
  await expect.poll(async () => (await readMock(page)).createCalls).toBe(1);
  if (stage === 'create') {
    await emitProgress(page, 0.25);
    await expect(page.locator('#progress')).toBeVisible();
    await expect(page.locator('#progress-bar')).toHaveAttribute('aria-valuenow', '25');
    return;
  }
  await finishAi(page, 'create');
  await expect.poll(async () => (await readMock(page)).promptCalls).toBe(1);
  await expect(page.locator('#ai-action')).toHaveText('停止推荐');
};

const readUi = async (page: Page) => await page.evaluate(() => {
  const save = document.getElementById('save');
  const picker = document.getElementById('folder-picker');
  const status = document.getElementById('status');
  const target = document.getElementById('target');
  const action = document.getElementById('ai-action');
  const progress = document.getElementById('progress');
  if (!(save instanceof HTMLButtonElement) || !(picker instanceof HTMLFieldSetElement)
    || !status || !target || !action || !progress) throw new Error('缺少保存状态控件');
  return {
    status: status.textContent,
    tone: status.dataset.tone,
    target: target.textContent,
    folder: document.querySelector<HTMLInputElement>('#tree input:checked')?.value,
    saveDisabled: save.disabled,
    pickerDisabled: picker.disabled,
    saveText: save.textContent,
    actionHidden: action.hidden,
    progressHidden: progress.hidden,
  };
});

const expectLocked = async (page: Page): Promise<void> => {
  await expect(page.locator('fieldset#folder-picker')).toHaveJSProperty('disabled', true);
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#tree input[value="10"]')).toBeDisabled();
  await expect(page.locator('#ai-action')).toBeHidden();
  await expect(page.locator('#progress')).toBeHidden();
};

const toggleFor = (page: Page, id: string) => page.locator('#tree .row')
  .filter({ has: page.locator(`input[value="${id}"]`) }).locator('button.toggle');

test('保存从 idle 进入 saving 和 saved，始终锁定目标且在 900ms 后只关闭一次', async ({ context, popupUrl }) => {
  const { page, errors } = await openPopup(context, popupUrl, { freezeClock: true });
  await prepareAiStage(page, 'prompt');
  await page.locator('#tree input[value="11"]').check();
  await expect(page.locator('fieldset#folder-picker')).toHaveJSProperty('disabled', false);
  await expect(page.locator('#save')).toBeEnabled();
  const target = await page.locator('#target').innerText();

  await page.locator('#save').click();
  await flushUi(page);
  await expect(page.locator('#status')).toHaveText('正在保存…');
  await expectLocked(page);
  expect(await readMock(page)).toMatchObject({ createAborted: true, promptAborted: true });
  expect((await readMock(page)).saveCalls).toEqual([{
    parentId: '11', title: '现代化测试文章', url: 'https://example.com/modernization',
  }]);
  // 除 disabled 的浏览器交互屏障外，保存入口本身也必须拒绝重复提交。
  await page.locator('#save').dispatchEvent('click');
  await flushUi(page);
  expect((await readMock(page)).saveCalls).toHaveLength(1);

  await finishSave(page, 'resolve');
  await expect(page.locator('#status')).toContainText('已保存到「测试收纳箱 / 手动目录」');
  await expect(page.locator('#save')).toHaveText('已保存');
  await expectLocked(page);
  const saved = await readUi(page);
  await finishAi(page, 'prompt');
  await emitProgress(page, 0.99);
  await page.locator('#tree input[value="10"]').evaluate((radio: HTMLInputElement) => radio.click());
  await page.locator('#save').dispatchEvent('click');
  await flushUi(page);
  expect(await readUi(page)).toEqual(saved);
  await expect(page.locator('#target')).toHaveText(target);
  expect((await readMock(page)).saveCalls).toHaveLength(1);

  expect((await readMock(page)).closeCalls).toBe(0);
  await page.clock.runFor(899);
  expect((await readMock(page)).closeCalls).toBe(0);
  await page.clock.runFor(1);
  expect((await readMock(page)).closeCalls).toBe(1);
  await expectLocked(page);
  await page.clock.runFor(900);
  expect((await readMock(page)).closeCalls).toBe(1);
  expect(errors).toEqual([]);
});

test('保存失败恢复选择与保存，保留失败提示，旧 AI 不干扰重新选择及重试', async ({ context, popupUrl }) => {
  const { page, errors } = await openPopup(context, popupUrl);
  await prepareAiStage(page, 'prompt');
  await page.locator('#tree input[value="11"]').check();
  await page.locator('#save').click();
  await flushUi(page);
  await expectLocked(page);
  await finishSave(page, 'reject');

  await expect(page.locator('#status')).toContainText('保存失败：模拟书签写入失败');
  await expect(page.locator('fieldset#folder-picker')).toHaveJSProperty('disabled', false);
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#tree input[value="11"]')).toBeChecked();
  await page.locator('#tree input[value="20"]').check();
  const failed = await readUi(page);
  await finishAi(page, 'prompt');
  await emitProgress(page, 0.85);
  expect(await readUi(page)).toEqual(failed);
  await expect(page.locator('#status')).toContainText('保存失败：模拟书签写入失败');
  expect((await readMock(page)).closeCalls).toBe(0);

  await page.locator('#save').click();
  await flushUi(page);
  expect((await readMock(page)).saveCalls).toEqual([
    { parentId: '11', title: '现代化测试文章', url: 'https://example.com/modernization' },
    { parentId: '20', title: '现代化测试文章', url: 'https://example.com/modernization' },
  ]);
  await finishSave(page, 'resolve', 1);
  await expect(page.locator('#status')).toContainText('已保存到「参考资料」');
  await expectLocked(page);
  expect(errors).toEqual([]);
});

const lateCases: Array<{ name: string; stage: AiStage; outcome: Outcome; value?: string }> = [
  { name: 'detect 可用', stage: 'detect', outcome: 'resolve', value: 'available' },
  { name: 'detect 可下载', stage: 'detect', outcome: 'resolve', value: 'downloadable' },
  { name: 'detect 下载中', stage: 'detect', outcome: 'resolve', value: 'downloading' },
  { name: 'detect 异常', stage: 'detect', outcome: 'reject' },
  { name: '创建完成', stage: 'create', outcome: 'resolve' },
  { name: '创建异常', stage: 'create', outcome: 'reject' },
  { name: '推理完成', stage: 'prompt', outcome: 'resolve' },
  { name: '推理异常', stage: 'prompt', outcome: 'reject' },
];

for (const saveState of ['saving', 'saved', 'failed'] as const) {
  for (const late of lateCases) {
    test(`${saveState} 不被迟到的 ${late.name} 或下载进度覆盖`, async ({ context, popupUrl }) => {
      const { page, errors } = await openPopup(context, popupUrl);
      await prepareAiStage(page, late.stage);
      await expect(page.locator('#save')).toBeEnabled();
      await page.locator('#save').click();
      // 先等待 abort race 的 catch/finally，而不是依赖尚未完成的底层 promise。
      await flushUi(page);
      await expect(page.locator('#status')).toHaveText('正在保存…');
      await expectLocked(page);
      if (late.stage !== 'detect') expect((await readMock(page)).createAborted).toBe(true);
      if (late.stage === 'prompt') expect((await readMock(page)).promptAborted).toBe(true);

      if (saveState === 'saved') {
        await finishSave(page, 'resolve');
        await expect(page.locator('#status')).toContainText('已保存到');
        await expectLocked(page);
      } else if (saveState === 'failed') {
        await finishSave(page, 'reject');
        await expect(page.locator('#status')).toContainText('保存失败：模拟书签写入失败');
        await expect(page.locator('fieldset#folder-picker')).toHaveJSProperty('disabled', false);
        await expect(page.locator('#save')).toBeEnabled();
      }
      const before = await readUi(page);
      await finishAi(page, late.stage, late.outcome, late.value);
      const progressBefore = (await readMock(page)).progressEvents;
      // create/prompt 的 monitor 保留原监听器，能真实发送取消后的迟到回调。
      await emitProgress(page, 0.97);
      expect(await readUi(page)).toEqual(before);
      const mock = await readMock(page);
      expect(mock.saveCalls).toHaveLength(1);
      expect(mock.createCalls).toBe(late.stage === 'detect' ? 0 : 1);
      expect(mock.promptCalls).toBe(late.stage === 'prompt' ? 1 : 0);
      if (late.stage !== 'detect') expect(mock.progressEvents).toBeGreaterThan(progressBefore);
      if (late.stage === 'create' && late.outcome === 'resolve') {
        expect(mock.destroyedSessions).toBeGreaterThan(0);
      }
      if (saveState === 'saving') {
        await finishSave(page, 'resolve');
        await expect(page.locator('#status')).toContainText('已保存到');
        await expectLocked(page);
      }
      expect(errors).toEqual([]);
    });
  }
}

test('tabs.query 拒绝时说明原因、保留目录浏览、禁止保存且无 pageerror', async ({ context, popupUrl }) => {
  const reason = '模拟 tabs.query 读取被拒绝';
  const { page, errors } = await openPopup(context, popupUrl, { queryError: reason });
  await expect(page.locator('#page-title')).toHaveText('无法读取当前页面');
  await expect(page.locator('#status')).toContainText('无法读取当前页面');
  await expect(page.locator('#status')).toContainText(reason);
  await expect(page.locator('#status')).toContainText('可以浏览收藏夹，但无法保存');
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('fieldset#folder-picker')).toHaveJSProperty('disabled', false);
  await toggleFor(page, '20').click();
  await expect(page.locator('#tree input[value="21"]')).toBeVisible();
  await page.locator('#tree input[value="21"]').check();
  await expect(page.locator('#target')).toContainText('参考资料 / 技术');
  await expect(page.locator('#save')).toBeDisabled();
  await flushUi(page);
  expect(await readMock(page)).toMatchObject({ availabilityCalls: 0, saveCalls: [] });
  expect(errors).toEqual([]);
});

test('none 保留手动选择并准确提示，不声称已回退默认目录', async ({ context, popupUrl }) => {
  const { page, errors } = await openPopup(context, popupUrl);
  await prepareAiStage(page, 'prompt');
  await page.locator('#tree input[value="11"]').check();
  const target = await page.locator('#target').innerText();
  await finishAi(page, 'prompt', 'resolve', '{"folderId":"none","confidence":0}');
  await expect(page.locator('#tree input[value="11"]')).toBeChecked();
  await expect(page.locator('#target')).toHaveText(target);
  await expect(page.locator('#status')).toContainText('都不合适');
  await expect(page.locator('#status')).toContainText('已保留你的选择');
  await expect(page.locator('#status')).not.toContainText('置信度');
  await expect(page.locator('#save')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('没有手动选择时 none 使用实际默认目录，不硬编码收藏栏', async ({ context, popupUrl }) => {
  const { page, errors } = await openPopup(context, popupUrl);
  await prepareAiStage(page, 'prompt');
  await expect(page.locator('#tree input[value="10"]')).toBeChecked();
  const target = await page.locator('#target').innerText();
  const defaultPath = target.replace(/^目标：/, '');
  expect(defaultPath).toBe('测试收纳箱');
  await finishAi(page, 'prompt', 'resolve', '{"folderId":"none","confidence":0}');
  await expect(page.locator('#tree input[value="10"]')).toBeChecked();
  await expect(page.locator('#target')).toHaveText(target);
  await expect(page.locator('#status')).toContainText('都不合适');
  await expect(page.locator('#status')).toContainText(defaultPath);
  await expect(page.locator('#status')).not.toContainText('收藏栏');
  await expect(page.locator('#status')).not.toContainText('置信度');
  expect(errors).toEqual([]);
});

test('AI 就地展开祖先、保留原 disclosure 焦点，并保持 fieldset 与原生单选语义', async ({ context, popupUrl }) => {
  const { page, errors } = await openPopup(context, popupUrl);
  await prepareAiStage(page, 'prompt');
  const group = page.getByRole('group', { name: '选择收藏位置', exact: true });
  await expect(group).toHaveJSProperty('tagName', 'FIELDSET');
  await expect(page.locator('fieldset#folder-picker > legend')).toHaveText('选择收藏位置');
  await expect(group.locator('input[type="radio"][name="folder"]')).toHaveCount(5);
  await expect(page.getByRole('radio', { includeHidden: true })).toHaveCount(5);
  await expect(page.locator('[role="tree"], [role="treeitem"], [role="radio"], [role="radiogroup"]')).toHaveCount(0);

  for (const toggle of await page.locator('#tree .toggle[aria-expanded]').all()) {
    expect(await toggle.evaluate((node) => {
      const id = node.getAttribute('aria-controls');
      const children = id ? document.getElementById(id) : null;
      return children instanceof HTMLUListElement
        && children === node.closest('li')?.querySelector(':scope > ul')
        && document.querySelectorAll(`#${CSS.escape(children.id)}`).length === 1;
    })).toBe(true);
  }

  const toggle = toggleFor(page, '20');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggleFor(page, '21')).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  const originalToggle = await toggle.elementHandle();
  if (!originalToggle) throw new Error('缺少参考资料的展开按钮');
  const originalNodes = await page.locator('#tree').evaluateHandle((node) => Array.from(node.querySelectorAll('*')));
  await finishAi(page, 'prompt');

  await expect(page.locator('#status')).toContainText('置信度 91%');
  await expect(page.locator('#tree input[value="22"]')).toBeChecked();
  await expect(page.locator('#tree input[value="22"]')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggleFor(page, '21')).toHaveAttribute('aria-expanded', 'true');
  expect(await originalToggle.evaluate((node) => node.isConnected && document.activeElement === node)).toBe(true);
  expect(await page.locator('#tree').evaluate((node, original) => {
    const current = Array.from(node.querySelectorAll('*'));
    return current.length === original.length && current.every((entry, index) => entry === original[index]);
  }, originalNodes)).toBe(true);
  await originalToggle.dispose();
  await originalNodes.dispose();
  expect(errors).toEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme} 使用显式保存 hover token、无 brightness，减少动画时禁用进度 transition`, async ({ context, popupUrl }) => {
    const { page, errors } = await openPopup(context, popupUrl);
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await expect(page.locator('#save')).toBeEnabled();
    await page.mouse.move(0, 0);
    const normalBackground = await page.locator('#save').evaluate((node) => getComputedStyle(node).backgroundColor);
    await page.locator('#save').hover();
    await expect(page.locator('#save')).toHaveCSS('filter', 'none');
    await expect(page.locator('#save')).not.toHaveCSS('background-color', normalBackground);
    const hover = await page.evaluate(() => {
      const hoverRules: CSSStyleRule[] = [];
      const collect = (rules: CSSRuleList): void => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('#save:hover')) hoverRules.push(rule);
          else if (rule instanceof CSSMediaRule && matchMedia(rule.conditionText).matches) collect(rule.cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) collect(sheet.cssRules);
      const rule = hoverRules[hoverRules.length - 1];
      const background = rule?.style.getPropertyValue('background-color') || rule?.style.getPropertyValue('background') || '';
      const token = /var\(\s*(--[\w-]+)/.exec(background)?.[1] ?? '';
      const value = token ? getComputedStyle(document.documentElement).getPropertyValue(token).trim() : '';
      const probe = document.createElement('span');
      if (token) probe.style.backgroundColor = `var(${token})`;
      document.body.append(probe);
      const resolved = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { token, value, resolved };
    });
    expect(hover.token).toMatch(/^--[\w-]+$/);
    expect(hover.value).not.toBe('');
    await expect(page.locator('#save')).toHaveCSS('background-color', hover.resolved);

    await prepareAiStage(page, 'create');
    await emitProgress(page, 0.4);
    await expect(page.locator('#progress-bar')).toHaveAttribute('aria-valuenow', '40');
    await expect(page.locator('#progress-fill')).toHaveCSS('transition-property', 'none');
    await expect(page.locator('#progress-fill')).toHaveCSS('transition-duration', '0s');
    expect(errors).toEqual([]);
  });
}
