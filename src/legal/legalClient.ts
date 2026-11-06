/**
 * 家長端讀後台編輯過的條款（`GET /api/legal`，開關 `LEGAL_DOCS`，只在專案 A）。整頁只問一次；
 * B 不問（B 沒有這支端點）。讀失敗、逾時、沒存過 → 那一份是 null，畫內建條款。
 */
import { useEffect, useState } from 'react';
import { PRODUCT } from '../productConfig';
import { EMPTY_LEGAL_DOCS, readLegalDocs, type LegalDocs } from './shape';

/** 等多久就不等了、畫內建條款（暫採）。 */
export const LEGAL_TIMEOUT_MS = 3000;

let pending: Promise<LegalDocs> | null = null;
let settled: LegalDocs | null = PRODUCT.mode === 'full' ? null : EMPTY_LEGAL_DOCS;

export function fetchLegalDocs(): Promise<LegalDocs> {
  if (settled) return Promise.resolve(settled);
  if (!pending) {
    const req = fetch('/api/legal')
      .then(resp => (resp.ok ? resp.json() : null))
      .then(body => readLegalDocs(body))
      .catch(() => EMPTY_LEGAL_DOCS);
    pending = Promise.race([
      req,
      new Promise<LegalDocs>(resolve => setTimeout(() => resolve(EMPTY_LEGAL_DOCS), LEGAL_TIMEOUT_MS)),
    ]).then(docs => {
      settled = docs;
      return docs;
    });
  }
  return pending;
}

/** 讀到之前是 null（呼叫端畫「载入中」，不先閃一份內建條款再換掉）。 */
export function useLegalDocs(): LegalDocs | null {
  const [docs, setDocs] = useState<LegalDocs | null>(settled);
  useEffect(() => {
    if (docs) return;
    let alive = true;
    void fetchLegalDocs().then(d => {
      if (alive) setDocs(d);
    });
    return () => {
      alive = false;
    };
  }, [docs]);
  return docs;
}
