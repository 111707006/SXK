/**
 * 舊版 T1 報告的本地模板（2026-10-08 從 `server.ts` 原樣搬來，**輸出一字不變**）。
 *
 * 誰在用：
 * - `server.ts` 的 `/api/report`：開關 `T1_REPORT_REAL` 關著（或專案 B）且模型全掛時的兜底，同搬家前；
 * - `scripts/t1-report-compare.ts`：同一份輸入印出舊版與新版並排，給使用者對照。
 *
 * ⚠️ 這一檔是**舊文案的存檔**：含《用语对照表》禁字與腦神經術語（四個儀表數字也是照狀態算的固定值）。
 * 不進用字掃描、不要在這裡修字 —— 要改的是新版（`report.ts`）；舊版留著是為了對照與 B 照舊。
 * `appMode` 由呼叫端給（伺服器傳 `APP_MODE`），本檔不讀環境變數。
 */

import { REHAB_SUGGESTIONS } from '../dimensionContent';

export type LegacyAppMode = 'full' | 't1only';

export interface LegacyT1Report {
  summary: string;
  neuralPathwayAnalysis: string;
  rehabSuggestions: string[];
  homeGuidance: string[];
  prognosisPrediction: string;
  criticalMetrics: {
    neuralPlasticity: number;
    sensoryIntegration: number;
    familyEnvironmentScore: number;
    motorControlIndex: number;
  };
}

