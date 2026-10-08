import { describe, it, expect } from 'vitest';
import { T1_AGE_BANDS, getT1AgeBand } from '../src/t1Data';
import { findBannedWords } from '../src/utils/parentWording';
import {
  asModelOutput, findT1ReportViolations, generateT1Report, t1ReportInputOf, templateT1Report, validateT1Report,
  type T1ReportInput,
} from '../src/t1report/report';
import { buildT1ReportPrompt } from '../src/t1report/prompt';
import { T1_REPORT_REAL_VERSION, isRealT1Report } from '../src/t1report/shape';
import { bandScores } from './helpers/t1Scores';

const CHILD = { name: '森森', gender: 'boy' };

/** 逐題作答的幾種樣子：全綠、全部還不能、混合（紅黃綠都有）、每維恰好一題有時（全部黃燈）。 */
const PATTERNS: Record<string, (dimId: string, i: number) => 0 | 1 | 2> = {
  allClear: () => 2,
  allNotYet: () => 0,
  mixed: (d, i) => (d === 'language' ? 0 : d === 'gross_motor' ? (i < 2 ? 1 : 2) : d === 'attention' && i === 3 ? 1 : 2),
  allBorderline: (_d, i) => (i === 0 ? 1 : 2),
  partlyOnly: () => 1,
};

function inputFor(age: number, pattern: keyof typeof PATTERNS, withItems = true): T1ReportInput {
  return t1ReportInputOf({ ...CHILD, ageMonth: age }, bandScores(age, PATTERNS[pattern], withItems));
}

const AGES = T1_AGE_BANDS.flatMap(b => [b.minAge, b.maxAge]);

describe('模板一定過驗證器（年齡段 × 作答樣子 × 有沒有逐題作答）', () => {
  const cases = AGES.flatMap(age =>
    Object.keys(PATTERNS).flatMap(p => [[age, p, true], [age, p, false]] as Array<[number, string, boolean]>),
  );
  it.each(cases)('%i 個月・%s・逐題 %s', (age, pattern, withItems) => {
    const input = inputFor(age, pattern as keyof typeof PATTERNS, withItems);
    const report = templateT1Report(input);
    const checked = validateT1Report(asModelOutput(report), input);
    expect(checked.ok, checked.ok ? '' : checked.errors.join('\n')).toBe(true);
    expect(report.version).toBe(T1_REPORT_REAL_VERSION);
    expect(isRealT1Report(report)).toBe(true);
    expect(report).not.toHaveProperty('criticalMetrics');
  });

  it('全部檔案：模板不靠「挖掉題目原文」也沒有禁字以外的違規 —— 題目原文以外的句子乾淨', () => {
    for (const age of AGES) for (const p of Object.keys(PATTERNS)) {
      const input = inputFor(age, p as keyof typeof PATTERNS);
      const r = templateT1Report(input);
      const band = getT1AgeBand(age);
      const all = [r.summary, r.prognosisPrediction, ...r.rehabSuggestions, ...r.homeGuidance, ...r.perDimension.map(n => n.note)].join('\n');
      let scrubbed = all;
      for (const q of band.questions) scrubbed = scrubbed.split(q.text).join('');
      expect(findBannedWords(scrubbed), `${age} ${p}`).toEqual([]);
    }
  });
});

describe('模板照這個孩子的作答寫', () => {
  it('被標記的方面各一段，紅燈在前；段落點出還不能的那一題原文', () => {
    const input = inputFor(30, 'mixed');
    const r = templateT1Report(input);
    expect(r.perDimension.map(n => n.dimensionId)).toEqual(['language', 'gross_motor', 'attention']);
    const band = getT1AgeBand(30);
    const firstLanguage = band.questions.find(q => q.dimensionId === 'language')!.text;
    expect(r.perDimension[0].note).toContain(`「${firstLanguage}」`);
    expect(r.perDimension[0].note).toContain('还不能 4 题');
    expect(r.summary).toContain('语言沟通');
    expect(r.summary).toContain('做到了 29 项');
    expect(r.summary).not.toContain('认知');
    expect(r.rehabSuggestions[0]).toContain('「语言沟通」');
    expect(r.prognosisPrediction).toContain('三个月后再做一次筛查');
  });

  it('全綠：沒有段落，總覽是基線那一句', () => {
    const r = templateT1Report(inputFor(30, 'allClear'));
    expect(r.perDimension).toEqual([]);
    expect(r.summary).toContain('可作为日后对照的基线记录');
    expect(r.rehabSuggestions.length).toBeGreaterThanOrEqual(3);
  });

  it('沒有逐題作答（舊成績）：不寫「做到了幾項」，段落講合計分數', () => {
    const r = templateT1Report(inputFor(30, 'mixed', false));
    expect(r.summary).not.toMatch(/做到了 \d+ 项/);
    expect(r.perDimension[0].note).toContain('合计');
  });

  it('6 歲以前與學齡的建議不同', () => {
    const young = templateT1Report(inputFor(30, 'allNotYet')).rehabSuggestions.join('');
    const school = templateT1Report(inputFor(100, 'allNotYet')).rehabSuggestions.join('');
    expect(young).not.toEqual(school);
    expect(school).not.toContain('绘本');
  });

  it('兩個孩子作答不同，報告就不同（舊模板每個孩子一樣）', () => {
    const a = templateT1Report(inputFor(30, 'mixed'));
    const b = templateT1Report(inputFor(30, 'allBorderline'));
    expect(a.summary).not.toEqual(b.summary);
    expect(a.homeGuidance).not.toEqual(b.homeGuidance);
  });
});

