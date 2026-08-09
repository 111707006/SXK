import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Child, DimensionScore, AssessmentRecord } from '../types';
import { formatAge } from '../utils/dateUtils';
import { 
  ArrowLeft, Brain, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, 
  RefreshCw, Layers, ShieldAlert, Award, Compass, HeartHandshake, Printer,
  Activity, MessageSquare, Smile, BookOpen, Target, Home, Heart, Calendar, User, Phone, Check, Info,
  ClipboardCheck, Loader2, QrCode, Mic, ChevronRight
} from 'lucide-react';
import { DIMENSIONS_DATA } from '../data';
import { PRODUCT } from '../productConfig';
import { peekDeviceId } from '../utils/deviceId';
import {
  emptySpecialistsMessage,
  useReportSpecialists,
  type ReportSpecialist,
} from '../utils/specialists';
import { 
  IntegrationGauges, NeuralNetworkTopology, WeeklyRehabPlanner, PrognosisTrajectoryChart 
} from './ReportCharts';

/**
 * 森心康自己的三位專家 —— **只有專案 A 用得到**。
 *
 * 專案 B 的每一家合作公司自備專家，名單改由 `/api/specialists` 依家長的歸屬
 * 供應（見 `utils/specialists.ts`）。這份常數在 B 的建置裡不會被讀到，
 * 也不會退回來當備援：那會讓合作公司的家長看到三位森心康醫師的姓名與照片。
 */
const BUILTIN_SPECIALISTS: ReportSpecialist[] = [
  {
    id: 'spec-1',
    name: '王素娟',
    title: '儿童专科医院 副主任医师',
    avatarUrl: '/expert-wang.jpg',
    specialty: '儿童脑瘫的系统管理与康复、脑损伤后遗症的全面康复干预、高危新生儿的长期随访与发育监测、学习障碍、阅读障碍、书写障碍等发育障碍的康复治疗。',
    experience: '从业30年，复旦大学附属儿科医院，中国康复医学会康复评定专委会委员，中国妇幼保健协会高危儿专业委员',
    slots: ['周四上午', '周五下午', '周六上午']
  },
  {
    id: 'spec-2',
    name: '何明哲',
    title: '国家合格康复督导师',
    avatarUrl: '/expert-he.jpg',
    specialty: '儿童作业、心理、多动症、自闭症、学习障碍、言语功能等干预训练，儿童发育迟缓调整训练。',
    // 品牌職稱那一句由 PRODUCT.brand.bioClause 提供，B 為 null 即整段不出現。
    // 其餘資歷一字不動 —— 這是真人的簡歷，能省略但不能改寫。
    experience: `从业20年，中国台湾大学职能治疗学系，台北护理大学语言治疗病理学硕士，${PRODUCT.brand.bioClause ?? ''}上海星晨儿童医院（暨复旦大学附设儿科医院新虹桥分院）康复科督导`,
    slots: ['周一上午', '周二下午', '周三上午']
  },
  {
    id: 'spec-3',
    name: '张厚亮',
    title: '神经内科医学博士、院长',
    avatarUrl: '/expert-zhang.png',
    specialty: '神经内科医学、脑神经专家、神经内科疑难杂症干细胞修复治疗、功能医学辅助神经康复。',
    experience: '26 年神经系统疾病临床诊疗经验，美年大健康门诊部院长，华山医院神经内科、中心医院神经内科、上海新起点康复医院副院长',
    slots: ['周三上午', '周五上午', '周日上午']
  }
];

/**
 * 可預約日期的計算。
 *
 * 【為什麼不寫死】原本這裡是 `min="2026-07-09" max="2026-07-30"`，預設值 `2026-07-13`。
 * 寫死的日期區間一定會過期，而過期的樣子很安靜：日曆上一個可選的日期都沒有，
 * 預設值卻仍停在 7/13，於是每一筆送出的預約都寫著四週前的時段
 * （`preferredSlot` 是 `${bookingDate} ${selectedSlot}` 直接組出來的）。
 * 專案 B 沒有付費層，這張表單就是它唯一的轉換點 —— 它壞掉不會有人回報，
 * 只會表現成「都沒有人來預約」。
 */
function bookingDayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // 刻意不用 toISOString()：那是 UTC，在東八區會把當地凌晨算成前一天。
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 沒有照片時的替代標記 —— 合作公司多半不會有每位治療師的沙龍照。 */
function SpecialistAvatar({ spec, size }: { spec: ReportSpecialist; size: number }) {
  if (spec.avatarUrl) {
    return (
      <img
        src={spec.avatarUrl}
        alt={spec.name}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover border border-brand-stone/80"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-brand-sage/30 border border-brand-stone/80 flex items-center justify-center text-brand-forest font-bold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {spec.name.slice(0, 1)}
    </div>
  );
}

const IconComponent = ({ name, size = 20 }: { name: string; size?: number }) => {
  switch (name) {
    case 'Activity': return <Activity size={size} />;
    case 'Sparkles': return <Sparkles size={size} />;
    case 'Brain': return <Brain size={size} />;
    case 'MessageSquare': return <MessageSquare size={size} />;
    case 'Smile': return <Smile size={size} />;
    case 'BookOpen': return <BookOpen size={size} />;
    case 'Target': return <Target size={size} />;
    case 'Home': return <Home size={size} />;
    case 'Heart': return <Heart size={size} />;
    default: return <Brain size={size} />;
  }
};

/**
 * Normalise a score from any tier onto the shared 0-8 "concern" scale used by
 * the report's badges, bars and radar. T1 is scored out of 8, but T2/T3 are out
 * of 50/120, so the previous `8 - score` produced negative values and coloured
 * badly-performing dimensions green. For T1 this is identical to `8 - score`.
 */
function toConcernScore(score: number, maxScore: number): number {
  const max = maxScore > 0 ? maxScore : 8;
  return Math.round(8 * (1 - score / max));
}

interface AnalysisReportProps {
  child: Child;
  completedScores: DimensionScore[];
  onBack: () => void;
  onSaveReportToHistory: (record: AssessmentRecord) => void;
  onGoToLanguageSpecial?: () => void;
  historicalRecord?: AssessmentRecord | null;
  /**
   * 開啟後自動捲到專家預約區塊。專案 B 的維度卡片會走這條路 ——
   * 家長點了亮燈的維度，就直接把他帶到諮詢入口。
   */
  focusBooking?: boolean;
}

export default function AnalysisReport({ child, completedScores, onBack, onSaveReportToHistory, onGoToLanguageSpecial, historicalRecord, focusBooking }: AnalysisReportProps) {
  const [loading, setLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AssessmentRecord['aiReport'] | null>(null);
  // 三態：true = AI 生成、false = 本地模板兜底、null = 來源不明（舊的歷史紀錄沒存這個旗標）
  const [isAiGenerated, setIsAiGenerated] = useState<boolean | null>(false);
  const [error, setError] = useState('');

  /**
   * 這份報告該用誰的年齡來讀。
   *
   * 看歷史紀錄時是**那一次篩查當下**的孩子（測評月齡），不是今天的孩子 ——
   * 分數是照那個年齡段的題目算出來的，配上今天的年齡就沒有人讀得懂了。
   * 只有現場產出的新報告才用 `child`，那時兩者本來就是同一個。
   */
  const reportChild = historicalRecord?.child ?? child;

  useEffect(() => {
    if (historicalRecord && historicalRecord.aiReport) {
      setAiReport(historicalRecord.aiReport);
      // 舊紀錄沒有 isAiGenerated 欄位，此時來源不明，不能預設成 AI 生成
      setIsAiGenerated(historicalRecord.isAiGenerated ?? null);
    }
  }, [historicalRecord]);

  const [showBookingModal, setShowBookingModal] = useState(false);
  // 專案 A 是內建的三位；專案 B 是這位家長所屬合作公司的專家。
  const { specialists, reason: specialistsReason } = useReportSpecialists(BUILTIN_SPECIALISTS);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>('');
  const currentSpecialist = specialists.find(s => s.id === selectedSpecialist) ?? null;
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  // 從明天起算 30 天。專家要有時間排班，所以不開放今天。
  const bookingWindow = useMemo(() => ({ min: bookingDayOffset(1), max: bookingDayOffset(30) }), []);
  const [bookingDate, setBookingDate] = useState<string>(() => bookingDayOffset(1));
  const [parentName, setParentName] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'success'>('idle');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const bookingSectionRef = useRef<HTMLDivElement>(null);

  // 名單是非同步來的，預設選擇不能寫死成 'spec-1' —— 那個 id 在合作公司的名單裡
  // 根本不存在，會讓「已選定」與「選了一個不存在的人」長得一模一樣。
  //
  // 比對在 effect 裡直接做，**不放進 setState 的 updater**：updater 必須是純函式，
  // React 會在 StrictMode 下重複呼叫、也可能在並行渲染時丟棄後重跑，在裡面順手
  // 改另一個 state 遲早會產生只在特定排程下重現的錯誤狀態。
  useEffect(() => {
    if (specialists.length === 0) {
      setSelectedSpecialist('');
      setSelectedSlot('');
      return;
    }
    // 目前選的人還在新名單裡就不要動他 —— 名單重新抓取不該把使用者選到一半的
    // 預約洗掉。不在了才換成第一位，並清掉屬於前一位的時段。
    setSelectedSpecialist(prev => {
      if (specialists.some(s => s.id === prev)) return prev;
      return specialists[0].id;
    });
    if (!specialists.some(s => s.id === selectedSpecialist)) {
      setSelectedSlot('');
    }
    // selectedSpecialist 刻意不在依賴裡：這個 effect 是「名單變了要不要改選擇」，
    // 把它加進去會在每次使用者換人時多跑一輪，並在名單沒變時清掉剛選的時段。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialists]);

  // 專案 B 從維度卡片進來時捲到專家預約區塊。
  // 必須等 aiReport 就緒 —— 該區塊在 `{aiReport && ...}` 裡面，報告還在載入時
  // ref 是 null，掛載當下就捲會什麼事都沒發生。
  useEffect(() => {
    if (!focusBooking || !aiReport) return;
    bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusBooking, aiReport]);

  const delayList = completedScores.filter(s => s.status === 'delay');
  const borderlineList = completedScores.filter(s => s.status === 'borderline');
  const normalList = completedScores.filter(s => s.status === 'normal');

  const languageScore = completedScores.find(s => s.dimensionId === 'language');
  const hasLanguageIssue = languageScore && (languageScore.status === 'borderline' || languageScore.status === 'delay');

  /**
   * 送出專家預約。
   *
   * 在這之前，這顆按鈕只做 `setBookingStatus('success')` —— 家長看到「預約成功
   * 確認書」，但沒有任何人被通知、沒有留下任何紀錄。現在要等後端確認寫入成功
   * 才切到成功畫面，寫不進去就顯示錯誤，不再給假的成功。
   */
  const handleSubmitBooking = async () => {
    setBookingSubmitting(true);
    setBookingError('');
    try {
      // 交給專家的行前摘要：只列被標記的維度，正常的不佔篇幅。
      const flagged = [
        ...delayList.map(s => `${s.dimensionName}（迟缓风险 ${s.score}/${s.maxScore}）`),
        ...borderlineList.map(s => `${s.dimensionName}（临界 ${s.score}/${s.maxScore}）`),
      ];
      const summary = flagged.length ? flagged.join('；') : '本次筛查各维度均在正常范围';

      const token = localStorage.getItem('senxinkang_token');
      const resp = await fetch('/api/expert-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          specialistId: selectedSpecialist,
          specialistName: currentSpecialist?.name,
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
          childAgeMonth: reportChild.ageMonth,
          childGender: reportChild.gender,
          reportSummary: summary,
          preferredSlot: `${bookingDate} ${selectedSlot}`,
          deviceId: peekDeviceId(),
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || '预约提交失败，请稍后重试。');

      setBookingStatus('success');
    } catch (err: any) {
      setBookingError(err.message || '预约提交失败，请检查网络后重试。');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child,
          scores: completedScores
        })
      });

      if (!response.ok) {
        throw new Error('网络应答异常，请重试');
      }

      const ct = response.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        throw new Error('服务器响应格式不正确，未能生成AI评估报告');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setAiReport(data.report);
      // 後端降級到本地模板時會回傳 isAiGenerated: false，照實收下
      setIsAiGenerated(data.isAiGenerated === true);

      // Optionally trigger parent state to record the report
      const newRecord: AssessmentRecord = {
        id: 'rec_' + Date.now(),
        type: 'T1_SCREENING',
        child,
        scores: completedScores,
        aiReport: data.report,
        // 一併存下來源，之後從歷史紀錄重開時才標得出來
        isAiGenerated: data.isAiGenerated === true,
        createdAt: new Date().toISOString()
      };
      onSaveReportToHistory(newRecord);

    } catch (e: any) {
      console.error(e);
      setError('AI 评估报告生成中偏离：' + (e.message || '未知微差'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStatusPercentage = (status: 'normal' | 'borderline' | 'delay') => {
    const total = completedScores.length;
    if (total === 0) return 0;
    const count = completedScores.filter(s => s.status === status).length;
    return Math.round((count / total) * 100);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Back navigation header */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-brand-stone shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-charcoal/85 hover:text-brand-forest transition"
        >
          <ArrowLeft size={16} />
          返回评估面板
        </button>
        <span className="text-xs bg-brand-sage px-3 py-1 text-brand-forest border border-brand-stone/40 rounded-full font-bold">
          受测儿档案：{reportChild.name} ({reportChild.gender === 'boy' ? '男' : '女'}) | {formatAge(reportChild.ageMonth)}
        </span>
      </div>

      {/* Primary diagnostic score cards overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-brand-sage/40 border border-brand-stone p-5 rounded-2xl text-left shadow-sm">
          <div className="flex items-center gap-2.5 text-brand-forest">
            <CheckCircle2 size={18} className="text-brand-moss" />
            <h3 className="text-sm font-bold">生理/心理发育正常</h3>
          </div>
          <div className="text-2xl font-bold font-sans text-brand-forest mt-2.5">
            {completedScores.filter(s => s.status === 'normal').length} 个维度
          </div>
          <p className="text-[11px] text-brand-charcoal/85 mt-1">占比约 {calculateStatusPercentage('normal')}%，发育状态平稳</p>
        </div>

        <div className="bg-brand-sand/55 border border-brand-stone p-5 rounded-2xl text-left shadow-sm">
          <div className="flex items-center gap-2.5 text-brand-clay">
            <AlertTriangle size={18} className="text-brand-clay" />
            <h3 className="text-sm font-bold">边缘警示与滞后过渡</h3>
          </div>
          <div className="text-2xl font-bold font-sans text-brand-clay mt-2.5">
            {completedScores.filter(s => s.status === 'borderline').length} 个维度
          </div>
          <p className="text-[11px] text-brand-charcoal/85 mt-1">占比约 {calculateStatusPercentage('borderline')}%，需轻度康复及环境干预</p>
        </div>

        <div className="bg-rose-50/30 border border-rose-200/60 p-5 rounded-2xl text-left shadow-sm">
          <div className="flex items-center gap-2.5 text-rose-800">
            <AlertCircle size={18} className="text-rose-600" />
            <h3 className="text-sm font-bold">需关注的发育落后风险</h3>
          </div>
          <div className="text-2xl font-bold font-sans text-rose-700 mt-2.5">
            {completedScores.filter(s => s.status === 'delay').length} 个维度
          </div>
          <p className="text-[11px] text-brand-charcoal/85 mt-1">占比约 {calculateStatusPercentage('delay')}%，强烈推荐进行深度特训</p>
        </div>
      </div>

      {/* AI neural network generator gate (Brain/Synapse animation) - Moved above detail table & compacted */}
      <div className="bg-brand-forest text-white rounded-2xl p-4 md:p-5 shadow-lg relative overflow-hidden text-left">
        {/* Abstract cyber backdrop */}
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-forest to-brand-moss opacity-95" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand-sage/10 rounded-full blur-2xl animate-pulse" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-full">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-moss to-brand-clay rounded-xl flex items-center justify-center shadow-md shrink-0">
              <Brain className={`${loading ? 'animate-spin' : ''} text-white`} size={20} />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold font-sans flex items-center gap-1.5">
                {PRODUCT.brand.reportTitle}
                <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-brand-sage/20 border border-brand-sage/30 text-[9px] font-bold text-brand-sage">
                  <Sparkles size={8} /> 脑发育前额叶机制算法
                </span>
              </h2>
              <p className="text-[11px] text-brand-cream/80 max-w-xl">
                结合 9 维神经网络，由 康复AI多模 机制算法计算，输出综合发育程度评价、神经网络发育解析、动作/感统训练建议及居家互动方案。
              </p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-stretch md:items-end gap-1.5">
            {!aiReport ? (
              <button
                id="ai-report-trigger-btn"
                disabled={loading}
                onClick={handleGenerateReport}
                className="px-5 py-2.5 bg-brand-moss hover:bg-brand-moss/90 border border-brand-sage/20 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? '神经网络解析中...' : '一键启动 AI 突触分析'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="re-evaluate-btn"
                  onClick={handleGenerateReport}
                  className="px-3.5 py-2 bg-brand-cream/10 hover:bg-brand-cream/20 border border-brand-cream/20 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  重新评估
                </button>
                <button
                  id="print-report-btn"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-brand-moss hover:bg-brand-moss/95 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <Printer size={12} />
                  打印报告
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="relative z-10 mt-3 p-2.5 bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Dimensions Detail - 3x3 Grid (九宫格) */}
      {!aiReport && (
        <div className="bg-white rounded-3xl border border-brand-stone p-6 md:p-8 shadow-sm text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-brand-forest">9 维度评估结果明细</h3>
              <p className="text-xs text-brand-charcoal/60 mt-1">精细化脑网络评测数据，直观展示多维神经网络发育的均衡性</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {DIMENSIONS_DATA.map((dim) => {
              const score = completedScores.find(s => s.dimensionId === dim.id);
              if (!score) return null;

              return (
                <div 
                  key={dim.id} 
                  className="relative overflow-hidden bg-white border border-brand-stone/70 rounded-2xl p-5 hover:translate-y-[-2px] hover:shadow-md transition duration-200 flex flex-col justify-between"
                >
                  {/* Color Accent Top Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${dim.color.split(' ')[0]}`} />

                  <div className="space-y-4">
                    {/* Header: Icon, Name & Level */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl text-xs font-bold shrink-0 ${dim.color}`}>
                          <IconComponent name={dim.iconName} size={15} />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-brand-forest leading-tight">{dim.name}</h4>
                          <span className="text-[10px] text-brand-charcoal/50 font-medium">
                            {score.tierId === 'T1' ? 'T1 评估层' : score.tierId === 'T2' ? 'T2 问卷层' : 'T3 评估层'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Score display */}
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-brand-forest leading-none">
                          {score.score} <span className="text-brand-charcoal/40 text-[10px] font-normal">/ {score.maxScore}</span>
                        </p>
                        <p className="text-[9px] text-brand-charcoal/40 mt-0.5">得分</p>
                      </div>
                    </div>

                    {/* Score Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-brand-cream/50 rounded-full overflow-hidden border border-brand-stone/30">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${Math.min(100, Math.max(0, (score.score / score.maxScore) * 100))}%`,
                            backgroundColor: score.status === 'normal' ? '#5f7161' : score.status === 'borderline' ? '#cda07c' : '#e11d48' 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-4 pt-3 border-t border-brand-cream/50 flex flex-col gap-2">
                    <div className={`flex items-center justify-center gap-1.5 py-1 px-3 rounded-xl text-[10px] font-extrabold border w-full text-center ${
                      score.status === 'normal' ? 'bg-brand-sage/20 text-brand-forest border-brand-moss/20' :
                      score.status === 'borderline' ? 'bg-brand-sand text-brand-clay border-brand-clay/30 animate-pulse' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        score.status === 'normal' ? 'bg-brand-forest' :
                        score.status === 'borderline' ? 'bg-brand-clay' :
                        'bg-rose-600'
                      }`} />
                      {score.status === 'normal' ? '健康普通' : score.status === 'borderline' ? '临界/关注' : '落后风险偏高'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive AI report outputs */}
      {aiReport && (
        <div className="space-y-8 animate-fade-in text-left bg-white rounded-3xl border border-brand-stone shadow-sm overflow-hidden p-6 md:p-8">
          
          {/* Diagnostic top header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-cream pb-5 mb-6">
            <div>
              <div className="flex items-center gap-2 text-brand-moss font-bold text-xs uppercase tracking-wider">
                <Award size={14} />
                {isAiGenerated ? '神经网络康复AI大模型生成' : '深度特型匹配知识库组装'}
              </div>
              <h2 className="text-xl font-bold text-brand-forest mt-1">儿童综合发展评估报告</h2>
            </div>
            <span className="text-[10px] text-brand-charcoal/50 text-right">监测号: SXK-{Date.now().toString().slice(-6)}</span>
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
          {(() => {
            const redNames = completedScores
              .filter(s => toConcernScore(s.score, s.maxScore) >= 5)
              .map(s => s.dimensionName);
            const yellowNames = completedScores
              .filter(s => {
                const c = toConcernScore(s.score, s.maxScore);
                return c >= 3 && c <= 4;
              })
              .map(s => s.dimensionName);
            
            if (redNames.length === 0 && yellowNames.length === 0) {
              return (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-xs font-semibold leading-relaxed">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    建议维持当前的常规评估观察。本次评估结果显示所有 9 项发育领域表现大致良好，神经系统联动与行为适应能力发育平衡，请配合日常亲子伴读及益智活动继续保持。
                  </div>
                </div>
              );
            }

            return (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl flex items-start gap-3 text-xs leading-relaxed font-medium">
                <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-bold text-rose-800">{PRODUCT.nextStep.alertText}</span>
                  本次评估在{' '}
                  {redNames.length > 0 && (
                    <>
                      <span className="font-bold text-rose-600">{redNames.join('、')}</span>{' '}
                      显示明显<span className="font-bold text-rose-600">需关注</span>
                    </>
                  )}
                  {redNames.length > 0 && yellowNames.length > 0 && '，另有 '}
                  {yellowNames.length > 0 && (
                    <>
                      <span className="font-bold text-amber-600">{yellowNames.join('、')}</span>{' '}
                      <span className="font-bold text-amber-600">需留意</span>
                    </>
                  )}
                  。
                </div>
              </div>
            );
          })()}

          {/* SECTION 2: 9宫格明细 */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
                <Layers size={15} className="text-brand-moss" />
                9 维度评估结果明细
              </h3>
              <p className="text-[10px] text-brand-charcoal/50 mt-0.5">条形图代表该领域的「关注分」（0-8分，分数越高越需关注）</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {DIMENSIONS_DATA.map((dim) => {
                const score = completedScores.find(s => s.dimensionId === dim.id);
                if (!score) return null;
                const concernScore = toConcernScore(score.score, score.maxScore);
                let statusBadge = "大致良好";
                let badgeClass = "bg-emerald-50 border-emerald-200 text-emerald-700";
                let fillClass = "bg-emerald-500";
                let actionText = "继续观察";
                let actionClass = "text-emerald-600";

                if (concernScore >= 5) {
                  statusBadge = "需关注";
                  badgeClass = "bg-rose-50 border-rose-200 text-rose-700 font-bold";
                  fillClass = "bg-rose-500";
                  actionText = PRODUCT.nextStep.actionLabelHigh;
                  actionClass = "text-rose-600 font-bold";
                } else if (concernScore >= 3) {
                  statusBadge = "需留意";
                  badgeClass = "bg-amber-50 border-amber-200 text-amber-700 font-bold";
                  fillClass = "bg-amber-500";
                  actionText = PRODUCT.nextStep.actionLabelMedium;
                  actionClass = "text-amber-600 font-bold";
                }

                return (
                  <div key={dim.id} className="relative overflow-hidden bg-white border border-brand-stone/70 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <div className={`absolute top-0 left-0 right-0 h-1 ${concernScore >= 5 ? 'bg-rose-500' : concernScore >= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-forest">{dim.name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border ${badgeClass}`}>{statusBadge}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-brand-charcoal/70">
                        <span>关注分: <strong className="font-extrabold">{concernScore}</strong> / 8</span>
                        <span className={`text-[9px] ${actionClass}`}>{actionText} →</span>
                      </div>

                      <div className="w-full h-1.5 bg-brand-cream/50 rounded-full overflow-hidden border border-brand-stone/30">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${fillClass}`} 
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
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 大致良好 (继续观察)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 需留意 ({PRODUCT.nextStep.legendAttentionHint})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 需关注 ({PRODUCT.nextStep.legendConcernHint})
              </span>
            </div>
          </div>

          {/* SECTION 3: 重点问题标注 KEY FINDINGS - 雷达图 */}
          {(() => {
            const sortedScores = [...completedScores]
              .map(s => {
                const concernScore = toConcernScore(s.score, s.maxScore);
                let severityLabel = "大致良好";
                let severityColor = "bg-emerald-500 text-white";
                let severityVal = 1;

                if (concernScore >= 6) {
                  severityLabel = "需重点关注";
                  severityColor = "bg-rose-600 text-white";
                  severityVal = 4;
                } else if (concernScore === 5) {
                  severityLabel = "需关注";
                  severityColor = "bg-amber-500 text-white";
                  severityVal = 3;
                } else if (concernScore >= 3) {
                  severityLabel = "临界";
                  severityColor = "bg-amber-400 text-brand-charcoal";
                  severityVal = 2;
                }

                return {
                  ...s,
                  concernScore,
                  severityLabel,
                  severityColor,
                  severityVal
                };
              })
              .sort((a, b) => b.concernScore - a.concernScore || b.severityVal - a.severityVal);

            const redCount = sortedScores.filter(s => s.concernScore >= 5).length;
            const yellowCount = sortedScores.filter(s => s.concernScore >= 3 && s.concernScore <= 4).length;
            const attentionCount = redCount + yellowCount;

            // 雷达图参数
            const cx = 160, cy = 160, maxR = 120;
            const axes = sortedScores.length;
            const angleStep = (2 * Math.PI) / axes;

            // 计算每个维度的坐标点
            const getPoint = (index: number, value: number, maxVal: number = 8) => {
              const angle = angleStep * index - Math.PI / 2;
              // 限制值在 0 到 maxVal 之间，防止负分或超分导致图表变形
              const clampedValue = Math.max(0, Math.min(value, maxVal));
              const r = (clampedValue / maxVal) * maxR;
              return {
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle)
              };
            };

            // 生成数据多边形路径
            const dataPath = sortedScores
              .map((s, i) => {
                const pt = getPoint(i, s.concernScore);
                return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
              })
              .join(' ') + ' Z';

            // 生成网格路径（5层）
            const gridLevels = [2, 4, 6, 8];
            const gridPaths = gridLevels.map(level =>
              sortedScores
                .map((_, i) => {
                  const pt = getPoint(i, level);
                  return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
                })
                .join(' ') + ' Z'
            );

            // 根据严重程度获取颜色
            const getSeverityColor = (concernScore: number) => {
              if (concernScore >= 6) return '#e11d48'; // rose-600
              if (concernScore === 5) return '#f59e0b'; // amber-500
              if (concernScore >= 3) return '#fbbf24'; // amber-400
              return '#10b981'; // emerald-500
            };

            // 计算多边形填充颜色（取最严重的颜色）
            const maxConcern = Math.max(...sortedScores.map(s => s.concernScore));
            const polygonColor = getSeverityColor(maxConcern);

            return (
              <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
                <div className="border-b border-brand-cream pb-2.5">
                  <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
                    <ClipboardCheck size={15} className="text-brand-moss" />
                    9 大维度结论 —— 雷达图分析
                  </h3>
                  <p className="text-[10px] text-brand-charcoal/50 mt-0.5">
                    共评测 9 项发育维度，检测到 <span className="font-bold text-rose-600">{attentionCount} 项</span> 需留意/关注领域（其中 <span className="font-bold text-rose-600">{redCount} 项</span> 需重点关注）
                  </p>
                </div>

                {/* 雷达图 */}
                <div className="flex justify-center">
                  <svg width="320" height="320" viewBox="0 0 320 320" className="overflow-visible">
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
                        <line
                          key={`axis-${i}`}
                          x1={cx}
                          y1={cy}
                          x2={pt.x}
                          y2={pt.y}
                          stroke="#d1d5db"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* 数据多边形 */}
                    <path
                      d={dataPath}
                      fill={`${polygonColor}20`}
                      stroke={polygonColor}
                      strokeWidth="2"
                    />

                    {/* 数据点 */}
                    {sortedScores.map((s, i) => {
                      const pt = getPoint(i, s.concernScore);
                      const color = getSeverityColor(s.concernScore);
                      return (
                        <g key={`point-${i}`}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="4"
                            fill={color}
                            stroke="white"
                            strokeWidth="2"
                          />
                          {/* 数值标签 */}
                          <text
                            x={pt.x}
                            y={pt.y - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="bold"
                            fill={color}
                          >
                            {s.concernScore}
                          </text>
                        </g>
                      );
                    })}

                    {/* 维度标签 */}
                    {sortedScores.map((s, i) => {
                      const pt = getPoint(i, 8);
                      const angle = angleStep * i - Math.PI / 2;
                      const labelR = maxR + 25;
                      const lx = cx + labelR * Math.cos(angle);
                      const ly = cy + labelR * Math.sin(angle);
                      
                      // 调整文本锚点
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

                {/* 图例 */}
                <div className="flex flex-wrap justify-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-600"></div>
                    <span className="text-brand-charcoal/70">需重点关注 (≥6)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                    <span className="text-brand-charcoal/70">需关注 (5)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                    <span className="text-brand-charcoal/70">临界 (3-4)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-brand-charcoal/70">大致良好 (≤2)</span>
                  </div>
                </div>

                {/* 详细列表 */}
                <div className="border-t border-brand-cream pt-3 space-y-2">
                  <p className="text-[10px] font-bold text-brand-charcoal/60 text-center">各维度关注分详情</p>
                  <div className="grid grid-cols-3 gap-2">
                    {sortedScores.map((item) => (
                      <div
                        key={`${item.dimensionId}-${item.tierId}`}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] ${
                          item.concernScore >= 5 ? 'bg-rose-50/30' :
                          item.concernScore >= 3 ? 'bg-amber-50/30' :
                          'bg-emerald-50/30'
                        }`}
                      >
                        <span className="font-medium text-brand-charcoal/80 truncate">{item.dimensionName}</span>
                        <span className={`font-bold ml-1 ${
                          item.concernScore >= 5 ? 'text-rose-600' :
                          item.concernScore >= 3 ? 'text-amber-600' :
                          'text-emerald-600'
                        }`}>
                          {item.concernScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/*
            語言專項評估的入口。
            這個元件（2,388 行）先前**全庫沒有任何按鈕能開啟它** —— `onGoToLanguageSpecial`
            宣告了卻沒有任何地方渲染。專案 B 不會收到這個 prop（`features.tier2And3`
            為 false），付費未解鎖時 App 會把這個動作導向付費牆。
            只在語言維度被標記時出現：發育正常的孩子不需要被推銷一次錄音評測。
          */}
          {onGoToLanguageSpecial && hasLanguageIssue && (
            <div className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 shadow-sm text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
                    <Mic size={10} /> 语言溝通 · 专项深测
                  </span>
                  <h3 className="text-sm font-extrabold text-brand-forest">
                    语言沟通为{languageScore?.status === 'delay' ? '迟缓风险' : '临界待测'}，建议进行言语专项录音评测
                  </h3>
                  <p className="text-[11px] text-brand-charcoal/70 leading-relaxed max-w-2xl">
                    依孩子月龄匹配语音题目，由孩子跟读、系统进行语音识别与构音判读，输出声学剖析、干预目标与一周言语训练课表。
                  </p>
                </div>
                <button
                  onClick={onGoToLanguageSpecial}
                  className="px-5 py-3 bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-extrabold rounded-xl shadow-md shadow-brand-moss/20 transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                >
                  进入语言专项评估
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* New Visual Section 1: Overall Peer Development Level Comparison (Inspired by Attachment) */}
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
                  居同龄前 {100 - (completedScores.reduce((acc, score) => acc + (score.score / score.maxScore) * 100, 0) / completedScores.length > 0 ? Math.round(completedScores.reduce((acc, score) => acc + (score.score / score.maxScore) * 100, 0) / completedScores.length) : 50)}%
                </span>
              </div>

              {/* Segmented color track with red vertical pointer indicator */}
              <div className="relative w-full h-5 rounded-full overflow-hidden flex border border-brand-stone/50 shadow-inner">
                <div className="w-1/4 h-full bg-rose-200" title="需要干预" />
                <div className="w-1/4 h-full bg-orange-100" title="稍低于平均" />
                <div className="w-1/4 h-full bg-amber-50" title="平均水平" />
                <div className="w-1/4 h-full bg-emerald-100" title="高于平均" />
                
                {/* Visual red pointer indicator bar */}
                <div 
                  className="absolute top-0 bottom-0 w-1.5 bg-rose-600 shadow-lg shadow-rose-600/30 transition-all duration-1000"
                  style={{ 
                    left: `${completedScores.length > 0 ? Math.round(completedScores.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / completedScores.length) : 50}%`,
                    transform: 'translateX(-50%)' 
                  }}
                />
              </div>

              {/* Labels matching attachment */}
              <div className="flex justify-between text-[10px] text-brand-charcoal/80 font-bold px-1 mt-2">
                <span className="w-1/4 text-center">需要干预</span>
                <span className="w-1/4 text-center">稍低于平均</span>
                <span className="w-1/4 text-center">平均水平</span>
                <span className="w-1/4 text-center">高于平均</span>
              </div>
            </div>

            <div className="bg-brand-sage/10 p-3 rounded-xl border border-brand-moss/20 text-xs text-brand-charcoal leading-relaxed font-semibold">
              💡 {(() => {
                const totalPct = completedScores.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0);
                const avgPct = completedScores.length > 0 ? Math.round(totalPct / completedScores.length) : 50;
                if (avgPct < 40) {
                  return `您的孩子 (${child.name}) 整体发育进度相对滞后，处于偏弱区间。推荐重点跟进最下方制定的 7日感官训练行事历，及预约线上专家一对一指导。`;
                } else if (avgPct < 70) {
                  return `您的孩子 (${child.name}) 整体发育进度处于中等稍弱水平。部分脑网络突触传递尚有边缘滞后，多进行互动OT实操与居家共读有助于极快提升。`;
                } else if (avgPct < 85) {
                  return `您的孩子 (${child.name}) 整体发育处于同龄人平均水平偏上。在大部分测验维度中表现良好，通过针对性轻度干预可巩固优势。`;
                } else {
                  return `您的孩子 (${child.name}) 发育进度整体处于高于平均的优良状态！前额叶认知网络可塑性极佳，脑网络连接协同效率突出。`;
                }
              })()}
            </div>
          </div>

          {/* 1. Circular Dial Gauges for Critical Brain Indices */}
          <IntegrationGauges criticalMetrics={aiReport.criticalMetrics} />

          {/* 2. Interactive Synaptic Connection Topology Diagram & Pathway Analysis */}
          {/*
            拓撲圖底下原本還有一段「脑突触剪切与微环路协同性分析」總覽敘述，
            依客戶需求移除 —— 那段是寫給臨床看的神經生理術語，家長讀不出行動。
            `aiReport.neuralPathwayAnalysis` 仍由後端產生並保留在型別裡，只是不再渲染。
          */}
          <div className="space-y-4">
            <NeuralNetworkTopology completedScores={completedScores} />
          </div>

          {/* 4. Smooth trajectory 3-month forecast line-graph & Prognosis Narrative */}
          <div className="space-y-4">
            <PrognosisTrajectoryChart completedScores={completedScores} />

            <div className="bg-brand-sand/50 p-4 rounded-2xl border border-brand-stone/60 text-left">
              <span className="text-[10px] font-bold text-brand-clay uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Compass size={11} className="text-brand-clay" />
                脑发育预后轨迹预测与家属指导指引:
              </span>
              <p className="text-xs text-brand-charcoal leading-relaxed font-semibold">
                {aiReport.prognosisPrediction}
              </p>
            </div>
          </div>

          {/* 3. Gamified Weekly Sensori-Motor Training Calendar - MOVED TO THE BOTTOM AS REQUESTED */}
          <div className="space-y-4 pt-4 border-t border-brand-cream/80">
            <WeeklyRehabPlanner rehabSuggestions={aiReport.rehabSuggestions} homeGuidance={aiReport.homeGuidance} />
            
            {/*
              沒有可預約的專家時，這裡**不出現空白的預約區塊**，而是說清楚為什麼。
              一顆按不出東西的「立即預約」比沒有按鈕更糟：家長會以為是自己操作錯了。
            */}
            {specialists.length === 0 ? (
              <div ref={bookingSectionRef} className="bg-brand-cream/30 border border-brand-stone rounded-3xl p-6 mt-6 text-left space-y-2">
                <h3 className="text-sm font-bold text-brand-forest">
                  {emptySpecialistsMessage(specialistsReason).title}
                </h3>
                {emptySpecialistsMessage(specialistsReason).body && (
                  <p className="text-xs text-brand-charcoal/70 leading-relaxed max-w-xl">
                    {emptySpecialistsMessage(specialistsReason).body}
                  </p>
                )}
              </div>
            ) : (
            /* Highly visual Online Appointment Booking CTA card */
            <div ref={bookingSectionRef} className="bg-gradient-to-r from-brand-forest to-brand-moss text-white rounded-3xl p-6 shadow-md relative overflow-hidden mt-6 text-left">
              <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none" />
              <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-brand-sage/20 rounded-full blur-2xl" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="space-y-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-sage/30 text-[10px] font-bold text-brand-sage inline-block uppercase tracking-wider">
                    ⭐ 线上发育辅导连通系统
                  </span>
                  <h3 className="text-lg font-bold">线上预约 1对1 脑发育与感统指导专家说明指导</h3>
                  <p className="text-xs text-brand-cream/90 max-w-xl leading-relaxed">
                    基于本次 AI 九维评估报告，特邀三甲儿童发展评估专家提供在线可视化深度辅导，为您量身解密大脑特定环路发育，指导日常脑机及多媒体工具实操。
                  </p>
                </div>

                <button
                  onClick={() => {
                    // 滚动到预约模块并居中
                    if (bookingSectionRef.current) {
                      bookingSectionRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                      });
                    }
                    // 延迟打开弹窗，等待滚动完成
                    setTimeout(() => {
                      setParentName('');
                      setParentPhone('');
                      setBookingStatus('idle');
                      setBookingError('');
                      setSelectedSlot('');
                      setShowBookingModal(true);
                    }, 400);
                  }}
                  className="px-6 py-3 bg-brand-sage text-brand-forest font-bold text-xs rounded-xl hover:bg-white transition duration-200 shadow-lg shrink-0 w-full md:w-auto text-center active:scale-95 cursor-pointer"
                >
                  立即连线预约说明
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Specialist Booking Modal Dialog */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-brand-stone shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up text-left">
            {/* Header */}
            <div className="bg-brand-forest text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Calendar size={16} /> 线上专家 1对1 发展说明指导预约
                </h3>
                <p className="text-[10px] text-brand-cream/80 mt-0.5">连线三甲儿童发展专家，多维解读评估指标</p>
              </div>
              <button 
                onClick={() => setShowBookingModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {bookingStatus === 'idle' ? (
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Step 1: Select Specialist */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold text-brand-forest block uppercase tracking-wider">
                    第一步: 选择特邀专家成员
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {specialists.map((spec) => {
                      const isSelected = selectedSpecialist === spec.id;
                      return (
                        <div
                          key={spec.id}
                          onClick={() => {
                            setSelectedSpecialist(spec.id);
                            setSelectedSlot('');
                          }}
                          className={`p-3 rounded-2xl border transition duration-200 cursor-pointer flex flex-col items-center text-center space-y-2 ${
                            isSelected
                              ? 'border-brand-moss bg-brand-sage/10 ring-1 ring-brand-moss/30 shadow-sm'
                              : 'border-brand-stone hover:bg-brand-cream/20'
                          }`}
                        >
                          <SpecialistAvatar spec={spec} size={48} />
                          <div>
                            <h4 className="text-xs font-bold text-brand-forest">{spec.name}</h4>
                            {spec.title && (
                              <span className="text-[8px] text-brand-charcoal/60 leading-none block mt-0.5">{spec.title}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Specialist Detail Card */}
                {currentSpecialist && (currentSpecialist.specialty || currentSpecialist.experience) && (
                  <div className="bg-brand-cream/20 border border-brand-stone/60 rounded-2xl p-4 space-y-2 text-xs">
                    {currentSpecialist.specialty && (
                      <div>
                        <span className="text-[10px] font-bold text-brand-moss block">专家执业专长:</span>
                        <p className="text-brand-charcoal leading-relaxed">{currentSpecialist.specialty}</p>
                      </div>
                    )}
                    {currentSpecialist.experience && (
                      <div>
                        <span className="text-[10px] font-bold text-brand-clay block">学术及评估背景:</span>
                        <p className="text-brand-charcoal/80">{currentSpecialist.experience}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Select Date & Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-brand-forest block uppercase tracking-wider">
                      第二步: 选择预约说明日期
                    </label>
                    <input 
                      type="date" 
                      value={bookingDate}
                      min={bookingWindow.min}
                      max={bookingWindow.max}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full p-2.5 bg-brand-cream/20 border border-brand-stone/80 rounded-xl text-xs text-brand-charcoal font-semibold focus:outline-none focus:border-brand-forest"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-brand-forest block uppercase tracking-wider">
                      第三步: 选择专家的出诊班次
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {currentSpecialist && currentSpecialist.slots.length === 0 && (
                        <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">
                          这位专家尚未开放可预约的时段，请改选其他专家，或直接与机构联系。
                        </p>
                      )}
                      {currentSpecialist?.slots.map((slot) => {
                        const isSlotSelected = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition ${
                              isSlotSelected
                                ? 'bg-brand-forest text-white border-brand-forest'
                                : 'bg-white text-brand-charcoal border-brand-stone/80 hover:bg-brand-cream/35'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Step 3: Contact details */}
                <div className="space-y-3 pt-3 border-t border-brand-cream">
                  <span className="text-[11px] font-bold text-brand-forest block uppercase tracking-wider">
                    第四步: 完善家长联系资料
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-brand-charcoal/70">家长姓名</span>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-charcoal/40" size={13} />
                        <input 
                          type="text" 
                          placeholder="请输入家长/监护人姓名"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-brand-cream/20 border border-brand-stone/80 rounded-xl text-xs focus:outline-none focus:border-brand-forest text-brand-charcoal"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-brand-charcoal/70">联系手机</span>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-charcoal/40" size={13} />
                        <input 
                          type="tel" 
                          placeholder="请输入 11 位手机号码"
                          value={parentPhone}
                          onChange={(e) => setParentPhone(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-brand-cream/20 border border-brand-stone/80 rounded-xl text-xs focus:outline-none focus:border-brand-forest text-brand-charcoal"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Booking confirmation action */}
                {bookingError && (
                  <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-relaxed">
                    {bookingError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!currentSpecialist || !selectedSlot || !parentName.trim() || !parentPhone.trim() || bookingSubmitting}
                  onClick={handleSubmitBooking}
                  className="w-full py-3 bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-bold rounded-xl transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {bookingSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      正在提交预约...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      确认并预约专家说明
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Success Receipts - Ticket Style */
              <div className="p-8 text-center space-y-6 overflow-y-auto flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-brand-sage/30 flex items-center justify-center text-brand-forest animate-bounce">
                  <CheckCircle2 size={36} className="text-brand-moss" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-brand-forest">专家预约成功确认书</h4>
                  <p className="text-[11px] text-brand-charcoal/50">预约成功编号: RSV-SXK-{Date.now().toString().slice(-6)}</p>
                </div>

                {/* Decorative Ticket Details */}
                <div className="max-w-md w-full border border-dashed border-brand-stone bg-brand-cream/10 rounded-2xl p-4 text-xs text-brand-charcoal text-left space-y-2 relative">
                  {/* Left & Right punch holes */}
                  <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-r border-brand-stone/40" />
                  <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-l border-brand-stone/40" />

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-b border-brand-stone/30 pb-2">
                    <div>
                      <span className="text-[9px] text-brand-charcoal/50 block">预定专家:</span>
                      <span className="font-bold text-brand-forest">
                        {currentSpecialist?.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-brand-charcoal/50 block">出诊职称:</span>
                      <span className="font-bold text-brand-forest">
                        {currentSpecialist?.title?.split(' ')[0] ?? '—'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-1">
                    <div>
                      <span className="text-[9px] text-brand-charcoal/50 block">预约说明时段:</span>
                      <span className="font-extrabold text-brand-clay font-mono">{bookingDate} {selectedSlot}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-brand-charcoal/50 block">受测儿档案:</span>
                      <span className="font-bold text-brand-forest">{reportChild.name} ({formatAge(reportChild.ageMonth)})</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-brand-charcoal/50 block">联系家长:</span>
                      <span className="font-semibold text-brand-charcoal">{parentName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-brand-charcoal/50 block">预留手机:</span>
                      <span className="font-mono text-brand-charcoal">{parentPhone}</span>
                    </div>
                  </div>
                </div>

                {/* Guidance Text */}
                <p className="text-xs text-brand-charcoal/80 max-w-md leading-relaxed bg-brand-sage/10 p-3.5 rounded-2xl border border-brand-moss/20">
                  <strong>💡 预约后指引:</strong> 咨询通道已自动预留。专家专属评估顾问将在 <strong>10 分钟内</strong> 进行电话回访，向您同步视频咨询室入口，并为您预备本次测评的纸质脑图解析手册。请保持电话畅通。
                </p>

                {/* 轉接微信客服：電話回訪之外的第二條路。家長多半更習慣微信，
                    而且工作人員的通知管道若有延遲，這裡讓家長能主動找上來。 */}
                {/*
                  二維碼或微信號，有一個就顯示這整塊。
                  原本只看 wechatId —— 有了真實二維碼但沒有微信號時整塊會消失，
                  而二維碼本身就足以完成轉接。
                */}
                {(PRODUCT.expertBooking.wechatId || PRODUCT.expertBooking.wechatQrSrc) && (
                  <div className="max-w-md w-full bg-white border border-brand-stone rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-brand-forest">
                      <QrCode size={14} />
                      也可以直接加微信客服
                    </div>
                    {PRODUCT.expertBooking.wechatQrSrc ? (
                      <img
                        src={PRODUCT.expertBooking.wechatQrSrc}
                        alt="微信客服二维码"
                        className="w-36 h-36 mx-auto rounded-xl border border-brand-stone/60"
                      />
                    ) : (
                      <div className="w-36 h-36 mx-auto rounded-xl border border-dashed border-brand-stone/60 flex items-center justify-center text-[10px] text-brand-charcoal/40 text-center px-3 leading-relaxed">
                        客服二维码
                        <br />
                        待上传
                      </div>
                    )}
                    <p className="text-[11px] text-brand-charcoal/70 text-center leading-relaxed">
                      {PRODUCT.expertBooking.wechatId && (
                        <>
                          微信号：
                          <span className="font-mono font-bold text-brand-forest select-all">
                            {PRODUCT.expertBooking.wechatId}
                          </span>
                          <br />
                        </>
                      )}
                      添加后请说明「已预约专家说明」，客服会为您衔接。
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-8 py-2.5 bg-brand-forest hover:bg-brand-moss text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                >
                  确 定
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

