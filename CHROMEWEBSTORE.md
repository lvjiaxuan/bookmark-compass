# Chrome Web Store Listing — Bookmark Compass

> Last Updated: 2026-11-12
>
> 本文件是 Chrome Web Store 商店元数据、权限说明、隐私披露和版本记录的单一来源。当前仅为草稿，不代表已提交、审核或发布。

## Store Listing

**Extension Name** [REQUIRED]

Bookmark Compass

**Short Description** [REQUIRED]

用浏览器本地 AI 为当前网页推荐合适的收藏夹位置。

> 来源：`src/manifest.json` 的 `description`；提交前仍需在商店表单中确认字符数限制。

**Detailed Description** [REQUIRED]

Bookmark Compass 帮你把当前网页保存到合适的浏览器收藏夹，减少手动查找文件夹的时间。

在普通网页上打开扩展后，它会读取当前页面的标题、网址以及页面中存在的标准 meta 信息，并显示浏览器中的收藏夹文件夹树。如果浏览器提供受支持的内置本地 AI，扩展会从实际存在的文件夹中推荐一个位置，并显示置信度。推荐只是预选：你可以接受推荐、改选其他文件夹，或完全手动选择后再保存。

本地 AI 不可用、模型尚未下载、下载失败或推理出错时，仍可手动选择收藏夹并保存。模型没有合适推荐时，会保留你的手动选择；尚未手动选择时使用当前默认目录。只有点击保存后才会创建书签；保存开始后锁定目标并停止推荐，迟到的推荐不会改变保存目标或提示。成功后防止重复提交，失败后可重试；关闭面板不会修改收藏夹。自动展开推荐路径时保留键盘焦点，界面提供明确的控件分组与关联，并尊重减少动态效果偏好。浏览器内部页面等不允许读取或注入的页面可能无法保存。

扩展只处理完成上述工作流所需的信息。当前页面信息和收藏夹目录在浏览器本地处理，不上传到开发者运营的服务器；扩展不使用分析统计、广告、远程代码或云端存储。扩展不会读取网页正文。

支持与隐私问题请参阅项目中的 `PRIVACY.md`。公开隐私政策地址尚未提供，发布前必须补齐并核验。

**Category** [REQUIRED]

Productivity

**Single Purpose** [REQUIRED]

帮助用户选择浏览器收藏夹文件夹并将当前网页保存到该位置。

**Primary Language** [REQUIRED]

中文（简体）。

## Graphics & Assets

尺寸和实际渲染效果均未运行检查；以下状态均为“待核验”，不能视为符合商店要求。

| Asset                          | Dimensions                                         | Status                                        | Filename                                                  |
| ------------------------------ | -------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| Store Icon [REQUIRED]          | 待核验（文件名为 `icon128.png`）                   | 🟡 待核验；未做像素尺寸与渲染检查             | `src/icons/icon128.png`                                   |
| Extension icon                 | 待核验（文件名为 `icon16.png`）                    | 🟡 待核验；清单实际引用                       | `src/icons/icon16.png`                                    |
| Extension icon                 | 待核验（文件名为 `icon32.png`）                    | 🟡 待核验；清单实际引用                       | `src/icons/icon32.png`                                    |
| Extension icon                 | 待核验（文件名为 `icon48.png`）                    | 🟡 待核验；清单实际引用                       | `src/icons/icon48.png`                                    |
| Screenshot 1 [REQUIRED]        | 待核验（文件名含 `1280x800`）                      | 🟡 需刷新并核验尺寸、渲染和与当前 UI 的一致性 | `store-assets/screenshots/recommendation-ui-1280x800.png` |
| Screenshot 2 [RECOMMENDED]     | 待核验（文件名含 `640x480`，不等同于商店推荐尺寸） | 🟡 需刷新并核验尺寸、渲染和与当前 UI 的一致性 | `store-assets/screenshots/recommendation-ui-640x480.png`  |
| Small Promo Tile [RECOMMENDED] | 未提供                                             | ⬜ 待确认                                     | 未发现实际文件                                            |
| Marquee Promo Tile             | 未提供                                             | ⬜ 待确认                                     | 未发现实际文件                                            |

### Screenshot Notes

- `recommendation-ui-1280x800.png` 应展示当前网页信息、收藏夹树、AI 推荐和保存前确认流程；本文件不把文件名当作尺寸验证结果。
- `recommendation-ui-640x480.png` 为仓库中实际存在的第二张截图，但其文件名尺寸不符合模板列出的 `640×400` 推荐规格，需刷新或确认是否上传。
- 本轮阶段 1–2 已改变保存状态、目录展开、焦点和颜色表现，两张截图均待刷新，并需核验尺寸、渲染效果及与更新后 UI 的一致性。

## Permissions Justification

清单实际权限保持为 `bookmarks`、`activeTab`、`scripting`；未声明 `host_permissions`。

