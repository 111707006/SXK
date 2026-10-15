import { describe, it, expect } from 'vitest';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { REWRITES, adaptForParents, splitSentences } from '../src/t2/kitv3/textAdapt';
import { findBannedWords } from '../src/utils/parentWording';
import { DIAGNOSIS_NAMES, INSTRUMENT_AND_TREATMENT_NAMES, REPLACED_SCALE_NAMES } from '../src/t2/report/blacklist';

/**
 * 客戶說明的改寫表（量表详解規格 §3、票 D-2）。三條護欄：
 * ① 題庫 `texts` 裡踩到禁字的每一句，改寫表都有一筆；② 每一句改寫過用字掃描；③ 表裡沒有找不到原句的孤兒（客戶換版會紅）。
 */

function allTexts(): string[] {
  const out: string[] = [];
  for (const b of Object.values(KITV3_BANKS)) {
    const t = b.texts;
    if (!t) continue;
    for (const f of Object.values(t.facets)) {
      out.push(f.what, ...f.tips);
      if (f.poleTips) out.push(f.poleTips.hi, f.poleTips.lo);
    }
    for (const l of t.levels ?? []) out.push(l.head, l.txt);
  }
  return out;
}

const sentences = [...new Set(allTexts().flatMap(splitSentences))];

describe('客戶說明的改寫表', () => {
  it('踩到禁字的每一句都在改寫表上', () => {
    const missing = sentences.filter(s => findBannedWords(s).length > 0 && !Object.prototype.hasOwnProperty.call(REWRITES, s));
    expect(missing).toEqual([]);
  });

  it('每一句改寫都過用字掃描', () => {
    const bad = Object.entries(REWRITES).filter(([, r]) => r !== null && findBannedWords(r).length > 0);
    expect(bad).toEqual([]);
  });

  it('表裡的原句都還在題庫裡（沒有孤兒）', () => {
    const known = new Set(sentences);
    expect(Object.keys(REWRITES).filter(k => !known.has(k))).toEqual([]);
  });

  it('家長版的說明全文沒有禁字', () => {
    const hits = allTexts().map(adaptForParents).flatMap(findBannedWords);
    expect(hits).toEqual([]);
  });

  it('家長版的說明也過報告黑名單的診斷名、量表商品名、儀器療程藥物（分段內部名稱那一類不套：說明裡的「明显」是一般形容詞）', () => {
    const words = [...REPLACED_SCALE_NAMES, ...DIAGNOSIS_NAMES, ...INSTRUMENT_AND_TREATMENT_NAMES];
    const hits = allTexts().map(adaptForParents).flatMap(t => words.filter(w => t.toLowerCase().includes(w.toLowerCase())).map(w => `${w} ← ${t.slice(0, 30)}`));
    expect(hits).toEqual([]);
  });

  it('轉介對象照留（使用者 2026-10-15 放行物理治疗等）', () => {
    const t = adaptForParents(KITV3_BANKS['SXK-LANG'].texts!.levels![3].txt);
    expect(t).toContain('语言治疗评估');
  });

  it('不在表上的乾淨句子原樣留著；踩禁字又不在表上的句子拿掉（最後一道防線）', () => {
    expect(adaptForParents('先从扶着开始。')).toBe('先从扶着开始。');
    expect(adaptForParents('先从扶着开始。这一句有落后。')).toBe('先从扶着开始。');
  });
});
