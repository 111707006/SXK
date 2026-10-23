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
  },

  report: {
    title: 'T1 儿少综合发展评估报告',
    disclaimer: '本筛查仅作参考，不是医疗诊断，不能替代医院专业诊疗',
    generating: '正在生成报告',
  },

  buttons: {
    generateReport: '生成报告',
    deepAssess: '深度评估',
  },

  /** 12–180 個月以外的孩子：評估面板不給 T1，改畫這張紅燈卡。 */
  outOfRange: {
    title: '建议寻找专业人士',
  },
} as const;
