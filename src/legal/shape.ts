/**
 * 後台可編輯的條款（客戶 11/03 第 14 頁，開關 `LEGAL_DOCS`，只在專案 A）：兩份、各一列 `legal_documents`。
 * 前端、後台、伺服器共用（純資料與純函式）。
 *
 * 沒存過的那一份是 `null`：家長端照舊畫 `src/components/LegalTerms.tsx` 寫死的條款。
 * 改了**不要求家長重新勾同意**（使用者 2026-11-06）：這裡沒有版本號，也不碰登入的同意勾選。
 */

export type LegalDocKey = 'service' | 'privacy';
export const LEGAL_DOC_KEYS: ReadonlyArray<LegalDocKey> = ['service', 'privacy'];

export function isLegalDocKey(v: unknown): v is LegalDocKey {
  return v === 'service' || v === 'privacy';
}

export interface LegalDoc {
  markdown: string;
  /** 存檔那一刻（伺服器填，ISO 字串）；家長端落款的「最后更新日期」。 */
  updatedAt: string;
}

export type LegalDocs = Record<LegalDocKey, LegalDoc | null>;

export const EMPTY_LEGAL_DOCS: LegalDocs = { service: null, privacy: null };

/** 一列 `legal_documents` → 一份條款；認不得回 null（退回內建條款，不畫一份壞掉的）。 */
export function legalDocFromRow(row: Record<string, unknown>): { key: LegalDocKey; doc: LegalDoc } | null {
  if (!isLegalDocKey(row.doc_key) || typeof row.markdown !== 'string' || row.markdown.trim() === '') return null;
  const at = row.updated_at instanceof Date ? row.updated_at.toISOString() : typeof row.updated_at === 'string' ? row.updated_at : null;
  if (!at || Number.isNaN(Date.parse(at))) return null;
  return { key: row.doc_key, doc: { markdown: row.markdown, updatedAt: at } };
}

export function legalDocsFromRows(rows: ReadonlyArray<Record<string, unknown>>): LegalDocs {
  const out: LegalDocs = { service: null, privacy: null };
  for (const r of rows) {
    const d = legalDocFromRow(r);
    if (d) out[d.key] = d.doc;
  }
  return out;
}

/** 前端讀公開端點回來的東西：形狀不對的那一份當成沒存過。 */
export function readLegalDocs(body: unknown): LegalDocs {
  if (typeof body !== 'object' || body === null) return EMPTY_LEGAL_DOCS;
  const b = body as Record<string, unknown>;
  const one = (v: unknown): LegalDoc | null => {
    if (typeof v !== 'object' || v === null) return null;
    const d = v as Record<string, unknown>;
    return typeof d.markdown === 'string' && d.markdown.trim() !== '' && typeof d.updatedAt === 'string' && !Number.isNaN(Date.parse(d.updatedAt))
      ? { markdown: d.markdown, updatedAt: d.updatedAt }
      : null;
  };
  return { service: one(b.service), privacy: one(b.privacy) };
}

/** 落款的日期：照 Asia/Shanghai 寫成「2026年11月7日」（同內建條款的寫法）。 */
export function legalDateLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

/**
 * 一個落款底下有幾份條款（登入頁的合併彈窗是兩份）：取存過的那幾份裡最晚的一天；
 * 一份都沒存過回 null（呼叫端用內建條款的日期）。
 */
export function latestLegalDate(docs: ReadonlyArray<LegalDoc | null>): string | null {
  const times = docs.filter((d): d is LegalDoc => d !== null).map(d => Date.parse(d.updatedAt));
  if (times.length === 0) return null;
  return legalDateLabel(new Date(Math.max(...times)).toISOString());
}
