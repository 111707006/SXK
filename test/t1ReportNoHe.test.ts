import { describe, expect, it } from 'vitest';
import { withoutHe } from '../src/t1report/report';

describe('1022 的 T1 模板不用「他」指孩子（2026-11-10 清單第 8 條）', () => {
  it('他 → 孩子；其他、他们不動', () => {
    expect(withoutHe('说一遍给他听；共读时等他回应')).toBe('说一遍给孩子听；共读时等孩子回应');
    expect(withoutHe('其他方面稳定，他们一起玩')).toBe('其他方面稳定，他们一起玩');
  });
});

import { templateT1Report } from '../src/t1report/report';
import { baselineCases } from './helpers/t1ReportBaseline';

describe('1022 模板的每一個樣本', () => {
  it('整份沒有指孩子的「他」', () => {
    for (const c of baselineCases()) {
      const r = templateT1Report(c.input, { writing: '1022' });
      const all = [r.summary, ...r.perDimension.map(d => d.note), ...r.rehabSuggestions, ...r.homeGuidance, r.prognosisPrediction].join('\n');
      expect(all.replace(/其他|他们/g, ''), c.key).not.toContain('他');
    }
  });
});
