import { describe, it, expect } from 'vitest';
import { scoreKitV3, type KitV3Answers, type MchatScoring } from '../src/t2/kitv3/score';
import { BANK as MCHAT } from '../src/t2/kitv3/mchat-rf';
import { MCHAT_RF } from '../src/t2/toolkit/mchat-rf';

/**
 * M-CHAT-R/F 第一階段（T2 v3 題庫規格 §4.2、R-18）。期望值照頁面 `isRisk`／`total`／`bandOf`；0–3 照 R-18 暫採。
 */

const S = MCHAT.scoring as MchatScoring;
const items = MCHAT.forms[0].sections[0].items;

/** 前 `n` 題答風險、其餘答安全。 */
function withRisk(n: number): KitV3Answers {
  return Object.fromEntries(
    items.map((it, i) => {
      const riskYes = S.riskIsYes.includes(it.key);
      const risk = i < n;
      return [it.key, risk === riskYes ? 1 : 0];
    }),
  );
}

describe('M-CHAT-R/F 第一階段', () => {
  it('20 題；第 2、5、12 題答「是」是風險', () => {
    expect(items).toHaveLength(20);
    expect(S.riskIsYes).toEqual(['q2', 'q5', 'q12']);
  });

  // 第 12、20 題新版把全形括號換成半形加空格，其餘只差繁簡；比字數前先把標點與空白收成一樣
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').replace(/？/g, '?');

  it('與 9/08 舊題庫（繁體）逐題同一句：同樣 20 題、同樣的風險方向、每題字數一樣（只差繁簡與括號全半形）', () => {
    const old = MCHAT_RF.sections.flatMap(s => s.items);
    expect(old).toHaveLength(20);
    old.forEach((o, i) => {
      expect(norm(items[i].text).length, `第 ${i + 1} 題`).toBe(norm(o.text).length);
      expect(S.riskIsYes.includes(items[i].key), `第 ${i + 1} 題`).toBe(o.riskAnswer === 'yes');
    });
  });

  it.each([
    [0, 0, 0],
    [2, 0, 0],
    [3, 1, 2],
    [7, 1, 2],
    [8, 2, 3],
    [20, 2, 3],
  ])('風險 %i 題 → 第 %i 段、0–3 是 %i', (n, band, grade) => {
    const r = scoreKitV3(MCHAT, withRisk(n), { ageM: 20 });
    expect(r.total.value).toBe(n);
    expect(r.total.band).toBe(band);
    expect(r.grade03).toEqual({ SOC: grade });
    expect(r.missing).toEqual([]);
  });
});
