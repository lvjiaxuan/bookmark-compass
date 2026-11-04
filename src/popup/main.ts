import { buildFolderTree, defaultTarget, findPathIds, flattenFolders } from '../lib/bookmarks.ts';
import { buildPrompt, candidatesOf } from '../lib/prompt.ts';
import { parseRecommendation, recommendationSchema, type RecommendationResult } from '../lib/recommendation.ts';
import { closeSession, createSession, detectAi, getSessionQuota, promptWithTimeout, type LanguageModelApi, type PromptSession } from '../lib/ai.ts';
import { readPageMetadata } from '../lib/page.ts';
import { saveBookmark, type SaveAdapter } from '../lib/save.ts';
import type { FolderNode, PageInfo } from '../lib/types.ts';

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
};

const titleEl = el<HTMLHeadingElement>('page-title');
const urlEl = el<HTMLParagraphElement>('page-url');
const statusEl = el<HTMLParagraphElement>('status');
const quotaEl = el<HTMLParagraphElement>('ai-quota');
const treeEl = el<HTMLUListElement>('tree');
const targetEl = el<HTMLParagraphElement>('target');
const saveBtn = el<HTMLButtonElement>('save');
const cancelBtn = el<HTMLButtonElement>('cancel');
const aiActionBtn = el<HTMLButtonElement>('ai-action');
const progressRow = el<HTMLDivElement>('progress');
const progressBar = el<HTMLDivElement>('progress-bar');
const progressFill = el<HTMLDivElement>('progress-fill');
const progressText = el<HTMLSpanElement>('progress-text');

const bookmarks: SaveAdapter = {
  get: (id) => chrome.bookmarks.get(id),
  create: (input) => chrome.bookmarks.create(input),
};

let tree: FolderNode[] = [];
let folders: FolderNode[] = [];
let target: FolderNode | null = null;
let page: PageInfo | null = null;
let userPicked = false;
let saving = false;
let aiApi: LanguageModelApi | null = null;
let aiBusy = false;
let activeController: AbortController | null = null;
let activeSession: PromptSession | null = null;
const expanded = new Set<string>();

// 浏览器要求先在该页打开对应开关，扩展没有权限直接改这些设置
const AI_FLAGS_URL = navigator.userAgent.includes('Edg/')
  ? 'edge://flags/#edge-llm-prompt-api-for-default'
  : 'chrome://flags/#prompt-api-for-gemini-nano';

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function setStatus(text: string, tone: 'info' | 'ok' | 'warn' = 'info'): void {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function updateQuota(session: PromptSession): void {
  const quota = getSessionQuota(session);
  quotaEl.textContent = quota
    ? `会话配额：已用 ${quota.used.toLocaleString('zh-CN')} / ${quota.total.toLocaleString('zh-CN')} · 剩余 ${quota.remaining.toLocaleString('zh-CN')}`
    : '当前浏览器未提供会话配额';
  quotaEl.hidden = false;
}

function updateTarget(): void {
  targetEl.textContent = target ? `目标：${target.path}` : '目标：未选择';
  saveBtn.disabled = !target || !page?.url || saving;
}

function checkedRadio(folderId: string): HTMLInputElement | null {
  return treeEl.querySelector<HTMLInputElement>(`input[value="${CSS.escape(folderId)}"]`);
}

function selectFolder(folder: FolderNode, byUser: boolean): void {
  target = folder;
  if (byUser) userPicked = true;
  const radio = checkedRadio(folder.id);
  if (radio) radio.checked = true;
  updateTarget();
}

function renderFolder(folder: FolderNode): HTMLLIElement {
  const item = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'row';
  row.style.setProperty('--depth', String(folder.depth));

  const hasChildren = folder.children.length > 0;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toggle';

  const childrenUl = document.createElement('ul');
  childrenUl.className = 'children';
  childrenUl.hidden = !expanded.has(folder.id);
  if (hasChildren) childrenUl.append(...folder.children.map(renderFolder));

  const setExpanded = (open: boolean): void => {
    if (open) expanded.add(folder.id);
    else expanded.delete(folder.id);
    childrenUl.hidden = !open;
    toggle.textContent = open ? '▾' : '▸';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', `${open ? '收起' : '展开'} ${folder.name}`);
  };

  if (hasChildren) {
    toggle.addEventListener('click', () => setExpanded(!expanded.has(folder.id)));
    setExpanded(expanded.has(folder.id));
  } else {
    toggle.disabled = true;
    toggle.setAttribute('aria-hidden', 'true');
  }

  const label = document.createElement('label');
  label.className = 'choice';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'folder';
  radio.value = folder.id;
  radio.checked = target?.id === folder.id;
  radio.addEventListener('change', () => selectFolder(folder, true));
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = folder.name;
  label.append(radio, name);

  row.append(toggle, label);
  item.append(row);
  if (hasChildren) item.append(childrenUl);
  return item;
}

function renderTree(): void {
  treeEl.replaceChildren(...tree.map(renderFolder));
}

function expandPath(folderId: string): void {
  for (const id of findPathIds(tree, folderId)) {
    if (id !== folderId) expanded.add(id);
  }
  renderTree();
}

async function loadPage(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    titleEl.textContent = '无法读取当前页面';
    urlEl.textContent = '';
    setStatus('当前标签页不可读取（可能是浏览器内部页面）。可以浏览收藏夹，但无法保存。', 'warn');
    return;
  }

  page = { title: tab.title || tab.url, url: tab.url };
  titleEl.textContent = page.title;
  urlEl.textContent = page.url;

  if (tab.id !== undefined) {
    const metadata = await readPageMetadata(tab.id);
    if (metadata) page = { ...page, ...metadata };
  }
}

