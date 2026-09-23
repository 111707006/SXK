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

/**
 * 中文短名，**只給後台**（v2.1 S15、附錄 B；客戶 9/21 工作單 #19，來源是 9/13《判斷依據》⑥）。
 *
 * 後台貼標時顯示「中文短名 · 英文碼」，存的仍是英文碼。這是**顯示用的別名**，不是另一套受控詞彙：
 * 規則表、活動庫、報告快照裡流通的永遠是英文碼。
 *
 * ⚠️ **家長端不可用**：有短名踩《家长报告用语对照表》的禁字（`emo.mood_negative`「心情底色偏低」的
 * 「偏低」；2026-09-24 用 `findBannedWords` 掃過，57 個裡只有這一個），而且短名是給內容團隊辨認
 * 標籤的簡稱，不是對家長說的話 —— 家長端講標籤用 `report/sentences.ts` 的 `TAG_SENTENCES`。
 * `test/t2FindingTags.test.ts` 掃 `src/` 與 `server.ts`：除了本檔與後台活動庫分頁，誰提到這個名字就紅。
 *
 * 字照附錄 B 原樣（簡體），順序照 `FINDING_TAGS`（★ 在前，§5.5 的維度順序），不照附錄 B 的列序。
 */
export const FINDING_TAG_LABELS: Readonly<Record<FindingTag, string>> = {
  // ★ lang
  'lang.comprehension': '听懂',
  'lang.expression': '表达',
  'lang.expression_below_comprehension': '听懂多于说出',
  'lang.vocabulary_size': '词汇量',
  'lang.articulation': '发音',
  'lang.pragmatics': '对话轮替',
  // ★ soc
  'soc.joint_attention': '共同注意',
  'soc.eye_contact': '眼神接触',
  'soc.imitation': '模仿',
  'soc.social_initiation': '主动发起',
  'soc.emotion_reciprocity': '情绪来回',
  'soc.pretend_play': '假装游戏',
  // ★ emo
  'emo.regulation': '情绪调节',
  // ★ att
  'att.inattention': '持续注意',
  'att.hyperactivity': '安坐',
  'att.impulsivity': '等待与轮流',
  'att.working_memory': '工作记忆',
  'att.inhibition': '抑制',
  'att.organization': '收拾与规划',
  // ★ mot
  'mot.postural': '姿势控制',
  'mot.locomotion': '移动',
  'mot.balance': '平衡',
  'mot.ball_skills': '球类',
  'mot.fine_motor': '精细动作',
  // ★ sen
  'sen.tactile': '触觉',
  'sen.vestibular': '前庭',
  'sen.body_awareness': '本体觉',
  'sen.auditory': '听觉',
  'sen.visual': '视觉',
  'sen.oral': '口腔',
  'sen.regulation': '感觉调节',
  // ★ adl
  'adl.feeding': '吃饭',
  'adl.dressing': '穿脱',
  'adl.toileting': '如厕',
  'adl.hygiene': '清洁',
  'adl.routines': '日常流程',
  // ★ cog
  'cog.visual_attention': '视觉专注',
  'cog.problem_solving': '解决问题',
  'cog.concepts': '概念',
  // ★ learn
  'learn.reading': '阅读',
  'learn.writing': '书写',
  'learn.number': '数学',
  'learn.phonological': '语音觉识',
  'learn.task_persistence': '持续完成',
  // 只進報告（後台只能貼在 avoidIf）
  'soc.response_to_name': '叫名字的反应',
  'soc.stereotyped_behavior': '重复行为',
  'emo.adaptability_low': '适应变化慢',
  'emo.intensity_high': '情绪强度大',
  'emo.mood_negative': '心情底色偏低',
  'emo.regularity_low': '作息不规律',
  'emo.slow_to_warm': '慢热',
  'emo.activity_high': '活动量大',
  'sen.threshold_low': '反应阈低',
  'sen.impact_adl': '已影响到日常',
  'sen.impact_group': '已影响到团体',
  'sen.impact_play': '已影响到游戏',
  'severity.severe': '最需要留意',
};

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
