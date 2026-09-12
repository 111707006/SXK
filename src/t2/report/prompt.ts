/**
 * 送給模型的提示（規格 v2 §6.1、§6.2，#55）。
 *
 * 【這一層做什麼】
 * 一個純函式 `buildProsePrompt`：`T2ReportInput` → `{ system, user }` 兩段字。**不呼叫模型** ——
 * 哪個引擎、幾段備援、逾時多久，是伺服器票（#59）的事；正式站現成的 `generateReportJSON`
 * 三段備援（Qwen → Doubao → DashScope）沿用，換的只有這兩段字與 `validateProse`。
 *
 * 【系統提示與使用者提示為什麼分開】
 * 系統提示是**規則**，每一份報告都一樣，可以整段快取；使用者提示是**這個孩子的素材**，每份都
 * 不同。混在一起寫，規則會跟著孩子的資料一起被改寫，而「不得改變判定」這種話一旦被模型讀成
 * 建議就沒有意義了。
 *
 * 【提示裡的禁止清單就是驗證器的黑名單】
 * 兩邊同一份（`blacklist.ts`）。先告訴模型不能寫什麼，再用同一份清單檢查它寫了什麼 ——
 * 兩份清單會漂，漂掉的那幾個字就是「提示沒說、驗證器會退」的無效重試。
 *
 * ⚠️ **這一檔的產出本身含有禁字**（禁止清單要把那些字寫出來，模型才知道不能用）。
 * 所以 `findBlacklisted` **不掃提示**，只掃模型回來的東西與模板的產出。
 *
 * 【caveats 為什麼連固定句一起給】
 * §6.2 說 caveats「固定句可改寫但不可略」。只給 `incomplete` 這種代號，模型得自己想那是什麼
 * 意思；給了 §5.6 的固定句，它要嘛照抄、要嘛換句話說，兩種都對。驗證器比的是**條數**，所以
 * 少給一條就等於默許它漏一條。
 *
 * 【不給模型的】
 * 題目原文、每一題的作答、分數怎麼算出來的。§6.1 那張圖上模型站在規則引擎的**下游**：
 * 它看到的是結論與素材，不是原始答案 —— 看得到答案，它遲早會自己做一次判定。
 */

import { SITE_DIMENSION_NAME } from '../dimensionMap';
import type { DimensionFinding, T2Findings } from '../types';
import { BANNED_WORDS } from '../../utils/parentWording';
import {
  DIAGNOSIS_NAMES,
  INSTRUMENT_AND_TREATMENT_NAMES,
  PUBLIC_TOOL_NAMES,
  REPLACED_SCALE_NAMES,
  TIER_NAMES,
} from './blacklist';
import {
  CHAR_RANGES,
  CLOSING_SENTENCE,
  caveatsToVoice,
  hasSafetyConcern,
  reportedDimensions,
  temperamentTagsOf,
} from './prose';
import type { T2ReportInput } from './prose';
import { CAVEAT_SENTENCES, SAFETY_SENTENCE, TAG_SENTENCES } from './sentences';

export interface ProsePrompt {
  system: string;
  user: string;
}

/** 系統提示裡那一句「不能改判定」。測試盯著它 —— 這是整段規則的地基。 */
export const NO_VERDICT_CHANGE_RULE =
  '判定已经由规则引擎算好，你不得改变判定：不得把 watch 写成没事、不得把 clear 写成要留意、不得自己下任何结论。';

function list(values: ReadonlyArray<string>): string {
  return values.join('、');
}

function range(r: { min: number; max: number }): string {
  return `${r.min}–${r.max} 字`;
}

/** 規則。每份報告都一樣，與孩子無關。 */
function buildSystem(): string {
  return [
    '你是一位替儿童发展筛查机构写家长版报告的中文写手。你的工作只有一件：把已经算好的结论写成家长读得懂的段落。',
    '',
    '【最重要的一条】',
    NO_VERDICT_CHANGE_RULE,
    '',
    '【你可以做的】',
    '- 把发现标签展开成家长读得懂的话（例如 lang.expression_below_comprehension 写成「孩子听得懂的比说得出的多」）。',
    '- 用素材里给的 reason 解释为什么选了这几支活动。',
    '- 引用素材里已经有的原生数字（例如「达成率 78%」），但不得自己算、不得改。',
    `- 提到这四支工具的官方名称：${list(PUBLIC_TOOL_NAMES)}。`,
    '',
    '【你不可以做的】',
    '- 换掉任何一支活动、新增任何一支活动、改动任何一条目标。',
    '- 省略任何一条 caveat：素材里每个维度列了几条，你就写几条（固定句可以改写，不可以少）。',
    '- 引用问卷的题目原文。你拿到的素材里没有题目，也不要凭印象写出像题目的句子。',
    '- 提任何仪器、疗程、药物。',
    '- 写出下面任何一类词。',
    '',
    '【禁止出现的词】',
    `1. 诊断名：${list(DIAGNOSIS_NAMES)}。这是一份筛查，不是诊断。`,
    `2. 仪器、疗程、药物：${list(INSTRUMENT_AND_TREATMENT_NAMES)}。`,
    `3. 已经不再使用的量表名：${list(REPLACED_SCALE_NAMES)}。这次没有跑过这些量表，写出来就是编的。`,
    `4. 分段的内部名称：${list(TIER_NAMES)}。这些是内部刻度，不给家长看。`,
    `5. 家长报告用语对照表的禁字：${list(BANNED_WORDS)}。`,
    '',
    '【输出格式】',
    '只输出一个 JSON 对象，不要有任何其他文字、不要包在代码块里。字段如下：',
    `- overview：${range(CHAR_RANGES.overview)}，只讲各项落在什么范围，不讲细节。`,
    '- perDimension：数组，每个元素是 { dimensionId, whatWeSaw, whyItMatters, caveats }。',
    `  - whatWeSaw：${range(CHAR_RANGES.whatWeSaw)}，由发现标签展开。`,
    `  - whyItMatters：${range(CHAR_RANGES.whyItMatters)}，讲这项能力在生活里撑着什么。`,
    '  - caveats：字符串数组，逐条对应素材里这个维度的 caveats。',
    `- temperament：${range(CHAR_RANGES.temperament)}。只有素材里有气质标签时才写这个字段，没有就不要放。`,
    `- weeklyPlanIntro：${range(CHAR_RANGES.weeklyPlanIntro)}，说明这四支活动怎么排。`,
    `- closing：${range(CHAR_RANGES.closing)}，必须含「${CLOSING_SENTENCE}」这几个字。`,
    '不要加任何素材里没有要求的字段。',
  ].join('\n');
}