function applyResult(result: RecommendationResult): void {
  if (result.kind === 'none') {
    setStatus('模型认为现有文件夹都不合适，已选择收藏栏根目录。');
    return;
  }

  if (result.kind === 'invalid') {
    setStatus(`模型返回的结果无法使用（${result.reason}），请手动选择文件夹。`, 'warn');
    return;
  }

  const folder = folders.find((candidate) => candidate.id === result.folderId);
  if (!folder) {
    setStatus('模型推荐的文件夹已不存在，请手动选择。', 'warn');
    return;
  }

  if (userPicked) {
    setStatus(`AI 推荐「${folder.path}」（置信度 ${result.confidence}%），已保留你的选择。`);
    return;
  }

  selectFolder(folder, false);
  expandPath(folder.id);
  setStatus(`AI 推荐：${folder.path} · 置信度 ${result.confidence}%`, 'ok');
}

function setProgress(percent: number | null): void {
  progressRow.hidden = percent === null;
  if (percent === null) return;

  const value = Math.max(0, Math.min(100, Math.round(percent)));
  progressBar.setAttribute('aria-valuenow', String(value));
  progressFill.style.width = `${value}%`;
  progressText.textContent = `${value}%`;
}

function showAiAction(label: string, onClick: () => void): void {
  aiActionBtn.textContent = label;
  aiActionBtn.onclick = onClick;
  aiActionBtn.hidden = false;
}

