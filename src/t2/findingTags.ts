/**
 * 發現標籤：受控詞彙 v2（規格 §5.5）。
 *
 * 【這是什麼】
 * 一份量表對某個維度「具體看到什麼」——「表達弱於理解」「觸覺過度反應」「工作記憶」。
 * 嚴重度決定**要不要**干預，發現標籤決定**練什麼**（CONTEXT.md「發現標籤」）。
 *
 * 【為什麼要寫成常數】
 * 量表規則表那一邊產生標籤，活動庫那一邊貼標籤，兩邊必須是**同一組字**。
 * 打成字串到處寫，`soc.eye_contact` 與 `soc.eyeContact` 會各自長出來，而且不會有
 * 任何型別錯誤 —— 只會有一個維度永遠配不到活動，沒有人看得出來。
 *
 * 【兩種用途】
 * `ACTIVITY_TAGS`（規格的 ★）配活動，`Activity.targets` 只認這些。
 * `REPORT_ONLY_TAGS` 只進報告 —— 氣質的「慢熱型」不是要訓練掉的東西，它是特質，
 * 但它該讓報告多一句「前幾次先讓他在旁邊看」。把特質當症狀治，就是把量表的產出
 * 全部拿去挑活動的下場。
 *
 * 格式一律 `<維度小寫>.<標的>`。`severity` 不是維度，是跨工具的嚴重度標記（tier 4）。
 *
 * 產出每個標籤的規則在 `sectionTags.ts`（面向級、氣質、chexi 因素、前置題、衍生）
 * 與 `itemTags.ts`（逐題級）。`test/t2FindingTags.test.ts` 擋住「定義了但沒有任何
 * 規則產得出來」的死字。
 */

/** 標籤的前綴：九個維度的小寫，加上跨工具的 `severity`。 */
export type TagDimension =
  | 'lang' | 'soc' | 'emo' | 'att' | 'mot' | 'sen' | 'adl' | 'cog' | 'learn' | 'severity';

export const TAG_DIMENSIONS: ReadonlyArray<TagDimension> = [
  'lang', 'soc', 'emo', 'att', 'mot', 'sen', 'adl', 'cog', 'learn', 'severity',
];

/**
 * ★ 配活動。活動庫的 `targets` 只能貼這些字。
 * 順序照 §5.5 的表（維度由上而下、每列由左而右），方便逐格對。
 */
export const ACTIVITY_TAGS = [
  // lang —— lang RC／EX／AR／PR；voc V1／V2／V3；asq CO；dev LANG；adl CC 前兩項；asb LA；mchat 2、18
  'lang.comprehension',
  'lang.expression',
  'lang.expression_below_comprehension',
  'lang.vocabulary_size',
  'lang.articulation',
  'lang.pragmatics',
  // soc —— soc S1–S4；mchat 逐題；asb RE／BO 逐題；asr 1、2、9、10；asq PE；dev SOC
  'soc.joint_attention',
  'soc.eye_contact',
  'soc.imitation',
  'soc.social_initiation',
  'soc.emotion_reciprocity',
  'soc.pretend_play',
  // emo —— soc S5；ab OD；snap OD；chexi 調節力；asb SH；asr 3、11、12、13；temp 九向度
  'emo.regulation',
  // att —— ab SU／DI／IM／HY／EF；att 五情境；snap IA／HI；chexi；ldp 注意力方面；temp 注意分散度
  'att.inattention',
  'att.hyperactivity',
  'att.impulsivity',
  'att.working_memory',
  'att.inhibition',
  'att.organization',
  // mot —— gm P1–P5；dev MOT／FM；asq GM／FM；adp A2；adl MO；asb BO 7；mchat 4、13、20
  'mot.postural',
  'mot.locomotion',
  'mot.balance',
  'mot.ball_skills',
  'mot.fine_motor',
  // sen —— spa／spb 七系統與前置題；asb SE 逐題；asr 6、7、8；mchat 5、12；temp 反應閾
  'sen.tactile',
  'sen.vestibular',
  'sen.body_awareness',
  'sen.auditory',
  'sen.visual',
  'sen.oral',
  'sen.regulation',
  // adl —— adl 逐項；adp A5；asq PE 前三項；dev ADL；asb SH 4、5
  'adl.feeding',
  'adl.dressing',
  'adl.toileting',
  'adl.hygiene',
  'adl.routines',
  // cog —— adp A1／A3／A4；asq PS；dev COG
  'cog.visual_attention',
  'cog.problem_solving',
  'cog.concepts',
  // learn —— ldp／lds 五方面；temp 堅持度；att HW
  'learn.reading',
  'learn.writing',
  'learn.number',
  'learn.phonological',
  'learn.task_persistence',
] as const;

/**
 * 只進報告，不配活動。
 *
 * 氣質的六個（`emo.adaptability_low` 起）是**特質**不是症狀；`sen.impact_*` 是
 * 前置題答出來的影響範圍，不是能力缺口；`severity.severe` 是任何工具的 tier 4。
 */
export const REPORT_ONLY_TAGS = [
  'soc.response_to_name',
  'soc.stereotyped_behavior',
  'emo.adaptability_low',
  'emo.intensity_high',
  'emo.mood_negative',
  'emo.regularity_low',
  'emo.slow_to_warm',
  'emo.activity_high',
  'sen.threshold_low',
  'sen.impact_adl',
  'sen.impact_group',
  'sen.impact_play',
  'severity.severe',
] as const;

export type ActivityTag = (typeof ACTIVITY_TAGS)[number];
export type ReportOnlyTag = (typeof REPORT_ONLY_TAGS)[number];
export type FindingTag = ActivityTag | ReportOnlyTag;

/** 57 個，★ 在前。兩張表沒有交集 —— 一個標籤不可能既配活動又只進報告。 */
export const FINDING_TAGS: ReadonlyArray<FindingTag> = [...ACTIVITY_TAGS, ...REPORT_ONLY_TAGS];

const ACTIVITY_TAG_SET: ReadonlySet<string> = new Set<string>(ACTIVITY_TAGS);
const FINDING_TAG_SET: ReadonlySet<string> = new Set<string>(FINDING_TAGS);

/** 這個標籤歸哪個維度。`'sen.impact_adl'` → `'sen'`。 */
export function tagDimension(tag: FindingTag): TagDimension {
  return tag.slice(0, tag.indexOf('.')) as TagDimension;
}

/** 這個標籤配不配活動（★）。 */
export function isActivityTag(tag: FindingTag): tag is ActivityTag {
  return ACTIVITY_TAG_SET.has(tag);
}

/**
 * 這串字是不是登錄過的標籤。用在讀舊資料與後台貼標的入口 ——
 * 標籤會存進報告快照，改名或拿掉一個標籤時，舊報告裡還留著那串字。
 */
export function isFindingTag(value: string): value is FindingTag {
  return FINDING_TAG_SET.has(value);
}

/** 這個維度有哪些標籤，照 `FINDING_TAGS` 的順序。 */
export function tagsOfDimension(dimension: TagDimension): FindingTag[] {
  return FINDING_TAGS.filter(t => tagDimension(t) === dimension);
}
