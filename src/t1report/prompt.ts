/**
 * 新版 T1 報告送給模型的提示（`T1_REPORT_REAL`）。純函式：`T1ReportInput` → `{ system, user }`。
 *
 * 照 T2 報告提示（`src/t2/report/promptV3.ts`）的分法：系統提示是規則（每份一樣）、使用者提示是這個孩子的素材；
 * 先說規則，再用同一份規則驗（`rules.ts` 的 `findT1ReportViolations`）。
 *
 * 和舊版提示（`server.ts` 的 `/api/report`）不同的地方：
 * - 給的是**每一題怎麼答**，不只九個總分 —— 報告才寫得出「這個孩子」。
 * - 不再叫模型扮「首席临床医学主任医生」、用「突触偶联、前额叶」解析 —— 那些是 T1 問不出來的東西。
 * - 不再要四個 45–98 的指標數字 —— 那是編的。
 * - 不推銷穿戴硬體（舊版 A 的提示會請模型推薦「脑电反馈带」）：新版的建議只從這個孩子的作答來。
 *   商城的產品另放在報告最底下「相关产品」那一塊（`src/t1report/relatedProducts.ts`），**不進提示、不進模型寫的字**。
 * - 使用者 2026-10-08 選 a：數字與預測可以寫，但每一處預測後面要照抄 `PREDICTION_DISCLAIMER_TEXT`；
 *   驗證器只擋《用语对照表》禁字與「預測沒接免責」。
 *
 * ⚠️ 回傳的字串**含有禁字**（禁止清單本身、題目原文），這一檔不進用字掃描。
 */

import { BANNED_WORDS, PARENT_WORDING_CLAUSE } from '../utils/parentWording';
import { STATUS_WORDING } from '../utils/statusWording';
import { ANSWER_LABEL, flaggedDimensions, type T1Answers } from './answers';
import type { T1ReportInput, T1ReportOptions } from './report';

// 字數、條數與禁止清單與驗證器同一份（`rules.ts`），不在這裡重寫。
import * as limits from './rules';

/** 預測與數字：可以寫，但要接免責（使用者 2026-10-08 選 a；驗證器在 `rules.ts`）。 */
function predictionRule(is1022: boolean): string {
  return [
    `- 这份筛查是对照年龄题组的清单，不和其他孩子比较。如果写到预测、几周或几个月会怎样、进步的百分比，`,
    `  在那一句后面原样加上「${limits.PREDICTION_DISCLAIMER_TEXT}」，同一段里每一处都要有；没有把握就不写预测。`,
    `- 「${limits.PREDICTION_DISCLAIMER_TEXT}」只接在预测后面。约下一次筛查（「三个月后再做一次筛查」）、建议、练习的频率与时长、发展稳定的描述后面都不要加。`,
    is1022
      ? '- 不编任何指数或指标；不要写题数（「这一项四题里」「做到了几项」「合计几分」这类统计都不写），只写看到的样子。'
      : '- 不编任何指数或指标，题数和作答只用素材里给的。',
  ].join('\n');
}

/**
 * 客戶 10/22 的新寫法（`T1_REPORT_1022`，#81）：summary＝首席专家结论三句、perDimension 的 note 以「这次看到的是：」開頭。
 * 範例句是使用者給的目標樣子（規格 docs/specs/client-changes-2026-10-22-1-ui.md）。
 */
function outputFormat1022(r: (x: { min: number; max: number }) => string): string[] {
  const L = limits.T1_REPORT_LIMITS;
  return [
    `- summary：${r(L.summary)}。这是报告最上面的「首席专家结论」，恰好三句，每句以「。」结尾：`,
    '  第一句讲整体怎么样；',
    `  第二句讲需要先关注哪几个方面：「需要较多支持」的方面写在前面、每一个都要点名，接「${STATUS_WORDING.delay.tag}」；「需要少量支持」的方面写在后面，接「${STATUS_WORDING.borderline.tag}」，两种之间用「；」隔开；`,
    '  第三句讲下一步：有需要关注的方面时，建议做「T2 深度评估」把这几个方面看得更细；全部稳定时，写三个月后再做一次筛查、和这一次对照。',
    '  不要写题数、做到了几项、合计几分。全部稳定时第一句写「各方面发展稳定，可作为日后对照的基线记录」。',
    `- perDimension：数组，每个元素 { dimensionId, note }。素材里「需要写说明的方面」列了哪几个就写哪几个，不多不少，dimensionId 照抄。note ${r(L.note)}：`,
    `  以「${limits.NOTE_OPENING_1022}」开头，先用一句话写这一方面这次看到的具体情况（从还不能、有时做得到的那几题看出来的、日常里看得到的样子），再接在家怎么练（做什么、多久、怎么陪）。`,
    '  不要写「这一项 N 题里，可以做到几题、还不能几题」这类统计。',
    `  示例（学龄的孩子，动作发展方面）：「${limits.NOTE_OPENING_1022}体育课上比同学吃力一些，写字有时也比较费力。可以先从大动作玩起：每天找 10 到 15 分钟陪孩子跑跳、拍球、跳格子，先求玩得开心，不比快慢；写字前做几下手指操、捏捏黏土，让小手先热身。」`,
  ];
}

