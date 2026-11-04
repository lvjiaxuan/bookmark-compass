export type RecommendationResult =
  | { kind: 'recommendation'; folderId: string; confidence: number }
  | { kind: 'none' }
  | { kind: 'invalid'; reason: string };

const ALLOWED_KEYS = new Set(['folderId', 'confidence']);

const invalid = (reason: string): RecommendationResult => ({ kind: 'invalid', reason });

/** 仅允许本次实际发给模型的候选 ID，或明确返回 none。 */
export function recommendationSchema(validIds: ReadonlySet<string>) {
  return {
    type: 'object',
    properties: {
      folderId: { type: 'string', enum: [...validIds, 'none'] },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
    },
    required: ['folderId', 'confidence'],
    additionalProperties: false,
  } as const;
}

/**
 * 严格校验模型输出：只接受已知文件夹 id 或 none，整数置信度 0–100，
 * 且不允许出现约定之外的字段。模型输出一律视为不可信数据。
 */
export function parseRecommendation(raw: unknown, validIds: ReadonlySet<string>): RecommendationResult {
  if (typeof raw !== 'string' || raw.trim() === '') return invalid('模型没有返回内容');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid('返回的不是合法 JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return invalid('返回的不是 JSON 对象');
  const record = parsed as Record<string, unknown>;

  const extraKey = Object.keys(record).find((key) => !ALLOWED_KEYS.has(key));
  if (extraKey) return invalid(`包含额外字段 ${extraKey}`);

  const folderId = record.folderId;
  if (typeof folderId !== 'string' || folderId.trim() === '') return invalid('缺少 folderId');

  const confidence = record.confidence;
  if (typeof confidence !== 'number' || !Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
    return invalid('置信度不是 0–100 的整数');
  }

  if (folderId === 'none') return { kind: 'none' };
  if (!validIds.has(folderId)) return invalid('返回了不在候选列表中的文件夹');

  return { kind: 'recommendation', folderId, confidence };
}
