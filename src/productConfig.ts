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

import type { AdminCenterShape } from './admin/companyScope';

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
    /**
     * 報告中每個維度旁的行動標籤，依嚴重度分成兩個。
     *
     * 拆成兩個是因為專案 B 的標籤本身就是警示等級（紅＝高度、橘黃＝中度），
     * 一個字串無法同時扮演兩級。專案 A 的標籤是「去哪裡」而不是「多嚴重」，
     * 兩級填同一個值即可 —— 不必為了對稱硬掰出兩種說法。
     *
     * High：關注分 ≥ 5 / 狀態 `delay`（紅）
     * Medium：關注分 3–4 / 狀態 `borderline`（橘黃）
     */
    actionLabelHigh: string;
    actionLabelMedium: string;
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
    /**
     * 維度卡片底部的點擊提示（該維度尚無 T1 紀錄時顯示）。
     *
     * ⚠️ **不得寫成「聯繫專家」那一類的字**（issue #18 / p.9）。這張卡片點下去
     * 到的是報告，聯繫專家是報告裡的下一步 —— 把終點寫在起點上，家長點一次
     * 發現不是那件事，就不會再點第二次。文案要說**這一下會發生什麼**。
     */
    dimensionCardHint: string;
    /** 維度卡片右下角的行動提示（該維度亮黃燈或紅燈時顯示）。同上，說去向不說終點。 */
    dimensionCardCta: string;
  };

  /**
   * 專家預約送出後的「轉接真人」資訊。
   *
   * 兩個產品目前填的是同一組值，但仍放在這裡而非寫死在元件裡 ——
   * B 是交付給合作公司的，他們很可能要換成自己的客服帳號，屆時改這裡一處即可。
   */
  expertBooking: {
    /** 客服微信號；`null` 代表不顯示微信號那一行（企業微信客服即是如此，只掃碼） */
    wechatId: string | null;
    /** 客服二維碼圖片路徑（放在 `public/`）；`null` 代表只顯示微信號 */
    wechatQrSrc: string | null;
    // 兩個都是 null 時，整個轉接區塊不顯示。
    /**
     * 報告頁的專家名單從哪裡來。
     *
     * - `builtin`：寫死在 `AnalysisReport.tsx` 的三位森心康醫師（專案 A）
     * - `company`：家長所屬合作公司的專家，執行期向 `/api/specialists` 取得（專案 B）
     *
     * 兩者不能共存：若 B 在「該公司還沒設定專家」時退回內建名單，家長會看到
     * 三位森心康醫師的姓名與照片 —— 那既是別人的品牌，也是家長預約不到的人。
     */
    specialistSource: 'builtin' | 'company';
  };

  /**
   * 管理中心的形狀 —— 這個產品**有沒有**合作公司這回事（issue #19）。
   *
   * 專案 B 交付給多家合作公司，全域管理員切換視野、維護公司名冊、看跨公司彙總。
   * 專案 A 一家合作公司都沒有：它的家長全部未歸屬，也就是森心康直屬。於是
   * 「合作公司」「跨公司彙總」「本機構設定」三個分頁永遠是空的，而登入後還得
   * 先選一家不存在的公司才看得到人。
   *
   * ⚠️ 伺服器端有**對應的一份**，由 `APP_MODE` 決定（見 `server.ts`）——
   * 那邊決定路由掛不掛載，這邊決定畫面畫不畫。兩份必須說同一件事：畫面藏了
   * 分頁而路由還在，是功能還在只是找不到；反過來則是一顆按下去 404 的按鈕。
   *
   * 型別借用伺服器端的定義（`admin/companyScope.ts`），只是型別，編譯後不留
   * 任何東西 —— 但兩邊寫成同一個型別，欄位改名時兩邊會一起紅。
   */
  adminCenter: AdminCenterShape;

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
      headerTitle: '森心康儿童综合发展评估',
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
      actionLabelHigh: '第二层评估',
      actionLabelMedium: '第二层评估',
      alertText: '建议尽快进入第二层「量表评估中心」。',
      legendAttentionHint: '进入第二层评估',
      legendConcernHint: '建议进入第二层评估',
      finishButtonLabel: '一键对接 AI 判读并启动 T2/T3 深度专项评估',
      screeningResultWithFindings: '为了精确定位孩子在大脑突触环路与功能上的发展状况并建立成长引导方案，推荐立即进入相应维度的 T2 能力评估层 与 T3 专项深入评估。',
      screeningResultAllClear: '基本发育水平良好。如需作为成长记录归档并获得脑神经网络的高清动力学分析图谱，您亦可点击下方一键对接 AI 判读建档并视情探索 T2/T3 检测。',
      action: 'goto_tier2',
    },
    dashboard: {
      stepTwoHint: '点击高亮的黄色 / 红色维度卡片，进入 T2、T3 深度测评',
      stepTwoIsPaid: true,
      screeningIntro: 'T1 评估 36 题依据 HELP、儿童发展学、神经科学、语言科学综合而来。完成基本评估后，系统方能根据得分高低，自动解锁并推荐您进行 T2 言语/感统专项问卷与 T3 互动实测。',
      gridHintCompleted: '以下为 9 维 T1 评估结果。点击标有黄色/红色警告的维度卡片，直接推进 T2 问卷 与 T3 专项检测！',
      dimensionCardSubLabel: 'T2 自评量表 + T3 专项上传',
      dimensionCardHint: '点击进入本维度测定',
      dimensionCardCta: '立即深测',
    },
    // 轉接真人走企業微信二維碼。不列微信號 —— 企業微信客服掃碼即進，
    // 手打帳號那條路在企業微信上並不通，寫出來只會讓家長白試一次。
    expertBooking: {
      wechatId: null,
      wechatQrSrc: '/kefu-qr.jpg',
      specialistSource: 'builtin',
    },
    // 森心康自己的產品，沒有合作公司 —— 家長全部未歸屬（即直屬）。
    adminCenter: { multiCompany: false },
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
      headerTitle: '儿童综合发展评估',
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
      actionLabelHigh: '高度警告',
      actionLabelMedium: '中度警告',
      alertText: '建议尽快联系专家进行一对一说明。',
      // 圖例就在九維卡片正下方，跟卡片右下角的行動標籤是同一組語彙 ——
      // 卡片改成「中度／高度警告」之後，圖例還寫「联系专家」等於同一頁兩套講法。
      legendAttentionHint: '中度警告',
      legendConcernHint: '高度警告',
      finishButtonLabel: '一键生成 AI 发展报告',
      screeningResultWithFindings: '为了更清楚了解孩子在这些维度上的发展状况，建议生成完整 AI 发展报告，并就标记的维度联系专家进行一对一说明。',
      screeningResultAllClear: '基本发育水平良好。如需作为成长记录归档并获得脑神经网络的高清动力学分析图谱，可点击下方生成完整 AI 发展报告。',
      action: 'contact_expert',
    },
    dashboard: {
      stepTwoHint: '查看 AI 发展报告，如有需要留意的维度，可联系专家一对一说明',
      stepTwoIsPaid: false,
      screeningIntro: 'T1 评估 36 题依据 HELP、儿童发展学、神经科学、语言科学综合而来，完成答题后生成 AI 发展报告，涵盖 9 个维度发展情况分析与建议。',
      gridHintCompleted: '以下为 9 维 T1 评估结果。点击上方「生成全维 AI 深度评估报告」查看完整解读与专家咨询方向。',
      dimensionCardSubLabel: null,
      // 「联系专家」在 issue #18 / p.9 被拿掉：這張卡片點下去到的是 AI 發展報告，
      // 專家諮詢是報告裡的下一步。改成說出這一下真正會發生的事。
      dimensionCardHint: '点击查看该维度说明',
      dimensionCardCta: '查看说明',
    },
    // 同專案 A：企業微信二維碼，不列微信號。
    // B 交付給合作公司後，可能要換成對方的客服二維碼。
    expertBooking: {
      wechatId: null,
      wechatQrSrc: '/kefu-qr.jpg',
      // 各公司自備專家，名單是資料不是常數。見 docs/adr/0001。
      specialistSource: 'company',
    },
    // 交付給多家合作公司，見 docs/adr/0001。
    adminCenter: { multiCompany: true },
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
