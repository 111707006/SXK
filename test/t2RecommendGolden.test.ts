import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { recommend } from '../src/t2/recommend/engine';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';
import type { DxCode, KeyTag, Level, RecommendInput } from '../src/t2/recommend/types';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode } from '../src/t2/types';

/**
 * 客規 §11「标准推荐表：诊断 × 年龄」30 格（客戶寫的 IT 验收基准 V2）。
 *
 * `test/fixtures/t2RecommendCells.json` 是從客規逐字轉錄（`docs/reference/client-mockups/森心康_T2量表推荐规则规格书_v1.0-2026-10-06.md`）
 * 用腳本抽出來的：每一格的量表（依順序）、家長分鐘、T3 預告、提示與缺口。
 *
 * 「典型 T1」照客規 §11 開頭那一句：核心維度中度、相關維度輕度、其餘正常、沒有紅旗；自閉症加社交警訊標籤；
 * 語言發展障礙在 A、B 組加無口語標籤。上學與否客規沒說，取「是」；聽力檢查沒做（才會出前置條件）。
 */

interface Cell {
  dx: Exclude<DxCode, 'NONE'>;
  ageM: number;
  tools: string[];
  minutes: number;
  t3: string[];
  notes: string[];
}

const CELLS: Cell[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/t2RecommendCells.json'), 'utf8')).cells;

function typical(dx: Cell['dx'], ageM: number): RecommendInput {
  const profile = RECOMMEND_CONFIG.dx[dx];
  const levels = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, Level>;
  for (const d of profile.rel) levels[d] = 1;
  for (const d of profile.core) levels[d] = 2;
  const extraTags: KeyTag[] = [];
  if (dx === 'ASD') extraTags.push('ASD_SIG');
  if (dx === 'LANG' && ageM < 48) extraTags.push('NONVERBAL');
  return { ageM, levels, rfdims: [], items: {}, dx: [dx], school: true, done: [], extraTags, hearingChecked: null };
}

const squash = (s: string) => s.replace(/\s+/g, '');

describe('客規 §11 標準推薦表（30 格）', () => {
  it('轉錄出來剛好 30 格（6 診斷 × 5 年齡）', () => {
    expect(CELLS).toHaveLength(30);
  });

  it.each(CELLS.map(c => [`${c.dx} ${c.ageM} 個月`, c] as const))('%s', (_, cell) => {
    const r = recommend(typical(cell.dx, cell.ageM));
    expect(r.tools.map(t => t.code), '量表與順序').toEqual(cell.tools);
    expect(r.parentMinutes, '家長分鐘').toBe(cell.minutes);
    expect(r.t3.map(t => t.code), 'T3 預告').toEqual(cell.t3);
    const ours = [...r.alerts.map(a => a.text), ...r.gaps].map(squash);
    for (const note of cell.notes) expect(ours, note).toContain(squash(note));
  });
});
