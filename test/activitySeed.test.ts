import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ACT300 } from '../src/t2/act300';
import {
  ACTIVITY_SEED,
  ALL_AGES,
  MODULE_DIMENSIONS,
  MODULE_TITLES,
  activityIdOf,
  moduleNoOf,
  parseAgeRange,
} from '../src/t2/activitySeed';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, ModuleNo } from '../src/t2/types';
import { T1_AGE_RANGE } from '../src/t1Data';
import { ACT300_MODULE, renderAct300Module } from '../scripts/t2/act300';
import { sameToolkitContent } from '../scripts/t2/extract';
import {
  ACTIVITIES_MIGRATION,
  SEED_BEGIN,
  SEED_END,
  renderActivitySeedSql,
  extractCreateTable,
} from '../scripts/t2/activitySql';

/**
 * 活動種子的測試（#44，規格 v2 §7.1、§7.2、§9.1、附錄 B.3）。
 *
 * 【為什麼需要這些】
 * 300 支活動是從舊原型的名稱與「3–8岁」這種字串**算**出來的：模組是 `ceil(編號 / 20)`、
 * 月齡是解析字串、維度是照附錄 B.3 從模組反查。算錯不會有型別錯誤 —— 「6个月–3岁」
 * 若被讀成 72–36，那支活動永遠配不到，而畫面上沒有任何一處看得出來。這裡把每一條
 * 規則釘住，再把 300 支整批掃一次。
 *
 * 最後兩組是地基：`src/t2/act300.ts` 必須就是腳本從原型 JS 重跑的結果（沒有人手改），
 * 遷移檔裡的 INSERT 必須就是 `ACTIVITY_SEED` 印出來的（TS 與 SQL 沒有各自漂移）。
 */

const ROOT = path.resolve(__dirname, '..');

describe('適齡字串 → 月齡區間（§7.1）', () => {
  it.each([
    ['3–8岁', 36, 96],
    ['6个月–3岁', 6, 36],
    ['1–5岁', 12, 60],
    ['6个月–4岁', 6, 48],
    ['2–6岁', 24, 72],
    ['1–3岁', 12, 36],
    ['5–8岁', 60, 96],
  ])('「%s」→ %i–%i', (text, min, max) => {
    expect(parseAgeRange(text)).toEqual({ min, max });
  });

  it('「全龄」是一個明確的記號，不是解析失敗：0 到平台服務的最大月齡', () => {
    // 原型沒給數字，這裡不憑空發明一個上限：平台自己的上限（`T1_AGE_RANGE`）就是「全部」。
    expect(parseAgeRange('全龄')).toEqual(ALL_AGES);
    expect(ALL_AGES).toEqual({ min: 0, max: T1_AGE_RANGE.maxMonths });
    expect(ALL_AGES.max).toBeGreaterThanOrEqual(96); // 不能比任何一支「–8岁」的活動還窄
  });

  it('「全龄／收官」的「收官」是備註，去掉之後就是全龄', () => {
    expect(parseAgeRange('全龄／收官')).toEqual(ALL_AGES);
  });

  it.each([
    ['', '空字串'],
    ['3岁', '只有一個數字'],
    ['3-8', '沒有單位'],
    ['三到八岁', '中文數字'],
    ['8–3岁', '下限大於上限'],
    ['全龄／完結', '不認得的備註'],
    ['3–8岁以上', '多出來的字'],
    ['0–0岁', '零到零'],
  ])('「%s」（%s）要丟例外，不能靜默給預設值', text => {
    expect(() => parseAgeRange(text)).toThrow();
  });
});

describe('編號 → 模組（§7.2：ceil(編號 / 20)）', () => {
  it.each([
    [1, 1], [20, 1], [21, 2], [40, 2], [41, 3], [60, 3], [61, 4], [120, 6], [121, 7],
    [180, 9], [181, 10], [240, 12], [241, 13], [299, 15], [300, 15],
  ])('%i → 模組 %i', (no, moduleNo) => {
    expect(moduleNoOf(no)).toBe(moduleNo);
  });

  it.each([0, 301, -1, 1.5, Number.NaN])('編號 %s 不在 1–300 → 丟例外', no => {
    expect(() => moduleNoOf(no)).toThrow();
  });

  it('編號印成 A 加三位數', () => {
    expect(activityIdOf(1)).toBe('A001');
    expect(activityIdOf(17)).toBe('A017');
    expect(activityIdOf(300)).toBe('A300');
  });

  it('15 個模組的名稱照 §7.2', () => {
    expect(MODULE_TITLES).toEqual({
      1: '身體動一動', 2: '平衡與協調', 3: '力氣與耐力', 4: '小手動起來', 5: '畫畫寫寫前',
      6: '自己來', 7: '聽懂與回應', 8: '詞彙與說話', 9: '聊天與說故事', 10: '認識情緒',
      11: '情緒來了怎麼辦', 12: '和人一起玩', 13: '專心與記憶', 14: '看與想', 15: '動腦與解決問題',
    });
  });
});

