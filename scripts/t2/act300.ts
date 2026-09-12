/**
 * 從舊原型的 `files/sxk_t2_activities.js` 取出 `ACT300`，印成 `src/t2/act300.ts`。
 *
 * `ACT300` 是舊原型（2026-08-21 的量表評估中心）唯一還在用的東西：300 個活動的名稱與
 * 適齡字串（規格 v2 §7.1、票 #44）。那份 JS 只有三個純資料宣告（`ACT300`、`ACT_DIRS`、
 * `DOM2DIR`），用題庫同一套沙箱讀法（`literals.ts`）：只收字面量、一行都不執行。
 *
 * 這裡只抄名稱與適齡**原文**，不解析、不推維度 —— 那些是 `src/t2/activitySeed.ts` 的事，
 * 而且要能在測試裡對「3–8岁 → 36–96」逐條釘住。原文留一份在 repo 裡，解析規則改了
 * 才有東西可以重跑。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { collectDataDeclarations } from './literals';

/** 與產出檔裡宣告的是同一個形狀。不從那邊 import：第一次產生時它還不存在。 */
export interface Act300Entry {
  no: number;
  name: string;
  age: string;
}

export const ACT300_SOURCE = 'files/sxk_t2_activities.js';
export const ACT300_MODULE = 'src/t2/act300.ts';
export const ACT300_COUNT = 300;

export function readAct300(root: string): { entries: Act300Entry[]; sha256: string } {
  const source = readFileSync(path.join(root, ACT300_SOURCE), 'utf8');
  const sha256 = createHash('sha256').update(source).digest('hex');
  const decl = collectDataDeclarations(source).get('ACT300');
  if (!decl) throw new Error(`${ACT300_SOURCE} 裡找不到純資料的 ACT300 宣告`);
  return { entries: toEntries(decl.value), sha256 };
}

/**
 * 原型的形狀是 `{"1": {name, age}, …, "300": {…}}`。這裡把每一格都驗過：
 * 少一號、多一號、name 或 age 不是字串，都直接丟出來 —— 抽取腳本安靜地跳過一格，
 * 下游就會有一支活動永遠不存在而沒有人知道。
 */
function toEntries(value: unknown): Act300Entry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ACT300 不是物件');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== ACT300_COUNT) throw new Error(`ACT300 有 ${keys.length} 格，應為 ${ACT300_COUNT}`);

  const entries: Act300Entry[] = [];
  for (let no = 1; no <= ACT300_COUNT; no++) {
    const cell = record[String(no)];
    if (!cell || typeof cell !== 'object') throw new Error(`ACT300[${no}] 不存在或不是物件`);
    const { name, age } = cell as Record<string, unknown>;
    if (typeof name !== 'string' || name.trim() === '') throw new Error(`ACT300[${no}].name 不是非空字串`);
    if (typeof age !== 'string' || age.trim() === '') throw new Error(`ACT300[${no}].age 不是非空字串`);
    entries.push({ no, name, age });
  }
  return entries;
}

/** `src/t2/act300.ts` 該長什麼樣。逐位元可重現：一格一行、單引號、沒有時間戳。 */
export function emitAct300Module(entries: Act300Entry[], sha256: string): string {
  const rows = entries.map(e => `  { no: ${e.no}, name: ${quote(e.name)}, age: ${quote(e.age)} },`);
  return [
    '/**',
    ' * 舊原型的 300 個活動：編號、名稱、適齡原文。',
    ' *',
    ` * 由 \`scripts/t2-extract-act300.ts\` 從 \`${ACT300_SOURCE}\` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，`,
    ' * 而且 `test/activitySeed.test.ts` 會比對這一份與腳本重跑的結果。',
    ` * 來源檔 sha256 ${sha256.slice(0, 12)}…。`,
    ' *',
    ' * 這裡是**原文**：適齡是「3–8岁」這種字串，還沒解析成月齡；模組、維度也還沒推。',
    ' * 解析與推導在 `activitySeed.ts`，那裡的規則每一條都有測試釘著。',
    ' */',
    '',
    'export interface Act300Entry {',
    '  /** 1–300。模組＝ceil(no / 20)。 */',
    '  no: number;',
    '  name: string;',
    '  /** 原型的適齡字串：「3–8岁」「6个月–3岁」「全龄」。 */',
    '  age: string;',
    '}',
    '',
    'export const ACT300: ReadonlyArray<Act300Entry> = [',
    ...rows,
    '];',
    '',
  ].join('\n');
}

export function renderAct300Module(root: string): string {
  const { entries, sha256 } = readAct300(root);
  return emitAct300Module(entries, sha256);
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
