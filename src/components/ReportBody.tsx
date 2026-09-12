import React from 'react';
import { DimensionScore, AssessmentStatus } from '../types';
import {
  Award, AlertTriangle, CheckCircle2, Compass, Layers, ClipboardCheck, Activity,
} from 'lucide-react';
import { DIMENSIONS_DATA } from '../data';
import { PRODUCT } from '../productConfig';
import { ALL_CLEAR_SUMMARY, SCREENING_DISCLAIMER, STATUS_WORDING } from '../utils/statusWording';
import { reportSourceLabel } from '../utils/reportSource';
import { reportNumber } from '../utils/reportNumber';
import type { RenderableReport } from '../utils/reportHistory';
import {
  IntegrationGauges, NeuralNetworkTopology, WeeklyRehabPlanner, PrognosisTrajectoryChart,
} from './ReportCharts';

/**
 * 報告本體 —— 家長手機上看到的那一頁，後台的家長詳情看到的也是這一頁（ADR-0007）。
 *
 * 【為什麼是共用元件而不是兩份】
 * 後台的讀者是客服，工作是接家長的電話。家長說「我看到那個儀表 72%」，客服得看得到
 * 同一個 72%。兩邊各畫一份的話，分岔只是時間問題，而分岔的樣子是客服與家長在電話
 * 兩端看著不同的東西、誰都不知道對方為什麼這樣說。
 *
 * 【這個元件只吃資料，不做動作】
 * 沒有 fetch、沒有 useState、沒有任何送得出去的按鈕。要按的東西（語言專項入口、
 * 掃碼帶走卡、預約表單）由呼叫端從插槽放進來，家長端放、後台不放。
 *
 * ⚠️ **後台看到的裝飾性圖表不要只在後台修掉。** 發育軌跡預測圖的四個數字是寫死的
 * （62→74→87→95，每個孩子一樣），百分位條沒有常模。它們出現在後台是因為家長看得到
 * 它們。要改就改這個元件（兩邊一起變），或去問產品端那張圖該不該存在 —— 後台一旦與
 * 家長端分岔，ADR-0007 這份決定就沒了。
 */

/**
 * 把任一層級的得分換算到共用的 0–8「關注分」刻度。
 *
 * T1 滿分 8，T2/T3 滿分 50/120，先前的 `8 - score` 會在深度評估上產生負值，
 * 於是表現最差的維度被畫成綠色。T1 的結果與 `8 - score` 完全相同。
 */
function toConcernScore(score: number, maxScore: number): number {
  const max = maxScore > 0 ? maxScore : 8;
  return Math.round(8 * (1 - score / max));
}

/**
 * 三級嚴重度各自的顏色。**圖表的顏色與文字一律走這裡，不看關注分**
 * （ADR-0007 / CONTEXT.md「關注分」）。
 *
 * 2026-09-11 之前，橫幅、九宮格與雷達圖各自在關注分上另畫一條線（≥5 紅、3–4 黃），
 * 換算回得分是比篩查判定寬鬆一格 —— 得分 6 的維度在篩查頁亮黃燈，在報告的雷達圖上
 * 卻說「大致良好」。那是第二套刻度，而 CONTEXT.md 對嚴重度的定義是「與報告上的判定
 * 是同一組值，不另立一套刻度」。
 *
 * 關注分留下來的唯一工作是**雷達圖上那一角凸出去多少**，以及九宮格條形圖的長度。
 */
const SEVERITY: Record<AssessmentStatus, {
  /** 卡片頂端那條色帶、條形圖填色、圖例圓點。 */
  fill: string;
  /** 膠囊標籤。 */
  badge: string;
  /** 分數與行動建議的字色。 */
  text: string;
  /** 明細列的底色。 */
  tint: string;
  /** SVG 用得到的色碼（Tailwind 類別在 SVG 屬性裡沒有作用）。 */
  hex: string;
  /** 卡片右下角的行動建議。 */
  action: string;
}> = {
  normal: {
    fill: 'bg-emerald-500',
    badge: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    text: 'text-emerald-600',
    tint: 'bg-emerald-50/30',
    hex: '#10b981',
    action: '继续观察',
  },
  borderline: {
    fill: 'bg-amber-500',
    badge: 'bg-amber-50 border-amber-200 text-amber-700 font-bold',
    text: 'text-amber-600 font-bold',
    tint: 'bg-amber-50/30',
    hex: '#f59e0b',
    action: PRODUCT.nextStep.actionLabelMedium,
  },
  delay: {
    fill: 'bg-rose-500',
    badge: 'bg-rose-50 border-rose-200 text-rose-700 font-bold',
    text: 'text-rose-600 font-bold',
    tint: 'bg-rose-50/30',
    hex: '#e11d48',
    action: PRODUCT.nextStep.actionLabelHigh,
  },
};

