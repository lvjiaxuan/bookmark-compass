# Bookmark Compass Store Listing

Use the matching short description in the manifest and the full description in the Chrome Web Store or Microsoft Edge Add-ons listing.

## Name

Bookmark Compass

## Short description

Use your browser's local AI to recommend the best bookmark folder for the current page.

Chinese alternative:

用浏览器本地 AI 为当前网页推荐合适的收藏夹位置。

## Full description

Bookmark Compass helps you save the current page to the right browser bookmark folder with less manual searching.

Open the extension on any ordinary web page and it reads the page title, URL, and available standard metadata. It also reads your bookmark folders and presents them as a clear folder tree. When the browser provides a supported built-in local AI model, Bookmark Compass recommends a folder from the folders that actually exist in your browser. The recommendation is constrained to the available folder IDs and includes a confidence score. You can review the recommendation, choose another folder, or use the folder tree manually before saving.

The AI recommendation uses the browser's built-in Prompt API and local model. Bookmark Compass does not upload your page information, bookmark data, or recommendation result to a developer-operated server. It does not use analytics, advertising, remote code, or cloud storage. If local AI is unavailable, the extension remains useful as a manual bookmark-folder picker.

The extension requests only the permissions needed for its workflow: bookmarks to read folders and create the bookmark you ask it to save, activeTab to read the tab where you opened the extension, and scripting to read standard metadata such as a page description. It does not read the page body.

## Chinese full description

Bookmark Compass 帮你把当前网页保存到合适的浏览器收藏夹，减少手动查找文件夹的时间。

在普通网页上打开扩展后，它会读取当前页面的标题、网址以及页面中存在的标准 meta 信息，同时读取浏览器中的收藏夹文件夹并显示为清晰的目录树。如果浏览器提供受支持的内置本地 AI 模型，Bookmark Compass 会从实际存在的文件夹中推荐一个合适的位置。推荐结果受到候选文件夹 ID 的约束，并显示置信度。你可以接受推荐、改选其他文件夹，或完全手动选择后再保存。

AI 推荐通过浏览器内置的 Prompt API 和本地模型完成。Bookmark Compass 不会把网页信息、收藏夹数据或推荐结果上传到开发者服务器，也不使用分析统计、广告、远程代码或云端存储。如果本地 AI 不可用，扩展仍然可以作为手动收藏夹选择器使用。

扩展只请求完成工作流所需的权限：使用 bookmarks 读取文件夹并创建你确认保存的书签，使用 activeTab 读取你打开扩展的当前标签页，使用 scripting 读取网页描述等标准 meta 信息。扩展不会读取网页正文。

## Category suggestion

Productivity

## Search terms

bookmark manager, bookmark folder, save bookmark, local AI, browser AI, bookmarks

Chinese search terms:

收藏夹, 书签管理, 书签分类, 本地 AI, 浏览器 AI, 收藏夹文件夹

## Privacy form answers

- Single purpose: Help users choose a browser bookmark folder and save the current page there.
- Remote code: No.
- Analytics or telemetry: No.
- Developer-operated server: No.
- Data sent to a developer-operated server: None.
- Local model input: Current tab title and URL, selected page metadata, and candidate bookmark folder IDs and paths.
- Permission justification: See `PRIVACY.md` and the permission explanations above.

## Certification notes

1. Install the extension and pin it to the browser toolbar.
2. Open a normal web page, then click the Bookmark Compass toolbar icon.
3. The panel displays the current page and the browser's bookmark folders.
4. If the browser's built-in local AI is enabled and available, the panel recommends a folder. Otherwise, choose a folder manually.
5. Click Save to create the bookmark in the selected folder.
6. No account, login, test credentials, or remote service is required.
7. The local AI feature depends on browser support and local model availability. The manual folder selection and save workflow remains available when local AI is unavailable.
