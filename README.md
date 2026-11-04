# Bookmark Compass 书签指南针

**为每个网页找到合适的书签文件夹。**

Bookmark Compass 是一款 Chrome / Microsoft Edge 扩展：点击工具栏图标打开保存面板，读取当前网页的标题、URL 和元数据，用浏览器本地 AI 从现有收藏夹里推荐位置。推荐只是预选，保存前仍由你确认。

> 状态：MVP 已实现，已提供 Chromium / Chrome / Edge 自动测试入口；完整兼容性仍需结合测试结果与真实模型手动验收（见下文）。

## 功能

- 点击扩展图标打开中文保存面板，自动读取当前标签页。
- 展示完整可展开的收藏夹树，可选任意文件夹。
- 本地 AI 使用 `temperature: 0.2`、`topK: 3` 推荐文件夹；通过 Prompt API 的 `responseConstraint` JSON Schema 限定候选 ID、`none` 和 0–100 的整数置信度，并在应用结果前再次校验。
- AI 消息栏底部显示本次推荐会话的上下文配额（已用 / 总量及剩余），推理结束后保留最后读数；浏览器未提供配额字段时显示说明。
- 本地模型尚未下载时，由你点击按钮开始下载（浏览器要求用户手势），下载过程显示进度条。
- 浏览器没有开放本地 AI 时，给出对应开关地址（Edge 用 `edge://flags/#edge-llm-prompt-api-for-default`，Chrome 用 `chrome://flags/#prompt-api-for-gemini-nano`），可尝试打开或复制。
- 没有推荐、AI 不可用、模型下载失败或推理出错时，默认选中收藏栏根目录，面板照常可用。
- 只有点击「保存」才创建书签；关闭面板不修改收藏夹。
- 保存前重新确认目标文件夹仍存在且是文件夹。手动改选后，迟到的 AI 结果不会覆盖你的选择。

## 环境要求

- Chrome 或 Microsoft Edge。本地 AI 依赖浏览器内置的 Prompt API，各版本支持情况不同。
- Node.js 20+ 与 npm。

## 开发与构建

```bash
npm install
npm run dev          # 启动 Extension.js 开发会话（会打开 Chrome）
npm run build        # 构建 dist/chrome 与 dist/edge
npm run typecheck    # tsc --noEmit
npm test             # node:test 单元测试
npm run check        # 类型检查 + 单元测试
npm run test:e2e:install  # 下载 Playwright 自带的 Chromium（只需一次）
npm run test:e2e     # Chromium 自动回归，加载 dist/chrome
npm run test:e2e:compat  # 系统 Chrome + Edge，各加载对应构建产物
npm run test:e2e:chrome  # 只测试系统 Chrome
npm run test:e2e:edge    # 只测试系统 Edge
```

构建产物：`dist/chrome/`（Chrome）、`dist/edge/`（Microsoft Edge）。

## 端到端测试

`tests/e2e/` 用 Playwright 加载扩展并驱动面板。三个项目共用测试用例：

| 项目 | 浏览器 | 扩展产物 | 命令 |
| --- | --- | --- | --- |
| `chromium` | Playwright 自带的 Chromium | `dist/chrome` | `npm run test:e2e` |
| `chrome` | 系统安装的 Google Chrome | `dist/chrome` | `npm run test:e2e:chrome` |
| `msedge` | 系统安装的 Microsoft Edge | `dist/edge` | `npm run test:e2e:edge` |

先运行 `npm run build`。Chromium 需要先运行一次 `npm run test:e2e:install`；Chrome、Edge 需要自行安装，缺少浏览器时测试会失败，不会跳过或退回 Chromium。`npm run test:e2e:compat` 一起验证两个品牌浏览器，使用 `npx playwright test --project=chrome --project=msedge --headed` 可观察测试窗口。运行 `npx playwright show-report` 查看 HTML 报告及 `browser-capabilities` 附件，其中记录浏览器版本信息、权限、原生 AI 入口和可用性。

Chrome、Edge 已移除原先的命令行侧载开关。品牌浏览器测试通过 Playwright 的调试 pipe 和 `Extensions.loadUnpacked` 安装扩展，使用 `--enable-unsafe-extension-debugging`；需要目标浏览器支持该 CDP 命令且未被企业策略阻止。Edge 构建会移除 manifest 的 `key`，测试使用安装返回的实际 ID。Chromium 仍使用原有的命令行加载方式。每个测试使用独立临时 profile，退出后删除，不接触日常浏览器数据。

