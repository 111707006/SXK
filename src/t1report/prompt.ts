/**
 * 新版 T1 報告送給模型的提示（`T1_REPORT_REAL`）。純函式：`T1ReportInput` → `{ system, user }`。
 *
 * 照 T2 報告提示（`src/t2/report/promptV3.ts`）的分法：系統提示是規則（每份一樣）、使用者提示是這個孩子的素材；
 * 先說不能寫什麼，再用同一份清單驗（`report.ts` 的 `findT1ReportViolations`）。
 *
 * 和舊版提示（`server.ts` 的 `/api/report`）不同的地方：
 * - 給的是**每一題怎麼答**，不只九個總分 —— 報告才寫得出「這個孩子」。
 * - 不再叫模型扮「首席临床医学主任医生」、用「突触偶联、前额叶」解析 —— 那些是 T1 問不出來的東西。
 * - 不再要四個 45–98 的指標數字 —— 那是編的。
 * - 不推銷穿戴硬體（舊版 A 的提示會請模型推薦「脑电反馈带」）：新版的建議只從這個孩子的作答來。
 *
 * ⚠️ 回傳的字串**含有禁字**（禁止清單本身、題目原文），這一檔不進用字掃描。
 */

import { BANNED_WORDS, PARENT_WORDING_CLAUSE } from '../utils/parentWording';
import { STATUS_WORDING } from '../utils/statusWording';
import { DIAGNOSIS_NAMES, INSTRUMENT_AND_TREATMENT_NAMES, REPLACED_SCALE_NAMES } from '../t2/report/blacklist';
import { ANSWER_LABEL, flaggedDimensions, type T1Answers } from './answers';
import type { T1ReportInput } from './report';

// 字數、條數與禁止清單與驗證器同一份（`rules.ts`），不在這裡重寫。
import * as limits from './rules';

const FABRICATION_RULE = [
  '这份筛查是对照年龄题组的清单，没有常模，也不和其他孩子比较：',
  '- 不写任何百分比、百分位、排名、「居同龄前百分之几」「超过多少孩子」之类的比较；',
  '- 不预测未来（不写「几周内可以回到某某范围」「预计」「一定会」），只写现在看到的和接下来可以怎么做；',
  '- 不编任何指数、分数或指标，只用素材里给的题数和作答。',
].join('\n');

function buildSystem(): string {
  const L = limits.T1_REPORT_LIMITS;
  const r = (x: { min: number; max: number }) => `${x.min}–${x.max} 字`;
  return [
    '你是一位替儿童发展筛查写家长版报告的中文写手。读这份报告的是孩子的爸爸妈妈，不是医生。',
    '你的工作：根据这个孩子每一题的作答，用家长听得懂的日常语言，写出这次看到的样子和在家可以怎么陪孩子练。',
    '',
    '【最重要的规则】',
    '- 每一方面的结论（发展稳定／需要少量支持／需要较多支持）已经由系统算好，你不能改，也不能自己另下判定。',
    '- 只写素材里有的：哪几题可以做到、哪几题有时做得到、哪几题还不能。引用题目时，用「」把题目原文一字不改地抄进去。',
    '- 写孩子日常里看得到的行为，不写大脑、神经内部怎么运作（不要出现神经、突触、前额叶、脑区、环路、皮层、可塑性这类词）。',
    FABRICATION_RULE,
    '- 不写任何问卷或量表的名称、代码；不提任何仪器、疗程、药物；不推荐任何需要购买的产品或设备。',
    '',
    '【禁止出现的词】',
    `1. 诊断名：${DIAGNOSIS_NAMES.join('、')}。`,
    `2. 仪器、疗程、药物：${INSTRUMENT_AND_TREATMENT_NAMES.join('、')}。`,
    `3. 量表名与代码：${REPLACED_SCALE_NAMES.join('、')}。`,
    `4. 编出来的比较与预测：${limits.FABRICATED_CLAIM_WORDS.join('、')}。`,
    `5. 家长报告用语对照表的禁字：${BANNED_WORDS.join('、')}。`,
    '',
    PARENT_WORDING_CLAUSE,
    '',
    '【输出格式】',
    '只输出一个 JSON 对象，不要有任何其他文字、不要包在代码块里。字段如下，不要加任何没有要求的字段：',
    `- summary：${r(L.summary)}。一句到三句的总览：这次做到了几项（用素材给的数字）、哪几方面${STATUS_WORDING.delay.tag}、哪几方面${STATUS_WORDING.borderline.tag}。「需要较多支持」的每一方面都要点名。全部稳定时写「各方面发展稳定，可作为日后对照的基线记录」。`,
    `- perDimension：数组，每个元素 { dimensionId, note }。素材里「需要写说明的方面」列了哪几个就写哪几个，不多不少，dimensionId 照抄。note ${r(L.note)}：这一方面四题各怎么答，可以先从哪一题练起、在日常里怎么练。`,
    `- rehabSuggestions：${L.rehabCount.min}–${L.rehabCount.max} 条，每条 ${r(L.listItem)}。针对被标记的方面、在家做得到的练习，具体到做什么、做多久；不用买任何东西。`,
    `- homeGuidance：${L.homeCount.min}–${L.homeCount.max} 条，每条 ${r(L.listItem)}。把练习放进吃饭、洗澡、出门、睡前这些日常时刻的做法。`,
    `- nextSteps：${r(L.nextSteps)}。接下来怎么做：先从哪几件小事开始、需要较多支持的方面建议优先安排专业咨询、三个月后再做一次筛查看变化。不要预测结果。`,
  ].join('\n');
}

