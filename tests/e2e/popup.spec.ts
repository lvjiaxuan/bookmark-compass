import { expect, test } from './fixtures.ts';

/** 弹窗读的是 activeTab；直接打开扩展页面时它读到的就是自己，测试里替换成普通网页。 */
const fakeActiveTab = (): void => {
  const query = chrome.tabs.query.bind(chrome.tabs);
  Object.defineProperty(chrome.tabs, 'query', {
    configurable: true,
    value: async (info: chrome.tabs.QueryInfo) =>
      (await query(info)).map((tab) => ({ ...tab, url: 'https://example.com/article', title: '示例文章' })),
  });
};

type FakeAiConfig = { availability: string; reply: string };

/** 用假的 LanguageModel 替换真实模型，让下载、进度和推荐流程可以稳定复现。 */
const fakeAi = ({ availability, reply }: FakeAiConfig): void => {
  (globalThis as Record<string, unknown>).LanguageModel = {
    availability: async () => availability,
    create: async (options?: Record<string, any>) => {
      const scope = globalThis as Record<string, unknown>;
      scope.lastCreateOptions = options;
      options?.monitor?.({
        addEventListener: (_type: string, listener: (event: { loaded: number }) => void) => listener({ loaded: 0.4 }),
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        prompt: async (_text: string, promptOptions?: Record<string, unknown>) => {
          scope.lastPromptOptions = promptOptions;
          return reply;
        },
        destroy: () => undefined,
      };
    },
  };
};

test('默认选中收藏栏；AI 接口报错时给出开关提示', async ({ context, popupUrl }) => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: async () => {
        throw new Error('本地 AI 被关闭');
      },
      create: async () => ({ prompt: async () => '', destroy: () => undefined }),
    };
  });
  await page.goto(popupUrl);

  await expect(page.locator('#tree input[type="radio"]').first()).toBeVisible();
  await expect(page.locator('#tree input[value="1"]')).toBeChecked();
  await expect(page.locator('#status')).toContainText('本地 AI 接口当前不可用');
  await expect(page.locator('#ai-action')).toHaveText('打开 AI 开关');
  const flags = await page.evaluate(() => navigator.userAgent.includes('Edg/'))
    ? 'edge://flags/#edge-llm-prompt-api-for-default'
    : 'chrome://flags/#prompt-api-for-gemini-nano';
  await expect(page.locator('#status')).toContainText(flags);
  await expect(page.locator('#ai-quota')).toBeHidden();
});

test('模型可下载时由按钮触发下载，显示进度并选中推荐文件夹', async ({ context, popupUrl }) => {
  const page = await context.newPage();
  await page.addInitScript(fakeAi, { availability: 'downloadable', reply: '{"folderId":"1","confidence":88}' });
  await page.goto(popupUrl);

  const action = page.locator('#ai-action');
  await expect(action).toHaveText('下载本地模型');
  await expect(page.locator('#ai-quota')).toBeHidden();
  await action.click();

  await expect(page.locator('#progress-bar')).toHaveAttribute('aria-valuenow', '40');
  await expect(page.locator('#status')).toContainText('置信度 88%');
  await expect(page.locator('#tree input[value="1"]')).toBeChecked();
  const options = JSON.parse(await page.evaluate(() => {
    const scope = globalThis as Record<string, any>;
    return JSON.stringify({ create: scope.lastCreateOptions, prompt: scope.lastPromptOptions });
  })) as { create: { temperature: number; topK: number }; prompt: { responseConstraint: { properties: { folderId: { enum: string[] }; confidence: { minimum: number; maximum: number } }; additionalProperties: boolean } } };
  expect(options.create.temperature).toBe(0.2);
  expect(options.create.topK).toBe(3);
  expect(options.prompt.responseConstraint.properties.folderId.enum).toContain('1');
  expect(options.prompt.responseConstraint.properties.folderId.enum).toContain('none');
  expect(options.prompt.responseConstraint.properties.confidence).toMatchObject({ minimum: 0, maximum: 100 });
  expect(options.prompt.responseConstraint.additionalProperties).toBe(false);
  await expect(page.locator('#progress')).toBeHidden();
});

