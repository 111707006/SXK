/**
 * 新版 T1 報告的文字（`T1_REPORT_REAL`，只在專案 A）：模板退路、驗證器、「呼叫模型 → 驗證 → 不過就退模板」。
 *
 * 【為什麼有這一層】
 * 舊版 `/api/report` 只給模型九個維度的總分，叫它寫「突触偶联、前额叶」與四個 45–98 的儀表數字，
 * 回來的東西**沒有任何驗證**就給家長看；模板退路則是同一段腦科學敘述、每個孩子一樣的居家建議。
 * 新版給模型的是**每一題怎麼答的**（題目原文＋可以做到／有时・部分／还不能），請它用家長聽得懂的話寫，
 * 回來先過驗證器，不過就整份丟、退模板。模板也照這個孩子的作答組：哪幾方面被標記、哪幾題還不能。
 *
 * 做法照 T2 報告（`src/t2/report/generate.ts`、`proseV3.ts`）：引擎由呼叫端傳進來（正式站傳 T1 報告
 * 原本那一串：Qwen → 豆包 → DashScope → Gemini），**任一項不過，整份丟**，不重試、不局部修補；
 * `aiEngine` 三種（引擎代號／`template:<引擎>`／`template:all_engines_failed`）。
 *
 * 【驗證器擋什麼】（規則在 `rules.ts`；使用者 2026-10-08 選 a 之後放寬）
 * 1. 形狀：五個欄位、字數範圍、條數；多出來的欄位也擋（模型自己加一個 `criticalMetrics` 就是編數字）。
 * 2. 一致性：`perDimension` 恰好是被標記的那幾個維度；紅燈維度的名字要出現在 `summary`。
 * 3. 用字：**只擋**《用语对照表》禁字（`findBannedWords`）。數字、百分比、預測、量表名、腦神經的說法不擋，
 *    但同一段裡有預測（數字＋週／個月／％、「预计／有望／回到」……）就要接「一般经验，每个孩子进度不同」，沒接就擋。
 * 掃描前先挖掉這個年齡段的**題目原文** —— 題目是客戶的量表原文（「不严重抗拒」），引用它是在講
 * 「這一題」，不是系統在說孩子（同 `parentWording.structure.test.ts` 豁免 `t1Data.ts` 的理由）。
 * 只挖一字不差的原文；模型改寫過的題目照樣掃。
 * 模板本身不寫預測、不寫百分比。
 *
 * 這一檔的模板句在用字掃描裡（`test/parentWording.structure.test.ts`）；提示在 `prompt.ts`（含禁止清單，不掃）。
 */

import { getT1AgeBand } from '../t1Data';
import { ALL_CLEAR_SUMMARY, STATUS_WORDING, flaggedSummary } from '../utils/statusWording';
import { ALL_ENGINES_FAILED, templateEngineLabel, type ProseEngine } from '../t2/report/generate';
import { charCount } from '../t2/report/prose';
import { flaggedDimensions, itemsAnswered, t1AnswersOf, type T1Answers, type T1DimensionAnswers } from './answers';
import { T1_REPORT_REAL_VERSION, type T1RealReport } from './shape';
import { buildT1ReportPrompt } from './prompt';
import { T1_REPORT_LIMITS, findAdviceMismatch, findT1ReportViolations, tidyDisclaimers } from './rules';

export {
  PREDICTION_DISCLAIMER, PREDICTION_DISCLAIMER_TEXT, PREDICTION_PATTERNS, T1_REPORT_LIMITS, findPredictionSignal, findT1ReportViolations,
} from './rules';

export interface T1ReportInput {
  child: { name?: string; ageMonth?: number; gender?: string };
  answers: T1Answers;
}

/** 從請求 body 組輸入：成績當 unknown 收，月齡退路是**這一次**的孩子月齡（報告就是現在生成的）。 */
export function t1ReportInputOf(child: unknown, scores: unknown): T1ReportInput {
  const c = typeof child === 'object' && child !== null ? (child as Record<string, unknown>) : {};
  const ageMonth = typeof c.ageMonth === 'number' && Number.isFinite(c.ageMonth) ? c.ageMonth : undefined;
  return {
    child: {
      name: typeof c.name === 'string' ? c.name.trim().slice(0, 20) : undefined,
      ageMonth,
      gender: typeof c.gender === 'string' ? c.gender : undefined,
    },
    answers: t1AnswersOf(scores, ageMonth ?? null),
  };
}