function hideAiAction(): void {
  aiActionBtn.hidden = true;
  aiActionBtn.onclick = null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function openFlags(): Promise<void> {
  try {
    await chrome.tabs.create({ url: AI_FLAGS_URL });
    setStatus(`已打开 ${AI_FLAGS_URL}。开启后请重启浏览器，再重新打开本面板。`, 'warn');
    return;
  } catch {
    // 扩展通常无权打开浏览器内置页面，退回复制地址
  }

  const copied = await copyText(AI_FLAGS_URL);
  setStatus(
    copied
      ? `已复制开关地址：${AI_FLAGS_URL}\n粘贴到地址栏打开，开启后重启浏览器。`
      : `请在地址栏手动打开：${AI_FLAGS_URL}，开启后重启浏览器。`,
    'warn',
  );
}

function offerFlags(message: string): void {
  setStatus(`${message}\n如果本地 AI 还没开启，打开 ${AI_FLAGS_URL} 启用后重启浏览器。`, 'warn');
  showAiAction('打开 AI 开关', () => void openFlags());
}

async function runAi(downloading: boolean): Promise<void> {
  if (!aiApi || !page || aiBusy) return;

  aiBusy = true;
  const controller = new AbortController();
  activeController = controller;
  showAiAction('停止推荐', () => controller.abort());
  quotaEl.hidden = true;
  quotaEl.textContent = '';

  if (downloading) {
    setProgress(0);
    setStatus('正在下载本地模型，请保持面板打开…');
  } else {
    setStatus('正在准备本地模型…');
  }

  let session: PromptSession | null = null;
  try {
    // create() 要在用户点击后调用，浏览器才允许开始下载模型
    session = await createSession(aiApi, (loaded) => setProgress(loaded * 100), controller.signal);
    activeSession = session;
    if (controller.signal.aborted) {
      closeSession(session);
      activeSession = null;
      return;
    }
    updateQuota(session);
    setProgress(null);
    setStatus('正在让本地模型判断合适的文件夹…');

    const candidates = candidatesOf(folders);
    const validIds = new Set(candidates.map((candidate) => candidate.id));
    const raw = await promptWithTimeout(
      session,
      buildPrompt(page, candidates),
      recommendationSchema(validIds),
      controller.signal,
    );
    hideAiAction();
    applyResult(parseRecommendation(raw, validIds));
  } catch (error) {
    setProgress(null);
    if (error instanceof Error && error.name === 'AbortError') {
      hideAiAction();
      setStatus('已停止本次推荐。');
    } else {
      setStatus(`本地 AI 未能给出结果：${messageOf(error)}。可以手动选择文件夹，或重试。`, 'warn');
      showAiAction('重试推荐', () => void runAi(false));
    }
  } finally {
    if (session) updateQuota(session);
    if (activeSession === session) {
      activeSession = null;
      closeSession(session);
    } else if (session && !controller.signal.aborted) {
      closeSession(session);
    }
    if (activeController === controller) activeController = null;
    aiBusy = false;
  }
}

async function initAi(): Promise<void> {
  if (!page) return;

  const { status, api, error } = await detectAi();
  aiApi = api;
  if (!api) {
    offerFlags('当前浏览器没有提供本地 AI 接口。');
    return;
  }

  if (status === 'unavailable') {
    offerFlags(`本地 AI 接口当前不可用${error ? `（${error}）` : ''}。`);
    return;
  }

  if (status === 'downloadable') {
    setStatus('本地模型还没有下载。下载由浏览器完成，需要你点击按钮开始。');
    showAiAction('下载本地模型', () => void runAi(true));
    return;
  }

  if (status === 'downloading') setProgress(0);

  await runAi(false);
}

async function save(): Promise<void> {
  if (!target || !page || saving) return;

  saving = true;
  saveBtn.disabled = true;
  const destination = target.path;
  setStatus('正在保存…');

  const result = await saveBookmark(bookmarks, target.id, page);
  saving = false;

  if (result.ok) {
    saveBtn.textContent = '已保存';
    setStatus(`已保存到「${destination}」。`, 'ok');
    window.setTimeout(() => window.close(), 900);
    return;
  }

  saveBtn.disabled = false;
  setStatus(result.reason, 'warn');
}

async function init(): Promise<void> {
  try {
    tree = buildFolderTree(await chrome.bookmarks.getTree());
    folders = flattenFolders(tree);
  } catch {
    setStatus('无法读取收藏夹，请确认扩展的书签权限后重新打开。', 'warn');
    return;
  }

  target = defaultTarget(tree);
  if (target) expanded.add(target.id);
  renderTree();
  updateTarget();

  await loadPage();
  updateTarget();
  await initAi();
}

saveBtn.addEventListener('click', () => {
  void save();
});

cancelBtn.addEventListener('click', () => window.close());

window.addEventListener('pagehide', () => {
  activeController?.abort();
  closeSession(activeSession);
  activeSession = null;
});

void init();