describe('驗證器擋下壞的模型輸出', () => {
  const input = inputFor(30, 'mixed');
  const good = () => asModelOutput(templateT1Report(input));

  it('好的那一份過', () => {
    expect(validateT1Report(good(), input).ok).toBe(true);
  });

  it.each([
    ['禁字', (o: any) => { o.summary += '语言方面明显落后。'; }],
    ['診斷名', (o: any) => { o.rehabSuggestions[0] = '可能是自闭症，建议多观察孩子的反应。'; }],
    ['百分位', (o: any) => { o.summary += '整体居同龄百分位第三十。'; }],
    ['居同齡前 X%', (o: any) => { o.summary += '整体居同龄前 40%。'; }],
    ['全形百分號', (o: any) => { o.nextSteps += '进步可达三十％。'; }],
    ['常模', (o: any) => { o.nextSteps += '与常模相比还有距离。'; }],
    ['預測', (o: any) => { o.nextSteps += '预测八周后可以回到普通范围。'; }],
    ['ASQ', (o: any) => { o.nextSteps += '有机会回到 asq 常见范围。'; }],
    ['腦神經術語', (o: any) => { o.perDimension[0].note += '这和前额叶的突触发育有关。'; }],
    ['儀器', (o: any) => { o.homeGuidance[0] = '可以配合脑电反馈带一起练习，每天二十分钟。'; }],
    ['缺欄位', (o: any) => { delete o.nextSteps; }],
    ['多一個欄位（編出來的指標）', (o: any) => { o.criticalMetrics = { neuralPlasticity: 80 }; }],
    ['條數不對', (o: any) => { o.rehabSuggestions = ['每天陪孩子玩十五分钟的游戏。']; }],
    ['字太少', (o: any) => { o.summary = '还行。'; }],
    ['少一個被標記的維度', (o: any) => { o.perDimension.pop(); }],
    ['多一個沒被標記的維度', (o: any) => { o.perDimension.push({ dimensionId: 'cognitive', note: '认知方面目前发展稳定，可以继续保持日常的游戏。' }); }],
    ['同一維度兩次', (o: any) => { o.perDimension.push({ ...o.perDimension[0] }); }],
    ['紅燈維度沒點名', (o: any) => { o.summary = '这次的筛查整理好了，下面分方面说明，接下来可以从日常小事开始陪孩子练习。'; }],
    ['不是物件', (o: any) => { o.summary = 3; }],
  ])('%s', (_name, mutate) => {
    const o = good();
    mutate(o);
    const checked = validateT1Report(o, input);
    expect(checked.ok).toBe(false);
  });

  it('不是物件、null、陣列都擋', () => {
    for (const v of [null, 'x', [], 42]) expect(validateT1Report(v, input).ok).toBe(false);
  });

  it('題目原文一字不差地引用不算違規；改寫過的照樣掃', () => {
    const band = T1_AGE_BANDS.find(b => b.questions.some(x => findBannedWords(x.text).length > 0))!;
    const q = band.questions.find(x => findBannedWords(x.text).length > 0)!;
    const texts = band.questions.map(x => x.text);
    expect(findT1ReportViolations(`可以先练「${q.text}」。`, texts)).toEqual([]);
    expect(findT1ReportViolations(`可以先练「${q.text}」。`, [])).not.toEqual([]);
  });
});

describe('generateT1Report：三種出口', () => {
  const input = inputFor(30, 'mixed');

  it('模型過了：用模型的，aiEngine 是引擎代號', async () => {
    const out = await generateT1Report(input, async () => ({ report: asModelOutput(templateT1Report(input)), aiEngine: 'qwen-x' }));
    expect(out.isAiGenerated).toBe(true);
    expect(out.aiEngine).toBe('qwen-x');
    expect(out.report.version).toBe(T1_REPORT_REAL_VERSION);
  });

  it('模型寫壞：退模板，aiEngine 是 template:<引擎>', async () => {
    const bad = { ...asModelOutput(templateT1Report(input)), summary: '整体居同龄前 12%，语言沟通方面明显落后。' };
    const out = await generateT1Report(input, async () => ({ report: bad, aiEngine: 'doubao-y' }));
    expect(out.isAiGenerated).toBe(false);
    expect(out.aiEngine).toBe('template:doubao-y');
    expect(out.report).toEqual(templateT1Report(input));
    expect(out.errors.length).toBeGreaterThan(0);
  });

  it('全部引擎失敗：退模板，aiEngine 是 template:all_engines_failed', async () => {
    const out = await generateT1Report(input, async () => { throw new Error('down'); });
    expect(out.isAiGenerated).toBe(false);
    expect(out.aiEngine).toBe('template:all_engines_failed');
  });
});

describe('提示', () => {
  const { system, user } = buildT1ReportPrompt(inputFor(30, 'mixed'));

  it('給模型每一題怎麼答（題目原文＋作答），點出要寫的維度', () => {
    const band = getT1AgeBand(30);
    for (const q of band.questions) expect(user).toContain(`「${q.text}」`);
    expect(user).toContain('还不能');
    expect(user).toContain('作答合计：共 36 题');
    expect(user).toContain('language（语言沟通');
  });

  it('不再要編出來的指標與腦神經解析；帶著用字規範', () => {
    expect(system + user).not.toContain('criticalMetrics');
    expect(system).not.toMatch(/首席|主任医生|突触偶联/);
    expect(system).toContain('用词规范（家长会直接阅读本报告，请严格遵守）');
    expect(system).toContain('百分位');
    expect(system).not.toMatch(/穿戴|森心康/);
  });

  it('沒有逐題作答時，叫模型不要寫總數', () => {
    const p = buildT1ReportPrompt(inputFor(30, 'mixed', false));
    expect(p.user).toContain('不要写「做到了几项」的总数');
  });
});