/** 排序與多邊形顏色用的名次。越大越需要支持。 */
const SEVERITY_RANK: Record<AssessmentStatus, number> = { normal: 1, borderline: 2, delay: 3 };

/**
 * 查表一律經過這裡，**不要直接寫 `SEVERITY[s.status]`**。
 *
 * 型別說 `status` 一定是三種之一，但值的來源是 JSON（後台讀資料庫、家長端讀
 * localStorage），宣告擋不住那裡面的任何東西。直接查表的話，一個認不得的字
 * 會讓 `look.fill` 拋 TypeError（整頁白畫面），或讓 `Math.max(acc, undefined)`
 * 算出 NaN —— 後者更糟：雷達圖會安靜地畫成綠色，而那個孩子有好幾項紅燈。
 *
 * 退路選 `normal` 不是因為綠燈比較安全，而是因為全站對未知判定只有這一種說法
 * （`adminView.statusLabel`、`adminStore.flaggedFrom`、`utils/reportHistory.ts`
 * 都是這樣）。真正的正規化在那三處，這裡只是最後一道。
 */
function look(status: AssessmentStatus) {
  return SEVERITY[status] ?? SEVERITY.normal;
}

function rankOf(status: AssessmentStatus): number {
  return SEVERITY_RANK[status] ?? SEVERITY_RANK.normal;
}

export interface ReportBodyProps {
  /**
   * 報告內文裡稱呼孩子的名字 —— 是**這份報告當時**的那個名字，不是今天的。
   *
   * 只要名字，不要整個 `Child`：月齡與性別由呼叫端各自的標頭顯示，報告本體
   * 從來沒用到，而多要一個欄位就多一個「那個欄位是 null」的當機點。
   */
  childName: string;
  scores: DimensionScore[];
  aiReport: RenderableReport['aiReport'];
  /** 三態：true = AI 生成、false = 本地模板兜底、null/undefined = 舊紀錄沒存這個旗標。 */
  isAiGenerated?: boolean | null;
  /** 報告編號由它算出。`null` 代表還沒存進歷史，此時整行不出現。 */
  reportId?: string | null;
  /** 家長端專屬：T2 深度評估入口（票 #56）。放在雷達圖之後、語言專項入口之前。 */
  t2Slot?: React.ReactNode;
  /** 家長端專屬：語言專項評估入口。放在雷達圖與發育進度對比之間。 */
  languageSlot?: React.ReactNode;
  /** 家長端專屬：掃碼把報告帶回家的二維碼卡。放在預後說明與每週課表之間。 */
  takeawaySlot?: React.ReactNode;
  /** 家長端專屬：專家預約入口。放在每週課表底下，與它同屬最後那一區。 */
  bookingSlot?: React.ReactNode;
}

