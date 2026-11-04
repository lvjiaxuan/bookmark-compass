export type PageMetadata = {
  description?: string;
  keywords?: string;
  siteName?: string;
};

/**
 * 注入到页面执行：函数体会被序列化后单独运行，不能引用模块内的其他符号。
 * 只读 meta 标签，不碰正文。
 */
export function readMetadataInPage(): PageMetadata {
  const content = (selector: string): string | undefined => {
    const value = document.querySelector(selector)?.getAttribute('content')?.trim();
    return value || undefined;
  };

  return {
    description: content('meta[name="description"]') ?? content('meta[property="og:description"]'),
    keywords: content('meta[name="keywords"]'),
    siteName: content('meta[property="og:site_name"]'),
  };
}

export async function readPageMetadata(tabId: number): Promise<PageMetadata | null> {
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: readMetadataInPage });
    const result = injection?.result;
    return result && typeof result === 'object' ? (result as PageMetadata) : null;
  } catch {
    // 浏览器内部页面、应用商店等不允许注入，按无元数据处理
    return null;
  }
}
