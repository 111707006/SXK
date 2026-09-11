import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BANNED_WORDS, findBannedWords } from './helpers/parentWording';
import {
  ALL_CLEAR_SUMMARY,
  SCREENING_DISCLAIMER,
  STATUS_WORDING,
  flaggedSummary,
} from '../src/utils/statusWording';
import { BRAIN_NODES, REHAB_SUGGESTIONS } from '../src/dimensionContent';

/**
 * 家長端用字的護欄（客戶 2026-09-11《家长报告用语对照表》）。
 *
 * 【為什麼需要這一條】
 * 2026-09-11 之前，同一顆紅燈在畫面上有五個名字，全部帶著「迟缓／落后／风险」；
 * 報告頂端寫「高度警告」、預測圖寫「若不及时矫正……发育落后风险将增加」。
 * 這些字沒有一個會讓型別或建置變紅 —— 它們只會讓一位家長在合作公司的 iPad
 * 前面嚇到。而下一次有人「順手」在卡片上加一個「需关注」，同樣不會有任何聲音。
 *
 * 為什麼是結構測試：專案沒有 jsdom，畫面上出現什麼字沒有測試看得到，只能讀
 * 原始碼。寫法參照 `test/reportCopy.structure.test.ts`。
 *
 * 【檔案怎麼選】
 * 列的是家長在 T1 路徑上會讀到的元件，加上它們共用的用語與資料表。
 * 刻意不列的：
 * - `src/builtinSpecialists.ts`：三位醫師的真實簡歷（脑瘫、学习障碍、康复治疗），
 *   能省略不能改寫 —— 這正是它從 `AnalysisReport.tsx` 搬出來的原因。
 * - `src/t1Data.ts`、`src/data.ts`：**題目**本身（「体育课上不明显笨拙、落后」）。
 *   題目是量表，改題目等於改測的東西，那是另一個決定。
 * - `src/dimensionContent.ts` 整檔：`DIMENSION_DETAILS` 裡是量表的正式名稱
 *   （「物理治疗 PT」「CRRC 语言发育迟缓检查法」），而且沒有任何地方渲染它。
 *   真的會進報告的兩張表（`REHAB_SUGGESTIONS`、`BRAIN_NODES`）改成直接 import 檢查值。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡舉的反例（「2026-09-11 之前寫的是『高度警告』」）不該被當成真的文案。 */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const PARENT_FACING_FILES = [
  'src/utils/statusWording.ts',
  'src/productConfig.ts',
  'src/components/DimensionGrid.tsx',
  'src/components/T1Screening.tsx',
  'src/components/AnalysisReport.tsx',
  'src/components/ReportBody.tsx',
  'src/components/ReportCharts.tsx',
  'src/App.tsx',
  // 2026-09-11 補上：家長在 T1 路徑上還會走到的其餘畫面。先前這份清單只涵蓋
  // 「報告」那幾頁，於是 `InterventionPack` 的膠囊寫著「需关注」而報告寫著
  // 「需要较多支持」—— 同一顆紅燈兩個名字，正是這條護欄要擋的事。
  'src/components/AuthScreen.tsx',
  'src/components/ChildProfileForm.tsx',
  'src/components/EditProfileModal.tsx',
  'src/components/AgeBandDriftNotice.tsx',
  'src/components/InterventionPack.tsx',
  'src/components/Paywall.tsx',
  'src/components/WearablesMall.tsx',
  'src/utils/interventionPack.ts',
  'src/utils/specialists.ts',
  'src/utils/ageBandDrift.ts',
];