test('模型返回 none 时回退收藏栏根目录，且不显示百分比', async ({ context, popupUrl }) => {
  const page = await context.newPage();
  await page.addInitScript(fakeAi, { availability: 'available', reply: '{"folderId":"none","confidence":0}' });
  await page.goto(popupUrl);

  await expect(page.locator('#status')).toContainText('都不合适');
  await expect(page.locator('#status')).not.toContainText('置信度');
  await expect(page.locator('#ai-quota')).toHaveText('当前浏览器未提供会话配额');
  await expect(page.locator('#tree input[value="1"]')).toBeChecked();
});

test('保存会在所选文件夹下创建书签', async ({ context, popupUrl }) => {
  const page = await context.newPage();
  await page.addInitScript(fakeActiveTab);
  await page.goto(popupUrl);

  await expect(page.locator('#page-title')).toHaveText('示例文章');
  await expect(page.locator('#tree input[value="1"]')).toBeChecked();
  await page.locator('#save').click();
  await expect(page.locator('#status')).toContainText('已保存到');

  const verifier = await context.newPage();
  await verifier.goto(popupUrl);
  const found = await verifier.evaluate(() => chrome.bookmarks.search('示例文章'));
  expect(found).toHaveLength(1);
  expect(found[0]?.parentId).toBe('1');
});

for (const fails of [false, true]) {
  test(`会话配额在推理${fails ? '失败' : '成功'}后更新并在销毁后保留`, async ({ context, popupUrl }) => {
    const page = await context.newPage();
    await page.addInitScript((fails) => {
      const scope = globalThis as Record<string, unknown>;
      scope.LanguageModel = {
        availability: async () => 'available',
        create: async () => {
          const session = {
            contextUsage: 0,
            contextWindow: 4096,
            prompt: async () => {
              await new Promise<void>((resolve) => { scope.finishPrompt = resolve; });
              session.contextUsage = 640;
              if (fails) throw new Error('测试推理失败');
              return '{"folderId":"1","confidence":88}';
            },
            destroy: () => { session.contextUsage = 0; scope.sessionDestroyed = true; },
          };
          return session;
        },
      };
    }, fails);
    await page.goto(popupUrl);

    const quota = page.locator('#ai-quota');
    await expect(quota).toHaveText('会话配额：已用 0 / 4,096 · 剩余 4,096');
    await page.evaluate(() => ((globalThis as Record<string, unknown>).finishPrompt as () => void)());
    if (fails) await expect(page.locator('#status')).toContainText('测试推理失败');
    await expect(quota).toHaveText('会话配额：已用 640 / 4,096 · 剩余 3,456');
    expect(await page.evaluate(() => (globalThis as Record<string, unknown>).sessionDestroyed)).toBe(true);
    expect(await quota.evaluate((node) => node === node.parentElement?.lastElementChild)).toBe(true);
  });
}
test('会话配额字段缺失时显示说明', async ({ context, popupUrl }) => {
  const page = await context.newPage();
  await page.addInitScript(fakeAi, { availability: 'available', reply: '{"folderId":"none","confidence":0}' });
  await page.goto(popupUrl);
  await expect(page.locator('#ai-quota')).toHaveText('当前浏览器未提供会话配额');
});
test('停止推荐会中止推理并释放会话', async ({ context, popupUrl }) => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    const scope = globalThis as Record<string, unknown>;
    scope.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        contextUsage: 20,
        contextWindow: 4096,
        prompt: async (_text: string, options?: { signal?: AbortSignal }) => await new Promise<string>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')), { once: true });
        }),
        destroy: () => { scope.sessionDestroyed = true; },
      }),
    };
  });
  await page.goto(popupUrl);
  await expect(page.locator('#ai-action')).toHaveText('停止推荐');
  await page.locator('#ai-action').click();
  await expect(page.locator('#status')).toHaveText('已停止本次推荐。');
  await expect(page.locator('#ai-action')).toBeHidden();
  expect(await page.evaluate(() => (globalThis as Record<string, unknown>).sessionDestroyed)).toBe(true);
});