export default function ReportBody({
  childName,
  scores,
  aiReport,
  isAiGenerated,
  reportId,
  t2Slot,
  languageSlot,
  takeawaySlot,
  bookingSlot,
}: ReportBodyProps) {
  const redNames = scores.filter(s => s.status === 'delay').map(s => s.dimensionName);
  const yellowNames = scores.filter(s => s.status === 'borderline').map(s => s.dimensionName);

  const sourceLabel = reportSourceLabel(isAiGenerated);

  return (
    <div className="space-y-8 animate-fade-in text-left bg-white rounded-3xl border border-brand-stone shadow-sm overflow-hidden p-6 md:p-8">

      {/* Diagnostic top header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-cream pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 text-brand-moss font-bold text-xs uppercase tracking-wider">
            <Award size={14} />
            {sourceLabel}
          </div>
          <h2 className="text-xl font-bold text-brand-forest mt-1">儿童综合发展评估报告</h2>
          {/* 對照表要求固定放在報告最上方的定位句，原句照抄（見 statusWording.ts）。 */}
          <p className="text-[11px] text-brand-charcoal/70 mt-1.5">{SCREENING_DISCLAIMER}</p>
        </div>
        {/*
          編號由報告 id 算出，同一份報告永遠同一號（ADR-0007）。先前這裡取的是
          `Date.now()` 的後六位 —— 家長自己把報告關掉重開，號碼就換一個，
          而這串字的用途正是讓他在電話上說出「我看的是哪一份」。
        */}
        {reportId && (
          <span className="text-[10px] text-brand-charcoal/50 text-right">
            报告编号: {reportNumber(reportId)}
          </span>
        )}
      </div>

      {/* AI One-Sentence Summary */}
      <div className="bg-brand-sage/35 p-4.5 rounded-2xl border border-brand-stone/40">
        <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5 mb-1.5">
          <Compass size={14} /> 首席专家建议:
        </h4>
        <p className="text-xs text-brand-charcoal leading-relaxed font-semibold">
          {aiReport.summary}
        </p>
      </div>

      {/* SECTION 1: ALERT BANNER */}
      {redNames.length === 0 && yellowNames.length === 0 ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-xs font-semibold leading-relaxed">
          <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
          <div>
            {ALL_CLEAR_SUMMARY}请配合日常亲子共读与游戏互动继续保持。
          </div>
        </div>
      ) : (
        /*
          句型照對照表的公式：（能力方面）＋（中性描述）＋（行動建議）。
          紅燈與黃燈各自成句 —— 兩者的行動建議不同，混在一起會把優先順序丟掉。
          產品各自的下一步（B 約專家、A 進第二層）接在最後。
        */
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl flex items-start gap-3 text-xs leading-relaxed font-medium">
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
          <div>
            本次筛查提示：
            {redNames.length > 0 && (
              <>
                <span className="font-bold text-rose-600">{redNames.join('、')}</span>
                方面{STATUS_WORDING.delay.describe}，<span className="font-bold text-rose-800">{STATUS_WORDING.delay.tag}</span>
              </>
            )}
            {redNames.length > 0 && yellowNames.length > 0 && '；'}
            {yellowNames.length > 0 && (
              <>
                <span className="font-bold text-amber-600">{yellowNames.join('、')}</span>
                方面{STATUS_WORDING.borderline.describe}，<span className="font-bold text-amber-700">{STATUS_WORDING.borderline.tag}</span>
              </>
            )}
            。{PRODUCT.nextStep.alertText}
          </div>
        </div>
      )}

      {/* SECTION 2: 9宫格明细 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
            <Layers size={15} className="text-brand-moss" />
            9 维度评估结果明细
          </h3>
          <p className="text-[10px] text-brand-charcoal/50 mt-0.5">条形图代表该维度的「关注分」（0-8分，分数越高，越建议进一步了解）</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {DIMENSIONS_DATA.map((dim) => {
            const score = scores.find(s => s.dimensionId === dim.id);
            if (!score) return null;
            const concernScore = toConcernScore(score.score, score.maxScore);
            const style = look(score.status);

            return (
              <div key={dim.id} className="relative overflow-hidden bg-white border border-brand-stone/70 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                <div className={`absolute top-0 left-0 right-0 h-1 ${style.fill}`} />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-forest">{dim.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border ${style.badge}`}>
                      {(STATUS_WORDING[score.status] ?? STATUS_WORDING.normal).label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-brand-charcoal/70">
                    <span>关注分: <strong className="font-extrabold">{concernScore}</strong> / 8</span>
                    <span className={`text-[9px] ${style.text}`}>{style.action} →</span>
                  </div>

                  <div className="w-full h-1.5 bg-brand-cream/50 rounded-full overflow-hidden border border-brand-stone/30">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${style.fill}`}
                      style={{ width: `${(concernScore / 8) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 text-[9px] text-brand-charcoal/60 pt-1">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {STATUS_WORDING.normal.label} (继续观察)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> {STATUS_WORDING.borderline.label} ({PRODUCT.nextStep.legendAttentionHint})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> {STATUS_WORDING.delay.label} ({PRODUCT.nextStep.legendConcernHint})
          </span>
        </div>
      </div>

      {/* SECTION 3: 重点问题标注 KEY FINDINGS - 雷达图 */}
      <RadarSection scores={scores} />

      {/* 家長端專屬：T2 深度評估入口。後台不放 —— 同語言專項，那是一顆按下去會開始做事的按鈕。 */}
      {t2Slot}

      {/* 家長端專屬：語言專項評估入口。後台不放 —— 那是一顆按下去會開始做事的按鈕。 */}
      {languageSlot}

      {/* New Visual Section 1: Overall Peer Development Level Comparison */}
      <PeerComparison childName={childName} scores={scores} />

      {/*
        1. Circular Dial Gauges for Critical Brain Indices

        沒存下這四個數字的舊報告，整區不出現 —— 補 0 畫出來是四個歸零的儀表，
        而讀的人會以為那是這個孩子的分數。
      */}
      {aiReport.criticalMetrics && <IntegrationGauges criticalMetrics={aiReport.criticalMetrics} />}

      {/* 2. Interactive Synaptic Connection Topology Diagram & Pathway Analysis */}
      {/*
        拓撲圖底下原本還有一段「脑突触剪切与微环路协同性分析」總覽敘述，
        依客戶需求移除 —— 那段是寫給臨床看的神經生理術語，家長讀不出行動。
        `aiReport.neuralPathwayAnalysis` 仍由後端產生並保留在型別裡，只是不再渲染。
      */}
      <div className="space-y-4">
        <NeuralNetworkTopology completedScores={scores} />
      </div>

      {/* 4. Smooth trajectory 3-month forecast line-graph & Prognosis Narrative */}
      <div className="space-y-4">
        <PrognosisTrajectoryChart completedScores={scores} />

        <div className="bg-brand-sand/50 p-4 rounded-2xl border border-brand-stone/60 text-left">
          <span className="text-[10px] font-bold text-brand-clay uppercase tracking-wider flex items-center gap-1 mb-1.5">
            <Compass size={11} className="text-brand-clay" />
            后续发展预判与家长指引
          </span>
          <p className="text-xs text-brand-charcoal leading-relaxed font-semibold">
            {aiReport.prognosisPrediction}
          </p>
        </div>
      </div>

      {/* 家長端專屬：掃碼把報告帶回自己的手機（issue #22）。 */}
      {takeawaySlot}

      {/* 3. Gamified Weekly Sensori-Motor Training Calendar */}
      <div className="space-y-4 pt-4 border-t border-brand-cream/80">
        <WeeklyRehabPlanner rehabSuggestions={aiReport.rehabSuggestions} homeGuidance={aiReport.homeGuidance} />

        {/* 家長端專屬：專家預約入口與表單。 */}
        {bookingSlot}
      </div>
    </div>
  );
}

