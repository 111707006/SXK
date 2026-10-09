import { describe, it, expect } from 'vitest';
import { formV3 } from '../src/t2/answeringV3';
import { buildFindingsV3, type T2FindingsV3 } from '../src/t2/findingsV3';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { scoreToolV3 } from '../src/t2/kitv3/submit';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';
import {
  ALL_ENGINES_FAILED,
  CLOSING_SENTENCE,
  NO_VERDICT_CHANGE_RULE,
  buildProsePromptV3,
  generateProseV3,
  isProseV3,
  reportedDimensionsV3,
  templateEngineLabel,
  templateProseV3,
  validateProseV3,
} from '../src/t2/report';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, T1Flag } from '../src/t2/types';

/**
 * 完整版報告的文字（2026-10-08，使用者：v3 報告用 AI，跟 T1 報告串接相同）：
 * 模板一定過驗證器、驗證器擋得住寫壞的、生成的三個出口、提示不帶量表名稱。
 */

const NOW = new Date('2026-10-07T08:00:00Z');

function t1(flags: Partial<Record<DimensionCode, T1Flag>>): Record<DimensionCode, T1Flag> {
  return { ...(Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, T1Flag>), ...flags };
}

/** 一支工具在某個月齡、每題都答第 `pick` 檔（0＝最好那一檔，-1＝最差那一檔）。 */
function record(code: string, ageM: number, pick: 0 | -1) {
  const child = { inSchool: true, sex: 'male' as const };
  const form = formV3(KITV3_BANKS[code], { ageM, ...child });
  const answers: Record<string, number | null> = {};
  for (const s of form.sections) for (const it of s.items) {
    const vals = s.options.map(o => o.value).filter(v => v !== null) as number[];
    answers[it.key] = pick === 0 ? vals[0] : vals[vals.length - 1];
  }
  const got = scoreToolV3({ toolId: code, assessedAgeMonth: ageM, rater: 'mother', answers }, child, NOW);
  if (!got.ok) throw new Error(`${code}@${ageM}: ${got.body.error}`);
  return { createdAt: NOW.toISOString(), result: got.result };
}

function findingsOf(codes: string[], ageM: number, pick: 0 | -1, flags: Partial<Record<DimensionCode, T1Flag>> = {}, recommended = codes): T2FindingsV3 {
  return buildFindingsV3({ t1: t1(flags), recommended, records: codes.map(c => record(c, ageM, pick)), sex: 'boy', fallbackAgeMonth: ageM, now: NOW });
}

/** 24 支每一支在它窗口的頭、中、尾，各答最好、最差，T1 全紅（每一維都要成段或 no_tool）。 */
const SWEEP: Array<{ label: string; findings: T2FindingsV3 }> = [];
for (const code of Object.keys(KITV3_BANKS)) {
  const spec = RECOMMEND_CONFIG.tools[code];
  const lo = Math.max(spec.minM, 3);
  const ages = [...new Set([lo, Math.round((lo + spec.maxM) / 2), spec.maxM])];
  for (const ageM of ages) for (const pick of [0, -1] as const) {
    const flags = Object.fromEntries(DIMENSION_CODES.map(d => [d, 2])) as Record<DimensionCode, T1Flag>;
    SWEEP.push({ label: `${code}@${ageM}/${pick}`, findings: findingsOf([code], ageM, pick, flags) });
  }
}

