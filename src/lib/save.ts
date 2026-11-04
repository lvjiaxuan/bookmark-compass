export type SaveAdapter = {
  get: (id: string) => Promise<Array<{ id: string; url?: string }>>;
  create: (input: { parentId: string; title: string; url: string }) => Promise<{ id: string }>;
};

export type SaveResult = { ok: true; id: string } | { ok: false; reason: string };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * 保存前重新确认目标仍是存在的文件夹，避免收藏夹在面板打开期间被改动。
 * 失败只返回原因，由调用方保留面板状态，不重试、不重复创建。
 */
export async function saveBookmark(
  adapter: SaveAdapter,
  targetId: string,
  page: { title: string; url: string },
): Promise<SaveResult> {
  if (!targetId) return { ok: false, reason: '还没有选择收藏夹' };
  if (!page.url) return { ok: false, reason: '当前页面没有可保存的网址' };

  let nodes: Array<{ id: string; url?: string }>;
  try {
    nodes = await adapter.get(targetId);
  } catch {
    return { ok: false, reason: '目标文件夹已不存在，请重新选择' };
  }

  const node = nodes[0];
  if (!node) return { ok: false, reason: '目标文件夹已不存在，请重新选择' };
  if (node.url) return { ok: false, reason: '目标不是文件夹，请重新选择' };

  try {
    const created = await adapter.create({ parentId: targetId, title: page.title || page.url, url: page.url });
    return { ok: true, id: created.id };
  } catch (error) {
    return { ok: false, reason: `保存失败：${messageOf(error)}` };
  }
}
