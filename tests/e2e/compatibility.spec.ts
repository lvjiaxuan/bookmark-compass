import { expect, test } from './fixtures.ts';

test('真实浏览器加载扩展并记录原生 AI 能力', async ({ context, popupUrl, channel }, testInfo) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(popupUrl);
  await expect(page.locator('#tree input[type="radio"]').first()).toBeVisible();

  const report = await page.evaluate(async () => {
    const scope = globalThis as unknown as Record<string, any>;
    const entries = [
      ['LanguageModel', scope.LanguageModel],
      ['ai.languageModel', scope.ai?.languageModel],
      ['chrome.aiOriginTrial.languageModel', scope.chrome?.aiOriginTrial?.languageModel],
    ] as const;
    const entry = entries.find(([, api]) => typeof api?.create === 'function');
    let availability: unknown = null;
    let error: string | null = null;
    try {
      availability = entry?.[1].availability
        ? await entry[1].availability()
        : await entry?.[1].capabilities?.();
    } catch (cause) {
      error = String(cause);
    }
    return {
      userAgent: navigator.userAgent,
      extensionId: chrome.runtime.id,
      permissions: await chrome.permissions.getAll(),
      ai: { entry: entry?.[0] ?? null, availability: availability ?? null, error },
    };
  });
  await testInfo.attach('browser-capabilities', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  expect(report.permissions.permissions).toEqual(expect.arrayContaining(['bookmarks', 'activeTab', 'scripting']));
  if (channel === 'msedge') expect(report.userAgent).toContain('Edg/');
  if (channel === 'chrome') {
    expect(report.userAgent).toMatch(/(?:Headless)?Chrome\//);
    expect(report.userAgent).not.toContain('Edg/');
  }
  // 不支持 AI 也应能正常初始化；能力记录不代表模型下载或推理通过。
  if (!report.ai.entry) {
    await expect(page.locator('#status')).toContainText('当前浏览器没有提供本地 AI 接口');
    await expect(page.locator('#ai-action')).toHaveText('打开 AI 开关');
  }
  expect(errors).toEqual([]);
});
