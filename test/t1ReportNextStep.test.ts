import { describe, it, expect } from 'vitest';
import { asModelOutput, nextStepSentence, templateT1Report, validateT1Report } from '../src/t1report/report';
import { buildT1ReportPrompt } from '../src/t1report/prompt';
import { flaggedDimensions } from '../src/t1report/answers';
import { baselineCases } from './helpers/t1ReportBaseline';

/**
 * 新版 T1 報告開給專案 B（使用者 2026-11-19）：B 沒有 T2，結論第三句改成約專家（`nextStep: 'expert'`），
 * 模型寫了 T2／深度评估就整份退模板。A（不帶或 `'t2'`）一字不變。
 */
describe('T1 報告的下一步：A 指 T2，B 指約專家', () => {
  const cases = baselineCases().filter(c => flaggedDimensions(c.input.answers).length > 0);

  it('句子', () => {
    expect(nextStepSentence('t2', 1)).toBe('下一步建议做「T2 深度评估」，把这个方面看得更细，再决定在家怎么练。');
    expect(nextStepSentence(undefined, 2)).toBe(nextStepSentence('t2', 2));
    expect(nextStepSentence('expert', 2)).toBe('下一步建议约专家一对一说明，把这几个方面看得更细，再决定在家怎么练。');
  });

  it('B 的 1022 模板：結論第三句約專家、整份沒有 T2，且自己過得了 B 的驗證器', () => {
    expect(cases.length).toBeGreaterThan(0);
    for (const { input } of cases) {
      const report = templateT1Report(input, { writing: '1022', nextStep: 'expert' });
      expect(report.summary).toContain('约专家一对一说明');
      expect(JSON.stringify(report)).not.toMatch(/T2|深度评估/);
      expect(validateT1Report(asModelOutput(report), input, { writing: '1022', nextStep: 'expert' }).ok).toBe(true);
    }
  });

  it('寫了 T2 的輸出，B 的驗證器退回；A 照收', () => {
    const { input } = cases[0];
    const aReport = asModelOutput(templateT1Report(input, { writing: '1022' }));
    expect(validateT1Report(aReport, input, { writing: '1022' }).ok).toBe(true);
    const b = validateT1Report(aReport, input, { writing: '1022', nextStep: 'expert' });
    expect(b.ok).toBe(false);
  });

  it('B 的提示叫模型約專家、不要提 T2；A 的提示照舊', () => {
    const { input } = cases[0];
    expect(buildT1ReportPrompt(input, { writing: '1022', nextStep: 'expert' }).system).toContain('建议约专家一对一说明');
    expect(buildT1ReportPrompt(input, { writing: '1022' }).system).toContain('建议做「T2 深度评估」');
  });
});