/**
 * 專案 A 的深度評估路徑（T2／T3）**尚未納入這條護欄**，這是 2026-09-11 的
 * 決定，不是漏掉。
 *
 * 那幾個檔案 —— `SpecializedReportView.tsx`、`utils/reportUtils.ts`、
 * `LanguageSpecialAssessment.tsx`、`MotionVideoAssessment.tsx`、`cpmvData.ts`、
 * `utils/cpmvReport.ts`、`AssessmentPanel.tsx` 描述 T2/T3 的那兩句 —— 合計約
 * 五十處禁字（「🚨 重度发育落后」「必须在未来 2-3 周内」「脑瘫儿童动作影像评估
 * 报告」…）。客戶的對照表明寫適用於「T1 筛查报告与**各层**家长版报告」，所以
 * 它們該改。
 *
 * **不現在改的理由：整個 T2 正在重做。** 題庫、判級門檻、報告產生方式都要換成
 * 客戶提供的 23 份量表（見 `docs/specs/t2-rules-engine-report-and-video-matching.md`
 * 與 ADR-0005），現在把這些字一個一個柔化，改完的句子多半會連同整個檔案被換掉。
 *
 * ⚠️ **T2 重做完成時，把那幾個檔案加進上面那份清單。** 沒有這一條護欄，新寫的
 * T2 報告會重新長出同一批字 —— 這個專案已經證明過它會。
 */

describe('護欄本身沒有壞掉', () => {
  it('禁字清單不是空的，而且抓得到已知的舊文案', () => {
    expect(BANNED_WORDS.length).toBeGreaterThan(30);
    // 截圖裡被圈起來的那兩句。
    expect(findBannedWords('T1 迟缓风险')).toHaveLength(2);
    expect(findBannedWords('落后风险偏高')).toHaveLength(2);
  });

  it('定位句裡的「诊断」是被否定的，不算違規', () => {
    expect(findBannedWords(SCREENING_DISCLAIMER)).toEqual([]);
    // 但同一個字換到別的句子裡就算。
    expect(findBannedWords('为其精确诊断')).toHaveLength(1);
  });
});

describe('家長會看到的元件裡沒有禁字', () => {
  it.each(PARENT_FACING_FILES)('%s', rel => {
    const hits = findBannedWords(stripComments(read(rel)));
    expect(hits, hits.join('\n')).toEqual([]);
  });
});

describe('三級標示（statusWording.ts）', () => {
  it('每一級的三種說法都沒有禁字', () => {
    for (const [status, w] of Object.entries(STATUS_WORDING)) {
      for (const [field, text] of Object.entries(w)) {
        expect(findBannedWords(text), `${status}.${field} = ${text}`).toEqual([]);
      }
    }
  });

  it('紅／橙／綠的 tag 逐字等於對照表「落地建議」指定的三句', () => {
    expect(STATUS_WORDING.delay.tag).toBe('建议优先安排专业咨询');
    expect(STATUS_WORDING.borderline.tag).toBe('建议进一步了解');
    expect(STATUS_WORDING.normal.tag).toBe('目前发展稳定');
  });

  it('短標籤不超過 6 個字 —— 篩查結論頁的卡片在平板寬度下只放得下這麼多', () => {
    for (const [status, w] of Object.entries(STATUS_WORDING)) {
      expect(w.label.length, `${status}.label = ${w.label}`).toBeLessThanOrEqual(6);
    }
  });

  it('三級的字互不相同 —— 兩級說同一句話等於少了一級', () => {
    for (const field of ['label', 'tag', 'describe'] as const) {
      const values = Object.values(STATUS_WORDING).map(w => w[field]);
      expect(new Set(values).size, field).toBe(values.length);
    }
  });

  /**
   * 關注分不再是第二套判定（ADR-0007 / CONTEXT.md「關注分」）。
   *
   * 這一條原本在驗 `concernLabel` 的四級。那支函式連同它的四級一起廢除了 ——
   * 留一條「它不存在」的測試，是因為下一個覺得「三級太粗」的人最自然的動作
   * 就是把它加回來，而加回來不會有任何其他測試出聲。
   */
  it('沒有第二套刻度：statusWording 不再輸出依關注分切的標籤', () => {
    const source = read('src/utils/statusWording.ts');
    expect(source).not.toMatch(/export function concernLabel/);
    // 報告本體只把關注分當成雷達圖的軸值，不拿它決定顏色或文字。
    const body = stripComments(read('src/components/ReportBody.tsx'));
    expect(body).not.toMatch(/concernScore\s*>=\s*\d/);
    expect(body).not.toMatch(/concernScore\s*===\s*\d/);
  });

  it('全綠結論逐字等於對照表指定的那一句', () => {
    expect(ALL_CLEAR_SUMMARY).toBe('本次筛查各方面发展稳定，可作为日后对照的基线记录。');
  });
});