describe('模板一定過驗證器', () => {
  it(`24 支 × 窗口頭中尾 × 最好／最差（${SWEEP.length} 份），有沒有孩子名字都過`, () => {
    for (const { label, findings } of SWEEP) {
      for (const childName of [undefined, '小明']) {
        const input = { findings, ...(childName ? { childName } : {}) };
        const got = validateProseV3(templateProseV3(input), input);
        expect(got.ok ? [] : got.errors, label).toEqual([]);
      }
    }
  });

  it('什麼都沒做、T1 全綠：perDimension 空、整份照樣過', () => {
    const findings = findingsOf([], 48, 0);
    const prose = templateProseV3({ findings });
    expect(prose.perDimension).toEqual([]);
    expect(validateProseV3(prose, { findings }).ok).toBe(true);
  });

  it('段落只寫留意、關注、沒有問卷的維度，不寫量表名稱', () => {
    for (const { label, findings } of SWEEP) {
      const prose = templateProseV3({ findings });
      expect(prose.perDimension.map(p => p.dimensionId), label).toEqual(reportedDimensionsV3(findings).map(d => d.dimensionId));
      const text = JSON.stringify(prose);
      for (const tool of Object.values(RECOMMEND_CONFIG.tools)) expect(text, label).not.toContain(tool.name);
    }
  });
});

describe('跨好幾個維度的量表：每一段只點名自己那一維的面向', () => {
  // 2026-10-08 展示站實測：分齡發育綜合評估做完，語言、認知、社交三段都寫「沟通、粗大动作、精细动作、解决问题」
  it('分齡發育綜合評估全答最差：語言只講沟通、認知只講解决问题、動作只講粗大／精細動作', () => {
    const findings = findingsOf(['SXK-ASQ3'], 30, -1, Object.fromEntries(DIMENSION_CODES.map(d => [d, 2])) as any);
    const bank = KITV3_BANKS['SXK-ASQ3'];
    const domainDim = (bank.scoring as any).domainDim as Record<string, DimensionCode>;
    const form = formV3(bank, { ageM: 30, inSchool: true, sex: 'male' });
    const nameOf = (key: string) => form.sections.find(s => s.key === key)!.name;
    const prose = templateProseV3({ childName: '小安', findings });
    for (const [dim, keys] of [['LANG', ['cm']], ['COG', ['ps']], ['MOT', ['gm', 'fm']], ['SOC', ['so']]] as Array<[DimensionCode, string[]]>) {
      const text = prose.perDimension.find(p => p.dimensionId === dim)!.whatWeSaw;
      for (const key of Object.keys(domainDim)) {
        const name = nameOf(key);
        if (keys.includes(key)) expect(text, `${dim} 要講 ${name}`).toContain(name);
        else expect(text, `${dim} 不該講 ${name}`).not.toContain(`「${name}」`);
      }
    }
  });
});

describe('面向的說法（使用者 2026-10-08）', () => {
  it('只點名一個面向時寫「这一方面」，不寫「这几方面」', () => {
    const findings = findingsOf(['SXK-ASQ3'], 30, -1, Object.fromEntries(DIMENSION_CODES.map(d => [d, 2])) as any);
    const lang = templateProseV3({ childName: '小安', findings }).perDimension.find(p => p.dimensionId === 'LANG')!.whatWeSaw;
    expect(lang).toContain('这一方面');
    expect(lang).not.toContain('这几方面');
  });

  it('SNAP-IV 全答最差：注意力那一段不點名「对立违抗」', () => {
    const findings = findingsOf(['SNAP-IV'], 84, -1, Object.fromEntries(DIMENSION_CODES.map(d => [d, 2])) as any);
    const prose = templateProseV3({ childName: '小安', findings });
    expect(JSON.stringify(prose)).not.toContain('对立违抗');
    expect(buildProsePromptV3({ childName: '小安', findings }).user).not.toContain('对立违抗');
  });
});