describe('模組 → 維度初值（附錄 B.3，從規格重抄一次）', () => {
  // 「模組 1–5 → MOT（4、5 另加 ADL；2、3、5 另加 SEN）；6 → ADL；7–9 → LANG（7、9 另加
  //  ATT、SOC、COG）；10–12 → EMO（12 另加 SOC）；13–15 → COG（另加 ATT、LEARN）」
  const B3: Record<ModuleNo, DimensionCode[]> = {
    1: ['MOT'],
    2: ['MOT', 'SEN'],
    3: ['MOT', 'SEN'],
    4: ['MOT', 'ADL'],
    5: ['MOT', 'ADL', 'SEN'],
    6: ['ADL'],
    7: ['LANG', 'ATT', 'SOC', 'COG'],
    8: ['LANG'],
    9: ['LANG', 'ATT', 'SOC', 'COG'],
    10: ['EMO'],
    11: ['EMO'],
    12: ['EMO', 'SOC'],
    13: ['COG', 'ATT', 'LEARN'],
    14: ['COG', 'ATT', 'LEARN'],
    15: ['COG', 'ATT', 'LEARN'],
  };

  it('15 個模組逐格相符', () => {
    expect(MODULE_DIMENSIONS).toEqual(B3);
  });

  it('票 #44 點名的兩格：模組 4 → MOT＋ADL；模組 7 → LANG＋ATT＋SOC＋COG', () => {
    expect(MODULE_DIMENSIONS[4]).toEqual(['MOT', 'ADL']);
    expect(MODULE_DIMENSIONS[7]).toEqual(['LANG', 'ATT', 'SOC', 'COG']);
  });

  it('每一格都是合法的維度碼，且不重複', () => {
    for (const dims of Object.values(MODULE_DIMENSIONS)) {
      expect(dims.length).toBeGreaterThan(0);
      expect(new Set(dims).size).toBe(dims.length);
      for (const d of dims) expect(DIMENSION_CODES).toContain(d);
    }
  });
});

describe('300 支種子（票 #44 驗收）', () => {
  it('恰好 300 支，id 是 A001–A300、不重複、依編號排序', () => {
    expect(ACTIVITY_SEED).toHaveLength(300);
    expect(ACTIVITY_SEED.map(a => a.id)).toEqual(ACT300.map(e => activityIdOf(e.no)));
    expect(new Set(ACTIVITY_SEED.map(a => a.id)).size).toBe(300);
  });

  it('moduleNo、ageMonths 全部算得出且無 null', () => {
    for (const a of ACTIVITY_SEED) {
      expect(a.moduleNo).toBeGreaterThanOrEqual(1);
      expect(a.moduleNo).toBeLessThanOrEqual(15);
      expect(Number.isInteger(a.ageMonths.min)).toBe(true);
      expect(Number.isInteger(a.ageMonths.max)).toBe(true);
      expect(a.ageMonths.min).toBeGreaterThanOrEqual(0);
      expect(a.ageMonths.max).toBeGreaterThan(a.ageMonths.min);
    }
  });

  it('模組 1–15 各 20 支', () => {
    const count = new Map<number, number>();
    for (const a of ACTIVITY_SEED) count.set(a.moduleNo, (count.get(a.moduleNo) ?? 0) + 1);
    expect([...count.entries()].sort((x, y) => x[0] - y[0])).toEqual(
      Array.from({ length: 15 }, (_, i) => [i + 1, 20])
    );
  });

  it('標題與適齡都對得回原型那一格', () => {
    for (const [i, a] of ACTIVITY_SEED.entries()) {
      const e = ACT300[i];
      expect(a.title).toBe(e.name);
      expect(a.moduleNo).toBe(moduleNoOf(e.no));
      expect(a.ageMonths).toEqual(parseAgeRange(e.age));
    }
  });

  it('維度初值 = 該模組在附錄 B.3 的那一格', () => {
    for (const a of ACTIVITY_SEED) expect(a.dimensions).toEqual(MODULE_DIMENSIONS[a.moduleNo]);
  });

  it('內容團隊還沒填的欄位：targets 空、targetMonth 全 null、steps 空、active 為真', () => {
    for (const a of ACTIVITY_SEED) {
      expect(a.targets).toEqual([]);
      expect(a.avoidIf).toEqual([]);
      expect(a.targetMonth).toBeNull();
      expect(a.steps).toEqual([]);
      expect(a.equipment).toEqual([]);
      expect(a.durationMin).toBe(0);
      expect(a.videoUrl).toBeNull();
      expect(a.active).toBe(true);
    }
  });

  it('兩支「全龄」的活動（20、300）拿到的是 ALL_AGES，不是某個猜出來的數字', () => {
    expect(ACTIVITY_SEED[19].ageMonths).toEqual(ALL_AGES);
    expect(ACTIVITY_SEED[299].ageMonths).toEqual(ALL_AGES);
  });
});