function genderWord(g: string | undefined): string {
  return g === 'boy' ? '男孩' : g === 'girl' ? '女孩' : '未填';
}

function dimensionLines(answers: T1Answers): string[] {
  const out: string[] = [];
  for (const d of answers.dimensions) {
    out.push(`【${d.dimensionName}】（dimensionId: ${d.dimensionId}）结论：${STATUS_WORDING[d.status].label}，四题合计 ${d.score}/${d.maxScore} 分`);
    if (d.items) for (const it of d.items) out.push(`  - 「${it.text}」：${ANSWER_LABEL[it.answer]}`);
    else out.push('  - （这一方面没有存下逐题作答，只有合计分数）');
  }
  return out;
}

function buildUser(input: T1ReportInput): string {
  const { child, answers } = input;
  const flagged = flaggedDimensions(answers);
  const lines: string[] = [];
  lines.push('孩子资料：');
  lines.push(`- 称呼：${child.name || '孩子'}`);
  lines.push(`- 年龄：${typeof child.ageMonth === 'number' ? `${child.ageMonth} 个月` : '未填'}`);
  lines.push(`- 性别：${genderWord(child.gender)}`);
  if (answers.bandName) lines.push(`- 这次作答的年龄题组：${answers.bandName}`);
  lines.push('');
  if (answers.counts) {
    const c = answers.counts;
    lines.push(`作答合计：共 ${c.total} 题，可以做到 ${c.can} 题，有时・部分 ${c.partly} 题，还不能 ${c.notYet} 题。`);
  } else {
    lines.push('作答合计：这份筛查有些方面没有存下逐题作答，不要写「做到了几项」的总数。');
  }
  lines.push('');
  lines.push('各方面的作答（照题组顺序）：');
  lines.push(...dimensionLines(answers));
  lines.push('');
  lines.push(
    flagged.length
      ? `需要写说明的方面（perDimension 就写这几个，照这个顺序）：${flagged.map(d => `${d.dimensionId}（${d.dimensionName}，${STATUS_WORDING[d.status].label}）`).join('、')}`
      : '需要写说明的方面：无（perDimension 输出空数组 []）。',
  );
  return lines.join('\n');
}

export function buildT1ReportPrompt(input: T1ReportInput): { system: string; user: string } {
  return { system: buildSystem(), user: buildUser(input) };
}
