/**
 * 模板退路的固定說法（規格 v2 §6.4「每個 ★ 標籤一句固定說法、每個 caveat 一句固定說法」，#55）。
 *
 * 【這一檔是什麼】
 * 兩張查表：`TAG_SENTENCES`（57 個發現標籤各一句）與 `CAVEAT_SENTENCES`（17 個 caveat 各一句，
 * §5.6 第三欄）。模板報告就是這兩張表加上維度層的句子拼出來的；AI 那條路也拿這兩張表當**素材**
 * 放進提示裡（§6.2「§5.6 的固定句可改寫但不可略」）。
 *
 * 【為什麼標籤要有自己的句子，而不是讓模板講 band 就好】
 * band 只說「要不要多留意」，標籤說「練什麼」。一份只講 band 的報告，家長讀完知道語言要留意，
 * 但不知道是聽不懂還是說不出 —— 而這兩件事在家裡要做的事完全不同。
 *
 * 【用字】
 * 每一句都過 `findBlacklisted`（`t2ReportProse.test.ts` 逐句掃）。所以這裡看不到「落后」「不足」
 * 「困难」「明显」這些字 —— 不是客氣，是客戶 2026-09-11《對照表》與 §6.4 的黑名單擋掉的。
 * 描述一律寫成「還在發展中／還在練／目前還不多」：同一件事，家長讀完知道要做什麼，而不是知道
 * 孩子哪裡壞了。
 *
 * 【§5.6 的 N】
 * 三句帶數字（缺答幾題、幾個月時做的、只依幾題判斷）。數字不一定湊得出來 —— caveats 是整個維度
 * 的聯集，不記是哪一支帶來的。所以每一句有「有數字」與「沒數字」兩種寫法，`caveatSentence` 依
 * 傳不傳 `n` 選一種。湊不出數字時**不寫假的數字**，改寫成「有几题」「少数几题」。
 *
 * 【`parent_report` 沒有句子】
 * §5.6 明寫「不單獨成句」——22 支全部都是家長填的，每個維度都印一句「這是家長填的」，讀起來像
 * 在替結果打折 22 次。它進不了報告，但仍然留在 `caveats` 裡（快照要記得這件事）。
 */

import type { Caveat } from '../caveats';
import { FINDING_TAGS } from '../findingTags';
import type { FindingTag } from '../findingTags';
import type { DimensionCode } from '../types';

