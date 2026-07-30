export type Gender = 'boy' | 'girl';

export interface Child {
  name: string;
  birthDate?: string; // Birth date of the child (e.g. "2023-05-15")
  ageMonth: number; // Age in months (e.g. 24 months, 48 months)
  gender: Gender;
}

export type AssessmentStatus = 'normal' | 'borderline' | 'delay';

export interface DimensionScore {
  dimensionId: string;
  dimensionName: string;
  tierId: 'T1' | 'T2' | 'T3';
  score: number;
  maxScore: number;
  status: AssessmentStatus;
  completedAt: string;
}

export interface Question {
  id: string;
  text: string;
  options: {
    label: string;
    score: number;
  }[];
}

export interface DimensionConfig {
  id: string;
  name: string;
  iconName: string;
  color: string;
  textColor: string;
  borderColor: string;
  tiers: {
    /**
     * @deprecated 已廢棄，無任何程式讀取。
     * 篩查（T1）的唯一資料來源是 `src/t1Data.ts`（依年齡段分組、計分 2/1/0、含紅旗指標），
     * 而此處是舊分類體系殘留（每維度 5 題、計分 10/5/0）。兩者結構與計分刻度皆不同。
     * 要改篩查題目請改 `t1Data.ts`，不要改這裡。詳見 CONTEXT.md「已知的詞彙債」。
     */
    T1: { scaleName: string; duration: string; questions: Question[] };
    T2: { scaleName: string; duration: string; questions: Question[] };
    T3: { scaleName: string; duration: string; questions: Question[] };
  };
}

export interface AssessmentRecord {
  id: string;
  type?: 'T1_SCREENING' | 'T2_T3_SPECIALIZED';
  dimensionId?: string;
  dimensionName?: string;
  child: Child;
  scores: DimensionScore[];
  aiReport?: {
    summary: string;
    neuralPathwayAnalysis: string; // 神经环路分析
    rehabSuggestions: string[];   // 针对性康复建议
    homeGuidance: string[];        // 家庭指导方案
    prognosisPrediction: string;   // 预后轨迹预测
    criticalMetrics: {
      neuralPlasticity: number;     // 神经可塑性 (0-100)
      sensoryIntegration: number;   // 感统协同度
      familyEnvironmentScore: number; // 家庭环境赋能
      motorControlIndex: number;    // 运动控制指数
    };
  };
  /**
   * `aiReport` 究竟是 AI 生成的，還是本地模板兜底的。
   *
   * 三態，`undefined` 有意義：代表這是加入本欄位之前存下的舊紀錄，來源不明。
   * UI 必須把 `undefined` 顯示成「來源未記錄」，**不可**當成 `true` —— 舊版
   * AnalysisReport 讀歷史紀錄時無條件標成 AI 生成，模板報告因此被誤標，正是要修的問題。
   */
  isAiGenerated?: boolean;
  createdAt: string;
}

// Store & Order types
export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  desc: string;
  details: string;
  image: string;
  specs: string[];
  features: string[];
  dimensionsTargeted: string[]; // which dimension it is designed for
}

export type MallOrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'delivering' | 'delivered';

export interface LogisticsTracking {
  time: string;
  content: string;
  location: string;
}

/**
 * 商城訂單：一筆實體商品購買，含收件資訊與物流。
 * 與 Payment（付款）、Unlock（解鎖權益）是三個不同概念，不可共用「訂單」一詞。
 */
export interface MallOrder {
  id: string;
  product: Product;
  quantity: number;
  totalPrice: number;
  recipient: string;
  phone: string;
  address: string;
  status: MallOrderStatus;
  paymentMethod: 'wechat' | 'alipay';
  createdAt: string;
  trackingNo: string;
  logisticsTimeline: LogisticsTracking[];
}

// 深度評估付費 types
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

/**
 * 付款：一次微信支付交易的紀錄。
 *
 * 與 Unlock 分開是刻意的，理由有三：
 * 1. 支付回調會重複送達 —— 冪等判斷應查「Unlock 是否已存在」，而非「是否付款成功」
 * 2. 退款要撤銷權益，但付款紀錄必須保留供對帳
 * 3. 客訴補償／行銷贈送需要發出權益，但不存在對應的付款
 */
export interface Payment {
  id: string;
  userId: string;
  /** 商戶訂單號，由我方產生，微信以此對帳 */
  outTradeNo: string;
  /** 微信支付訂單號，付款成功後由回調回填 */
  transactionId: string | null;
  /** 金額，單位為「分」，避免浮點誤差（¥19.9 = 1990） */
  amountFen: number;
  status: PaymentStatus;
  /** 此次付款要解鎖的維度 */
  dimensionId: string;
  createdAt: string;
  paidAt: string | null;
}

/**
 * 解鎖權益：某使用者對某維度深度評估（T2+T3）的永久使用權。
 *
 * 綁 userId + dimensionId，**不綁篩查批次** —— 家長重做篩查後權益依然有效，
 * 且可免費重做該維度的 T2/T3。家長買的是「使用權」，不是「一次評估機會」。
 */
export interface Unlock {
  id: string;
  userId: string;
  dimensionId: string;
  /** 取得來源：付款，或由客服／行銷免費發放 */
  source: 'payment' | 'grant';
  /** source 為 'payment' 時指向對應的付款紀錄 */
  paymentId: string | null;
  createdAt: string;
  /** 退款或人工撤銷時填入；非 null 代表權益已失效 */
  revokedAt: string | null;
}