describe('驗證器擋得住', () => {
  const findings = findingsOf(['SXK-AB'], 96, -1, { ATT: 2, SEN: 1 });
  const input = { findings };
  const good = templateProseV3(input);

  it('前提：這份有要成段的維度', () => {
    expect(good.perDimension.length).toBeGreaterThan(0);
    expect(validateProseV3(good, input).ok).toBe(true);
  });

  const bad: Array<[string, unknown]> = [
    ['不是物件', '一段字'],
    ['多一個欄位', { ...good, temperament: '这一段不该由模型写，系统会另外列出孩子天生风格的几个方向。' }],
    ['少一個維度', { ...good, perDimension: good.perDimension.slice(1) }],
    ['多一個 clear 的維度', { ...good, perDimension: [...good.perDimension, { ...good.perDimension[0], dimensionId: 'COG' }] }],
    ['同一個維度兩次', { ...good, perDimension: [...good.perDimension, good.perDimension[0]] }],
    ['不認得的維度', { ...good, perDimension: [{ ...good.perDimension[0], dimensionId: 'XYZ' }] }],
    ['closing 少了那一句', { ...good, closing: '接下来可以照线上干预里的家庭活动，每周陪孩子练几次就好。' }],
    ['overview 太短', { ...good, overview: '还不错。' }],
    ['寫出診斷名', { ...good, overview: '这次整理下来，孩子可能有多动症的倾向，注意力这一项最需要优先安排专业咨询。' }],
    ['寫出量表名稱裡的禁字', { ...good, overview: '这次参考了自闭行为量表与注意力问卷，注意力这一项最需要优先安排，其他几项照常观察。' }],
  ];
  for (const [what, value] of bad) {
    it(what, () => {
      expect(validateProseV3(value, input).ok).toBe(false);
    });
  }
});

describe('generateProseV3 的三個出口', () => {
  const findings = findingsOf(['SXK-AB'], 96, -1, { ATT: 2 });
  const input = { findings, childName: '小明' };

  it('模型寫得合格：用模型的、記引擎代號', async () => {
    const answer = { ...templateProseV3(input), closing: `每周照线上干预里的活动陪孩子练几次，三个月后再看看变化。${CLOSING_SENTENCE}。` };
    const got = await generateProseV3(input, async () => ({ report: answer, aiEngine: 'qwen-x' }));
    expect(got).toEqual({ prose: answer, isAiGenerated: true, aiEngine: 'qwen-x', errors: [] });
  });

  it('模型寫壞：退模板，記 template:<引擎>', async () => {
    const got = await generateProseV3(input, async () => ({ report: { overview: 'x' }, aiEngine: 'qwen-x' }));
    expect(got.isAiGenerated).toBe(false);
    expect(got.aiEngine).toBe(templateEngineLabel('qwen-x'));
    expect(got.prose).toEqual(templateProseV3(input));
    expect(got.errors.length).toBeGreaterThan(0);
  });

  it('全部引擎都掛：退模板，記 all_engines_failed', async () => {
    const got = await generateProseV3(input, async () => { throw new Error('down'); });
    expect(got.aiEngine).toBe(ALL_ENGINES_FAILED);
    expect(got.prose).toEqual(templateProseV3(input));
  });
});

describe('提示', () => {
  const findings = findingsOf(['SXK-ASB', 'SXK-AB'], 96, -1, { ATT: 2, SOC: 2, SEN: 1 });
  const { system, user } = buildProsePromptV3({ findings, childName: '小明' });

  it('有「不能改判定」那一句；同輸入兩次一樣', () => {
    expect(system).toContain(NO_VERDICT_CHANGE_RULE);
    expect(buildProsePromptV3({ findings, childName: '小明' })).toEqual({ system, user });
  });

  it('素材裡沒有量表名稱、沒有題目原文', () => {
    for (const tool of Object.values(RECOMMEND_CONFIG.tools)) expect(user).not.toContain(tool.name);
    for (const r of findings.toolResults) {
      for (const s of formV3(KITV3_BANKS[r.toolId], r.context).sections) for (const it of s.items) expect(user).not.toContain(it.text);
    }
  });

  it('要成段的維度逐一列出', () => {
    for (const d of reportedDimensionsV3(findings)) expect(user).toContain(`- ${d.dimensionId}（`);
  });
});

describe('isProseV3', () => {
  it('認得完整版、不認舊版（有 weeklyPlanIntro）', () => {
    const findings = findingsOf([], 48, 0);
    const prose = templateProseV3({ findings });
    expect(isProseV3(prose)).toBe(true);
    expect(isProseV3({ ...prose, weeklyPlanIntro: 'x' })).toBe(false);
    expect(isProseV3(null)).toBe(false);
  });
});