/**
 * 九大維度的雷達圖。
 *
 * **關注分決定每一角凸出去多遠，嚴重度決定它是什麼顏色。** 兩者分工，不互相取代。
 */
function RadarSection({ scores }: { scores: DimensionScore[] }) {
  const sortedScores = [...scores]
    .map(s => ({
      ...s,
      concernScore: toConcernScore(s.score, s.maxScore),
      rank: rankOf(s.status),
    }))
    .sort((a, b) => b.concernScore - a.concernScore || b.rank - a.rank);

  const redCount = sortedScores.filter(s => s.status === 'delay').length;
  const yellowCount = sortedScores.filter(s => s.status === 'borderline').length;
  const attentionCount = redCount + yellowCount;

  // 雷达图参数
  const cx = 160, cy = 160, maxR = 120;
  const axes = sortedScores.length;
  const angleStep = axes > 0 ? (2 * Math.PI) / axes : 0;

  // 计算每个维度的坐标点
  const getPoint = (index: number, value: number, maxVal: number = 8) => {
    const angle = angleStep * index - Math.PI / 2;
    // 限制值在 0 到 maxVal 之间，防止负分或超分导致图表变形
    const clampedValue = Math.max(0, Math.min(value, maxVal));
    const r = (clampedValue / maxVal) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // 生成数据多边形路径
  const dataPath = sortedScores
    .map((s, i) => {
      const pt = getPoint(i, s.concernScore);
      return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
    })
    .join(' ') + ' Z';

  // 生成网格路径
  const gridLevels = [2, 4, 6, 8];
  const gridPaths = gridLevels.map(level =>
    sortedScores
      .map((_, i) => {
        const pt = getPoint(i, level);
        return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
      })
      .join(' ') + ' Z'
  );

  // 多邊形取最需要支持的那一級的顏色。沒有任何成績時退回綠色，
  // 不讓 `Math.max` 在空陣列上回 -Infinity。
  const worstRank = sortedScores.reduce(
    (acc, s) => Math.max(acc, rankOf(s.status)),
    SEVERITY_RANK.normal
  );
  const polygonColor =
    worstRank === SEVERITY_RANK.delay ? SEVERITY.delay.hex
      : worstRank === SEVERITY_RANK.borderline ? SEVERITY.borderline.hex
        : SEVERITY.normal.hex;

  return (
    <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
      <div className="border-b border-brand-cream pb-2.5">
        <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
          <ClipboardCheck size={15} className="text-brand-moss" />
          {/* 客戶指定的字串，一字不動（issue #18 / p.12）：不加空格、破折號用兩個全形。 */}
          9大维度结论——雷达图分析
        </h3>
        <p className="text-[10px] text-brand-charcoal/50 mt-0.5">
          共评测 9 项发展维度，其中 <span className="font-bold text-rose-600">{attentionCount} 项</span>{' '}
          {STATUS_WORDING.borderline.tag}（<span className="font-bold text-rose-600">{redCount} 项</span>{' '}
          {STATUS_WORDING.delay.tag}）
        </p>
      </div>

      {/*
        雷达图

        `w-full max-w-[320px]` 而不是原本的固定 `width="320"`：320 是圖形本身的大小，
        維度標籤畫在 viewBox **之外**（`labelR = maxR + 25` = 145，最左/最右那兩根軸的
        錨點在 x ≈ 17 與 x ≈ 303，配上最長的維度名「生活自理与适应」7 字約 70px，
        會伸到 x = -53 與 373），靠 `overflow-visible` 露出來。

        桌機上外層卡片寬鬆，露出去也還在卡片裡；手機上卡片只剩 253px，露出去的標籤
        就撞上報告外框的 `overflow-hidden`，左邊那個維度名被削掉一角。改成隨容器縮放後，
        縮放比 253/320 ≈ 0.79 讓標籤範圍收在外框內（實測餘裕約 3px）。

        ⚠️ 餘裕不大 —— 若日後維度名超過 7 個字，最左那一個會再度被削。真要加長名稱，
        得連 `labelR` 與 viewBox 一起重算。
      */}
      <div className="flex justify-center">
        <svg width="320" height="320" viewBox="0 0 320 320" className="w-full max-w-[320px] h-auto overflow-visible">
          {/* 网格背景 */}
          {gridPaths.map((path, i) => (
            <path
              key={`grid-${i}`}
              d={path}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray={i === gridLevels.length - 1 ? "0" : "3,3"}
            />
          ))}

          {/* 轴线 */}
          {sortedScores.map((_, i) => {
            const pt = getPoint(i, 8);
            return (
              <line key={`axis-${i}`} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="#d1d5db" strokeWidth="1" />
            );
          })}

          {/* 数据多边形 */}
          <path d={dataPath} fill={`${polygonColor}20`} stroke={polygonColor} strokeWidth="2" />

          {/* 数据点 */}
          {sortedScores.map((s, i) => {
            const pt = getPoint(i, s.concernScore);
            const color = look(s.status).hex;
            return (
              <g key={`point-${i}`}>
                <circle cx={pt.x} cy={pt.y} r="4" fill={color} stroke="white" strokeWidth="2" />
                {/* 数值标签 */}
                <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>
                  {s.concernScore}
                </text>
              </g>
            );
          })}

          {/* 维度标签 */}
          {sortedScores.map((s, i) => {
            const angle = angleStep * i - Math.PI / 2;
            const labelR = maxR + 25;
            const lx = cx + labelR * Math.cos(angle);
            const ly = cy + labelR * Math.sin(angle);

            // 型別標註是必要的：不寫的話會被推論成 string，而 SVG 的
            // textAnchor 只接受這幾個字面值。
            let textAnchor: 'start' | 'middle' | 'end' = 'middle';
            if (Math.cos(angle) > 0.3) textAnchor = 'start';
            else if (Math.cos(angle) < -0.3) textAnchor = 'end';

            return (
              <text
                key={`label-${i}`}
                x={lx}
                y={ly}
                textAnchor={textAnchor}
                fontSize="10"
                fontWeight="600"
                fill="#374151"
              >
                {s.dimensionName}
              </text>
            );
          })}

          {/* 中心点 */}
          <circle cx={cx} cy={cy} r="3" fill="#9ca3af" />
        </svg>
      </div>

      {/*
        圖例三級，與九宮格、篩查結論頁同一組字。
        先前這裡是四級（依關注分 ≥6／5／3–4／≤2 切），那是第二套刻度 —— 見 SEVERITY 的說明。
      */}
      <div className="flex flex-wrap justify-center gap-3 text-[10px]">
        {(['delay', 'borderline', 'normal'] as const).map(status => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${look(status).fill}`} />
            <span className="text-brand-charcoal/70">{STATUS_WORDING[status].label}</span>
          </div>
        ))}
      </div>

      {/* 详细列表 */}
      <div className="border-t border-brand-cream pt-3 space-y-2">
        <p className="text-[10px] font-bold text-brand-charcoal/60 text-center">各维度关注分详情</p>
        <div className="grid grid-cols-3 gap-2">
          {sortedScores.map((item) => (
            <div
              key={`${item.dimensionId}-${item.tierId}`}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] ${look(item.status).tint}`}
            >
              <span className="font-medium text-brand-charcoal/80 truncate">{item.dimensionName}</span>
              <span className={`font-bold ml-1 ${look(item.status).text}`}>{item.concernScore}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 與同齡的比較條。
 *
 * ⚠️ **這張圖沒有常模。** 百分位是九個維度得分率的平均，不是任何一份常模樣本的分位數。
 * 它留在報告裡是產品決定（家長看得到它），不是因為它有臨床意義 —— 見本檔開頭的警告。
 */
function PeerComparison({ childName, scores }: { childName: string; scores: DimensionScore[] }) {
  const avgPct = scores.length > 0
    ? Math.round(scores.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / scores.length)
    : 50;

  // 主語是「发展节奏」，不是孩子 —— 對照表：避免「孩子有……」這種以孩子為主語的判定句。
  const note =
    avgPct < 40
      ? `${childName} 的整体发展节奏与同龄常见的节奏有一定差距。建议跟进最下方的 7 日居家活动安排，并近期预约专家一对一说明。`
      : avgPct < 70
        ? `${childName} 的整体发展节奏接近同龄常见水平，有几项仍在建立中，多做亲子互动与居家共读会有帮助。`
        : avgPct < 85
          ? `${childName} 的整体发展处于同龄常见水平偏上，大部分维度表现稳定，针对性的日常练习可巩固优势。`
          : `${childName} 的整体发展高于同龄常见水平，各维度表现均衡。`;

  return (
    <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
      <div className="border-b border-brand-cream pb-2.5">
        <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
          <Activity size={15} className="text-brand-moss animate-pulse" />
          发育进度对比 (与同龄儿童发育水平比较)
        </h3>
      </div>

      <div className="py-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold text-brand-forest">总体发育水平百分位</span>
          <span className="text-xs font-extrabold text-brand-moss bg-brand-sage/20 border border-brand-moss/30 px-2 py-0.5 rounded-full">
            居同龄前 {100 - avgPct}%
          </span>
        </div>

        {/* Segmented color track with red vertical pointer indicator */}
        <div className="relative w-full h-5 rounded-full overflow-hidden flex border border-brand-stone/50 shadow-inner">
          <div className="w-1/4 h-full bg-rose-200" title={STATUS_WORDING.delay.label} />
          <div className="w-1/4 h-full bg-orange-100" title={STATUS_WORDING.borderline.label} />
          <div className="w-1/4 h-full bg-amber-50" title="平均水平" />
          <div className="w-1/4 h-full bg-emerald-100" title="高于平均" />

          {/* Visual red pointer indicator bar */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-rose-600 shadow-lg shadow-rose-600/30 transition-all duration-1000"
            style={{ left: `${avgPct}%`, transform: 'translateX(-50%)' }}
          />
        </div>

        {/* Labels matching attachment */}
        <div className="flex justify-between text-[10px] text-brand-charcoal/80 font-bold px-1 mt-2">
          <span className="w-1/4 text-center">{STATUS_WORDING.delay.label}</span>
          <span className="w-1/4 text-center">{STATUS_WORDING.borderline.label}</span>
          <span className="w-1/4 text-center">平均水平</span>
          <span className="w-1/4 text-center">高于平均</span>
        </div>
      </div>

      <div className="bg-brand-sage/10 p-3 rounded-xl border border-brand-moss/20 text-xs text-brand-charcoal leading-relaxed font-semibold">
        💡 {note}
      </div>
    </div>
  );
}
