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
  createdAt: string;
}

// Store & Order types
export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  desc: string;
  details: string;
  image: string;
  specs: string[];
  features: string[];
  dimensionsTargeted: string[]; // which dimension it is designed for
}

export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'delivering' | 'delivered';

export interface LogisticsTracking {
  time: string;
  content: string;
  location: string;
}

export interface Order {
  id: string;
  product: Product;
  quantity: number;
  totalPrice: number;
  recipient: string;
  phone: string;
  address: string;
  status: OrderStatus;
  paymentMethod: 'wechat' | 'alipay';
  createdAt: string;
  trackingNo: string;
  logisticsTimeline: LogisticsTracking[];
}
