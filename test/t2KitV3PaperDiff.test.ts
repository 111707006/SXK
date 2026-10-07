import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readDocxBlocks } from '../scripts/t2/docx';
import {
  PAPER_DIR_V3,
  PAPER_ZIP_V3,
  diffBankAgainstPaperV3,
  normalizeV3,
  paperFileForV3,
  paperTextV3,
  similarityV3,
} from '../scripts/t2/paperDiffV3';
import { readZip } from '../scripts/t2/zip';
import { KITV3_BANKS } from '../src/t2/kitv3';

/**
 * 完整版題庫對紙本版（T2 v3 題庫規格 §3.3，票 R3i）。差異不擋上線，但清單上的數字要穩：
 * 題庫重抽或紙本換版，這裡的數字就會動，`docs/reference/T2完整版纸本比对-*.md` 要跟著重印給客戶。
 */

const zip = readZip(readFileSync(path.join(__dirname, '..', PAPER_ZIP_V3)), { unflaggedUtf8Names: true });

describe('紙本檔名對得上', () => {
  it('24 支每一支都找得到自己的紙本 docx', () => {
    for (const bank of Object.values(KITV3_BANKS)) {
      expect(zip.has(PAPER_DIR_V3 + paperFileForV3(bank.source.file)), bank.code).toBe(true);
    }
  });
});

describe('比對的零件', () => {
  it('正規化去掉空白、標點與全半形差異', () => {
    expect(normalizeV3('（共 8 项）走路，跑步！')).toBe(normalizeV3('(共8项)走路跑步'));
  });

  it('相似度：相同 1、毫無共同 0', () => {
    expect(similarityV3('以前会说的词', '以前会说的词')).toBe(1);
    expect(similarityV3('以前会说', '跑跳翻滚')).toBe(0);
  });
});

describe('2026-10-07 的結果（docs/reference/T2完整版纸本比对-2026-10-07.md）', () => {
  const misses = Object.fromEntries(
    Object.values(KITV3_BANKS).map(bank => {
      const file = paperFileForV3(bank.source.file);
      const d = diffBankAgainstPaperV3(bank, file, paperTextV3(readDocxBlocks(zip.get(PAPER_DIR_V3 + file)!)));
      return [bank.code, d.misses.length];
    }),
  );

  it('只有五支有差異，其餘 19 支逐句都在紙本上', () => {
    expect(Object.fromEntries(Object.entries(misses).filter(([, n]) => n > 0))).toEqual({
      'SXK-ASB': 4,
      'SXK-ASR': 5,
      'SXK-AB': 1,
      'SXK-ATT': 1,
      'SXK-TIC': 15,
    });
  });
});
