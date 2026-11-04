import { BOOKMARK_BAR_ID, type FolderNode } from './types.ts';

/** chrome.bookmarks 返回的节点：带 url 的是书签，不带 url 的是文件夹。 */
export type BookmarkTreeNode = {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkTreeNode[];
};

const isFolder = (node: BookmarkTreeNode): boolean => !node.url;

/**
 * 把 getTree() 的结果转成可展示的文件夹树。
 * 总根节点（id "0"）不可写，因此作为树的容器隐去，只保留收藏栏、其他收藏等一级节点。
 */
export function buildFolderTree(nodes: BookmarkTreeNode[]): FolderNode[] {
  const root = nodes[0];
  if (!root?.children) return [];

  const build = (node: BookmarkTreeNode, parentPath: string, depth: number): FolderNode => {
    const path = parentPath ? `${parentPath} / ${node.title}` : node.title;
    return {
      id: node.id,
      name: node.title,
      path,
      depth,
      children: (node.children ?? []).filter(isFolder).map((child) => build(child, path, depth + 1)),
    };
  };

  return root.children.filter(isFolder).map((node) => build(node, '', 0));
}

export function flattenFolders(tree: FolderNode[]): FolderNode[] {
  const out: FolderNode[] = [];
  const walk = (folders: FolderNode[]): void => {
    for (const folder of folders) {
      out.push(folder);
      walk(folder.children);
    }
  };
  walk(tree);
  return out;
}

/** 收藏栏文件夹本身；取不到时退到第一个一级文件夹。 */
export function defaultTarget(tree: FolderNode[]): FolderNode | null {
  return tree.find((folder) => folder.id === BOOKMARK_BAR_ID) ?? tree[0] ?? null;
}

/** 从一级文件夹到目标文件夹的 id 路径，用于展开推荐分支。 */
export function findPathIds(tree: FolderNode[], folderId: string): string[] {
  const walk = (folders: FolderNode[], trail: string[]): string[] | null => {
    for (const folder of folders) {
      const next = [...trail, folder.id];
      if (folder.id === folderId) return next;
      const found = walk(folder.children, next);
      if (found) return found;
    }
    return null;
  };
  return walk(tree, []) ?? [];
}
