/**
 * 客戶 10/22 修改的家長端用字（規格 `docs/specs/client-changes-2026-10-22-1-ui.md`，issue #78）。
 *
 * 開關 `VITE_UI_1022`（`PRODUCT.features.ui1022`，只在專案 A）開著時，畫面一律從這裡取字；
 * 關著時各處照舊用現在的字。字集中在一份，是因為同一件事以前有五個名字（森心康、儿童综合发展评估、
 * 综合评估、基础评估层、第二层评估）——散在各元件裡，下次改名又會漏掉一處。
 *
 * 這一檔**不寫品牌名**：1022 的 A 不露出森心康（規格「品牌」一節：醫院合作方不要強調森心康）。`test/brandIsolation.test.ts` 盯著。
 * 也進家長端用字掃描（`test/parentWording.structure.test.ts`）。`vite.config.ts` 讀同一份寫靜態頁的
 * title／description，所以這裡只能是純字面量，不 import 任何東西。
 */

/** 平台名稱：網頁標題、頁首、歡迎語、頁尾版權都是這一個。 */
const PLATFORM_NAME = '家庭评估与训练平台';

export const WORDING_1022 = {
  platformName: PLATFORM_NAME,
  /** 分享卡的標題（微信取網頁標題）。 */
  documentTitle: PLATFORM_NAME,
  /** 分享卡的說明：靜態頁的 description 與 body 第一段（視覺隱藏）。 */
  shareDescription: `欢迎体验${PLATFORM_NAME}`,
  welcome: `欢迎使用${PLATFORM_NAME}`,
  copyright: `© 2026 ${PLATFORM_NAME}`,

  /** T1 在每個地方都叫這個名字。 */
  t1Name: 'T1 儿少综合发展评估',
  /** 深度評估只叫這個名字；T3 不出現。 */
  t2Name: 'T2 深度评估',
  /** 不需要 T2 時那一句（伺服器回的 `NO_T2_TEXT` 寫「第二层检查」，1022 開著畫面換這一句）。 */
  noT2Text: '目前不需要 T2 深度评估，建议 3–6 个月后再做一次筛查。',

  home: {
    heroTitle: '今天也陪孩子训练一下',
    heroButton: '居家训练',
    login: '登录／注册',
    /** 首頁兩張卡，T1 在前。 */
    t1Card: { title: 'T1 儿少综合发展评估', subtitle: '读懂成长信号，定制适合孩子的成长支持方案' },
    trainingCard: { title: '线上家庭个性化训练', subtitle: '跟着练！科学助力孩子能力提升' },
  },

  profile: {
    title: 'T1 儿少综合发展评估',
    intro: '请填写“待评估”孩子的基本信息',
    formTitle: '待评估孩子的基本信息',
  },

  report: {
    title: 'T1 儿少综合发展评估报告',
    disclaimer: '本筛查仅作参考，不是医疗诊断，不能替代医院专业诊疗',
    generating: '正在生成报告',
    /** 掃碼卡（簡報第 22 頁）。 */
    qrHint: '长按二维码或扫描二维码，这份报告就会在您自己的手机上打开，之后随时都能再看。',
    /** 歷次報告清單每一筆的名字（簡報第 5 頁「后面所有名称都改」）。 */
    listItemTitle: 'T1 儿少综合发展评估报告',
  },

  /** 報告與面板上「第二层评估」「第二层『量表评估中心』」的新叫法（`PRODUCT.nextStep`）。 */
  nextStep: {
    actionLabel: 'T2 深度评估',
    alertText: '建议近期进入「T2 深度评估」。',
    legendAttentionHint: '进入 T2 深度评估',
    legendConcernHint: '建议进入 T2 深度评估',
    screeningResultWithFindings: '标黄、标红的方面建议再做「T2 深度评估」，了解得更清楚。',
    screeningResultAllClear: '各方面发展稳定，可以把这次结果留作成长记录。',
  },

  /** 評估面板（`PRODUCT.dashboard`，issue #85）：不提 T3、不叫「深测」。 */
  dashboard: {
    startTitle: '先做一次 T1 儿少综合发展评估',
    screeningIntro: 'T1 儿少综合发展评估共 36 题，完成后直接生成 AI 发展报告；标黄、标红的方面可以再做「T2 深度评估」。',
    gridHintCompleted: '以下是这次 T1 儿少综合发展评估的 9 个方面。',
    dimensionCardHint: '点击查看这个方面',
  },

  buttons: {
    generateReport: '生成报告',
    deepAssess: '深度评估',
  },

  /** T1 最後一步「补充资料」（issue #83）。題目本身沿用 `src/t2/recommend/childFieldsCopy.ts`。 */
  supplement: {
    title: '补充资料',
    sub: '最后几题会影响为孩子推荐的深度评估与训练，请按实际情况选择；不确定就选「不清楚」。',
    required: '必填',
    optional: '选填',
    unknown: '不清楚',
    /** 原題寫「（早产才需要选）」，在這裡是必填，括號那句拿掉。 */
    gestationQuestion: '出生时怀孕几周？',
    missing: '还有必填的题目没有选',
  },

  /** 「预约 1 对 1 专家」改成企業微信二維碼（使用者 2026-10-24）：不選專家、不選時段。 */
  expertQr: {
    title: '1 对 1 专家咨询',
    sub: '扫码添加企业微信，由儿童发展评估专家为您逐项说明报告，并给出接下来可以怎么做。',
    scan: '扫码添加企业微信',
    hint: '在微信里长按二维码即可识别；添加后说明想咨询的内容，客服会为您安排。',
    alt: '企业微信客服二维码',
  },

  /** 12–180 個月以外的孩子：評估面板不給 T1，改畫這張紅燈卡。 */
  outOfRange: {
    title: '建议寻找专业人士',
    body: (childName: string) =>
      `${childName}目前的年龄不在 T1 儿少综合发展评估的题目范围内，建议请专业人士当面了解孩子的发展情况。`,
  },
} as const;