function buildSystem(is1022: boolean): string {
  const L = limits.T1_REPORT_LIMITS;
  const r = (x: { min: number; max: number }) => `${x.min}–${x.max} 字`;
  return [
    '你是一位替儿童发展筛查写家长版报告的中文写手。读这份报告的是孩子的爸爸妈妈，不是医生。',
    '你的工作：根据这个孩子每一题的作答，用家长听得懂的日常语言，写出这次看到的样子和在家可以怎么陪孩子练。',
    '',
    '【最重要的规则】',
    '- 每一方面的结论（发展稳定／需要少量支持／需要较多支持）已经由系统算好，你不能改，也不能自己另下判定。',
    '- 「建议优先安排专业咨询」只能用在「需要较多支持」的方面；「需要少量支持」的方面写「建议进一步了解」。两种方面不要写在同一个「建议……」里，分开写。',
    '- 只写素材里有的：哪几题可以做到、哪几题有时做得到、哪几题还不能。引用题目时，用「」把题目原文一字不改地抄进去。',
    '- 多写孩子日常里看得到的行为，少讲大脑内部怎么运作；家长要读得懂。',
    predictionRule(is1022),
    '- 不推荐任何需要购买的产品或设备。',
    '',
    '【禁止出现的词】（家长报告用语对照表；引用题目原文时照抄不算）',
    `${BANNED_WORDS.join('、')}。`,
    '',
    PARENT_WORDING_CLAUSE,
    '',
    '【输出格式】',
    '只输出一个 JSON 对象，不要有任何其他文字、不要包在代码块里。字段如下，不要加任何没有要求的字段：',
    ...(is1022 ? outputFormat1022(r) : [
    `- summary：${r(L.summary)}。一句到三句的总览：这次做到了几项（用素材给的数字）、哪几方面${STATUS_WORDING.delay.tag}、哪几方面${STATUS_WORDING.borderline.tag}。「需要较多支持」的每一方面都要点名。全部稳定时写「各方面发展稳定，可作为日后对照的基线记录」。`,
    `- perDimension：数组，每个元素 { dimensionId, note }。素材里「需要写说明的方面」列了哪几个就写哪几个，不多不少，dimensionId 照抄。note ${r(L.note)}：这一方面四题各怎么答，可以先从哪一题练起、在日常里怎么练。`,
    ]),
    `- rehabSuggestions：${L.rehabCount.min}–${L.rehabCount.max} 条，每条 ${r(L.listItem)}。针对被标记的方面、在家做得到的练习，具体到做什么、做多久；不用买任何东西。`,
    `- homeGuidance：${L.homeCount.min}–${L.homeCount.max} 条，每条 ${r(L.listItem)}。把练习放进吃饭、洗澡、出门、睡前这些日常时刻的做法。`,
    `- nextSteps：${r(L.nextSteps)}。接下来怎么做：先从哪几件小事开始、需要较多支持的方面建议优先安排专业咨询、三个月后再做一次筛查看变化。写到预测时照上面的规则加「${limits.PREDICTION_DISCLAIMER_TEXT}」。`,
  ].join('\n');
}

function genderWord(g: string | undefined): string {
  return g === 'boy' ? '男孩' : g === 'girl' ? '女孩' : '未填';
}

// 新寫法不給題數與合計分數：素材裡沒有，模型就不會照抄（客戶 10/22：不要統計句）。
function dimensionLines(answers: T1Answers, is1022: boolean): string[] {
  const out: string[] = [];
  for (const d of answers.dimensions) {
    const total = is1022 ? '' : `，四题合计 ${d.score}/${d.maxScore} 分`;
    out.push(`【${d.dimensionName}】（dimensionId: ${d.dimensionId}）结论：${STATUS_WORDING[d.status].label}${total}`);
    if (d.items) for (const it of d.items) out.push(`  - 「${it.text}」：${ANSWER_LABEL[it.answer]}`);
    else out.push(is1022 ? '  - （这一方面没有存下逐题作答）' : '  - （这一方面没有存下逐题作答，只有合计分数）');
  }
  return out;
}

function buildUser(input: T1ReportInput, is1022: boolean): string {
  const { child, answers } = input;
  const flagged = flaggedDimensions(answers);
  const lines: string[] = [];
  lines.push('孩子资料：');
  lines.push(`- 称呼：${child.name || '孩子'}`);
  lines.push(`- 年龄：${typeof child.ageMonth === 'number' ? `${child.ageMonth} 个月` : '未填'}`);
  lines.push(`- 性别：${genderWord(child.gender)}`);
  if (answers.bandName) lines.push(`- 这次作答的年龄题组：${answers.bandName}`);
  lines.push('');
  if (!is1022) {
    if (answers.counts) {
      const c = answers.counts;
      lines.push(`作答合计：共 ${c.total} 题，可以做到 ${c.can} 题，有时・部分 ${c.partly} 题，还不能 ${c.notYet} 题。`);
    } else {
      lines.push('作答合计：这份筛查有些方面没有存下逐题作答，不要写「做到了几项」的总数。');
    }
    lines.push('');
  }
  lines.push('各方面的作答（照题组顺序）：');
  lines.push(...dimensionLines(answers, is1022));
  lines.push('');
  lines.push(
    flagged.length
      ? `需要写说明的方面（perDimension 就写这几个，照这个顺序）：${flagged.map(d => `${d.dimensionId}（${d.dimensionName}，${STATUS_WORDING[d.status].label}）`).join('、')}`
      : '需要写说明的方面：无（perDimension 输出空数组 []）。',
  );
  return lines.join('\n');
}

export function buildT1ReportPrompt(input: T1ReportInput, options: T1ReportOptions = {}): { system: string; user: string } {
  const is1022 = options.writing === '1022';
  return { system: buildSystem(is1022), user: buildUser(input, is1022) };
}
