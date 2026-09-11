import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readZip } from '../scripts/t2/zip';
import { PAPER_FILES, PAPER_ROOT, PAPER_ZIP, readPaperTool } from '../scripts/t2/paper';
import { diffToolAgainstPaper, type ToolDiff } from '../scripts/t2/paperDiff';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';

/**
 * 題庫常數對紙本版逐題比對（#41）。
 *
 * 【為什麼需要這一條】
 * 常數是從 09-08 工具包的 HTML 抽的，紙本版（09-10 docx）才是題目文字的權威
 * （規格 v2 §1）。規格記錄「17 支零差異」但沒說是哪 17 支 —— 這裡把 22 支全部比一遍，
 * 結果是 **22 支面向與題目零差異，1066 題**。這條測試把那個數字釘住：工具包或紙本
 * 任何一邊換版，先紅的是這裡。
 *
 * 比對邏輯與 `scripts/t2-diff-paper.ts` 共用（`scripts/t2/paperDiff.ts`）；腳本印報告，
 * 這裡斷言。已知的「其他差異」（選項標籤的排版差、紙本沒印的東西）逐條列出，
 * 多一條少一條都算變化。
 */

const ROOT = path.resolve(__dirname, '..');

let diffs: Map<ToolId, ToolDiff>;

beforeAll(() => {
  const zip = readZip(fs.readFileSync(path.join(ROOT, PAPER_ZIP)));
  diffs = new Map(TOOL_IDS.map(id => {
    const docx = zip.get(PAPER_ROOT + PAPER_FILES[id]);
    if (!docx) throw new Error(`紙本 zip 裡沒有 ${PAPER_FILES[id]}`);
    return [id, diffToolAgainstPaper(TOOLKIT[id], readPaperTool(id, docx))];
  }));
});

describe('紙本比對跑 22 支', () => {
  it('零差異的支數 ≥ 17（規格 §1 的記錄）—— 實際是 22 支全部零差異', () => {
    const zero = TOOL_IDS.filter(id => diffs.get(id)!.itemDiffs.length === 0);
    expect(zero.length).toBeGreaterThanOrEqual(17);
    expect(zero).toEqual([...TOOL_IDS]);
  });

  for (const id of TOOL_IDS) {
    it(`${id}：面向與題目零差異`, () => {
      expect(diffs.get(id)!.itemDiffs).toEqual([]);
    });
  }

  it('比對到的題數就是 22 支的題數總和 1066', () => {
    const total = TOOL_IDS.reduce((n, id) => n + diffs.get(id)!.itemsCompared, 0);
    expect(total).toBe(1066);
  });

  it('已知的其他差異只有三處：WARN 表頭的選項寫法、LDP／LDS 的「从未」在紙本是「没有」', () => {
    const others = Object.fromEntries(TOOL_IDS.map(id => [id, diffs.get(id)!.otherDiffs]).filter(([, d]) => (d as string[]).length));
    expect(others).toEqual({
      'sxk-warn': ['選項標籤：常數「未见异常／阳性」，紙本表頭「阳性／未见」'],
      'sxk-ldp': ['選項標籤：常數「从未／偶尔／经常／总是」，紙本表頭「没有／偶尔／经常／总是」'],
      'sxk-lds': ['選項標籤：常數「从未／偶尔／经常／总是」，紙本表頭「没有／偶尔／经常／总是」'],
    });
  });

  it('分段與紙本「分數解讀」一致的 18 支沒有任何分段差異；沒有那張表的是 chexi、snap-iv、tempa／b', () => {
    const noTable = TOOL_IDS.filter(id => diffs.get(id)!.notes.some(n => n.includes('沒有「分數解讀」')));
    expect(noTable).toEqual(['snap-iv', 'chexi', 'sxk-tempa', 'sxk-tempb']);
    for (const id of TOOL_IDS) {
      expect(diffs.get(id)!.otherDiffs.filter(d => d.startsWith('分段')), id).toEqual([]);
    }
  });

  it('無法逐題比對的部分有寫明：ASR 的錨點紙本沒印、CHEXI 紙本重新編號、LDP／LDS 各方面分段紙本沒有表', () => {
    expect(diffs.get('sxk-asr')!.notes.some(n => n.includes('錨點'))).toBe(true);
    expect(diffs.get('chexi')!.notes.some(n => n.includes('重新編號'))).toBe(true);
    expect(diffs.get('sxk-ldp')!.notes.some(n => n.includes('domLevel'))).toBe(true);
    expect(diffs.get('sxk-lds')!.notes.some(n => n.includes('domLevel'))).toBe(true);
  });

  it('ADL 七級定義全文與紙本一致（沒有列在其他差異裡）', () => {
    expect(diffs.get('sxk-adl')!.otherDiffs).toEqual([]);
  });
});