| Permission  | Type             | Justification                                                                                                                  |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `bookmarks` | permissions      | 读取浏览器收藏夹文件夹树供用户浏览和选择；保存动作发生时重新确认目标文件夹仍存在且确实是文件夹，然后在用户选定的位置创建书签。 |
| `activeTab` | permissions      | 用户点击工具栏图标打开面板后，读取当前标签页的标题和网址，用于显示页面并生成待保存书签。                                       |
| `scripting` | permissions      | 仅在用户打开面板后读取当前页面已有的标准 meta 信息（如 description、keywords、站点名称），用于补充推荐；不读取网页正文。       |
| 无          | host_permissions | `manifest.json` 未声明主机权限；扩展不需要持续访问任意网站。                                                                   |

## Privacy & Data Use

以下内容根据实际 `PRIVACY.md`、`STORE_LISTING.md` 和已读取的源代码整理。它区分“在设备上处理”与“收集/上传”：扩展会访问并在当前会话中处理必要信息，但不会因此声称完全不访问数据。

### Data Collection

**Does the extension collect user data?** No — 当前没有向开发者运营的服务器收集、上传或建立分析/遥测数据集。

这不等于扩展不访问数据。打开面板时，扩展会在浏览器内处理当前标签页标题和 URL、页面存在的指定 meta 信息、收藏夹文件夹树，以及用户选择的目标和创建书签所需的页面信息。这些输入可能包含任意敏感信息；扩展不主动识别敏感类别，也无针对这些类别的专门收集功能，但可能在必要输入内本地处理它们，不上传到开发者运营的服务器。推荐输入和结果只保留在打开的扩展会话内。

| Data Type                    | Collected?                                                           | Transmitted Off-Device?                                          | Purpose                                        | Shared with Third Parties?             |
| ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| Personally identifiable info | 不主动识别，无专门收集功能；可能出现在必要输入中                     | 不上传至开发者服务器；在浏览器内本地处理                         | 仅随标题、URL、meta 或目录信息用于选址与保存   | 不由扩展对外分享；浏览器自身处理见下文 |
| Health info                  | 不主动识别，无专门收集功能；可能出现在必要输入中                     | 不上传至开发者服务器；在浏览器内本地处理                         | 仅随标题、URL、meta 或目录信息用于选址与保存   | 不由扩展对外分享；浏览器自身处理见下文 |
| Financial info               | 不主动识别，无专门收集功能；可能出现在必要输入中                     | 不上传至开发者服务器；在浏览器内本地处理                         | 仅随标题、URL、meta 或目录信息用于选址与保存   | 不由扩展对外分享；浏览器自身处理见下文 |
| Authentication info          | 不主动识别，无专门收集功能；可能出现在必要输入中                     | 不上传至开发者服务器；在浏览器内本地处理                         | 仅随标题、URL、meta 或目录信息用于选址与保存   | 不由扩展对外分享；浏览器自身处理见下文 |
| Personal communications      | 不主动识别，无专门收集功能；可能出现在必要输入中                     | 不上传至开发者服务器；在浏览器内本地处理                         | 仅随标题、URL、meta 或目录信息用于选址与保存   | 不由扩展对外分享；浏览器自身处理见下文 |
| Location                     | 不主动识别，无专门收集功能；可能出现在必要输入中                     | 不上传至开发者服务器；在浏览器内本地处理                         | 仅随标题、URL、meta 或目录信息用于选址与保存   | 不由扩展对外分享；浏览器自身处理见下文 |
| Web history                  | No collection; current tab URL is accessed for the save workflow     | No developer-server upload；当前页信息可传给浏览器提供的本地模型 | 读取当前打开页面并生成书签/本地推荐            | No                                     |
| User activity                | No analytics or telemetry collection                                 | No                                                               | 不建立使用分析；仅响应用户主动打开、选择和保存 | No                                     |
| Website content              | No collection; reads page title, URL and selected standard meta only | No developer-server upload；页面信息可传给浏览器提供的本地模型   | 显示当前页并辅助本地文件夹推荐                 | No                                     |

### Local Processing and Sharing Details

- 本地处理：浏览器内置本地 AI（如当前浏览器提供并启用）接收当前页标题、URL、选定页面 meta 信息和候选收藏夹文件夹 ID/路径，用于生成推荐。收藏夹页面 URL 不发送给推荐模型。
- 不上传：Bookmark Compass 不把页面信息、收藏夹数据或模型结果上传到开发者运营的服务器。
- 不收集：不使用分析、遥测、广告、云端存储或开发者账户；不建立跨会话的用户数据集。
- 浏览器自身：浏览器可能依其自身隐私政策处理书签和本地模型相关数据；这不应被表述为扩展完全不访问数据。

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]

待确认：仓库中有 `PRIVACY.md`，但尚未提供或核验公开可访问的 live URL。发布前必须提供与 `PRIVACY.md` 内容一致的公开 URL，并确认页面可访问；本草稿不把 GitHub 仓库路径当作已验证的隐私政策地址。

## Distribution

**Visibility**: 待确认
**Regions**: 待确认

## Developer Info

**Publisher Name** [REQUIRED]