/** 這個年齡段的題目原文（掃描前挖掉）。月齡不明就沒有東西可挖。 */
function questionTextsOf(answers: T1Answers): string[] {
  if (answers.ageMonth === null) return [];
  return [...getT1AgeBand(answers.ageMonth).questions.map(q => q.text)].sort((a, b) => b.length - a.length);
}

// ---------------------------------------------------------------------------
// 模板
// ---------------------------------------------------------------------------

type AgeGroup = 'young' | 'school';

/** 6 歲以前（A、B、C 段）與學齡（D、E 段）的建議分開寫：給 12 歲的孩子「滚球」不像話。 */
function ageGroupOf(answers: T1Answers): AgeGroup {
  return answers.ageMonth !== null && answers.ageMonth >= 72 ? 'school' : 'young';
}

/** 每一方面的練習建議（模板用）。白話、在家做得到、不用買東西。 */
export const DIMENSION_PRACTICE: Record<AgeGroup, Record<string, string>> = {
  young: {
    gross_motor: '每天带孩子到户外跑一跑、跳一跳，玩踢球、上下台阶、走直线这类游戏，每次 15 分钟左右。',
    sensory_processing: '在游戏里慢慢接触不同的感觉：玩沙、玩水、捏面团、尝一种新口味；孩子不愿意就先停，下次从一小步再试。',
    cognitive: '多玩配对、分类、藏东西找东西、拼图这类小游戏，边玩边把颜色、形状、用途说给孩子听。',
    attention: '每天留一段安静的玩耍时间，陪孩子把一个游戏玩完再换下一个；说话前先叫名字、看着孩子，一次只说一件事。',
    learning_ability: '每天一起读一本绘本，读完说说讲了什么；涂画、搭积木、学新玩法时多鼓励孩子自己先试。',
    language: '多和孩子面对面说话，把孩子想表达的意思用完整的短句说一遍给他听；共读时停下来问「这是什么」，等他回应。',
    social_emotional: '每天留一段一对一的游戏时间，玩你来我往的游戏（滚球、轮流搭积木），也多约小朋友一起玩。',
    emotion_behavior: '作息尽量固定；孩子情绪上来时先蹲下来抱抱，说出他的感受（「你很生气」），等平静了再一起想办法。',
    self_care: '把穿衣、洗手、吃饭、收玩具拆成一小步一小步，大人先示范，孩子做到一步就及时夸奖。',
  },
  school: {
    gross_motor: '每周固定几次一起运动：跳绳、骑车、球类都可以；写字时留意握笔和坐姿，一次写短一点、多休息。',
    sensory_processing: '和孩子一起找出让他不舒服的声音、光线或衣物，先调整环境；需要专心时给一个安静、少干扰的角落。',
    cognitive: '生活里多让孩子动脑：算一算买东西找多少钱、看钟表安排时间、按步骤做一件事，做完一起回顾。',
    attention: '作业拆成 15 到 20 分钟一段，中间休息几分钟；书桌只放当下要用的东西，做完一段就打个勾。',
    learning_ability: '固定每天的阅读和作业时间，先做最有把握的一项；学新内容时请孩子讲给你听，讲得出来就是学会了。',
    language: '吃饭或睡前请孩子讲讲今天的一件事，提醒他按「开头、经过、结果」说；多问「为什么」，听他把理由讲完。',
    social_emotional: '多创造和同龄人相处的机会，事后聊聊发生了什么、别人可能怎么想；有冲突时陪他一起想几种说法。',
    emotion_behavior: '每天留一点聊天时间，先听孩子说完再给意见；遇到挫折时帮他把感受说出来，再一起想下一步。',
    self_care: '用一张清单列出早上出门、整理书包的步骤，让孩子自己照着做；家务分一件固定交给他负责。',
  },
};

/** 沒有被標記的方面時（或湊不滿三條時）補上的一般建議。 */
const GENERAL_PRACTICE: Record<AgeGroup, string[]> = {
  young: [
    '每天固定一段不看屏幕的亲子游戏时间，跟着孩子的兴趣玩，大人多陪、多说、多回应。',
    '每天到户外活动一会儿，跑跳、爬、玩沙都好，让身体和感觉都有机会练习。',
    '睡前一起读绘本、聊聊今天发生的事，让说话和听故事成为每天的习惯。',
  ],
  school: [
    '每天固定一段不看屏幕的家庭时间，一起运动、聊天或做家务。',
    '作息尽量规律，睡眠充足，学习和休息分开安排。',
    '孩子做到一件事时，具体地说出他哪里做得好，让他知道努力被看见了。',
  ],
};