describe('一句話結論（flaggedSummary）', () => {
  const red = { dimensionName: '语言沟通', status: 'delay' as const };
  const yellow = { dimensionName: '动作发展', status: 'borderline' as const };
  const green = { dimensionName: '认知', status: 'normal' as const };

  it('全綠回 null，讓呼叫端放全綠那一句', () => {
    expect(flaggedSummary([green])).toBeNull();
    expect(flaggedSummary([])).toBeNull();
  });

  it('紅燈與黃燈分開講，各自帶自己的行動建議 —— 優先順序不能被混掉', () => {
    const text = flaggedSummary([red, yellow, green])!;
    expect(text).toContain('语言沟通方面与同龄常见的发展节奏有差距，建议优先安排专业咨询');
    expect(text).toContain('动作发展方面仍在建立中，建议进一步了解');
    expect(text).not.toContain('认知');
    expect(findBannedWords(text)).toEqual([]);
  });

  it('句子的主語是「方面」，不是孩子', () => {
    // 對照表：避免「孩子有……」這種以孩子為主語的判定句。
    expect(flaggedSummary([red])).not.toContain('孩子');
  });
});

describe('專案 B 的行動標籤（productConfig.ts）', () => {
  const source = stripComments(read('src/productConfig.ts'));
  const t1only = source.slice(source.indexOf('t1only: {'));

  function field(name: string): string {
    const m = t1only.match(new RegExp(`\\n\\s*${name}:\\s*'([^']*)'`));
    expect(m, `${name} 讀不到`).not.toBeNull();
    return m![1];
  }

  it('紅燈與橙燈的標籤逐字等於三級標示', () => {
    // 卡片右下角與圖例是同一組語彙，兩處都要對上。
    expect(field('actionLabelHigh')).toBe(STATUS_WORDING.delay.tag);
    expect(field('legendConcernHint')).toBe(STATUS_WORDING.delay.tag);
    expect(field('actionLabelMedium')).toBe(STATUS_WORDING.borderline.tag);
    expect(field('legendAttentionHint')).toBe(STATUS_WORDING.borderline.tag);
  });

  it('警示句不再催「尽快」', () => {
    expect(field('alertText')).not.toContain('尽快');
    expect(findBannedWords(field('alertText'))).toEqual([]);
  });
});

describe('定位句固定出現在結果頁與報告頁最上方', () => {
  it.each(['src/components/T1Screening.tsx', 'src/components/ReportBody.tsx'])('%s', rel => {
    expect(stripComments(read(rel))).toContain('SCREENING_DISCLAIMER');
  });
});

describe('會進報告的資料表（dimensionContent.ts）', () => {
  it('備用報告的訓練建議沒有禁字', () => {
    for (const [dim, items] of Object.entries(REHAB_SUGGESTIONS)) {
      for (const text of items) {
        expect(findBannedWords(text), `${dim}: ${text}`).toEqual([]);
      }
    }
  });

  it('腦區拓樸圖的說明沒有禁字', () => {
    for (const node of BRAIN_NODES) {
      expect(findBannedWords(node.desc), `${node.id}.desc`).toEqual([]);
      expect(findBannedWords(node.clinicalNotes), `${node.id}.clinicalNotes`).toEqual([]);
    }
  });
});
