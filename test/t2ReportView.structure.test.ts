import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import { STATUS_WORDING } from '../src/utils/statusWording';
import { DIMENSION_STATE_SENTENCE, DIMENSION_STATE_LABEL, RETEST_SENTENCE } from '../src/t2/reportCopy';

/**
 * 報告頁的結構護欄（票 #61，規格 §6.3、§6.4）。專案沒有 jsdom，畫面上出現什麼字只能讀原始碼。
 *
 * 釘六件事：
 * 1. **段落順序**（§6.3）：safety 橫幅 → 總覽 → 逐維度 → no_tool 專屬段落 → 氣質 → 目標 → 本週活動
 *    （票 #60 的元件嵌進來）→ closing → 作答回顧。順序在原始碼裡就是渲染順序。
 * 2. **clear 的維度沒有段落；no_tool 有專屬段落**：逐維度那一段只渲染 band 是 watch／refer 的 prose；
 *    no_tool 從快照裡挑、另成一段並導向四種服務。
 * 3. **partial／not_assessed 的顯示與 clear 不同**（§5.7）：三種「沒有判定」各有自己的句子與標籤，
 *    沒有一句與 clear 的三級標示相同。顏色（v2.1 S02）：沒做的帶 T1 的紅／黃，`no_tool` 走灰（`tone`）。
 * 4. **模板與 AI 走同一個畫面**：元件不看 `isAiGenerated` 分岔渲染，只拿它標來源（三態沿用 T1 的那一份）。
 * 5. **題目原文不手抄**：22 支的題目沒有一句出現在元件或句子層裡；回顧走 `reviewGroups`。
 * 6. **tier 內部名稱不出現**：元件不讀 `sections[*].tier`、不印 `tier`。
 * 7. **CONSEQ／PLAN 兩段**（v2.1 §6.3）：在逐維度卡片裡、規則輸出不經 AI、空的時候整段不出。
 * 8. **不篩的維度整格不出**（v2.1 S08）：九宮格走 `gridDimensions`。
 * 9. **「三个月后重评」**（v2.1 S14）：本週活動段的容器之後、closing 之前，規則輸出、不經 AI。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const view = stripComments(read('src/components/T2Report.tsx'));
const copy = stripComments(read('src/t2/reportCopy.ts'));

/** 幾個段落的錨點，依它們在檔案裡出現的位置比順序。 */
function orderOf(anchors: string[]): number[] {
  return anchors.map(a => {
    const at = view.indexOf(a);
    expect(at, `找不到 ${a}`).toBeGreaterThanOrEqual(0);
    return at;
  });
}

describe('段落順序（§6.3）', () => {
  it('safety 橫幅 → 總覽 → 逐維度 → no_tool → 氣質 → 目標 → 本週活動 → 三個月後重評 → closing → 作答回顧', () => {
    const positions = orderOf([
      'id="t2-safety-banner"',
      'id="t2-dimension-grid"',
      'id="t2-per-dimension"',
      'id="t2-no-tool"',
      'id="t2-temperament"',
      'id="t2-goals"',
      'id="t2-weekly"',
      'id="t2-retest"',
      'id="t2-closing"',
      'id="t2-review"',
    ]);
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  });

  it('safety 橫幅原樣印 SAFETY_SENTENCE，並從 overview 開頭拿掉那一份（同一句不連著出現兩次）', () => {
    expect(view).toContain('{SAFETY_SENTENCE}');
    expect(view).toContain('stripSafetyPrefix(prose.overview)');
    expect(view).toContain('hasSafetyConcern(findings)');
  });

  it('「三个月后重评」在本週活動段的容器之後、closing 之前；句子從 reportCopy 來，不看 prose、不看打卡（v2.1 S14）', () => {
    const weeklyEnd = view.indexOf('</section>', view.indexOf('id="t2-weekly"'));
    const retest = view.indexOf('id="t2-retest"');
    expect(retest).toBeGreaterThan(weeklyEnd);
    expect(retest).toBeLessThan(view.indexOf('id="t2-closing"'));
    // 規則輸出、不經 AI：模板與 AI 兩條路都有，prose 讀不出來也有 —— 容器與 retest 之間沒有任何條件
    const between = view.slice(weeklyEnd, view.indexOf('</p>', retest));
    expect(between).toContain('{RETEST_SENTENCE}');
    expect(between).not.toMatch(/prose|isAiGenerated|&&|\?/);
    expect(view).not.toContain(RETEST_SENTENCE);
  });

  it('第六段嵌的是線上干預（Keep 規格 K11，取代票 #60 的清單），weeklyPlanIntro 在它上面', () => {
    const weekly = view.slice(view.indexOf('id="t2-weekly"'), view.indexOf('</section>', view.indexOf('id="t2-weekly"')));
    expect(weekly).toMatch(/<TrainingSection findings=\{findings\} childName=\{childName\} onBookService=\{onBookService\}/);
    expect(weekly.indexOf('prose.weeklyPlanIntro')).toBeLessThan(weekly.indexOf('<TrainingSection'));
    expect(view).not.toContain('T2WeeklyPlan');
  });
});

