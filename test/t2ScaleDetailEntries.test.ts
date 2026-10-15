import { describe, it, expect } from 'vitest';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, scoreKitV3 } from '../src/t2/kitv3/score';
import { TOOLKIT_VERSION_V3 } from '../src/t2/kitv3/types';
import type { ToolResultV3 } from '../src/t2/kitv3/submit';
import { assertV3Switches, buildFindingsV3 } from '../src/t2/findingsV3';
import { scaleDetailEntriesOf } from '../src/t2/scaleDetailEntries';
import { DIMENSION_CODES } from '../src/t2/types';

/** 量表详解存進快照（規格 §6、票 D-6）。 */

function resultOf(toolId: string, ageM: number, value: (vals: number[]) => number): ToolResultV3 {
  const bank = KITV3_BANKS[toolId];
  const context = { ageM };
  const answers: Record<string, number | null> = {};
  for (const { section, item } of askedItems(bank, context)) {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section)!;
    answers[item.key] = value(bank.options[sec.options].map(o => o.value).filter((v): v is number => typeof v === 'number'));
  }
  return {
    toolkitVersion: TOOLKIT_VERSION_V3, toolId, assessedAgeMonth: ageM, rater: 'mother' as any, context, answers,
    score: scoreKitV3(bank, answers, context), computedAt: '2026-10-01T00:00:00Z',
  };
}

const NOW = new Date('2026-10-15T00:00:00Z');

describe('scaleDetailEntriesOf', () => {
  it('每支最新一筆（90 天內）一份；`previous` 取更早那一次（不限 90 天）；氣質不列', () => {
    const records = [
      { createdAt: '2026-05-01T00:00:00Z', result: resultOf('SXK-GM', 44, v => Math.min(...v)) },
      { createdAt: '2026-10-01T00:00:00Z', result: resultOf('SXK-GM', 48, v => Math.max(...v)) },
      { createdAt: '2026-10-02T00:00:00Z', result: resultOf('ITQ/TTS/BSQ', 48, v => v[0]) },
    ];
    const entries = scaleDetailEntriesOf(records, NOW);
    expect(entries.map(e => e.toolId)).toEqual(['SXK-GM']);
    expect(entries[0].detail.focus).toEqual([]);
    expect(entries[0].previous?.computedAt).toBe('2026-05-01T00:00:00Z');
    expect(entries[0].previous?.facets.find(f => f.key === 'G7')?.counts[0]).toBe(0);
  });

  it('只交過一次：沒有 previous；90 天前的那一筆不算進報告', () => {
    expect(scaleDetailEntriesOf([{ createdAt: '2026-10-01T00:00:00Z', result: resultOf('SXK-SP', 48, v => v[0]) }], NOW)[0].previous).toBeUndefined();
    expect(scaleDetailEntriesOf([{ createdAt: '2026-05-01T00:00:00Z', result: resultOf('SXK-SP', 48, v => v[0]) }], NOW)).toEqual([]);
  });

  it('buildFindingsV3 只在傳了才存這一欄', () => {
    const t1 = Object.fromEntries(DIMENSION_CODES.map(d => [d, 'green'])) as any;
    const base = { t1, recommended: [], records: [], fallbackAgeMonth: 48, now: NOW };
    expect(buildFindingsV3(base).scaleDetails).toBeUndefined();
    expect(buildFindingsV3({ ...base, scaleDetails: [] }).scaleDetails).toEqual([]);
  });
});

describe('開關組合', () => {
  it('開了量表详解沒開完整版 → 起不來', () => {
    expect(() => assertV3Switches(false, false, true)).toThrow(/T2_SCALE_DETAIL/);
    expect(() => assertV3Switches(true, true, true)).not.toThrow();
    expect(() => assertV3Switches(true, true)).not.toThrow();
  });
});
