import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { chromium, test as base, type BrowserContext } from '@playwright/test';

/** 扩展 ID 由公钥 DER 的 SHA-256 前 16 字节得到，每半字节映射到 a–p。 */
export function extensionIdFromKey(key: string): string {
  const digest = createHash('sha256').update(Buffer.from(key, 'base64')).digest().subarray(0, 16);
  return [...digest].map((byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
}

export const test = base.extend<{ context: BrowserContext; popupUrl: string; extensionPath: string }>({
  extensionPath: async ({ channel }, use) => {
    const browser = channel === 'msedge' ? 'edge' : 'chrome';
    const extensionPath = path.resolve(process.cwd(), 'dist', browser);
    if (!existsSync(path.join(extensionPath, 'manifest.json'))) {
      throw new Error(`找不到 dist/${browser}/manifest.json，请先运行 npm run build`);
    }
    await use(extensionPath);
  },
  context: async ({ channel, headless, extensionPath }, use) => {
    // 独立 profile，避免读取或修改用户浏览器中的收藏夹和设置。
    const profileDir = mkdtempSync(path.join(process.cwd(), '.e2e-profile-'));
    let context: BrowserContext | undefined;
    try {
      const bundled = channel === 'chromium';
      context = await chromium.launchPersistentContext(profileDir, {
        channel,
        headless,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: bundled
          ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
          : ['--enable-unsafe-extension-debugging'],
      });
      await use(context);
    } finally {
      try {
        await context?.close();
      } finally {
        rmSync(profileDir, { recursive: true, force: true });
      }
    }
  },
  popupUrl: async ({ context, channel, extensionPath }, use) => {
    const manifest = JSON.parse(readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8')) as {
      key?: string;
      action?: { default_popup?: string };
    };
    if (!manifest.action?.default_popup) throw new Error('manifest 缺少 default_popup');
    let extensionId: string;
    if (channel === 'chromium') {
      if (!manifest.key) throw new Error('Chromium 测试需要 manifest.key 来确定扩展 ID');
      extensionId = extensionIdFromKey(manifest.key);
    } else {
      // 品牌浏览器改用 CDP 安装，并读取实际 ID（Edge 产物会移除 key）。
      const session = await context.browser()!.newBrowserCDPSession();
      try {
        const installed = await session.send('Extensions.loadUnpacked', { path: extensionPath });
        extensionId = installed.id;
      } catch (cause) {
        throw new Error(`${channel} 无法通过 CDP 加载扩展；请检查浏览器版本及企业策略。`, { cause });
      } finally {
        await session.detach();
      }
    }
    await use(`chrome-extension://${extensionId}/${manifest.action.default_popup}`);
  },
});

export const expect = test.expect;