describe('哪些維度有段落', () => {
  it('逐維度只渲染 band 是 watch／refer 的 prose；clear 不出段落', () => {
    // `flagged` 是從 prose.perDimension 用快照上的 band 篩出來的。
    expect(view).toMatch(/return band === 'watch' \|\| band === 'refer';/);
    expect(view).not.toMatch(/band === 'clear'/);
  });

  it('no_tool 從快照裡挑、另成一段、導向四種服務', () => {
    expect(view).toMatch(/findings\.dimensions\.filter\(d => d\.band === 'no_tool'\)/);
    const noToolSection = view.slice(view.indexOf('id="t2-no-tool"'), view.indexOf('id="t2-temperament"'));
    expect(noToolSection).toContain('{serviceButtons}');
    // 標題旁那一句與九宮格同一支（v2.1 S05：6 歲以上的認知、語言、動作換成客戶的固定句）
    expect(noToolSection).toContain('dimensionStatus(d, ageMonth).tag');
    expect(view).toContain('serviceTypeDescriptors()');
  });
});

describe('partial／not_assessed 與 clear 分得開（§5.7）', () => {
  it('總覽的九宮格每一格走 dimensionStatus（吃整個維度與測評月齡），帶 data-band 讓三種狀態在畫面上可辨', () => {
    expect(view).toContain('const ageMonth = findings.child.assessedAgeMonth;');
    expect(view).toContain('dimensionStatus(d, ageMonth)');
    expect(view).not.toMatch(/dimensionStatus\(d\.band\)/);
    expect(view).toContain('data-band={d.band}');
  });

  // v2.1 S08：不篩的維度（學習 0–36、注意力 0–11）九宮格不出這一格。格子從 `gridDimensions` 取，
  // 不直接走 `findings.dimensions`（那裡仍是九筆，dimensionStatus 對 not_screened 會丟錯）
  it('九宮格的格子從 gridDimensions 取，不直接 map findings.dimensions', () => {
    const grid = view.slice(view.indexOf('id="t2-dimension-grid"'), view.indexOf('</ul>', view.indexOf('id="t2-dimension-grid"')));
    expect(grid).toContain('gridDimensions(findings).map(d =>');
    expect(grid).not.toContain('findings.dimensions');
  });

  it('三種「沒有判定」的句子與標籤，沒有一個等於 clear 的三級標示', () => {
    const clearWords = new Set([STATUS_WORDING.normal.label, STATUS_WORDING.normal.tag, STATUS_WORDING.normal.describe]);
    for (const text of [...Object.values(DIMENSION_STATE_SENTENCE), ...Object.values(DIMENSION_STATE_LABEL)]) {
      expect(clearWords.has(text), text).toBe(false);
    }
  });

  // v2.1 S02（§4.2）：顏色看 `dimensionStatus` 回的 `tone`（依 `t1Flag`：partial 紅、not_assessed 黃、no_tool 灰），
  // 元件不自己從 band 名稱推，也不再把「沒有判定」一律塗灰
  it('沒做的用 T1 顏色、no_tool 用灰：膠囊的顏色取 tone，紅黃與三級 band 同一組色', () => {
    const uses = view.match(/STATUS_CLASS\[[^\]]*\]/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
    for (const u of uses) expect(u).toBe("STATUS_CLASS[s.kind === 'band' ? s.status : s.tone]");
    expect(view).toMatch(/state: 'bg-brand-cream/);
    expect(view).not.toMatch(/band === '(partial|not_assessed)'/);
  });
});

describe('模板與 AI 同一個畫面', () => {
  it('isAiGenerated 只用來標來源（沿用 T1 的三態），不分岔渲染', () => {
    const uses = view.match(/isAiGenerated/g) ?? [];
    // 型別宣告一次、標來源一次。
    expect(uses.length).toBe(2);
    expect(view).toContain('reportSourceLabel(entry!.isAiGenerated)');
    expect(view).not.toMatch(/isAiGenerated\s*(\?|&&|\|\||===)/);
  });

  it('來源三態的字與 T1 報告本體是同一支函式', () => {
    const body = stripComments(read('src/components/ReportBody.tsx'));
    expect(body).toContain('reportSourceLabel(isAiGenerated)');
    expect(body).not.toContain("'来源未记录'");
  });
});

describe('題目原文只在回顧那一段，而且不手抄', () => {
  it('元件不 import 題庫；回顧走 reviewGroups', () => {
    expect(view).not.toMatch(/from '\.\.\/t2\/toolkit/);
    expect(view).toContain('reviewGroups(findings)');
  });

  it('22 支的題目沒有一句出現在元件或句子層裡', () => {
    for (const id of TOOL_IDS) {
      for (const s of TOOLKIT[id].sections) for (const it of s.items) {
        expect(view, `${id} ${s.key}.${it.no}`).not.toContain(it.text);
        expect(copy, `${id} ${s.key}.${it.no}`).not.toContain(it.text);
      }
    }
  });

  it('句子層的題目經 displayItemText（M-CHAT 轉簡體），選項標籤經 displayPrompt', () => {
    expect(copy).toContain('displayItemText(result.toolId, asked.item)');
    expect(copy).toContain('displayPrompt(toolId, option.label)');
  });
});

describe('tier 內部名稱不出現', () => {
  it('元件不讀 sections／overall 的 tier，也不印 tier', () => {
    expect(view).not.toMatch(/\.tier\b/);
    expect(view).not.toMatch(/\{[^}]*tier[^}]*\}/i);
  });

  it('band 的說法只從 reportCopy（→ statusWording）來，元件裡沒有自己寫的三級', () => {
    for (const w of Object.values(STATUS_WORDING)) {
      expect(view).not.toContain(w.tag);
      expect(view).not.toContain(w.describe);
    }
  });
});

