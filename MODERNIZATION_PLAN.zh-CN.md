# 前端现代化审查与改造计划

- 原审查日期：2026-11-11；本轮验证日期：2026-11-12
- 状态：阶段 1–2 实现完成，类型检查、单元测试、Chrome / Edge 构建及 Chromium / 系统 Edge 完整 E2E 通过；系统 Chrome 未安装、E2E 未能启动，阶段 3 尚未实施
- 依据：项目 chrome-extensions 技能、实际源代码、现有测试与 Chrome 官方文档

## 一、结论

仓库适合进行针对性改造，不需要重写前端、引入框架或全面升级依赖。现有实现已经采用 Manifest V3、ES 模块、严格 TypeScript、基于 Promise 的 Chrome API、安全的 DOM 构建方式和现代 CSS。优先稳定保存流程和异步状态，再处理目录树焦点、旧版 AI 兼容层与书签目录识别。

## 二、审查范围与验证边界

已检查 src/ 下的清单、HTML、TypeScript、CSS，以及相关单元测试和 E2E 测试；同时参考 package.json、tsconfig.json、README.md 和 STORE_LISTING.md。清单引用的四个 PNG 图标均存在且可读取，未通过独立工具验证像素尺寸。

2026-11-11 原审查通过源码追踪、检查已有测试和官方文档交叉核对确认结论，当时没有运行浏览器复现，也没有执行构建、测试、类型检查、Lint、格式化或依赖安装；此为历史审查边界。2026-11-12 已完成的类型检查、单元测试、构建及 E2E 结果见第七节，不等同于所有真实环境与商店验收已完成。

## 三、已确认的问题与改进项

> 阶段 1–2 的问题已按下文计划实施代码改造并增加回归用例，相关回归已在 Chromium / 系统 Edge 完整 E2E 中通过。阶段 3 及其余明确待办仍未实施。

### 1. 高优先级：保存完成状态不稳定（已实施，自动化回归通过）

位置：`src/popup/main.ts:66–80、165–189、334–353`。

原实现中，保存成功后 saving 恢复为 false；自动关闭前改选可能重新启用按钮，迟到推荐也可能改写目标或状态。

实施：采用 idle / saving / saved 状态；保存开始固定目标、禁用文件夹选择与保存按钮、隐藏推荐动作及进度并中止当前推荐；通过 AI 代次隔离迟到状态更新；保存失败恢复可编辑并允许重试。新增覆盖成功锁定、失败重试及异步迟到结果的 E2E 用例，已在 Chromium / 系统 Edge 中通过。

### 2. 中优先级：初始化缺少完整错误边界

位置：`src/popup/main.ts:146–163、356–387`。

原实现只捕获读取书签树错误。已为当前标签页读取失败添加明确提示，保留目录浏览并禁用保存；另加顶层初始化错误兜底，避免未处理拒绝。新增 query 拒绝测试，已在 Chromium / 系统 Edge 中通过。

### 3. 中优先级：自动展开目录会移除聚焦控件

位置：`src/popup/main.ts:83–144、176–189`。

已将自动展开改为调用现有节点的展开状态更新，不再重建整棵树，保留原 disclosure 节点与焦点。新增检查节点身份、焦点和 aria-controls 关系的 E2E 用例，已在 Chromium / 系统 Edge 中通过。

### 4. 中优先级：无推荐结果的提示与实际选择可能不一致

位置：`src/popup/main.ts:165–185`。

原 none 分支未改变选择却固定提示收藏栏。现已改为保留手动选择并如实提示；未手动选择时选择 defaultTarget(tree) 的实际默认目录，且提示其路径。新增两种情况的 E2E 用例，已在 Chromium / 系统 Edge 中通过。

实施：优先保留手动选择并准确描述当前目标；无手动选择时采用实际默认目录并提示其路径，不假定默认目标一定是收藏栏。对应测试已新增，并在 Chromium / 系统 Edge 中通过。

### 5. 中优先级：旧版 AI 接口与现代接口混合维护（尚未实施）

位置：`src/lib/ai.ts:32–50、87–105`。

除 LanguageModel 外，还探测 ai.languageModel、chrome.aiOriginTrial.languageModel，并兼容 capabilities()、readily、after-download。全局探测使用 Record<string, any>，削弱类型保护。`tests/ai.test.ts:51–55` 明确测试旧接口，说明兼容分支是有意保留，不应直接删除。