function dimensionBlock(dimension: DimensionFinding): string {
  const area = SITE_DIMENSION_NAME[dimension.dimensionId];
  const lines = [`- ${dimension.dimensionId}（家长看到的名称：${area}）：判定 ${dimension.band}`];
  lines.push(`  发现标签：${dimension.tags.length === 0
    ? '（这次没有更细的标签，只有判定）'
    : dimension.tags.map(t => `${t}＝${TAG_SENTENCES[t]}`).join('；')}`);
  const caveats = caveatsToVoice(dimension);
  lines.push(`  caveats（${caveats.length} 条，一条都不能少）：${caveats.length === 0
    ? '（无）'
    : caveats.map(c => `${c}＝${CAVEAT_SENTENCES[c] ?? ''}`).join('；')}`);
  return lines.join('\n');
}

/** 這個孩子的素材。 */
function buildUser(input: T2ReportInput): string {
  const { findings, activities, goals } = input;
  const wanted = reportedDimensions(findings);
  const lines: string[] = [];

  lines.push('【孩子】');
  lines.push(`实足月龄 ${findings.child.assessedAgeMonth} 个月${input.childName ? `，名字 ${input.childName}` : ''}。`);
  lines.push('');

  lines.push('【要写段落的维度，不多不少就是这几个，顺序照这里】');
  lines.push(wanted.length === 0 ? '（这次没有需要单独成段的维度，perDimension 写成空数组）' : wanted.map(dimensionBlock).join('\n'));
  lines.push('');

  const temperament = temperamentTagsOf(findings);
  lines.push('【气质标签】');
  lines.push(temperament.length === 0
    ? '（没有。不要写 temperament 字段。）'
    : `${temperament.map(t => `${t}＝${TAG_SENTENCES[t]}`).join('；')}\n这些是天生风格，不是要练掉的东西。`);
  lines.push('');

  lines.push('【这一周的活动，原样带入，不得换、不得加】');
  lines.push(activities.picks.length === 0
    ? '（这一周没有可以安排的活动。）'
    : activities.picks.map((p, i) => {
      const tags = p.reason.matchedTags.length === 0 ? '（只对上维度，没有对上更细的标签）' : p.reason.matchedTags.join('、');
      const below = p.reason.belowWindow ? '；这一支是从更早一步的内容取的' : '';
      return `${i + 1}. ${p.activity.title}（为「${SITE_DIMENSION_NAME[p.dimension]}」挑的，判定 ${p.reason.band}，对上的标签：${tags}${below}）`;
    }).join('\n'));
  if (activities.preparing.length > 0) {
    lines.push(`还在准备中、这一周没有活动的维度：${activities.preparing.map(d => SITE_DIMENSION_NAME[d]).join('、')}。`);
  }
  lines.push('');

  lines.push('【已经算好的目标，原样带入，不得改动数字】');
  lines.push(goals.length === 0
    ? '（这次没有目标。）'
    : goals.map((g, i) => `${i + 1}. ${g.area}：${g.longTerm} ${g.shortTerm} ${g.measure}`).join('\n'));
  lines.push('');

  if (hasSafetyConcern(findings)) {
    lines.push('【必须照抄的一句】');
    lines.push(`overview 的第一句原样写成：${SAFETY_SENTENCE}一个字都不要改，也不要放在别的位置。`);
    lines.push('');
  }

  lines.push('【提醒】');
  lines.push('只输出 JSON。不要引用问卷的题目原文。不要出现系统提示里列的任何一个禁止词。');
  return lines.join('\n');
}

/**
 * `T2ReportInput` → 送給模型的兩段字。同輸入兩次結果相同（沒有時鐘、沒有隨機）。
 *
 * ⚠️ 回傳的字串**含有禁字**（禁止清單本身），不要拿去過 `findBlacklisted`。
 */
export function buildProsePrompt(input: T2ReportInput): ProsePrompt {
  return { system: buildSystem(), user: buildUser(input) };
}
