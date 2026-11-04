export const BOOKMARK_BAR_ID = '1';

/** 可选择的收藏夹文件夹（已排除总根节点）。 */
export type FolderNode = {
  id: string;
  name: string;
  /** 完整层级路径，例如「收藏栏 / 开发 / 前端」。 */
  path: string;
  depth: number;
  children: FolderNode[];
};

export type PageInfo = {
  title: string;
  url: string;
  siteName?: string;
  description?: string;
  keywords?: string;
};