建议：先确定 Chrome / Edge 最低支持版本；以当前 LanguageModel 接口为主，使用明确类型和类型守卫；移除已超出支持范围的旧接口，将必须保留的逻辑隔离到兼容适配层；同步测试、能力报告和文档。不能未经验证就保证删除旧路径不会影响 Edge。

### 6. 中优先级：收藏栏识别依赖固定 ID（尚未实施）

位置：`src/lib/types.ts:1`；`src/lib/bookmarks.ts:4–9、21–32、47–50`。

BOOKMARK_BAR_ID 固定为字符串 1，defaultTarget() 按此查找，否则选择第一个顶层目录。当前节点类型和转换没有保留 folderType、unmodifiable 等元数据。Chrome 134+ 的 folderType 可以识别 bookmarks-bar、other、mobile、managed；unmodifiable 可标识受管理节点。

建议：优先使用 folderType，旧浏览器保留明确回退；多个匹配目录采用确定性规则；避免将已知不可修改目录作为可写目标。不要把特殊根目录本身不可重命名误判为不能添加子书签。补充非固定 ID、缺失元数据和受管理目录夹具。该项属于健壮性改进，尚未在真实账户目录结构中复现错误。

## 四、较低优先级建议

### 异步取消桥接

`src/lib/ai.ts:57–85` 只有一次 .then(success, failure)，不是嵌套 Promise 链。可按技能要求整理为 async/await，但必须保留立即取消等待、清理迟到会话两项语义。`tests/ai.test.ts:109–122` 已覆盖后者。推理超时还能在底层不响应取消时结束等待，不能未经等价分析就用简单 AbortSignal 组合替换。

### 事件处理风格

`src/popup/main.ts:202–210` 通过 onclick 赋值和清空切换动作。可统一成单个 addEventListener 配合动作状态，但当前不是 HTML 内联处理器，不是 CSP 违规，也不会累积监听器。逐节点监听器也不能仅因数量多就认定为泄漏。

### 目录规模

`src/popup/main.ts:94–97` 提前构建折叠目录的后代，自动展开又重建整树。先避免不必要重建，有大目录性能证据后再考虑懒渲染或分批创建；本次未测量性能。

### 可访问性与样式

- 当前是嵌套列表、原生单选按钮和展开按钮，不是完整 ARIA tree；已有基本键盘交互、aria-expanded、状态播报、进度条语义和焦点样式。
- 优先完善单选组名称和展开按钮与子列表的关联，不要只加 role=tree 而不实现对应键盘模型。
- 复核浅色模式选中目录文字及保存按钮悬停配色，尤其 brightness 滤镜对最终颜色的影响。位置：`src/popup/styles.css:3–8、148–150、200–203、245–254`。未进行实际渲染测量，不将其表述为已验证的 WCAG 失败。
- 检查进度动画在 prefers-reduced-motion 下的表现。

## 五、不应误判为问题的现有实现

### 保持最小权限

Chrome 官方文档确认：用户通过工具栏调用扩展后，activeTab 临时授权允许读取当前标签页 URL 和标题；与 scripting 配合可执行脚本。因此本扩展不应仅为读取 tab.url 添加 tabs 或广泛主机权限。技能中“读取 tab.url 必须有 tabs”的绝对表述不适用于已取得 activeTab 授权的本流程。

直接打开 popup.html 不等于通过工具栏取得授权。现有 E2E 会模拟活动标签页，不能替代真实工具栏验收。

### 其他应保留的部分

- 已是 Manifest V3，已有 action.default_popup；图标引用对应真实文件。
- src/ 未发现 V2 API、eval、new Function、危险 HTML 字符串插入、HTML 内联事件或远程脚本；目录名称使用 textContent。
- 没有后台服务工作线程，弹窗变量和定时器不违反工作线程持久化及 alarms 要求。
- 元数据注入只做少量只读查询，无需批量 DOM 更新。
- 已使用 CSS 变量、Flexbox、深浅色、accent-color、focus-visible、focus-within，不必全面重写。固定弹窗宽度也不是自动成立的遗留缺陷。
- 不为现代化引入框架、云端 AI、遥测或无依据的依赖升级。

## 六、分阶段实施计划

### 阶段 1：稳定弹窗行为（已实施，自动化回归通过）

范围：`src/popup/main.ts` 及相关回归用例。已建立保存状态与异步更新边界，避免成功后重复提交，隔离 AI 与保存反馈，处理页面查询失败，并修正 none 提示。E2E 用例已在 Chromium / 系统 Edge 中通过；真实工具栏用户手势与系统 Chrome 行为仍须后续验收。

