/**
 * 產品設定 —— 專案 A 與專案 B 的所有分歧集中在這個檔案。
 *
 * 兩個產品共用同一份程式碼，靠建置時的 `VITE_APP_MODE` 切換：
 *
 *   VITE_APP_MODE=full   → 專案 A：篩查 → 報告 → 深度評估（付費）→ 商城
 *   VITE_APP_MODE=t1only → 專案 B：篩查 → 報告 → 聯繫專家 → 結束
 *
 * 【維護原則】新增分歧時請加在這裡，不要在元件裡散落 `if (mode === ...)`。
 * 分歧只有一個入口，才不會半年後沒人知道總共有幾處。
 *
 * 後端有對應的開關：`server.ts` 依 `process.env.APP_MODE` 決定是否註冊付費相關路由。
 */

export type ProductMode = 'full' | 't1only';

/** 篩查報告中，一個維度被標記為需關注時，「下一步」該引導使用者去哪裡 */
export type NextStepAction = 'goto_tier2' | 'contact_expert';

export interface ProductProfile {
  mode: ProductMode;

  /** 篩查完成後的引導 */
  nextStep: {
    /** 報告中每個維度旁的行動標籤 */
    actionLabel: string;
    /** 有維度亮紅燈時，報告頂部的警示句 */
    alertText: string;
    /** 圖例：黃燈（需留意）的行動提示 */
    legendAttentionHint: string;
    /** 圖例：紅燈（需關注）的行動提示 */
    legendConcernHint: string;
    /** 篩查完成頁主要按鈕的文案 */
    finishButtonLabel: string;
    /** 篩查結論頁：有維度需留意時的引導句 */
    screeningResultWithFindings: string;
    /** 篩查結論頁：全部正常時的引導句 */
    screeningResultAllClear: string;
    /** 點擊維度卡片後的去向 */
    action: NextStepAction;
  };

  /** 報告中「標記領域說明」區塊（原 SECTION 4） */
  markedAreaSection: {
    title: string;
    subtitle: string;
    /**
     * 建議量表子區塊的標題。`null` 代表這個產品不顯示該子區塊 ——
     * 用「有沒有標題」單一事實決定顯示與否，避免旗標與文案各說各話。
     */
    scalesLabel: string | null;
  };

  /** 評估面板（dashboard）上的文案 */
  dashboard: {
    /** 使用說明的第二步 */
    stepTwoHint: string;
    /** 第二步是否掛 VIP 徽章 */
    stepTwoIsPaid: boolean;
    /** T1 入口卡片的說明段落 */
    screeningIntro: string;
    /** 九維卡片區的說明（T1 完成後） */
    gridHintCompleted: string;
    /** 維度卡片上的子標籤；`null` 代表不顯示 */
    dimensionCardSubLabel: string | null;
  };

  features: {
    /** 深度評估（T2/T3） */
    tier2And3: boolean;
    /** 付費解鎖牆 */
    paywall: boolean;
    /** 穿戴裝置商城 */
    mall: boolean;
  };
}

const PROFILES: Record<ProductMode, ProductProfile> = {
  full: {
    mode: 'full',
    nextStep: {
      actionLabel: '第二层评估',
      alertText: '建议尽快进入第二层「量表评估中心」。',
      legendAttentionHint: '进入第二层评估',
      legendConcernHint: '建议进入第二层评估',
      finishButtonLabel: '一键对接 AI 判读并启动 T2/T3 深度专项评估',
      screeningResultWithFindings: '为了精确定位孩子在大脑突触环路与功能上的发展状况并建立成长引导方案，推荐立即进入相应维度的 T2 能力评估层 与 T3 专项深入评估。',
      screeningResultAllClear: '基本发育水平良好。如需作为成长记录归档并获得脑神经网络的高清动力学分析图谱，您亦可点击下方一键对接 AI 判读建档并视情探索 T2/T3 检测。',
      action: 'goto_tier2',
    },
    markedAreaSection: {
      title: '标记领域说明与第二层建议量表',
      subtitle: '针对有延迟风险的领域，提供深度评测指导及临床建议推荐量表',
      scalesLabel: '📋 第二层（量表评估中心）建议量表与发展特训:',
    },
    dashboard: {
      stepTwoHint: '点击高亮的黄色 / 红色维度卡片，进入 T2、T3 深度测评',
      stepTwoIsPaid: true,
      screeningIntro: '根据孩子年龄段自适应匹配 36 题 ASQ-3/M-CHAT 问卷。完成基本评估后，系统方能根据得分高低，自动解锁并推荐您进行 T2 言语/感统专项问卷与 T3 互动实测。',
      gridHintCompleted: '以下为 9 维 T1 评估结果。点击标有黄色/红色警告的维度卡片，直接推进 T2 问卷 与 T3 专项检测！',
      dimensionCardSubLabel: 'T2 自评量表 + T3 专项上传',
    },
    features: {
      tier2And3: true,
      paywall: true,
      mall: true,
    },
  },

  t1only: {
    mode: 't1only',
    nextStep: {
      actionLabel: '联系专家',
      alertText: '建议尽快联系专家进行一对一说明。',
      legendAttentionHint: '可联系专家咨询',
      legendConcernHint: '建议尽快联系专家',
      finishButtonLabel: '一键生成 AI 发展报告',
      screeningResultWithFindings: '为了更清楚了解孩子在这些维度上的发展状况，建议生成完整 AI 发展报告，并就标记的维度联系专家进行一对一说明。',
      screeningResultAllClear: '基本发育水平良好。如需作为成长记录归档并获得脑神经网络的高清动力学分析图谱，可点击下方生成完整 AI 发展报告。',
      action: 'contact_expert',
    },
    markedAreaSection: {
      title: '标记领域说明与专家咨询方向',
      subtitle: '针对有延迟风险的领域，提供居家观察建议与专家咨询方向',
      scalesLabel: null,
    },
    dashboard: {
      stepTwoHint: '查看 AI 发展报告，如有需要留意的维度，可联系专家一对一说明',
      stepTwoIsPaid: false,
      screeningIntro: '根据孩子年龄段自适应匹配 36 题 ASQ-3/M-CHAT 问卷。完成后即时生成 AI 发展报告，涵盖全部 9 个维度的发展状况与居家观察建议。',
      gridHintCompleted: '以下为 9 维 T1 评估结果。点击上方「生成全维 AI 深度评估报告」查看完整解读与专家咨询方向。',
      dimensionCardSubLabel: null,
    },
    features: {
      tier2And3: false,
      paywall: false,
      mall: false,
    },
  },
};

/**
 * 解析建置模式。**刻意 fail-closed**：認不得的值直接讓建置失敗，而不是退回 'full'。
 *
 * 退回 'full' 是危險的方向 —— `VITE_APP_MODE=t1_only` 這種打字錯誤會靜靜建出
 * 含付費牆與商城的完整版，然後交到合作公司手上，過程中沒有任何訊號。
 * 未設定變數則視為 'full'（本機開發與專案 A 的預設）。
 */
function resolveMode(raw: string | undefined): ProductMode {
  if (raw === undefined || raw === '') return 'full';
  if (raw === 'full' || raw === 't1only') return raw;
  throw new Error(
    `VITE_APP_MODE 的值無法辨識: ${JSON.stringify(raw)}。只接受 'full'（專案 A）或 't1only'（專案 B）。`
  );
}

const MODE: ProductMode = resolveMode(import.meta.env.VITE_APP_MODE);

/** 當前建置產物所屬的產品設定 */
export const PRODUCT: ProductProfile = PROFILES[MODE];
