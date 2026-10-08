/**
 * 完整版報告送給模型的提示（T2 v3）。純函式：`T2ReportInputV3` → `{ system, user }`。
 *
 * 照舊版 `prompt.ts` 的分法：系統提示是規則（每份一樣）、使用者提示是這個孩子的素材。禁止清單與驗證器同一份
 *（`blacklist.ts`、《用语对照表》），先說不能寫什麼，再用同一份清單檢查。
 *
 * ⚠️ 回傳的字串**含有禁字**（禁止清單本身），不要拿去過 `findBlacklisted`，這一檔也不進用字掃描。
 *
 * 【不給模型的】題目原文、每一題的作答、量表名稱（量表名稱裡有禁字，理由見 `proseV3.ts` 檔頭）。
 * 模型看到的是規則引擎的結論與「哪幾面比較弱」，不是原始答案。
 */

import { SITE_DIMENSION_NAME } from '../dimensionMap';
import { BANNED_WORDS } from '../../utils/parentWording';
import { STATUS_WORDING } from '../../utils/statusWording';
import { dimensionStatus } from '../reportCopy';
import { noticeLinesV3, qolSummaryV3 } from '../reportCopyV3';
import { STATUS_OF_BAND } from '../weeklyCopy';
import { DIAGNOSIS_NAMES, INSTRUMENT_AND_TREATMENT_NAMES, REPLACED_SCALE_NAMES } from './blacklist';
import { CLOSING_SENTENCE } from './prose';
import { CHAR_RANGES_V3, reportedDimensionsV3, weakFacetsV3, type T2ReportInputV3 } from './proseV3';
import { NO_VERDICT_CHANGE_RULE, type ProsePrompt } from './prompt';

const range = (r: { min: number; max: number }) => `${r.min}–${r.max} 字`;

function buildSystem(): string {
  return [
    '你是一位替儿童发展评估机构写家长版报告的中文写手。你的工作只有一件：把已经算好的结论写成家长读得懂、温和而具体的段落。',
    '',
    '【最重要的一条】',
    NO_VERDICT_CHANGE_RULE,
    '',
    '【你不可以做的】',
    '- 写出任何问卷或量表的名称、代码；只讲「哪一方面」（素材里给的方面名称）。',
    '- 引用问卷的题目原文，或凭印象写出像题目的句子。',
    '- 提任何仪器、疗程、药物，或做任何诊断。',
    '- 写生活质量、天生风格（气质）、最上方提示这几段：它们由系统另外列出，你只能当背景参考，不要重复。',
    '- 写出下面任何一类词。',
    '',
    '【禁止出现的词】',
    `1. 诊断名：${DIAGNOSIS_NAMES.join('、')}。这是一份评估整理，不是诊断。`,
    `2. 仪器、疗程、药物：${INSTRUMENT_AND_TREATMENT_NAMES.join('、')}。`,
    `3. 量表名与代码：${REPLACED_SCALE_NAMES.join('、')}，以及任何「××量表」「××问卷」的名称。`,
    `4. 家长报告用语对照表的禁字：${BANNED_WORDS.join('、')}。`,
    '',
    '【输出格式】',
    '只输出一个 JSON 对象，不要有任何其他文字、不要包在代码块里。字段如下：',
    `- overview：${range(CHAR_RANGES_V3.overview)}，概括各方面落在什么范围，先讲需要优先关注的。`,
    '- perDimension：数组，每个元素是 { dimensionId, whatWeSaw, whyItMatters }，素材里列了哪几个维度就写哪几个，不多不少。',
    `  - whatWeSaw：${range(CHAR_RANGES_V3.whatWeSaw)}，讲这次看到的情况（可以点出素材里比较弱的那几面）。`,
    `  - whyItMatters：${range(CHAR_RANGES_V3.whyItMatters)}，讲这项能力在日常生活里撑着什么、家长可以怎么陪。`,
    `- closing：${range(CHAR_RANGES_V3.closing)}，鼓励家长照「线上干预」里的家庭活动陪孩子练，必须含「${CLOSING_SENTENCE}」这几个字；不要再写「三个月后重评」，系统会另外列出。`,
    '不要加任何没有要求的字段。',
  ].join('\n');
}

function buildUser(input: T2ReportInputV3): string {
  const { findings } = input;
  const age = findings.child.assessedAgeMonth;
  const lines: string[] = [];
  lines.push('【孩子】');
  lines.push(`答题时 ${age} 个月${input.childName ? `，名字 ${input.childName}` : ''}${findings.child.sex ? `，${findings.child.sex === 'boy' ? '男孩' : '女孩'}` : ''}。近 3 个月填写了 ${findings.toolResults.length} 份问卷。`);
  lines.push('');

  lines.push('【九个方面的判定（已定，不得改）】');
  for (const d of findings.dimensions) {
    if (d.band === 'not_screened') continue;
    lines.push(`- ${d.dimensionId}（${SITE_DIMENSION_NAME[d.dimensionId]}）：${dimensionStatus(d, age).label}——${dimensionStatus(d, age).tag}`);
  }
  lines.push('');

  const wanted = reportedDimensionsV3(findings);
  lines.push('【要写段落的维度，不多不少就是这几个】');
  if (wanted.length === 0) lines.push('（这次没有需要单独成段的维度，perDimension 写成空数组）');
  for (const d of wanted) {
    const name = SITE_DIMENSION_NAME[d.dimensionId];
    if (d.band === 'no_tool') {
      lines.push(`- ${d.dimensionId}（${name}）：这个年龄没有适合家长在家填写的问卷，这次没有结果；筛查时这一项有标记，建议预约专家当面了解。`);
      continue;
    }
    const status = STATUS_WORDING[STATUS_OF_BAND[d.band as 'watch' | 'refer']];
    const weak = weakFacetsV3(findings, d);
    lines.push(`- ${d.dimensionId}（${name}）：${status.label}，${status.tag}。${weak.length ? `比较弱的几面：${weak.join('、')}。` : '没有特别突出的哪一面。'}`);
  }
  lines.push('');

  const background: string[] = [];
  const qol = findings.toolResults.find(r => r.toolId === 'SXK-QOL');
  const qolSummary = qol ? qolSummaryV3(qol) : null;
  if (qolSummary) background.push(`生活质量：${qolSummary.sentence}`);
  for (const n of [...(findings.t1Notices ?? []).map(x => x.text), ...noticeLinesV3(findings)]) background.push(`已在报告最上方列出的提示：${n}`);
  if (background.length) {
    lines.push('【背景（系统另外列出，不要重复成段）】');
    lines.push(...background.map(b => `- ${b}`));
    lines.push('');
  }

  lines.push('【提醒】');
  lines.push('只输出 JSON。不要写问卷名称、题目原文，不要出现系统提示里列的任何一个禁止词。');
  return lines.join('\n');
}

/** 同輸入兩次結果相同（沒有時鐘、沒有隨機）。⚠️ 回傳的字串含禁字。 */
export function buildProsePromptV3(input: T2ReportInputV3): ProsePrompt {
  return { system: buildSystem(), user: buildUser(input) };
}