describe('地基：原文與 SQL 都是算出來的，沒有人手改', () => {
  it('src/t2/act300.ts 與腳本從 files/sxk_t2_activities.js 重跑的結果逐位元一致', () => {
    const onDisk = fs.readFileSync(path.join(ROOT, ACT300_MODULE), 'utf8');
    expect(sameToolkitContent(onDisk, renderAct300Module(ROOT))).toBe(true);
  });

  it('遷移檔裡的種子區段 = renderActivitySeedSql(ACTIVITY_SEED)', () => {
    const migration = fs.readFileSync(path.join(ROOT, ACTIVITIES_MIGRATION), 'utf8').replace(/\r\n/g, '\n');
    const begin = migration.indexOf(SEED_BEGIN);
    const end = migration.indexOf(SEED_END);
    expect(begin, `遷移檔缺少 ${SEED_BEGIN}`).toBeGreaterThan(-1);
    expect(end, `遷移檔缺少 ${SEED_END}`).toBeGreaterThan(begin);
    const block = migration.slice(begin + SEED_BEGIN.length, end);
    expect(block.trim()).toBe(renderActivitySeedSql(ACTIVITY_SEED).trim());
  });

  it('種子 SQL 是一句 INSERT、300 列、重跑不覆蓋內容團隊改過的東西', () => {
    const sql = renderActivitySeedSql(ACTIVITY_SEED);
    // migrate.mjs 用分號切句：整段裡只能有結尾那一個分號，否則種子會被切成兩句半。
    expect(sql.match(/;/g)?.length ?? 0).toBe(1);
    expect(sql).toMatch(/^INSERT INTO `activities`/);
    expect(sql.match(/^\s*\('A\d{3}',/gm)).toHaveLength(300);
    expect(sql).toContain('ON DUPLICATE KEY UPDATE `id` = `id`');
    expect(sql).toContain("('A017', '跟着音乐动'");
  });

  it('deploy/schema.sql 與遷移檔的 CREATE TABLE `activities` 一字不差', () => {
    const schema = fs.readFileSync(path.join(ROOT, 'deploy/schema.sql'), 'utf8');
    const migration = fs.readFileSync(path.join(ROOT, ACTIVITIES_MIGRATION), 'utf8');
    const fromSchema = extractCreateTable(schema, 'activities');
    const fromMigration = extractCreateTable(migration, 'activities');
    expect(fromSchema).not.toBeNull();
    expect(fromMigration).not.toBeNull();
    expect(fromSchema).toBe(fromMigration);
    // 票 #44：ADR-0005 的欄位＋ module_no INT ＋ target_month INT NULL
    for (const col of [
      '`id`', '`title`', '`module_no` INT', '`target_month` INT', '`age_min_month`', '`age_max_month`',
      '`dimensions` JSON', '`targets` JSON', '`avoid_if` JSON', '`duration_min`', '`equipment` JSON',
      '`steps` JSON', '`video_url`', '`active`',
    ]) {
      expect(fromSchema, `缺欄位 ${col}`).toContain(col);
    }
    expect(fromSchema).not.toContain('company_id');
  });
});
