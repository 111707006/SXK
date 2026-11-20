import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import {
  PUSH_PAGE,
  SOURCE_LABEL,
  VARIANT_LABEL,
  abilityRow,
  guidanceLines,
  monthRangeLabel,
  pushReason,
  referralLine,
  statusLabelOf,
  variantLine,
} from '../src/t2/pushCopy';
import { STATUS_WORDING } from '../src/utils/statusWording';
import { ACTIVITY_TAGS } from '../src/t2/findingTags';
import { DIMENSION_CODES } from '../src/t2/types';

/**
 * v3 線上干預畫面的字（`src/t2/pushCopy.ts`）。家長端：每一句過《用语对照表》的掃描；狀態只用報告那三句。
 */

const COLORS = ['red', 'orange', 'green'] as const;

describe('pushCopy', () => {
  it('顏色 → 報告同一組狀態字（不出「红色」「重度」）', () => {
    expect(COLORS.map(statusLabelOf)).toEqual([STATUS_WORDING.delay.label, STATUS_WORDING.borderline.label, STATUS_WORDING.normal.label]);
  });

  it('月齡區間：三等分的小數往外取整，不縮小', () => {
    expect(monthRangeLabel([24, 28])).toBe('24–28 个月');
    expect(monthRangeLabel([42.6666, 45.3333])).toBe('42–46 个月');
  });

  it('怎麼帶最有效：照每週幾支算一個月幾個', () => {
    expect(guidanceLines(3)[0]).toContain('这个月一共 12 个活动，一周做 3 个');
    expect(guidanceLines(2)[0]).toContain('这个月一共 8 个活动，一周做 2 个');
  });

  it('為什麼給：模組名、編號、月齡；沒有模組（示範片模式）不寫「从……里」', () => {
    const base = { color: 'red' as const, source: 't1' as const, module: 8, window: [24, 28] as [number, number], relaxed: false };
    expect(pushReason('LANG', base, 'A141')).toBe(`语言沟通${STATUS_WORDING.delay.label}（按筛查推估），从「词汇与说话」里按编号排到第 141 号，练 24–28 个月的内容。`);
    expect(pushReason('LANG', { ...base, module: null }, 'A001')).not.toContain('从「');
  });

  it('對中孩子的細項（ADR-0018）：寫「这次看到」、不寫按編號；認不得的字照舊', () => {
    const base = { color: 'red' as const, source: 't2' as const, module: 9, window: [40, 44] as const, relaxed: true };
    const s = pushReason('LANG', base, 'A137', ['lang.pragmatics']);
    expect(s).toContain('这次看到：');
    expect(s).toContain('所以排了这个活动');
    expect(s).not.toContain('按编号');
    expect(s).not.toMatch(/。，|。。/);
    expect(s.endsWith('挑了最接近的一支。')).toBe(true);
    expect(pushReason('LANG', base, 'A137', ['nope.x'])).toContain('按编号排到第 137 号');
    expect(pushReason('LANG', base, 'A137', [])).toContain('按编号排到第 137 号');
  });

  it('家長端每一句都過用語對照表', () => {
    const texts: string[] = [
      ...Object.values(VARIANT_LABEL),
      ...Object.values(SOURCE_LABEL),
      PUSH_PAGE.abilityTitle,
      PUSH_PAGE.abilitySub,
      PUSH_PAGE.guidanceTitle,
      ...PUSH_PAGE.staircase.flatMap(s => [s.t1, s.t2]),
      ...Object.values(PUSH_PAGE.adjusted),
      ...guidanceLines(3),
      ...guidanceLines(2),
      referralLine(['LANG', 'SOC']),
      ...(['easy', 'standard', 'hard'] as const).map(variantLine),
    ];
    for (const d of DIMENSION_CODES) {
      for (const color of COLORS) {
        const row = abilityRow({ dimension: d, color, source: 't2', quota: 4, window: [24, 28] });
        texts.push(row.title, row.source, row.detail);
        for (const relaxed of [false, true]) {
          texts.push(pushReason(d, { color, source: 't1', module: 9, window: [24, 28], relaxed }, 'A161'));
          for (const tag of ACTIVITY_TAGS) texts.push(pushReason(d, { color, source: 't1', module: 9, window: [24, 28], relaxed }, 'A161', [tag]));
        }
      }
    }
    const bad = texts.flatMap(t => findBannedWords(t).map(w => `${w}：${t}`));
    expect(bad).toEqual([]);
  });
});
