import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 系統只有一個名字。
 *
 * 【為什麼需要這一條】
 * 產品名散在三個欄位裡：`documentTitle`（瀏覽器分頁）、`headerTitle`（頁首與
 * 登入卡）、`copyright`（頁尾版權列）。三個欄位、三個人在不同時間改，到
 * 2026-09-10 已經變成三個名字：
 *
 *   分頁    儿童发育评估系统
 *   頁首    儿童综合发展评估        ← 少了「系统」
 *   頁尾    儿童神经网络分层评估系统  ← 完全是另一個名字
 *
 * 使用者看到的是同一個畫面。他問的是「哪一個才是真的」，而程式碼答不出來。
 *
 * 壞掉的樣子非常安靜：每一個欄位單獨看都是合理的字串，型別也全對，沒有任何
 * 東西會變紅。只有把三處擺在一起看才發現對不上 —— 而沒有人會特地去擺。
 *
 * 【不在這個約定裡的兩個】
 * - `reportTitle`：那是**報告產生器**的名字，不是系統名
 * - `systemName`：條款內文用的法律全名，動它等於改一份已核可的法律文件
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 兩個產品共同的系統名。A 在前面多一個品牌前綴。 */
const SYSTEM_NAME = '儿童综合发展评估系统';

/** 要求說同一件事的三個欄位。 */
const NAME_FIELDS = ['documentTitle', 'headerTitle', 'copyright'] as const;

const source = read('src/productConfig.ts');

/** 取出某個 profile 的字面量區塊。 */
function profileBlock(name: 'full' | 't1only'): string {
  const start = source.indexOf(`${name}: {`);
  expect(start, `找不到 ${name} profile —— productConfig 改過結構，這支測試要一起更新`).toBeGreaterThan(0);
  const end = name === 'full' ? source.indexOf('t1only: {', start) : source.indexOf('\n};', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** 讀出某個欄位的字串值。 */
function fieldValue(block: string, field: string): string {
  const m = block.match(new RegExp(`\\n\\s*${field}:\\s*'([^']*)'`));
  expect(m, `${field} 讀不到 —— 它必須是單引號字串字面量，這支測試才看得到它`).not.toBeNull();
  return m![1];
}

describe.each([
  ['專案 A', 'full', '森心康'],
  ['專案 B', 't1only', ''],
] as const)('%s 的系統名', (_label, profile, prefix) => {
  const block = profileBlock(profile);

  it.each(NAME_FIELDS)(`%s 帶著「${SYSTEM_NAME}」`, field => {
    expect(fieldValue(block, field)).toContain(SYSTEM_NAME);
  });

  if (prefix) {
    it(`三處都帶著品牌前綴「${prefix}」`, () => {
      for (const field of NAME_FIELDS) {
        expect(fieldValue(block, field)).toContain(prefix);
      }
    });
  } else {
    // B 交付給合作公司，畫面上不得出現森心康 —— 與 brandIsolation.test.ts 同一條規則，
    // 這裡再釘一次是因為系統名最容易在「順手加個品牌」的時候破功。
    it('三處都不帶品牌名', () => {
      for (const field of NAME_FIELDS) {
        expect(fieldValue(block, field)).not.toContain('森心康');
      }
    });
  }
});

describe('舊名字不准回來', () => {
  /**
   * 這三個是 2026-09-10 統一之前散在各處的舊名字。它們單獨看都像是合理的產品名，
   * 所以會在有人「覺得這樣比較好聽」的時候悄悄回鍋。
   */
  it.each([
    '儿童神经网络分层评估系统',
    '神经网络科学技术实验室',
    '儿童发育评估系统',
  ])('「%s」不再出現在任何 profile 的設定值裡', old => {
    for (const profile of ['full', 't1only'] as const) {
      const block = profileBlock(profile);
      // 只看那三個欄位的值，不看註解 —— 註解裡本來就要寫出舊名字才說得清楚。
      for (const field of NAME_FIELDS) {
        expect(fieldValue(block, field)).not.toContain(old);
      }
    }
  });
});

describe('評估面板最上面那塊卡片（App.tsx）', () => {
  /**
   * 頁首、分頁、頁尾 2026-09-10 統一之後，家長往下捲一格就看到第四個名字：
   * 綠色卡片的大標題寫死「儿童神经网络综合发展评估」，上面還掛一顆
   * 「儿童生长发育评定专家」的膠囊。2026-09-11 客戶圈出來要求統一成系統名。
   *
   * 讀原始碼並去掉註解 —— 註解裡本來就要寫出舊名字才說得清楚它為什麼不能回來。
   */
  const app = read('src/App.tsx')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  it('標題讀的是 PRODUCT.brand.headerTitle，跟頁首同一個來源', () => {
    expect(app).toContain('{PRODUCT.brand.headerTitle}');
  });

  it.each(['儿童神经网络综合发展评估', '儿童生长发育评定专家'])('「%s」不再寫死在畫面上', old => {
    expect(app).not.toContain(old);
  });
});
