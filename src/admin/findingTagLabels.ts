import type { FindingTag } from '../t2/findingTags';

/**
 * 中文短名，**只給後台**（v2.1 S15、附錄 B；客戶 9/21 工作單 #19，來源是 9/13《判斷依據》⑥）。
 *
 * 後台貼標時顯示「中文短名 · 英文碼」，存的仍是英文碼。這是**顯示用的別名**，不是另一套受控詞彙：
 * 規則表、活動庫、報告快照裡流通的永遠是英文碼。
 *
 * ⚠️ **家長端不可用**：有短名踩《家长报告用语对照表》的禁字（`emo.mood_negative`「心情底色偏低」的
 * 「偏低」；2026-09-24 用 `findBannedWords` 掃過，57 個裡只有這一個），而且短名是給內容團隊辨認
 * 標籤的簡稱，不是對家長說的話 —— 家長端講標籤用 `report/sentences.ts` 的 `TAG_SENTENCES`。
 * 放在 `src/admin/`，不放 `src/t2/findingTags.ts`：後者家長端也 import，常數會跟著進家長端的 bundle
 * （畫面不顯示也一樣下載得到）；後台是 `main.tsx` 裡 lazy 載入的另一個 chunk。
 * `test/t2FindingTags.test.ts` 掃 `src/` 與 `server.ts`：除了本檔與後台活動庫分頁，誰提到這個名字或 import 本檔就紅。
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