自动化覆盖默认收藏栏、对应浏览器的 AI 开关提示、模型下载按钮与进度、`none` 回退、会话配额，以及真实书签写入。AI 流程使用模拟接口；额外的原生能力测试不注入模拟 API，验证扩展初始化、权限和无 AI 时的降级，并记录实际能力。原生 API 缺失不会让兼容性测试失败，因为这是产品支持的降级场景；能力附件中的可用性记录不代表模型下载或推理已通过。

### 真实 Chrome / Edge 手动验收

自动测试直接打开扩展页面，并在保存用例中模拟当前标签页，仍需分别在两个浏览器里完成以下验收。建议使用专门的测试 profile，并记录浏览器完整版本、系统、AI 开关和模型状态。

1. 按下文加载对应产物；在有标题及 description / keywords 的普通 HTTPS 网页点击工具栏图标，确认面板显示当前网页标题、URL，文件夹树可展开并切换选择。
2. AI 不可用时，确认提示对应 `chrome://` 或 `edge://` 开关地址，手动选择文件夹后仍可保存；核对新增书签的 URL、标题和父文件夹，随后删除测试书签。
3. 在支持 Prompt API 的浏览器、硬件和配置上，模型未下载时点击「下载本地模型」，保持面板打开，确认进度、下载完成后的推荐及配额提示。记录下载失败时的错误信息。不要把未提供 API 或硬件不满足条件记为模型测试通过。
4. 模型可用时验证真实推荐和手动改选；确认迟到的推荐不覆盖手动选择，保存确实进入选定文件夹。模型返回内容受实际模型影响，固定的 `none`、失败与配额分支由自动化覆盖。
5. 不点击保存直接关闭面板，确认没有新增书签；在浏览器内部页面验证不可保存的提示。检查窄面板及深浅色下文字、按钮和滚动是否正常。

在两种浏览器中分别完成自动测试与上述验收后，才能声称该版本的 Chrome / Edge 全流程兼容。

## 在浏览器中安装

1. 执行 `npm run build`。
2. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
3. 打开「开发者模式」。
4. 点「加载已解压的扩展程序」，选择 `dist/chrome` 或 `dist/edge`。
5. 在任意网页点击工具栏上的 Bookmark Compass 图标。

## 权限

| 权限 | 用途 |
| --- | --- |
| `bookmarks` | 读取收藏夹树、校验目标文件夹、创建书签 |
| `activeTab` | 点击图标后读取当前标签页的标题与 URL |
| `scripting` | 仅在打开面板时读取当前页的 `description`、`keywords` 等 meta 标签 |

不申请 `<all_urls>`、历史记录或远程主机权限，也不注册常驻内容脚本。

## 隐私与安全

- 只用浏览器本地 AI，不做云端推理，不收集遥测；构建时用 `--no-telemetry` 关闭 Extension.js 自身的匿名统计。
- 只读标题、URL 和指定 meta 标签，不读正文、截图或已有书签条目。
- 网页元数据和模型输出都按不可信数据处理：模型只能从候选文件夹里选一个，输出经严格 JSON 校验，未知 id、越界置信度和多余字段一律拒绝。
- 网页数据、目录树和模型输入输出都不落盘。

## 目录结构

```
src/
  manifest.json        MV3 清单
  popup.html           面板入口
  popup/
    main.ts            面板状态与交互
    styles.css         跟随系统深浅色的样式
  lib/
    bookmarks.ts       收藏夹树构建、展平、路径与默认目标
    prompt.ts          提示词与候选裁剪
    recommendation.ts  模型输出校验
    ai.ts              本地 AI 能力探测、会话、超时
    page.ts            页面元数据读取
    save.ts            保存前的目标校验与创建
tests/                 node:test 单元测试
```

## 已知限制

- 模型下载需要点按钮触发，下载期间请保持面板打开；关闭面板会中断这次的进度显示。
- 扩展无权直接修改浏览器开关，也通常打不开 `edge://`、`chrome://` 页面，按钮会退回复制地址。
- 候选文件夹超过 120 个时只有前 120 个参与推荐，其余仍可手动选择。
- 没有提供扩展图标，浏览器显示默认图标。
- 浏览器内部页面（如 `chrome://settings`）无法注入脚本，可以浏览收藏夹但不能保存。

## 设计文档

产品范围、技术选型、权限与数据流、分阶段计划见 [`plan.md`](./plan.md)。
