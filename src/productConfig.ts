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

  /**
   * 品牌字串。
   *
   * 專案 B 交付給合作公司使用，畫面上**不得出現「森心康」**——包含頁首、條款、
   * 頁尾、報告標題，以及後端送給 AI 的提示詞（那一段最容易漏：它不在畫面上，
   * 但會讓生成的報告內文自己寫出品牌名）。
   *
   * ⚠️ 這裡只處理**畫面上的稱呼**。備案主體、資料掌管方、責任承擔方**仍然是
   * 森心康**（見 `與客戶討論的問題.md` 第七項）——條款改用泛稱是產品決定，
   * 不代表法律關係改變。
   */
  brand: {
    /** 瀏覽器分頁標題。`index.html` 是兩個建置共用的靜態檔，改由執行期設定。 */
    documentTitle: string;
    /** 頁首與登入頁的大標題 */
    headerTitle: string;
    /**
     * 歡迎頁裡被強調的品牌詞。`null` 代表不顯示那一段強調
     * ——不是顯示空字串，是整個 `<span>` 不渲染。
     */
    welcomeName: string | null;
    /** AI 報告產生器的標題 */
    reportTitle: string;
    /** 條款內文提到本系統時的全名 */
    systemName: string;
    /** 條款與頁尾裡的責任主體稱呼 */
    legalEntity: string;
    /** 頁尾版權列 */
    copyright: string;
    /**
     * 頁首與登入頁那顆圓形標記裡的字。
     *
     * 專案 A 是「森」——森心康的字標。B 不能用它：一個綠底圓形配「森」字
     * 就是這個品牌的標記，名字拿掉了標記還在，等於沒拿掉。
     */
    logoMark: string;
    /**
     * 專家簡歷中提及本品牌的那一個子句（含結尾逗號）。
     *
     * `null` 代表**整段子句不出現**——刻意不是「改寫成別的說法」：那是真實
     * 醫師的資歷，改寫等於捏造，省略只是不提。
     */
    bioClause: string | null;
    /**
     * 後端送給 AI 的提示詞裡用的稱呼（由 `server.ts` 依 `APP_MODE` 各自決定，
     * 這裡列出來只是為了讓兩邊的值看得到彼此，不被前端讀取）。
     */
    promptName: string;
  };

  /**
   * 建置模式徽章 —— 掛在頁首標題旁，讓人一眼看出當前開的是哪一個產品。
   *
   * 兩個產品**都**顯示。若只有專案 B 掛徽章，「沒看到徽章」會同時對應
   * 「這是專案 A」與「徽章沒渲染出來 / 開到舊的建置」兩種情況，等於沒有訊號。
   *
   * 配色的 class 也放在這裡，元件才不需要 `if (mode === ...)` 決定要用哪個顏色。
   */
  buildBadge: {
    /** 徽章上的字，越短越好 */
    label: string;
    /** 滑鼠停留時的完整說明 */
    title: string;
    /** 徽章的 Tailwind 樣式（底色 / 文字色 / 框線） */
    className: string;
  };

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
    /** 維度卡片底部的點擊提示（該維度尚無 T1 紀錄時顯示） */
    dimensionCardHint: string;
    /** 維度卡片右下角的行動提示（該維度亮黃燈或紅燈時顯示） */
    dimensionCardCta: string;
  };

  /**
   * 專家預約送出後的「轉接真人」資訊。
   *
   * 兩個產品目前填的是同一組值，但仍放在這裡而非寫死在元件裡 ——
   * B 是交付給合作公司的，他們很可能要換成自己的客服帳號，屆時改這裡一處即可。
   */
  expertBooking: {
    /** 客服微信號；`null` 代表不顯示轉接區塊 */
    wechatId: string | null;
    /** 客服二維碼圖片路徑（放在 `public/`）；`null` 代表只顯示微信號 */
    wechatQrSrc: string | null;
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
    brand: {
      documentTitle: '森心康 - 儿童发育评估系统',
      headerTitle: '森心康儿童发展评估',
      welcomeName: '森心康',
      reportTitle: '森心康 AI 神经网络分层评估报告生成器',
      systemName: '森心康（SenXinKang）儿童数字测听与康复分层评估系统',
      legalEntity: '森心康（SenXinKang）技术实验室',
      copyright: '© 2026 森心康（SenXinKang）神经网络科学技术实验室',
      logoMark: '森',
      bioClause: '森心康儿童康复品牌康复质量管理部负责人，',
      promptName: '森心康',
    },
    buildBadge: {
      label: '完整版',
      title: '当前为完整版（项目 A）：包含 T2/T3 深度评估、付费解锁与穿戴设备商城。',
      // 低調的品牌色 —— 專案 A 是常態，徽章只需可辨識，不必搶眼。
      className: 'bg-brand-sage/40 text-brand-forest border-brand-stone/50',
    },
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
      dimensionCardHint: '点击进入本维度测定',
      dimensionCardCta: '立即深测',
    },
    // ⚠️ 佔位值 —— 上線前必須換成真實的客服微信號與二維碼圖片。
    expertBooking: {
      wechatId: 'SXK-KEFU-PLACEHOLDER',
      wechatQrSrc: null,
    },
    features: {
      tier2And3: true,
      paywall: true,
      mall: true,
    },
  },

  t1only: {
    mode: 't1only',
    // 中性命名，不提任何品牌 —— 交付給合作公司使用，畫面上不出現森心康。
    // 也刻意不寫成對方公司的名字：那樣每換一個合作對象就要改一次程式碼，
    // 而且備案與資料掌管方仍是森心康，掛對方的名字反而與事實不符。
    brand: {
      documentTitle: '儿童发育评估系统',
      headerTitle: '儿童发展评估',
      welcomeName: null,
      reportTitle: 'AI 神经网络分层评估报告生成器',
      systemName: '本儿童数字测听与康复分层评估系统',
      legalEntity: '本系统运营方',
      copyright: '© 2026 儿童神经网络分层评估系统',
      logoMark: '评',
      bioClause: null,
      promptName: '本系统',
    },
    buildBadge: {
      label: 'T1 版',
      title: '当前为 T1 版（项目 B）：仅提供 T1 筛查与 AI 发展报告，不含深度评估、付费解锁与商城。',
      // 高對比的琥珀色 —— 專案 B 交付給合作公司，誤認的代價最高，要一眼看到。
      className: 'bg-amber-400 text-brand-forest border-amber-500',
    },
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
      dimensionCardHint: '点击联系专家说明',
      dimensionCardCta: '联系专家',
    },
    // ⚠️ 佔位值 —— 上線前必須換成真實的客服微信號與二維碼圖片。
    // B 交付給合作公司後，可能要換成對方的客服帳號。
    expertBooking: {
      wechatId: 'SXK-KEFU-PLACEHOLDER',
      wechatQrSrc: null,
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

/** 仍然執行，仍然 fail-closed —— 打錯字的建置照樣起不來。 */
const MODE: ProductMode = resolveMode(import.meta.env.VITE_APP_MODE);

/**
 * 當前建置產物所屬的產品設定。
 *
 * 這裡刻意**不寫成 `PROFILES[MODE]`**：那是執行期的查表，Rollup 無法證明另一個
 * profile 用不到，於是兩份都會被打包進去 —— 專案 B 的產出物裡就會出現專案 A 的
 * 品牌字串（「森心康 - 儿童发育评估系统」等等）。B 是交付給合作公司的，
 * 檢視原始碼就看得到，這不可接受。
 *
 * 改成比對建置期常數之後，`import.meta.env.VITE_APP_MODE` 會在建置時被替換成
 * 字面值，Rollup 能判定其中一個分支是死碼並整個移除。
 * `test/brandIsolation.test.ts` 會擋住這一點被改回去。
 */
export const PRODUCT: ProductProfile =
  import.meta.env.VITE_APP_MODE === 't1only' ? PROFILES.t1only : PROFILES.full;

/**
 * 建置期常數與執行期解析出來的模式必須一致 —— 上面那行若被改錯
 * （例如比對成 `'t1_only'`），這裡會當場炸掉，而不是交出一份對錯參半的建置。
 *
 * ⚠️ **誠實的但書**：在正式建置中 Rollup 能把兩邊都摺疊成同一個字面值，
 * 於是整段判斷連同 `resolveMode()` 的錯誤訊息都會被移除（實測：產出物裡
 * 一個字都不剩）。所以**真正擋住打錯字的是 `vite.config.ts` 的
 * `assertValidAppMode()`**，它在建置開始前就跑，實測 `VITE_APP_MODE=t1_only`
 * 會讓建置 exit 1。這裡留著是為了本機開發與測試環境，不是最後一道防線。
 */
if (PRODUCT.mode !== MODE) {
  throw new Error(
    `產品設定與 VITE_APP_MODE 不一致：PRODUCT.mode=${PRODUCT.mode}，resolveMode()=${MODE}。`
  );
}
