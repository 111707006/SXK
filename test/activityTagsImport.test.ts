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

/**
 * `2026-11-07-videos.json`（ADR-0015）：正式站 2026-11-07 有示範片的 94 支（`/var/www/sxk/media/activities/` 的 mp4），
 * 標籤由手冊「练什么」、模組與腳本「怎么看出有进步」對到 ★ 標籤，`targetMonth` 是手冊適齡區間的中間（往下取整）。
 */
describe('2026-11-07-videos.json', () => {
  const FILE_1107 = path.join(DIR, '2026-11-07-videos.json');
  const body1107 = JSON.parse(fs.readFileSync(FILE_1107, 'utf8')) as {
    rows: Array<{ id: string; moduleNo: number; targetMonth: number; targets: string[] }>;
  };
  const VIDEO_IDS_20261107 = (
    'A001 A002 A003 A004 A005 A006 A007 A008 A009 A010 A011 A012 A013 A014 A015 A016 A017 A018 A019 A020 A021 A022 A023 A024 ' +
    'A025 A026 A027 A035 A061 A062 A063 A064 A065 A066 A067 A068 A069 A070 A071 A072 A075 A076 A077 A078 A079 A080 A081 A083 ' +
    'A084 A085 A086 A089 A090 A121 A122 A123 A124 A125 A128 A129 A132 A134 A136 A137 A139 A141 A142 A145 A146 A147 A148 A149 ' +
    'A150 A182 A183 A184 A185 A186 A187 A188 A192 A193 A194 A195 A197 A198 A199 A202 A203 A205 A206 A207 A209 A210'
  ).split(' ');

  it('後台的匯入一列不退、一欄不忽略', () => {
    const plan = planActivityImport({ ...body1107, dryRun: true }, EXISTING);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.failed).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.ready).toHaveLength(94);
  });

  it('正好是 2026-11-07 正式站有示範片的 94 支', () => {
    expect(body1107.rows.map(r => r.id)).toEqual(VIDEO_IDS_20261107);
  });

  it('targetMonth 是手冊適齡區間的中間；每支 1–3 個標籤、不重複', () => {
    const content = new Map(ACTIVITY_CONTENT.map(a => [a.id, a]));
    for (const r of body1107.rows) {
      const { min, max } = parseAgeRange(content.get(r.id)!.ageLabel);
      expect(r.targetMonth, r.id).toBe(Math.floor((min + max) / 2));
      expect(r.targets.length, r.id).toBeGreaterThanOrEqual(1);
      expect(r.targets.length, r.id).toBeLessThanOrEqual(3);
      expect(new Set(r.targets).size, r.id).toBe(r.targets.length);
    }
  });

  it('README 的表與檔案一致', () => {
    const readme = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    const section = readme.slice(readme.indexOf('## 2026-11-07-videos.json'));
    for (const r of body1107.rows) {
      const line = section.split('\n').find(l => l.startsWith(`| ${r.id} |`));
      expect(line, r.id).toBeDefined();
      const cells = line!.split('|').map(c => c.trim());
      expect(cells[5], r.id).toBe(String(r.targetMonth));
      expect(cells[6], r.id).toBe(r.targets.join(', '));
    }
  });
});