/**
 * CONSEQ／PLAN 兩段的版位（規格 v2.1 §6.3，S09）。取句規則在 `src/t2/advice.ts`、用假資料測在
 * `test/t2Advice.test.ts`；這裡釘畫面那一半：放在哪、從哪裡來、空的時候整段不出。
 */
describe('「若持续不处理」與「建议后续项目」（v2.1 §6.3）', () => {
  const perDimension = view.slice(view.indexOf('id="t2-per-dimension"'), view.indexOf('id="t2-no-tool"'));

  it('在逐維度卡片裡：whyItMatters 之後、caveats 之前，後果段在前、後續項目在後', () => {
    const positions = [
      'p.whyItMatters',
      'data-advice="consequences"',
      'data-advice="plans"',
      'p.caveats.length > 0',
    ].map(a => {
      const at = perDimension.indexOf(a);
      expect(at, `逐維度那一段找不到 ${a}`).toBeGreaterThanOrEqual(0);
      return at;
    });
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  });

  it('規則輸出、不經 AI：句子從快照經 dimensionAdvice（正式資料）取，不讀 prose', () => {
    expect(view).toContain('dimensionAdvice(findings, p.dimensionId)');
    expect(view).not.toMatch(/p\.(consequences|plans)\b/);
    expect(view).not.toMatch(/prose[?!]?\.(consequences|plans|advice)\b/);
  });

  it('空的時候整段不出：沒有 advice、或那一段沒有句子，連段名都不渲染', () => {
    expect(perDimension).toMatch(/advice && advice\.consequences\.length > 0 && \(/);
    expect(perDimension).toMatch(/advice && advice\.plans\.length > 0 && \(/);
  });

  it('段名、段首句、主要／次要方向都從 reportCopy 來，元件裡不自己寫', () => {
    expect(perDimension).toContain('{ADVICE_HEADING.consequences}');
    expect(perDimension).toContain('{ADVICE_LEAD_SENTENCE}');
    expect(perDimension).toContain('{ADVICE_HEADING.plans}');
    expect(perDimension).toContain('ADVICE_RANK_LABEL[');
    // 段首那一句只在後果段：「一般走向」講的是後果，不是後續項目。
    const plansBlock = perDimension.slice(perDimension.indexOf('data-advice="plans"'));
    expect(plansBlock).not.toContain('ADVICE_LEAD_SENTENCE');
  });
});
