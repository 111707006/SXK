import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getT1AgeBand } from '../src/t1Data';
import { findBannedWords } from '../src/utils/parentWording';
import { asModelOutput, generateT1Report, templateT1Report, validateT1Report, type T1ReportOptions } from '../src/t1report/report';
import { buildT1ReportPrompt } from '../src/t1report/prompt';
import { flaggedDimensions } from '../src/t1report/answers';
import { baselineCases, baselineHashes } from './helpers/t1ReportBaseline';

/**
 * 客戶 10/22 的新寫法（`T1_REPORT_1022`，#81，規格 docs/specs/client-changes-2026-10-22-1-ui.md）：
 * 首席專家結論（`summary`）三句、不寫題數；每個被標記方面的說明以「这次看到的是：」開頭、接練法、沒有統計句；
 * 驗證器擋統計句。開關關著（不帶選項）輸出與加開關之前一字不差。
 */

const W: T1ReportOptions = { writing: '1022' };

/** 以「。！？」切句（括號裡的不算另一句）。 */
const sentences = (s: string) => s.split(/[。！？]/).map(x => x.trim()).filter(Boolean);

describe('開關關著：與加開關之前一字不差', () => {
  it('模板整份與提示兩段的雜湊逐案相同', () => {
    const baseline = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/t1ReportBaseline.json'), 'utf8'));
    expect(Object.keys(baseline).length).toBe(baselineCases().length);
    expect(baselineHashes()).toEqual(baseline);
  });
});

describe('新寫法的模板（年齡段 × 作答 × 有沒有逐題作答）', () => {
  it.each(baselineCases().map(c => [c.key, c.input] as const))('%s', (_key, input) => {
    const r = templateT1Report(input, W);
    const checked = validateT1Report(asModelOutput(r), input, W);
    expect(checked.ok, checked.ok ? '' : checked.errors.join('\n')).toBe(true);

    // 首席專家結論：三句；紅燈都點名；不寫題數
    expect(sentences(r.summary), r.summary).toHaveLength(3);
    for (const d of input.answers.dimensions.filter(x => x.status === 'delay')) expect(r.summary).toContain(d.dimensionName);
    expect(r.summary).not.toMatch(/\d+\s*题|做到了\s*\d+\s*项/);
    // 下一步：有被標記就是 T2 深度评估，全綠就是三個月後再篩一次
    const last = sentences(r.summary)[2];
    if (flaggedDimensions(input.answers).length) expect(last).toContain('T2 深度评估');
    else expect(last).toContain('三个月后再做一次筛查');

    // 每段：「这次看到的是：」開頭，接練法，沒有統計句
    for (const n of r.perDimension) {
      expect(n.note.startsWith('这次看到的是：'), n.note).toBe(true);
      expect(n.note).not.toMatch(/题里|\d+\s*题|合计|\d+\s*\/\s*\d+/);
      expect(n.note).toContain('可以这样练：');
    }

    // 用字：題目原文以外乾淨
    let all = [r.summary, r.prognosisPrediction, ...r.rehabSuggestions, ...r.homeGuidance, ...r.perDimension.map(n => n.note)].join('\n');
    if (input.answers.ageMonth !== null) for (const q of getT1AgeBand(input.answers.ageMonth).questions) all = all.split(q.text).join('');
    expect(findBannedWords(all)).toEqual([]);
  });

  it('只有一個方面被標記：說「一个方面」「这个方面」，不說「几个」', () => {
    const c = baselineCases().find(x => x.key.endsWith('/oneRed/items'))!;
    const s = templateT1Report(c.input, W).summary;
    expect(s).toContain('有一个方面');
    expect(s).toContain('把这个方面看得更细');
    expect(s).not.toContain('几个');
  });

  it('紅燈在黃燈前面；說明點出還做不到的那一題原文', () => {
    const c = baselineCases().find(x => x.key === '30/mixed/items') ?? baselineCases().find(x => x.key.endsWith('/mixed/items'))!;
    const r = templateT1Report(c.input, W);
    const s = sentences(r.summary)[1];
    expect(s.indexOf('语言沟通')).toBeLessThan(s.indexOf('动作发展'));
    const band = getT1AgeBand(c.input.answers.ageMonth!);
    const firstLanguage = band.questions.find(q => q.dimensionId === 'language')!.text;
    expect(r.perDimension[0].note).toContain(`「${firstLanguage}」`);
  });
});