/** 57 個標籤各一句「這次看到什麼」。順序照 `FINDING_TAGS`。 */
export const TAG_SENTENCES: Readonly<Record<FindingTag, string>> = {
  // lang
  'lang.comprehension': '听大人说话、听懂指令这一块还在发展中，长一点的句子需要多说几遍。',
  'lang.expression': '主动说出来的话比同龄孩子少一些，句子也短一些。',
  'lang.expression_below_comprehension': '孩子听得懂的比说得出的多——理解走在前面，表达还在追上来。',
  'lang.vocabulary_size': '会说的词目前还不多，日常常见的东西有些还叫不出名字。',
  'lang.articulation': '说话时有些音还说不清楚，不熟的人不一定每次都听得明白。',
  'lang.pragmatics': '会说话，但轮到自己讲、看场合换个说法这些还在学。',
  // soc
  'soc.joint_attention': '和大人一起看同一样东西、顺着大人指的方向看，这样的来回还不多。',
  'soc.eye_contact': '和人说话时眼神对上来的次数还不多，多半看着别处。',
  'soc.imitation': '模仿大人的动作和声音这一块还在起步，需要人带着做。',
  'soc.social_initiation': '多半等别人来找他，自己主动开口、主动靠近的次数不多。',
  'soc.emotion_reciprocity': '分享开心的事、察觉别人的心情，这样的来回目前还不多。',
  'soc.pretend_play': '假装的游戏（喂娃娃、开车车、当医生）玩得还不多。',
  'soc.response_to_name': '叫名字时回头看过来的反应，目前不是每次都有。',
  'soc.stereotyped_behavior': '有一些重复的动作或固定的玩法会反复出现，换别的玩法不容易。',
  // emo
  'emo.regulation': '情绪上来的时候，自己平静下来需要比较长的时间。',
  'emo.adaptability_low': '换地方、换流程、换带的人时，需要比较长的时间才安顿下来。',
  'emo.intensity_high': '情绪来的时候力道比较大，开心和不开心都表现得很鲜明。',
  'emo.mood_negative': '一天里的心情底色偏向不太愉快，笑出来的时候少一些。',
  'emo.regularity_low': '吃饭、睡觉、大小便的时间不太固定，每天差得比较多。',
  'emo.slow_to_warm': '遇到新的人、新的地方，习惯先在旁边看一阵子再加入。',
  'emo.activity_high': '活动量大，很少停下来，坐着不动的时间短。',
  // att
  'att.inattention': '一件事做到一半容易被别的东西带走，要人提醒才回得来。',
  'att.hyperactivity': '身体停不下来，坐着的时候手脚也常在动。',
  'att.impulsivity': '想到就做、话到嘴边就说，等一下再动手这件事还在练。',
  'att.working_memory': '一次交代两三件事，常常记住前面就忘了后面。',
  'att.inhibition': '想做的事先停一下再决定，这个刹车还在练。',
  'att.organization': '收拾东西、排先后、准备等一下要用的，这些还需要大人带着。',
  // mot
  'mot.postural': '坐着、站着维持姿势的力气还在长，撑一阵子就想靠着。',
  'mot.locomotion': '走、跑、上下楼梯这些移动的动作还在稳定中。',
  'mot.balance': '单脚站、走直线、闭眼站这类平衡的动作还在练。',
  'mot.ball_skills': '丢球、接球、踢球的准头和时机还在练。',
  'mot.fine_motor': '手指的小动作——捏、扣、串、握笔——还在长。',
  // sen
  'sen.tactile': '对碰到身上的感觉反应比较大，某些衣服、某些触感会想躲开。',
  'sen.vestibular': '对晃动、旋转、双脚离地的活动反应比较大，或者特别爱找这类活动。',
  'sen.body_awareness': '对自己身体在哪里、该用多大力气的掌握还在长。',
  'sen.auditory': '对声音特别敏锐，吵的地方会想捂耳朵或者走开。',
  'sen.visual': '对光线和眼前太多东西比较敏锐，会想避开或者眯起眼睛。',
  'sen.oral': '对食物的口感和味道挑得比较细，刷牙也不太愿意。',
  'sen.regulation': '一天里的状态起伏大，太兴奋和太安静之间转换得很快。',
  'sen.threshold_low': '一点点声音、光线或碰触就会有反应，别人不一定注意到。',
  'sen.impact_adl': '家长提到这些反应已经影响到穿衣、吃饭、洗澡这些日常。',
  'sen.impact_group': '家长提到这些反应已经影响到在团体里跟着一起活动。',
  'sen.impact_play': '家长提到这些反应已经影响到玩的时候待不待得住。',
  // adl
  'adl.feeding': '自己吃饭这一段还需要大人帮上一部分。',
  'adl.dressing': '穿脱衣服、鞋袜还需要大人帮一把。',
  'adl.toileting': '上厕所的整套流程还需要大人提醒或者搭手。',
  'adl.hygiene': '洗手、刷牙、洗澡这些还需要大人带着做。',
  'adl.routines': '一天的固定流程还需要大人一步一步提醒。',
  // cog
  'cog.visual_attention': '看图找东西、盯着一样东西看完，这些还在练。',
  'cog.problem_solving': '遇到卡住的时候，自己想办法试的步数还不多。',
  'cog.concepts': '颜色、大小、多少、形状这些概念还在建立。',
  // learn
  'learn.reading': '认字和读句子这一块还在建立，读长一点的会跳字。',
  'learn.writing': '写字的笔顺、字的大小和位置还在练。',
  'learn.number': '数字和计算这一块还在建立。',
  'learn.phonological': '拼音、听音辨字这一块还在练。',
  'learn.task_persistence': '一件事坚持做完的时间还不长，容易中途换掉。',
  // severity
  'severity.severe': '这一项这次的结果落在最需要留意的那一段，建议请专业人员一起看。',
};

/** 帶 N 的三句，兩種寫法。 */
const COUNTED_CAVEAT_SENTENCES: Readonly<Partial<Record<Caveat, (n: number | null) => string>>> = {
  incomplete: n => n === null
    ? '这份问卷有几题没有作答，结果可能偏保守。'
    : `这份问卷有 ${n} 题没有作答，结果可能偏保守。`,
  age_out_of_window: n => n === null
    ? '这份结果是更早以前做的，超出这份工具适用的月龄范围，只作参考。'
    : `这份结果是在孩子 ${n} 个月时做的，超出这份工具适用的月龄范围，只作参考。`,
  few_items: n => n === null
    ? '这一项只依少数几题来看，宜与其他结果合起来读。'
    : `这一项只依 ${n} 题来看，宜与其他结果合起来读。`,
};

function counted(caveat: 'incomplete' | 'age_out_of_window' | 'few_items'): string {
  const render = COUNTED_CAVEAT_SENTENCES[caveat];
  if (!render) throw new Error(`report/sentences：${caveat} 應該有帶數字的寫法`);
  return render(null);
}