待确认：项目文件未提供发布者名称。

**Contact Email** [REQUIRED]

待确认：项目文件未提供公开联系邮箱；不得臆造。

**Support URL / Email** [RECOMMENDED]

https://github.com/lvjiaxuan/bookmark-compass/issues

> 来源：`PRIVACY.md` 的联系信息；公开可用性仍需在发布前确认。

**Homepage URL** [RECOMMENDED]

待确认：未从实际文件确认独立主页 URL。

## Version History

| Version | Date       | Changes                                                                                                                                                                                                                                                                              | Status                  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 0.1.0   | 2026-11-12 | 当前工作区草稿：阶段 1–2 实现完成，包括保存状态与异步事务边界、失败重试、目录原地展开与焦点保留、fieldset/legend 与 aria-controls、显式 hover 配色和 reduced-motion；类型检查、单元测试、Chrome / Edge 构建及 Chromium / 系统 Edge 完整 E2E 通过，系统 Chrome 未安装、E2E 未能启动。 | Draft（本轮未执行发布） |

当前版本保持 0.1.0；本轮未生成 release 或执行发布。本表记录当前工作区草稿，不据此推断项目此前的发布历史。

## Review Notes

### Known Issues / Limitations

- 阶段 1 已实现 `idle` / `saving` / `saved` 保存状态、保存开始锁定目标并取消推荐、迟到 AI 结果隔离，以及失败后恢复可重试；相关回归已在 Chromium / 系统 Edge 完整 E2E 中通过。
- 阶段 2 已实现目录原地展开和焦点保留，使用 `fieldset` / `legend` 命名文件夹单选组，并以 `aria-controls` 关联展开按钮和子列表；相关回归已在 Chromium / 系统 Edge 完整 E2E 中通过。
- 显式 hover 配色和 `prefers-reduced-motion` 处理已通过自动化回归；辅助技术与实测对比度仍未验收，不声称无障碍验收已通过。
- 旧 AI 适配路径、现有依赖和浏览器基线保持不变；本轮不删除旧适配、不升级依赖、不扩大权限。
- 浏览器本地 AI 的可用性、模型下载和真实推理依赖目标浏览器、版本、硬件和设置；不能据此声称 Chrome / Edge 兼容性已通过。
- `none` 的产品语义：保留用户已有的手动选择；若尚未手动选择，使用实际默认目录（优先收藏栏，否则第一个顶层目录），不能固定宣称一定回退到收藏栏。

### Test / Verification Status

阶段 1–2 实现完成，新增回归用例 `tests/e2e/modernization.spec.ts` 已随 2026-11-12 的 Chromium / 系统 Edge 完整 E2E 通过。以下列出相关自动化覆盖场景，不代表真实用户手势、模型或无障碍验收均已完成：

1. 保存状态按 `idle` → `saving` → `saved` 运行；保存成功后不能重复提交。
2. 保存开始后目标固定、推荐取消；保存中或保存成功后到达的 AI 结果不能覆盖事务。
3. 保存失败恢复可重试，并且不会重复创建书签。
4. 聚焦展开按钮时推荐到达，目录原地更新并保留焦点。
5. 手动改选后 AI 返回 `none` 时保留手动目标；无手动选择时使用实际默认目录。
6. `fieldset` / `legend` 和 `aria-controls` 语义、键盘焦点、显式 hover 配色及 reduced-motion 行为。

2026-11-12 本轮验证记录（不是 CWS 发布记录）：

- `npm run check`、`tsc --noEmit` 通过，node 单元测试 36/36 通过。
- `npm run build` 的 Chrome / Edge 构建成功；`activeTab` 访问范围警告及 Edge 自动移除 `key` 属于现有设计，无需为此扩大权限。
- Chromium 完整 E2E 41/41 通过；系统 Edge 完整 E2E 41/41 通过。
- 系统 Chrome E2E 已尝试但无法启动：Playwright 找不到 `C:/Users/PC/AppData/Local/Google/Chrome/Application/chrome.exe`，`Program Files` 与 `Program Files (x86)` 下也无 Chrome。系统未安装 Chrome，不能声称系统 Chrome 回归或全流程通过。
- 已修复新增 E2E 夹具缺少 `syncing` 类型字段的问题；`fieldset` 的 disabled matcher 改用 `toHaveJSProperty`，保留子 radio 的 `toBeDisabled` 断言。
- `git diff --check` 通过；不据此声称另行运行了 Lint 或格式化。

真实工具栏用户手势、真实模型下载与推理、辅助技术与实测对比度、商店截图和发布者信息仍未验收。阶段 3 尚未实施，版本未提升，未商店发布；上述结果不代表 Chrome / Edge 全流程兼容、无障碍或商店合规验收已通过。

### Rejection History

本轮尚未执行 Chrome Web Store 提交或发布；代码仓库提交历史不等同于商店发布历史。此前的商店审核及发布历史待确认。发布者、联系邮箱、公开隐私政策 URL、资产尺寸/渲染状态和分发设置仍待确认。