// Fallback high-fidelity simulation engine when API key is missing
export function generateLegacyFallbackReport(child: any, scores: any[], appMode: LegacyAppMode): LegacyT1Report {
  // Identify struggling dimensions
  const struggling = scores.filter((s: any) => s.status !== 'normal');
  const delayCount = scores.filter((s: any) => s.status === 'delay').length;
  const borderlineCount = scores.filter((s: any) => s.status === 'borderline').length;

  let summary = `对儿童【${child.name}】（${child.ageMonth}个月，${child.gender === 'boy' ? '男孩' : '女孩'}）的发育进行了9维度的评估分析。`;
  if (struggling.length === 0) {
    summary += `本次筛查各方面发展稳定，可作为日后对照的基线记录，建议维持当前的多感官成长氛围。`;
  } else if (delayCount > 0) {
    summary += `本次筛查提示，【${struggling.map(s => s.dimensionName).join('、')}】等方面与同龄常见的发展节奏有差距，其中【${scores.filter((s: any) => s.status === 'delay').map(s => s.dimensionName).join('、') || '部分项目'}】建议优先安排专业咨询，其余方面可在日常互动中多加练习。`;
  } else {
    summary += `本次筛查显示各方面发展大致稳定，其中【${struggling.map(s => s.dimensionName).join('、')}】仍在建立中，建议进一步了解，并在日常互动中多加练习。`;
  }

  // Calculate simulated critical metrics
  let neuralPlasticity = 88 - (delayCount * 8) - (borderlineCount * 3);
  let sensoryIntegration = 85 - (scores.find(s => s.dimensionId === 'sensory_processing')?.status === 'delay' ? 20 : 5);
  // 動作發展是唯一與運動控制相關的維度，權重合併後區間與原本一致 (61-81)
  let motorControl = 86 - (scores.find(s => s.dimensionId === 'gross_motor')?.status === 'delay' ? 25 : 5);
  // NOTE: 九大維度中已無「家庭環境」，此指標目前取自「學習能力」，名稱與來源不一致，待產品端決定改名或改算法
  let familyEnv = 90 - (scores.find(s => s.dimensionId === 'learning_ability')?.status === 'delay' ? 25 : 5);

  // Bounds check
  neuralPlasticity = Math.max(50, Math.min(98, neuralPlasticity));
  sensoryIntegration = Math.max(50, Math.min(98, sensoryIntegration));
  motorControl = Math.max(50, Math.min(98, motorControl));
  familyEnv = Math.max(50, Math.min(98, familyEnv));

  // Determine specific recommendations. The table lives in src/dimensionContent.ts
  // alongside the other dimension-keyed tables so one test can check them together.
  const rehabMap = REHAB_SUGGESTIONS;

  // 模板兜底也走同一條規則 —— B 沒有商城，卻在 AI 失敗時推薦穿戴套件，
  // 是最容易漏掉的一處：它只在降級路徑上才會出現。
  const defaultRehab = [
    appMode === 'full'
      ? '建议使用森心康智能穿戴套件，将训练游戏从2D升级为3D。配合高精度传感器做家庭OT训练指导。'
      : '将训练融入日常游戏，透过重复性的互动动作巩固神经环路，无需额外器材。',
    '坚持每天定时间的少儿关节拉伸运动，刺激下丘脑及神经营养因子释放，助力幼童认知成长。'
  ];

  const defaultHome = [
    '【起居室多通道游戏】：客厅一角辟出22米安全运动池，摆放彩虹滑梯与手套练习架，每日固定游戏。',
    '【亲子伴谈闭环游戏】：每晚睡前半小时举行“今日小英雄”拥抱对话，巩固温馨氛围。',
    '【户外沙盒感统训练】：带孩子光脚在小沙坑或草皮上奔跑行走，接触多重天然微颗粒及材质。'
  ];

  // Pick suggestions
  let pickedRehab: string[] = [];
  struggling.forEach(s => {
    if (rehabMap[s.dimensionId]) {
      pickedRehab.push(...rehabMap[s.dimensionId]);
    }
  });

  if (pickedRehab.length < 3) {
    // Top up with random standard ones or dimensional ones that are normal but can be optimized
    scores.forEach(s => {
      if (pickedRehab.length < 4 && rehabMap[s.dimensionId]) {
        pickedRehab.push(rehabMap[s.dimensionId][0]);
      }
    });
  }

  // Cap rehab list length
  pickedRehab = pickedRehab.slice(0, 4);
  if (pickedRehab.length === 0) pickedRehab = defaultRehab;

  let neuralPathwayAnalysis = '';
  if (delayCount > 0) {
    neuralPathwayAnalysis = `当前发展分析表明，孩子在局部大脑神经元突触剪切与环路传导上仍在建立中。特别是在前庭平衡与部分前额叶网路区域，突触密度或整合度与同龄常见水平有差距，外周感受传导反射至皮质所需的时间较长。当前正处于突触重塑的发展窗口期（Brain plasticity period），加强游戏化的密集 OT 练习与反馈，能有效促进未分化神经元的跨脑区功能建立。`;
  } else if (borderlineCount > 0) {
    neuralPathwayAnalysis = `脑机理测绘显示孩子的感觉整合与情绪通路目前处于典型的中性过渡带。脑深层核团如杏仁核、纹状体与精细运动小脑区信息偶联良好，传导通路的容错裕度仍在建立中。持续提供富有情绪互动的高感官互动刺激，有助于神经网突触连结密度稳定增长。建议以微阻力定向活动与温暖的家庭环境支持环路突触稳连。`;
  } else {
    neuralPathwayAnalysis = `评估数据勾勒出孩子具有极其健康、极高弹性（High resilience）的脑结构协同性。前额叶皮层、枕叶视觉中枢与颞叶听觉语言区之间的神经递质传输极为平滑，双侧半球联合纤维胼胝体发育匀称。其动作规划机制和多感官整合功能已达甚至溢出同龄水平，建议提供复杂的益智或少儿创造性互动，促进其潜在优势半球技能在高级突触环路层面的进一步沉淀。`;
  }

  let prognosisPrediction = '';
  if (delayCount > 0) {
    prognosisPrediction = `若从当月起坚持每日约 1 小时的家庭互动练习，接下来 3-6 个月内，多个仍在建立中的方面通常会有明显进展，有较大机会回到 ASQ 常见范围。发展窗口期内的支持通常效果较好；家长可以保持轻松的心态，多给正面回应，不必焦虑或比较。`;
  } else {
    prognosisPrediction = `未来3-6个月，若坚持适度运动、低干扰数码陪伴及高频率亲子共读，儿童在语言组织、注意力连续性等核心维度将会有极佳的向上突显。建议家长保持轻松乐观的心态配合其成长。`;
  }

  return {
    summary,
    neuralPathwayAnalysis,
    rehabSuggestions: pickedRehab,
    homeGuidance: defaultHome,
    prognosisPrediction,
    criticalMetrics: {
      neuralPlasticity,
      sensoryIntegration,
      familyEnvironmentScore: familyEnv,
      motorControlIndex: motorControl
    }
  };
}