### 阶段 2：目录节点与交互（已实施，自动化回归通过）

范围：`src/popup/main.ts`、`src/popup.html`、`src/popup/styles.css` 及 E2E 用例。已实现就地展开、焦点保留、原生 fieldset/legend 单选组语义、aria-controls、显式悬停配色及减少动态效果支持。相关 E2E 已在 Chromium / 系统 Edge 中通过；辅助技术与实测对比度仍未验收，未改为完整 ARIA tree。

### 阶段 3：浏览器适配层

范围：`src/lib/ai.ts`、`src/lib/bookmarks.ts`、`src/lib/types.ts` 与相关测试。先明确支持基线，再类型化 AI 接口、隔离或移除旧接口、保留异步清理语义；采用目录类型和可写性元数据，保留兼容回退。保持现有最小权限。

### 阶段 4：文档与商店信息

README 的图标说明和阶段 1–2 用户行为描述已更新，`STORE_LISTING.md` 已指向新建的 `CHROMEWEBSTORE.md` 单一商店元数据草稿。截图需因 UI 变化重新制作和核验。商店资料、隐私政策公开地址和资产状态仍有待确认；当前不代表已准备好提交。

## 七、回归与验收状态

阶段 1–2 的下列自动化用例已新增于 `tests/e2e/modernization.spec.ts`，并随 2026-11-12 的 Chromium / 系统 Edge 完整 E2E 通过：

1. 保存成功后的锁定、重复提交防护及自动关闭时序。
2. 保存开始时取消推荐；旧 AI 检测、会话创建、推理结果/异常和进度事件不能覆盖保存中、成功或失败状态；迟到会话清理。
3. 页面查询拒绝时显示原因、保留目录浏览、禁止保存且不产生页面错误。
4. 手动改选后模型返回 none 保留选择；无手动选择时采用真实默认目录。
5. 推荐路径就地展开，保留节点与键盘焦点，并验证 fieldset/legend、aria-controls 和原生单选语义。
6. 深浅色显式保存按钮悬停配色以及 prefers-reduced-motion。

以下仍需后续验收或补充：收藏栏非固定 ID、folderType 元数据与受管理目录；真实 Chrome / Edge 工具栏权限和模型体验；实际渲染的对比度、辅助技术交互及更新后的商店截图。

2026-11-12 本轮已获授权的验证结果：

- `npm run check`、`tsc --noEmit` 通过，node 单元测试 36/36 通过。
- `npm run build` 的 Chrome / Edge 构建成功；`activeTab` 访问范围警告及 Edge 自动移除 `key` 属于现有设计，无需为消除警告扩大权限。
- Chromium 完整 E2E 41/41 通过；系统 Edge 完整 E2E 41/41 通过。
- 系统 Chrome E2E 已尝试，但 Playwright 找不到 `C:/Users/PC/AppData/Local/Google/Chrome/Application/chrome.exe`；`Program Files` 与 `Program Files (x86)` 下也无 Chrome。系统未安装 Chrome，测试未能启动，不能声称系统 Chrome 回归或全流程通过。
- 已修复新增 E2E 夹具缺少 `syncing` 类型字段的问题；`fieldset` 的 disabled matcher 改用 `toHaveJSProperty`，并保留子 radio 的 `toBeDisabled` 断言。
- `git diff --check` 通过；不据此声称另行运行了 Lint 或格式化。

以上记录已完成的验证，不代表 CWS 提交、审核或发布。真实工具栏用户手势、真实模型下载与推理、辅助技术与实测对比度、商店截图和发布者信息仍未验收。

## 八、实施边界与后续工作

阶段 1–2 实现完成，回归用例和文档已同步，已完成的自动化验证及剩余边界见第七节。阶段 3 的 AI 兼容层与书签目录适配尚未实施；本轮未删除旧 AI 兼容分支、未升级依赖、未扩大权限。版本未提升，未商店发布；不将自动化通过等同于全流程或商店验收完成。

## 九、参考依据

- `.agents/skills/chrome-extensions/SKILL.md`
- `.agents/skills/chrome-extensions/references/extensions/permissions.md`
- `.agents/skills/chrome-extensions/references/extensions/prompt-api.md`
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- https://developer.chrome.com/docs/extensions/get-started/tutorial/scripts-activetab
- https://developer.chrome.com/docs/ai/prompt-api
- https://developer.chrome.com/docs/extensions/reference/api/bookmarks

官方文档通过 Context7 检索核对，直接网页抓取未成功。具体版本支持和真实模型能力仍需目标环境验收。
