import { describe, it, expect } from 'vitest';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, scoreKitV3 } from '../src/t2/kitv3/score';
import { hasScaleDetail, scaleDetailOf, type ScaleDetail } from '../src/t2/scaleDetail';
import { findBannedWords } from '../src/utils/parentWording';

/**
 * 量表详解（規格 `t2-v3-scale-detail-report.md`、票 D-3：達成率族）。
 * 範例那個孩子（2026-10-15 給使用者看的截圖）：48 個月，前五面都會；跑跳兩題偶爾、一題還不會；平衡球類後段卡住。
 */

function detailFor(code: string, ageM: number, override: Record<string, number> = {}, fill?: (max: number) => number): ScaleDetail {
  const bank = KITV3_BANKS[code];
  const context = { ageM };
  const answers: Record<string, number> = {};
  for (const { section, item } of askedItems(bank, context)) {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section)!;
    const values = bank.options[sec.options].map(o => o.value).filter((v): v is number => typeof v === 'number');
    const max = Math.max(...values);
    answers[item.key] = fill ? fill(max) : max;
  }
  Object.assign(answers, override);
  const score = scoreKitV3(bank, answers, context);
  const d = scaleDetailOf({ bank, answers, score, context });
  if (!d) throw new Error(`${code} 沒有详解`);
  return d;
}

const SAMPLE = { 'G6.6': 1, 'G6.8': 1, 'G6.9': 0, 'G7.4': 1, 'G7.6': 1, 'G7.7': 0, 'G7.8': 0 };

function allText(d: ScaleDetail): string {
  return [d.displayName, d.oneLiner, d.overall, ...d.kinds.map(k => k.label), ...d.facets.map(f => f.plain ?? ''),
    ...d.focus.flatMap(f => [f.plain ?? '', f.what, ...f.tips])].join('\n');
}

describe('達成率族：範例那個孩子（粗大動作）', () => {
  const d = detailFor('SXK-GM', 48, SAMPLE);

  it('總題數與三種作答', () => {
    expect(d.asked).toBe(76);
    expect(d.kinds).toEqual([{ label: '已经会', count: 69 }, { label: '偶尔会', count: 4 }, { label: '还不会', count: 3 }]);
  });

  it('七個面向的白話狀態與題數', () => {
    expect(d.facets.map(f => [f.key, f.plain, f.counts.join('/')])).toEqual([
      ['G1', '已经稳定', '12/0/0'], ['G2', '已经稳定', '12/0/0'], ['G3', '已经稳定', '11/0/0'], ['G4', '已经稳定', '12/0/0'],
      ['G5', '已经稳定', '12/0/0'], ['G6', '大部分会了，还有几项不稳', '6/2/1'], ['G7', '还在发展中，需要多练', '4/2/2'],
    ]);
  });

  it('最需要練的是平衡（較差的段）再來是跑跳；下一步是起始月齡最早的那一題', () => {
    expect(d.focus.map(f => f.key)).toEqual(['G7', 'G6']);
    expect(d.focus[0].next).toBe('能单脚站一两秒');
    expect(d.focus[1].next).toBe('能往前连续跳两三下');
    expect(d.focus[0].items).toEqual([
      { kind: 1, text: '能单脚站一两秒' }, { kind: 1, text: '能双手接住抛来的大球' },
      { kind: 2, text: '能沿着地上的直线走十步' }, { kind: 2, text: '能单脚站五秒以上' },
    ]);
  });

  it('整支 91% 是最好那段，總覽不說「各面向都好」，而是點名平衡', () => {
    expect(d.overall).toContain('76 题里已经会 69 题');
    expect(d.overall).toContain('「平衡与球类协调」还在发展中，是这次最需要练的地方');
    expect(d.overall).not.toContain('达成良好');
  });

  it('面向說明與練法取客戶原文、改寫過', () => {
    expect(d.focus[0].what).toContain('单脚站、走直线、接抛球、拍球、骑车');
    expect(d.focus[0].what).not.toContain('落后');
    expect(d.focus[0].tips).toHaveLength(4);
  });

  it('全文沒有禁字', () => {
    expect(findBannedWords(allText(d))).toEqual([]);
  });
});

describe('達成率族：其他情形', () => {
  it('全部都會：不展開，總覽用題庫最好那段的建議（改寫後）', () => {
    const d = detailFor('SXK-GM', 48);
    expect(d.focus).toEqual([]);
    expect(d.overall).toContain('各面向没有集中需要留意的地方');
  });

  it('整支落在需要評估的那段：總覽接上題庫的建議（含物理治疗评估）', () => {
    const d = detailFor('SXK-GM', 48, {}, () => 0);
    expect(d.focus).toHaveLength(2);
    expect(d.overall).toMatch(/物理治疗|神经动作评估|发展评估/);
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('題數太少的面向只列題數，不單獨判', () => {
    const d = detailFor('SXK-GM', 2);
    const few = d.facets.filter(f => f.fewItems);
    expect(few.length).toBeGreaterThan(0);
    expect(few.every(f => f.plain === '题数太少，这次不单独判断')).toBe(true);
  });

  it('ASQ3：五個領域、選項 10／5／0 也分得出三種作答', () => {
    const bank = KITV3_BANKS['SXK-ASQ3'];
    const asked = askedItems(bank, { ageM: 30 }).filter(a => a.section === 'gm');
    const d = detailFor('SXK-ASQ3', 30, { [asked[0].item.key]: 5, [asked[1].item.key]: 0 });
    expect(d.facets.map(f => f.key)).toEqual(['cm', 'gm', 'fm', 'ps', 'so']);
    expect(d.facets.find(f => f.key === 'gm')!.counts).toEqual([4, 1, 1]);
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('VOC：面向不分段判時，看整支分段決定要不要展開', () => {
    expect(detailFor('SXK-VOC', 30).focus).toEqual([]);
    const low = detailFor('SXK-VOC', 30, {}, () => 0);
    expect(low.focus.length).toBeGreaterThan(0);
    expect(low.facets.every(f => f.plain === null)).toBe(true);
  });

  it('LANG：沒有出題的面向（60 個月以下的 LS）不列', () => {
    expect(detailFor('SXK-LANG', 48).facets.map(f => f.key)).not.toContain('LS');
  });

  it('登記了的只有達成率族（其餘 D-4、D-5）', () => {
    const on = Object.values(KITV3_BANKS).filter(hasScaleDetail).map(b => b.code).sort();
    expect(on).toEqual(['SXK-ADP', 'SXK-ASQ3', 'SXK-GM', 'SXK-LANG', 'SXK-PLC', 'SXK-SOC', 'SXK-VOC']);
  });
});
