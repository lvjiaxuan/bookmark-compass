export type AiStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported';

type DownloadEvent = { loaded?: number };
type DownloadMonitor = { addEventListener: (type: 'downloadprogress', listener: (event: DownloadEvent) => void) => void };

export type PromptSession = {
  prompt: (text: string, options?: { responseConstraint?: Record<string, unknown>; signal?: AbortSignal }) => Promise<string>;
  destroy?: () => void;
  contextUsage?: number;
  contextWindow?: number;
  inputUsage?: number;
  inputQuota?: number;
  tokensSoFar?: number;
  maxTokens?: number;
};

export function getSessionQuota(session: PromptSession): { used: number; total: number; remaining: number } | null {
  const pairs = [
    [session.contextUsage, session.contextWindow],
    [session.inputUsage, session.inputQuota],
    [session.tokensSoFar, session.maxTokens],
  ];
  for (const [used, total] of pairs) {
    if (typeof used === 'number' && typeof total === 'number'
      && Number.isFinite(used) && Number.isFinite(total) && used >= 0 && total > 0 && used <= total) {
      return { used, total, remaining: total - used };
    }
  }
  return null;
}

export type LanguageModelApi = {
  create: (options?: Record<string, unknown>) => Promise<PromptSession>;
  availability?: () => Promise<string>;
  capabilities?: () => Promise<{ available?: string }>;
};

const mapStatus = (raw: unknown): AiStatus => {
  switch (raw) {
    case 'available':
    case 'readily':
      return 'available';
    case 'downloadable':
    case 'after-download':
      return 'downloadable';
    case 'downloading':
      return 'downloading';
    default:
      return 'unavailable';
  }
};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const abortError = (): DOMException => new DOMException('会话已停止', 'AbortError');

function createWithAbort(pending: Promise<PromptSession>, signal?: AbortSignal): Promise<PromptSession> {
  if (!signal) return pending;
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      reject(abortError());
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    pending.then((session) => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) {
        closeSession(session);
        abort();
      } else if (!settled) {
        settled = true;
        resolve(session);
      }
    }, (error) => {
      signal.removeEventListener('abort', abort);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

/** 各版本浏览器暴露本地模型的入口不同，按新版到旧版依次探测。 */
function findApi(): LanguageModelApi | null {
  const scope = globalThis as unknown as Record<string, any>;
  const candidates = [scope.LanguageModel, scope.ai?.languageModel, scope.chrome?.aiOriginTrial?.languageModel];
  for (const candidate of candidates) {
    if (candidate && typeof candidate.create === 'function') return candidate as LanguageModelApi;
  }
  return null;
}

export async function detectAi(): Promise<{ status: AiStatus; api: LanguageModelApi | null; error?: string }> {
  const api = findApi();
  if (!api) return { status: 'unsupported', api: null };

  try {
    const raw = api.availability ? await api.availability() : (await api.capabilities?.())?.available;
    return { status: mapStatus(raw), api };
  } catch (error) {
    return { status: 'unavailable', api, error: messageOf(error) };
  }
}

export async function createSession(
  api: LanguageModelApi,
  onDownload?: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<PromptSession> {
  const sampling = { temperature: 0.2, topK: 3 };
  if (onDownload) {
    try {
      return await createWithAbort(api.create({
        ...sampling,
        signal,
        monitor: (monitor: DownloadMonitor) => {
          monitor.addEventListener('downloadprogress', (event) => onDownload(event.loaded ?? 0));
        },
      }), signal);
    } catch (error) {
      if (signal?.aborted || !(error instanceof TypeError)) throw error;
      // 旧版接口不支持 monitor 时，重试时仍保留采样参数。
    }
  }
  return createWithAbort(api.create({ ...sampling, signal }), signal);
}

export async function promptWithTimeout(
  session: PromptSession,
  text: string,
  responseConstraint: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs = 20_000,
): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('推理超时'));
      controller.abort();
    }, timeoutMs);
  });
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new DOMException('推理已停止', 'AbortError'));
    if (controller.signal.aborted) rejectAbort();
    else controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });

  try {
    return await Promise.race([session.prompt(text, { responseConstraint, signal: controller.signal }), timeout, aborted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', rejectAbort);
  }
}

export function closeSession(session: PromptSession | null): void {
  try {
    session?.destroy?.();
  } catch {
    // 关闭失败不影响已得到的结果
  }
}