const HOME_GENERAL: Record<AgeGroup, string[]> = {
  young: [
    '吃饭、洗澡、出门这些日常时刻都是练习的机会：放慢一点，让孩子自己多试一步。',
    '每天留 10 到 15 分钟专心陪玩，不看手机，跟着孩子的兴趣走。',
    '孩子做到一点点就及时夸奖，说出他做到了什么（「你自己把鞋放好了」）。',
  ],
  school: [
    '把家里的事分一件给孩子负责，做完一起看看结果，让他有成就感。',
    '每周安排一次全家的户外活动或运动，一起出门、一起动。',
    '多听孩子讲学校里的事，先听完再给意见，让他愿意跟你说。',
  ],
};

function practiceOf(group: AgeGroup, dimensionId: string): string {
  return DIMENSION_PRACTICE[group][dimensionId] ?? GENERAL_PRACTICE[group][0];
}

/** 一個被標記的方面的說明：四題各怎麼答、可以從哪一題練起。 */
function templateNote(d: T1DimensionAnswers): string {
  const status = STATUS_WORDING[d.status];
  if (!d.items) {
    return `这一项合计 ${d.score}/${d.maxScore} 分，${status.describe}，${status.tag}。可以在日常里多陪孩子练习这方面的小事。`;
  }
  const can = itemsAnswered(d, 2);
  const partly = itemsAnswered(d, 1);
  const notYet = itemsAnswered(d, 0);
  const tally = `这一项 ${d.items.length} 题里，可以做到 ${can.length} 题、有时做得到 ${partly.length} 题、还不能 ${notYet.length} 题，${status.describe}。`;
  if (notYet.length) return `${tally}可以先从「${notYet[0].text}」这件事练起，在日常里多给孩子机会试。`;
  if (partly.length) return `${tally}「${partly[0].text}」有时做得到，可以在日常里多练几次，让它更稳定。`;
  return `${tally}${status.tag}。`;
}

/** 居家建議：被標記的方面挑一題還不能（沒有就挑有時）做的，放進日常；不夠三條用一般的補。 */
function templateHome(answers: T1Answers, group: AgeGroup): string[] {
  const out: string[] = [];
  for (const d of flaggedDimensions(answers)) {
    if (out.length >= 2) break;
    const target = itemsAnswered(d, 0)[0] ?? itemsAnswered(d, 1)[0];
    if (!target) continue;
    out.push(`「${d.dimensionName}」：把「${target.text}」放进每天的日常里，大人先示范一次，再请孩子试一次，做到了就及时夸奖。`);
  }
  for (const g of HOME_GENERAL[group]) if (out.length < 3) out.push(g);
  return out;
}

function templateSummary(input: T1ReportInput): string {
  const { answers } = input;
  const who = input.child.name || '孩子';
  const parts: string[] = [];
  if (answers.counts) {
    const c = answers.counts;
    parts.push(`${who}这次答的是「${answers.bandName}」的 ${c.total} 题，做到了 ${c.can} 项，有时做得到 ${c.partly} 项，还不能 ${c.notYet} 项。`);
  } else if (answers.dimensions.length) {
    // 沒有逐題作答（舊成績）：只講合計分數，那是真的；不講「做到了幾項」。
    const sum = answers.dimensions.reduce((a, d) => a + d.score, 0);
    const max = answers.dimensions.reduce((a, d) => a + d.maxScore, 0);
    parts.push(`${who}这次 ${answers.dimensions.length} 个方面合计 ${sum}/${max} 分。`);
  }
  parts.push(flaggedSummary(answers.dimensions) ?? ALL_CLEAR_SUMMARY);
  return parts.join('');
}

function templateNextSteps(answers: T1Answers, group: AgeGroup): string {
  const red = answers.dimensions.filter(d => d.status === 'delay').map(d => `「${d.dimensionName}」`);
  if (flaggedDimensions(answers).length === 0) {
    return group === 'young'
      ? '继续保持每天的亲子共读、游戏和户外活动。三个月后再做一次筛查，可以和这一次对照，看看这段时间的变化。'
      : '继续保持规律的作息、运动和亲子聊天。三个月后再做一次筛查，可以和这一次对照，看看这段时间的变化。';
  }
  return [
    '可以先从上面列的一两件小事开始，每天在日常里陪孩子练 10 到 15 分钟，不用一次全做完。',
    red.length ? `${red.join('、')}方面${STATUS_WORDING.delay.tag}。` : '',
    '三个月后再做一次筛查，就能看到这段时间的变化。',
  ].join('');
}