/**
 * 17 個 caveat 各一句（§5.6 第三欄，改寫成過得了《對照表》的說法）。
 * `parent_report` 是 `null`（不單獨成句）；帶 N 的三句在這裡放沒有數字的那種寫法。
 *
 * 改寫過的兩句與理由：
 * - `regression_reported` §5.6 寫「建議儘快安排專業評估」——「尽快」在《對照表》禁字裡
 *   （第三類「指令與緊迫感」）。換成「尽早」，急迫感留著，禁字不留。
 * - `safety_concern` 同上（「請儘快聯繫專業人員」）。這一句是整份報告裡最該急的一句，所以
 *   不是柔化它，是換一個更具體的說法：「请今天就联系」比「请尽快」更难被读成客套。
 */
export const CAVEAT_SENTENCES: Readonly<Record<Caveat, string | null>> = {
  incomplete: counted('incomplete'),
  age_out_of_window: counted('age_out_of_window'),
  unsourced_threshold: '这份工具的分段是森心康依临床经验订定的参考带，还没有建立常模。',
  parent_report: null,
  parent_administered_task: '这份是家长依孩子平常的表现勾选的，不是专业人员现场测出来的。',
  rater_not_credentialed: '协助程度由家长自己拿捏，不同的人来评分会有一些差异。',
  rater_role_parent: '这份原本设计由专业人员观察后填写，这次由家长依日常观察填答。',
  few_items: counted('few_items'),
  follow_up_not_done: '建议再由专业人员做一次进一步的访谈来确认。',
  regression_reported: '家长提到孩子有些原本会做的事现在不做了，建议尽早请专业人员看看。',
  recent_onset: '这些表现出现还不到六个月，先留意最近生活里的变化。',
  single_setting: '目前只在一个场合观察到，建议也请老师在学校里一起观察。',
  no_functional_impact: '家长认为这些反应目前还没有影响到日常参与。',
  descriptive_only: '这份只呈现相对的程度，不做分级。',
  hearing_check_first: '建议先安排一次听力检查。',
  narrow_window: '这份只涵盖三岁前后，不适合跨年龄比较。',
  safety_concern: '孩子出现伤害自己的举动时，请今天就联系专业人员。',
};

/** `safety_concern` 那一句。§5.6 說它**報告置頂**，所以 `overview` 開頭原樣照抄這一句。 */
export const SAFETY_SENTENCE: string = CAVEAT_SENTENCES.safety_concern ?? '';

/**
 * 一個 caveat 的固定句。`n` 只有 `incomplete`／`age_out_of_window`／`few_items` 會用到；
 * 其餘傳了也不影響。`parent_report` 回 `null`。
 */
export function caveatSentence(caveat: Caveat, n: number | null = null): string | null {
  const render = COUNTED_CAVEAT_SENTENCES[caveat];
  return render ? render(n) : CAVEAT_SENTENCES[caveat];
}

/**
 * 「這個維度為什麼值得花力氣」——九個維度各一句，放在 `whyItMatters` 裡。
 * 講的是這個能力在生活裡撐著什麼，不是它落在哪一段（那是 band 的事）。
 */
export const DIMENSION_WHY: Readonly<Record<DimensionCode, string>> = {
  COG: '动脑的这些基本功是后面学东西的底子，越早在日常里用得上，接下一步就越顺。',
  LANG: '说得出、听得懂是孩子跟外面打交道的主要工具；语言顺了，情绪和相处常跟着顺。',
  SOC: '和人一来一回是孩子学东西的主要通道；愿意来回了，其他能力才有机会一起练。',
  EMO: '情绪稳下来，孩子才有余力去学别的事；这一块的进展会带动一整天的节奏。',
  ATT: '专注和刹车决定孩子能不能把学到的东西真的用出来，在学校里尤其看得出差别。',
  MOT: '身体用得顺，孩子才愿意去探索；动作上的进展常常带着认知和社交一起走。',
  SEN: '身体收到的感觉舒服了，孩子才坐得住、玩得下去，日常的配合也会跟着上来。',
  ADL: '自己做得到的事越多，孩子的把握感越强，家里每天的节奏也会轻松一些。',
  LEARN: '读写和数的基本功会一路用到高年级，现在补上的每一点，后面都少绕一圈。',
};

/** `TAG_SENTENCES` 的鍵就是 `FINDING_TAGS`，一個不漏、一個不多（`t2ReportProse.test.ts` 盯著）。 */
export const SENTENCE_TAGS: ReadonlyArray<FindingTag> = FINDING_TAGS;
