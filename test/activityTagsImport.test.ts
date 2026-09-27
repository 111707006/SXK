import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { planActivityImport } from '../src/utils/activityAdmin';
import { ACTIVITY_SEED, parseAgeRange } from '../src/t2/activitySeed';
import { ACTIVITY_CONTENT } from '../src/t2/activityContent';
import { ACTIVITY_MEDIA } from '../src/t2/activityMedia';
import { DIM_MOD } from '../src/t2/activityMatch';

/**
 * `deploy/activity-tags/` 的汇入档（2026-09-27：17 支示范片的目標月齡與標籤）。
 *
 * 這份檔要在正式站後台「批量匯入」才生效。在那裡才發現一列被退、一欄被忽略，
 * 是改完檔還要再傳一次 —— 而被忽略的欄位是**安靜的**（只進 warnings），
 * 拼錯的 `target` 會讓整支片照舊配不到。所以這裡用同一個 `planActivityImport` 先跑一次。
 */

const DIR = path.resolve(__dirname, '..', 'deploy', 'activity-tags');
const FILE = path.join(DIR, '2026-09-27-module1-videos.json');
const body = JSON.parse(fs.readFileSync(FILE, 'utf8')) as {
  rows: Array<{ id: string; moduleNo: number; targetMonth: number; targets: string[] }>;
};
const EXISTING = new Set(ACTIVITY_SEED.map(a => a.id));

describe('2026-09-27-module1-videos.json', () => {
  it('後台的匯入一列不退、一欄不忽略', () => {
    const plan = planActivityImport({ ...body, dryRun: true }, EXISTING);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.failed).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.ready).toHaveLength(body.rows.length);
  });

  it('正好是有示範片的那 17 支', () => {
    expect(body.rows.map(r => r.id).sort()).toEqual(ACTIVITY_MEDIA.map(m => m.id).sort());
  });

  // 模組一只屬於動作發展：配對只給這個維度自己的 ★ 標籤加分，一個 mot.* 都沒有就拿不到加分。
  it('每支至少一個它所屬維度的標籤', () => {
    for (const r of body.rows) {
      const dims = Object.entries(DIM_MOD).filter(([, mods]) => mods.includes(r.moduleNo as never)).map(([d]) => d);
      expect(dims, r.id).toEqual(['MOT']);
      expect(r.targets.some(t => t.startsWith('mot.')), r.id).toBe(true);
    }
  });

  it('目標月齡落在手冊寫的適齡裡', () => {
    const content = new Map(ACTIVITY_CONTENT.map(a => [a.id, a]));
    for (const r of body.rows) {
      const { min, max } = parseAgeRange(content.get(r.id)!.ageLabel);
      expect(r.targetMonth, r.id).toBeGreaterThanOrEqual(min);
      expect(r.targetMonth, r.id).toBeLessThanOrEqual(max);
    }
  });

  // README 的表是給治療師看的那一份。兩邊對不上，看過的就不是要匯入的。
  it('README 的表與檔案一致', () => {
    const readme = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    for (const r of body.rows) {
      const line = readme.split('\n').find(l => l.startsWith(`| ${r.id} |`));
      expect(line, r.id).toBeDefined();
      const cells = line!.split('|').map(c => c.trim());
      expect(cells[4], r.id).toBe(String(r.targetMonth));
      expect(cells[5], r.id).toBe(r.targets.join(', '));
    }
  });
});