/** 模板退路。產出一定過 `validateT1Report`（`test/t1ReportReal.test.ts` 窮舉年齡段×判定盯著）。 */
export function templateT1Report(input: T1ReportInput): T1RealReport {
  const { answers } = input;
  const group = ageGroupOf(answers);
  const flagged = flaggedDimensions(answers);
  const rehab = flagged.slice(0, 4).map(d => `「${d.dimensionName}」：${practiceOf(group, d.dimensionId)}`);
  for (const g of GENERAL_PRACTICE[group]) if (rehab.length < 3) rehab.push(g);
  return {
    version: T1_REPORT_REAL_VERSION,
    summary: templateSummary(input),
    perDimension: flagged.map(d => ({ dimensionId: d.dimensionId, note: templateNote(d) })),
    rehabSuggestions: rehab,
    homeGuidance: templateHome(answers, group),
    prognosisPrediction: templateNextSteps(answers, group),
    neuralPathwayAnalysis: '',
  };
}

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

const AI_FIELDS = ['summary', 'perDimension', 'rehabSuggestions', 'homeGuidance', 'nextSteps'] as const;

export type T1ReportValidation = { ok: true; report: T1RealReport } | { ok: false; errors: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkText(raw: unknown, where: string, range: { min: number; max: number }, errors: string[]): string | null {
  if (typeof raw !== 'string') {
    errors.push(`${where}：要是字串，拿到 ${raw === undefined ? '缺這個欄位' : typeof raw}`);
    return null;
  }
  // 免責句只留在預測那一句（`tidyDisclaimers`）；之後的字數與用字都檢查整理過的字
  const value = tidyDisclaimers(raw);
  const n = charCount(value);
  if (n < range.min || n > range.max) errors.push(`${where}：${n} 字，超出 ${range.min}–${range.max} 的範圍`);
  return value;
}

function checkList(value: unknown, where: string, count: { min: number; max: number }, errors: string[], texts: Array<{ where: string; text: string }>): string[] | null {
  if (!Array.isArray(value)) {
    errors.push(`${where}：要是陣列`);
    return null;
  }
  if (value.length < count.min || value.length > count.max) errors.push(`${where}：${value.length} 條，要 ${count.min}–${count.max} 條`);
  const out: string[] = [];
  value.forEach((v, i) => {
    const t = checkText(v, `${where}[${i}]`, T1_REPORT_LIMITS.listItem, errors);
    if (t !== null) {
      out.push(t);
      texts.push({ where: `${where}[${i}]`, text: t });
    }
  });
  return out;
}

/**
 * 模型回來的 JSON（`summary`／`perDimension`／`rehabSuggestions`／`homeGuidance`／`nextSteps`）→ 驗過的報告。
 * 形狀 → 一致性 → 用字，任一項不過整份丟。
 */
export function validateT1Report(value: unknown, input: T1ReportInput): T1ReportValidation {
  const errors: string[] = [];
  const texts: Array<{ where: string; text: string }> = [];
  if (!isRecord(value)) return { ok: false, errors: ['整份：要是一個物件'] };
  const extra = Object.keys(value).filter(k => !(AI_FIELDS as ReadonlyArray<string>).includes(k));
  if (extra.length) errors.push(`整份：多了不認得的欄位 ${extra.join('、')}`);

  const summary = checkText(value.summary, 'summary', T1_REPORT_LIMITS.summary, errors);
  if (summary !== null) texts.push({ where: 'summary', text: summary });
  const nextSteps = checkText(value.nextSteps, 'nextSteps', T1_REPORT_LIMITS.nextSteps, errors);
  if (nextSteps !== null) texts.push({ where: 'nextSteps', text: nextSteps });
  const rehab = checkList(value.rehabSuggestions, 'rehabSuggestions', T1_REPORT_LIMITS.rehabCount, errors, texts);
  const home = checkList(value.homeGuidance, 'homeGuidance', T1_REPORT_LIMITS.homeCount, errors, texts);

  const flagged = flaggedDimensions(input.answers);
  const notes: T1RealReport['perDimension'] = [];
  if (!Array.isArray(value.perDimension)) {
    errors.push('perDimension：要是陣列');
  } else {
    value.perDimension.forEach((entry, i) => {
      if (!isRecord(entry)) {
        errors.push(`perDimension[${i}]：要是一個物件`);
        return;
      }
      const entryExtra = Object.keys(entry).filter(k => k !== 'dimensionId' && k !== 'note');
      if (entryExtra.length) errors.push(`perDimension[${i}]：多了不認得的欄位 ${entryExtra.join('、')}`);
      const id = typeof entry.dimensionId === 'string' ? entry.dimensionId : null;
      if (id === null) errors.push(`perDimension[${i}].dimensionId：要是字串`);
      const note = checkText(entry.note, `perDimension ${id ?? `[${i}]`}.note`, T1_REPORT_LIMITS.note, errors);
      if (note !== null) texts.push({ where: `perDimension ${id ?? `[${i}]`}.note`, text: note });
      if (id !== null && note !== null) notes.push({ dimensionId: id, note });
    });
    const got = value.perDimension.map(e => (isRecord(e) ? e.dimensionId : undefined)).filter((d): d is string => typeof d === 'string');
    const expected = flagged.map(d => d.dimensionId);
    const dup = got.filter((d, i) => got.indexOf(d) !== i);
    if (dup.length) errors.push(`perDimension：同一個維度出現兩次（${[...new Set(dup)].join('、')}）`);
    const missing = expected.filter(d => !got.includes(d));
    const surplus = got.filter(d => !expected.includes(d));
    if (missing.length) errors.push(`perDimension：少了被標記的維度 ${missing.join('、')}`);
    if (surplus.length) errors.push(`perDimension：多了沒被標記的維度 ${[...new Set(surplus)].join('、')}`);
  }

  if (summary !== null) {
    for (const d of input.answers.dimensions.filter(x => x.status === 'delay')) {
      if (!summary.includes(d.dimensionName)) errors.push(`summary：要點名「${d.dimensionName}」（这一方面${STATUS_WORDING.delay.tag}）`);
    }
  }

  const questions = questionTextsOf(input.answers);
  for (const { where, text } of texts) for (const hit of findT1ReportViolations(text, questions)) errors.push(`${where}：用字 ${hit}`);

  // 「优先安排专业咨询」只給紅燈；黃燈寫「建议进一步了解」（題目原文先挖掉，免得題目裡的字被當成方面名）
  const statuses = input.answers.dimensions.map(d => ({ name: d.dimensionName, status: d.status }));
  for (const { where, text } of texts) {
    let scrubbed = text;
    for (const q of questions) scrubbed = scrubbed.split(q).join('');
    for (const hit of findAdviceMismatch(scrubbed, statuses)) errors.push(`${where}：${hit}`);
  }

  if (errors.length) return { ok: false, errors };
  // 照被標記的順序排（紅燈在前），畫面不必再排。
  const order = flagged.map(d => d.dimensionId);
  notes.sort((a, b) => order.indexOf(a.dimensionId) - order.indexOf(b.dimensionId));
  return {
    ok: true,
    report: {
      version: T1_REPORT_REAL_VERSION,
      summary: summary!,
      perDimension: notes,
      rehabSuggestions: rehab!,
      homeGuidance: home!,
      prognosisPrediction: nextSteps!,
      neuralPathwayAnalysis: '',
    },
  };
}

/** 模板產出的形狀轉回「模型回來的樣子」，好讓模板走同一個驗證器（測試用）。 */
export function asModelOutput(report: T1RealReport): Record<string, unknown> {
  return {
    summary: report.summary,
    perDimension: report.perDimension,
    rehabSuggestions: report.rehabSuggestions,
    homeGuidance: report.homeGuidance,
    nextSteps: report.prognosisPrediction,
  };
}

// ---------------------------------------------------------------------------
// 呼叫模型
// ---------------------------------------------------------------------------

export interface T1ReportOutcome {
  report: T1RealReport;
  isAiGenerated: boolean;
  aiEngine: string;
  /** 退模板的原因，只給日誌與測試，不給家長、不存。 */
  errors: string[];
}

/** 永遠回得出一份報告：模型過了用模型的，否則用模板。 */
export async function generateT1Report(input: T1ReportInput, engine: ProseEngine): Promise<T1ReportOutcome> {
  const { system, user } = buildT1ReportPrompt(input);
  let raw: unknown;
  let aiEngine: string;
  try {
    ({ report: raw, aiEngine } = await engine(system, user));
  } catch (err: any) {
    return { report: templateT1Report(input), isAiGenerated: false, aiEngine: ALL_ENGINES_FAILED, errors: [`所有引擎皆失敗：${err?.message ?? err}`] };
  }
  const checked = validateT1Report(raw, input);
  if (checked.ok) return { report: checked.report, isAiGenerated: true, aiEngine, errors: [] };
  return { report: templateT1Report(input), isAiGenerated: false, aiEngine: templateEngineLabel(aiEngine), errors: checked.errors };
}
