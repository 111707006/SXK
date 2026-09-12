import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import { STATUS_WORDING } from '../src/utils/statusWording';
import { DIMENSION_STATE_SENTENCE, DIMENSION_STATE_LABEL } from '../src/t2/reportCopy';

/**
 * 報告頁的結構護欄（票 #61，規格 §6.3、§6.4）。專案沒有 jsdom，畫面上出現什麼字只能讀原始碼。
 *
 * 釘六件事：
 * 1. **段落順序**（§6.3）：safety 橫幅 → 總覽 → 逐維度 → no_tool 專屬段落 → 氣質 → 目標 → 本週活動
 *    （票 #60 的元件嵌進來）→ closing → 作答回顧。順序在原始碼裡就是渲染順序。
 * 2. **clear 的維度沒有段落；no_tool 有專屬段落**：逐維度那一段只渲染 band 是 watch／refer 的 prose；
 *    no_tool 從快照裡挑、另成一段並導向四種服務。
 * 3. **partial／not_assessed 的顯示與 clear 不同**（§5.7）：三種「沒有判定」各有自己的句子與標籤，
 *    沒有一句與 clear 的三級標示相同，膠囊走灰色那一組（不在綠黃紅那把尺上）。
 * 4. **模板與 AI 走同一個畫面**：元件不看 `isAiGenerated` 分岔渲染，只拿它標來源（三態沿用 T1 的那一份）。
 * 5. **題目原文不手抄**：22 支的題目沒有一句出現在元件或句子層裡；回顧走 `reviewGroups`。
 * 6. **tier 內部名稱不出現**：元件不讀 `sections[*].tier`、不印 `tier`。
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
  it('safety 橫幅 → 總覽 → 逐維度 → no_tool → 氣質 → 目標 → 本週活動 → closing → 作答回顧', () => {
    const positions = orderOf([
      'id="t2-safety-banner"',
      'id="t2-dimension-grid"',
      'id="t2-per-dimension"',
      'id="t2-no-tool"',
      'id="t2-temperament"',
      'id="t2-goals"',
      'id="t2-weekly"',
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

  it('本週活動嵌的是票 #60 的元件，weeklyPlanIntro 在它上面', () => {
    expect(view).toMatch(/<T2WeeklyPlan onBookService=\{onBookService\} \/>/);
    expect(view.indexOf('prose.weeklyPlanIntro')).toBeLessThan(view.indexOf('<T2WeeklyPlan'));
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
    expect(view).toContain('serviceTypeDescriptors()');
  });
});

describe('partial／not_assessed 與 clear 分得開（§5.7）', () => {
  it('總覽的九宮格每一格走 dimensionStatus，帶 data-band 讓三種狀態在畫面上可辨', () => {
    expect(view).toContain('dimensionStatus(d.band)');
    expect(view).toContain('data-band={d.band}');
  });

  it('三種「沒有判定」的句子與標籤，沒有一個等於 clear 的三級標示', () => {
    const clearWords = new Set([STATUS_WORDING.normal.label, STATUS_WORDING.normal.tag, STATUS_WORDING.normal.describe]);
    for (const text of [...Object.values(DIMENSION_STATE_SENTENCE), ...Object.values(DIMENSION_STATE_LABEL)]) {
      expect(clearWords.has(text), text).toBe(false);
    }
  });

  it('「沒有判定」的膠囊用灰的那一組，不在綠黃紅那把尺上', () => {
    expect(view).toMatch(/STATUS_CLASS\[s\.kind === 'band' \? s\.status : 'state'\]/);
    expect(view).toMatch(/state: 'bg-brand-cream/);
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