describe('驗證器（新寫法）', () => {
  const input = baselineCases().find(x => x.key.endsWith('/mixed/items'))!.input;
  const good = () => asModelOutput(templateT1Report(input, W)) as any;

  it('好的那一份過', () => {
    expect(validateT1Report(good(), input, W).ok).toBe(true);
  });

  it.each([
    ['說明裡的統計句', (o: any) => { o.perDimension[0].note = `这次看到的是：这一项 4 题里，可以做到 1 题。可以这样练：每天陪孩子多说话。`; }],
    ['說明裡用中文數字的統計', (o: any) => { o.perDimension[0].note = `这次看到的是：四题里有两题还不能。可以这样练：每天陪孩子多说话。`; }],
    ['結論裡寫題數', (o: any) => { o.summary = `森森这次答的是 36 题，做到了 29 项。需要先关注的方面：语言沟通方面与同龄常见的发展节奏有差距，建议优先安排专业咨询。下一步建议做「T2 深度评估」。`; }],
    ['結論裡寫合計分數', (o: any) => { o.summary = `森森这次九个方面合计 50/72 分。需要先关注的方面：语言沟通方面与同龄常见的发展节奏有差距，建议优先安排专业咨询。下一步建议做「T2 深度评估」。`; }],
    ['說明不是「这次看到的是」開頭', (o: any) => { o.perDimension[0].note = '可以这样练：每天陪孩子面对面说话，共读时停下来等他回应。'; }],
    ['結論不是三句', (o: any) => { o.summary = `${o.summary}继续保持每天的亲子游戏。`; }],
  ])('擋：%s', (_name, mutate) => {
    const o = good();
    mutate(o);
    expect(validateT1Report(o, input, W).ok).toBe(false);
  });

  it.each([
    ['「这一题」「每一题」不是統計', (o: any) => { o.perDimension[0].note = `这次看到的是：每一题都还在练，这一题可以先从日常开始。可以这样练：每天陪孩子面对面说话。`; }],
    ['練法裡的分鐘數', (o: any) => { o.perDimension[0].note = `这次看到的是：说话时还不太会接话。可以这样练：每天找 10 到 15 分钟陪孩子聊天、共读。`; }],
  ])('放行：%s', (_name, mutate) => {
    const o = good();
    mutate(o);
    const checked = validateT1Report(o, input, W);
    expect(checked.ok, checked.ok ? '' : checked.errors.join(' | ')).toBe(true);
  });

  it('開關關著：統計句照舊放行（舊寫法的模板本身就有）', () => {
    const old = asModelOutput(templateT1Report(input));
    expect(String((old.perDimension as any)[0].note)).toContain('题里');
    expect(validateT1Report(old, input).ok).toBe(true);
  });

  it('模型寫了統計句：退新寫法的模板', async () => {
    const bad = good();
    bad.perDimension[0].note = '这次看到的是：这一项 4 题里还不能 4 题。可以这样练：每天陪孩子多说话。';
    const out = await generateT1Report(input, async () => ({ report: bad, aiEngine: 'qwen-x' }), W);
    expect(out.isAiGenerated).toBe(false);
    expect(out.aiEngine).toBe('template:qwen-x');
    expect(out.report).toEqual(templateT1Report(input, W));
  });
});

describe('提示（新寫法）', () => {
  const input = baselineCases().find(x => x.key.endsWith('/mixed/items'))!.input;
  const { system, user } = buildT1ReportPrompt(input, W);

  it('結論三句、說明「这次看到的是：」開頭、不寫題數', () => {
    expect(system).toContain('三句');
    expect(system).toContain('这次看到的是：');
    expect(system).toContain('T2 深度评估');
    expect(system).toMatch(/不要写题数/);
  });

  it('素材不給題數合計（不給就不會被照抄）；逐題作答照給', () => {
    expect(user).not.toContain('作答合计');
    expect(user).not.toMatch(/合计 \d+\/\d+ 分/);
    for (const q of getT1AgeBand(input.answers.ageMonth!).questions) expect(user).toContain(`「${q.text}」`);
  });
});
