import React, { useState, useEffect, useRef } from 'react';
import { Child, DimensionScore, AssessmentRecord } from '../types';
import { formatAge } from '../utils/dateUtils';
import { 
  ArrowLeft, Brain, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, 
  RefreshCw, Layers, ShieldAlert, Award, Compass, HeartHandshake, Printer,
  Activity, MessageSquare, Smile, BookOpen, Target, Home, Heart, Calendar, User, Phone, Check, Info,
  ClipboardCheck, ArrowRight, Loader2, QrCode, Mic, ChevronRight
} from 'lucide-react';
import { DIMENSIONS_DATA } from '../data';
import { DIMENSION_DETAILS } from '../dimensionContent';
import { PRODUCT } from '../productConfig';
import { peekDeviceId } from '../utils/deviceId';
import { 
  IntegrationGauges, NeuralNetworkTopology, WeeklyRehabPlanner, PrognosisTrajectoryChart 
} from './ReportCharts';

const SPECIALISTS = [
  {
    id: 'spec-1',
    name: '王素娟',
    title: '儿童专科医院 副主任医师',
    avatar: '/expert-wang.jpg',
    specialty: '儿童脑瘫的系统管理与康复、脑损伤后遗症的全面康复干预、高危新生儿的长期随访与发育监测、学习障碍、阅读障碍、书写障碍等发育障碍的康复治疗。',
    experience: '从业30年，复旦大学附属儿科医院，中国康复医学会康复评定专委会委员，中国妇幼保健协会高危儿专业委员',
    slots: ['周四上午', '周五下午', '周六上午']
  },
  {
    id: 'spec-2',
    name: '何明哲',
    title: '国家合格康复督导师',
    avatar: '/expert-he.jpg',
    specialty: '儿童作业、心理、多动症、自闭症、学习障碍、言语功能等干预训练，儿童发育迟缓调整训练。',
    experience: '从业20年，中国台湾大学职能治疗学系，台北护理大学语言治疗病理学硕士，森心康儿童康复品牌康复质量管理部负责人，上海星晨儿童医院（暨复旦大学附设儿科医院新虹桥分院）康复科督导',
    slots: ['周一上午', '周二下午', '周三上午']
  },
  {
    id: 'spec-3',
    name: '张厚亮',
    title: '神经内科医学博士、院长',
    avatar: '/expert-zhang.png',
    specialty: '神经内科医学、脑神经专家、神经内科疑难杂症干细胞修复治疗、功能医学辅助神经康复。',
    experience: '26 年神经系统疾病临床诊疗经验，美年大健康门诊部院长，华山医院神经内科、中心医院神经内科、上海新起点康复医院副院长',
    slots: ['周三上午', '周五上午', '周日上午']
  }
];

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

  useEffect(() => {
    if (historicalRecord && historicalRecord.aiReport) {
      setAiReport(historicalRecord.aiReport);
      // 舊紀錄沒有 isAiGenerated 欄位，此時來源不明，不能預設成 AI 生成
      setIsAiGenerated(historicalRecord.isAiGenerated ?? null);
    }
  }, [historicalRecord]);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>('spec-1');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('2026-07-13');
  const [parentName, setParentName] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'success'>('idle');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [activePill, setActivePill] = useState<string | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);
  const bookingSectionRef = useRef<HTMLDivElement>(null);

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
          specialistName: SPECIALISTS.find(s => s.id === selectedSpecialist)?.name,
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
          childAgeMonth: child.ageMonth,
          childGender: child.gender,
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
          受测儿档案：{child.name} ({child.gender === 'boy' ? '男' : '女'}) | {formatAge(child.ageMonth)}
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
                森心康 AI 神经网络分层评估报告生成器
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
              <h2 className="text-xl font-bold text-brand-forest mt-1">T1 综合发展评估报告</h2>
            </div>
            <span className="text-[10px] text-brand-charcoal/50 text-right">监测号: SXK-{Date.now().toString().slice(-6)}</span>
          </div>

          {/* AI One-Sentence Summary */}
          <div className="bg-brand-sage/35 p-4.5 rounded-2xl border border-brand-stone/40">
            <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5 mb-1.5">
              <Compass size={14} /> 首席核心发育建议:
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
                  actionText = PRODUCT.nextStep.actionLabel;
                  actionClass = "text-rose-600 font-bold";
                } else if (concernScore >= 3) {
                  statusBadge = "需留意";
                  badgeClass = "bg-amber-50 border-amber-200 text-amber-700 font-bold";
                  fillClass = "bg-amber-500";
                  actionText = PRODUCT.nextStep.actionLabel;
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
                    重点问题标注 Key Findings - 雷达图分析
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

          {/* SECTION 4: 标记领域说明（標題與建議量表區塊依 productConfig 切換） */}
          <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
            <div className="border-b border-brand-cream pb-2.5">
              <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
                <BookOpen size={15} className="text-brand-moss" />
                {PRODUCT.markedAreaSection.title}
              </h3>
              <p className="text-[10px] text-brand-charcoal/50 mt-0.5">{PRODUCT.markedAreaSection.subtitle}</p>
            </div>

            <div className="space-y-4">
              {(() => {
                const filtered = DIMENSIONS_DATA.map(dim => {
                  const s = completedScores.find(score => score.dimensionId === dim.id);
                  const concernScore = s ? toConcernScore(s.score, s.maxScore) : 0;
                  return { dim, s, concernScore };
                });

                const attentionItems = filtered.filter(item => item.concernScore >= 3);
                const itemsToRender = showAllDomains || attentionItems.length === 0 ? filtered : attentionItems;

                return (
                  <>
                    {itemsToRender.map(({ dim, s, concernScore }) => {
                      const details = DIMENSION_DETAILS[dim.id];
                      if (!details) return null;

                      let statusLabel = "大致良好";
                      let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      if (concernScore >= 5) {
                        statusLabel = "需关注";
                        badgeStyle = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
                      } else if (concernScore >= 3) {
                        statusLabel = "需留意";
                        badgeStyle = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                      }

                      return (
                        <div key={dim.id} className="p-4 bg-brand-cream/5 border border-brand-stone/70 rounded-2xl space-y-3.5 shadow-sm hover:border-brand-moss/40 transition">
                          <div className="flex items-center justify-between border-b border-brand-cream/40 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-brand-forest">{dim.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${badgeStyle}`}>{statusLabel}</span>
                            </div>
                            <span className="text-xs font-bold text-brand-forest/80">关注分: <strong className="text-brand-forest font-extrabold">{concernScore}</strong> / 8</span>
                          </div>

                          <div className="text-xs space-y-2.5">
                            <div>
                              <span className="font-bold text-brand-forest block text-[11px] mb-0.5">💡 这项能力:</span>
                              <p className="text-brand-charcoal/80 leading-relaxed text-[11px]">{details.ability}</p>
                            </div>
                            <div>
                              <span className="font-bold text-brand-forest block text-[11px] mb-0.5">🏡 家庭观察与居家干预建议:</span>
                              <p className="text-brand-charcoal/80 leading-relaxed text-[11px]">{details.familyAdvice}</p>
                            </div>
                            {PRODUCT.markedAreaSection.scalesLabel !== null && (
                              <div>
                                <span className="font-bold text-brand-moss block text-[11px] mb-1.5">{PRODUCT.markedAreaSection.scalesLabel}</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {details.scales.map((scale, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="px-2.5 py-1 bg-brand-sage/10 text-brand-forest border border-brand-moss/20 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-brand-sage/20 transition cursor-default"
                                    >
                                      <span>{scale}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {attentionItems.length > 0 && (
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => setShowAllDomains(!showAllDomains)}
                          className="px-5 py-2.5 bg-brand-forest text-white hover:bg-brand-forest/90 text-xs font-extrabold rounded-full shadow-md transition transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          {showAllDomains ? "收起展示" : `显示全部 9 项领域 (${filtered.length}项)`}
                          <ArrowRight size={14} className={showAllDomains ? "rotate-270" : "rotate-90"} />
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

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
              <p className="text-[10px] text-brand-charcoal/50 mt-0.5">根据多维前额叶突触联动效率推算的相对发育百分位坐标</p>
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

          {/* New Visual Section 2: Developmental Shortcomings & Factor Distribution (Donut Chart & Pills, Inspired by Attachment) */}
          <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
            <div className="border-b border-brand-cream pb-2.5">
              <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
                <Layers size={15} className="text-brand-moss" />
                发育因子分布 (多维神经环路强弱分布)
              </h3>
              <p className="text-[10px] text-brand-charcoal/50 mt-0.5">点击下方气泡胶囊，可动态解锁各神经纤维因子的专业建议</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: SVG Donut Chart */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-brand-cream/10 rounded-2xl border border-brand-stone/40">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {/* Background track circle */}
                    <circle cx="50" cy="50" r="40" className="stroke-brand-stone/20 stroke-[10] fill-none" />
                    
                    {/* Sage Segment for Normal */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      className="stroke-brand-moss stroke-[10] fill-none transition-all duration-500" 
                      strokeDasharray={`${(completedScores.filter(s => s.status === 'normal').length / completedScores.length * 251.3) || 0} 251.3`}
                      strokeDashoffset={0}
                    />
                    
                    {/* Clay Segment for Borderline */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      className="stroke-brand-clay stroke-[10] fill-none transition-all duration-500" 
                      strokeDasharray={`${(completedScores.filter(s => s.status === 'borderline').length / completedScores.length * 251.3) || 0} 251.3`}
                      strokeDashoffset={`-${(completedScores.filter(s => s.status === 'normal').length / completedScores.length * 251.3) || 0}`}
                    />

                    {/* Rose Segment for Delay */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      className="stroke-rose-500 stroke-[10] fill-none transition-all duration-500" 
                      strokeDasharray={`${(completedScores.filter(s => s.status === 'delay').length / completedScores.length * 251.3) || 0} 251.3`}
                      strokeDashoffset={`-${((completedScores.filter(s => s.status === 'normal').length + completedScores.filter(s => s.status === 'borderline').length) / completedScores.length * 251.3) || 0}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-extrabold text-brand-forest">{completedScores.length}</span>
                    <span className="text-[9px] text-brand-charcoal/50 font-bold leading-none mt-0.5">测查维度总数</span>
                  </div>
                </div>
                
                <div className="flex justify-center gap-3 text-[9px] font-bold text-brand-charcoal/70 mt-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-brand-moss" /> 健康 ({completedScores.filter(s => s.status === 'normal').length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-brand-clay" /> 临界 ({completedScores.filter(s => s.status === 'borderline').length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> 滞后 ({completedScores.filter(s => s.status === 'delay').length})
                  </span>
                </div>
              </div>

              {/* Right Column: Bubble Pills List matching attachment */}
              <div className="md:col-span-7 space-y-4">
                <div>
                  <span className="text-[11px] font-bold text-brand-clay block mb-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} className="text-brand-clay" />
                    建议重点关注/稍低的因子 (粉红色高亮气泡):
                  </span>
                  {[...completedScores.filter(s => s.status === 'delay'), ...completedScores.filter(s => s.status === 'borderline')].length === 0 ? (
                    <p className="text-[10px] text-brand-charcoal/60 bg-brand-sage/10 p-2 rounded-xl border border-brand-moss/20">🎉 太棒了，未检测到任何落后或临界的发育阻滞因子！</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {[...completedScores.filter(s => s.status === 'delay'), ...completedScores.filter(s => s.status === 'borderline')].map((score) => (
                        <button
                          key={`${score.dimensionId}-${score.tierId}`}
                          onClick={() => setActivePill(activePill === score.dimensionId ? null : score.dimensionId)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition duration-150 flex items-center gap-1 cursor-pointer active:scale-95 ${
                            score.status === 'delay' 
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' 
                              : 'bg-brand-sand/50 hover:bg-brand-sand/80 text-brand-clay border-brand-clay/30'
                          } ${activePill === score.dimensionId ? 'ring-2 ring-brand-forest' : ''}`}
                        >
                          <span>{score.dimensionName}</span>
                          <span className="text-[9px] font-normal opacity-85">({score.score}/{score.maxScore})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-bold text-brand-forest block mb-1.5 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-brand-moss" />
                    已掌握良好的因子 (绿色平稳气泡):
                  </span>
                  {completedScores.filter(s => s.status === 'normal').length === 0 ? (
                    <p className="text-[10px] text-brand-charcoal/60 bg-rose-50/10 p-2 rounded-xl border border-rose-200/20">暂未包含普通/健康区间的测查因子，请配合行事历开展针对训练。</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {completedScores.filter(s => s.status === 'normal').map((score) => (
                        <button
                          key={`${score.dimensionId}-${score.tierId}`}
                          onClick={() => setActivePill(activePill === score.dimensionId ? null : score.dimensionId)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition duration-150 flex items-center gap-1 cursor-pointer active:scale-95 bg-brand-sage/20 hover:bg-brand-sage/30 text-brand-forest border-brand-moss/20 ${
                            activePill === score.dimensionId ? 'ring-2 ring-brand-forest' : ''
                          }`}
                        >
                          <span>{score.dimensionName}</span>
                          <span className="text-[9px] font-normal opacity-85">({score.score}/{score.maxScore})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dynamic details drawer */}
                {activePill && (() => {
                  const selectedScore = completedScores.find(s => s.dimensionId === activePill);
                  if (!selectedScore) return null;
                  return (
                    <div className="bg-brand-cream/30 border border-brand-stone/60 rounded-xl p-3 text-[11px] text-brand-charcoal animate-fade-in space-y-1">
                      <div className="flex justify-between items-center border-b border-brand-stone/20 pb-1 mb-1.5">
                        <span className="font-bold text-brand-forest">{selectedScore.dimensionName} 脑中枢协同性</span>
                        <span className="text-[9px] bg-brand-cream border border-brand-stone/40 px-1.5 py-0.5 rounded font-extrabold font-sans">
                          得分率: {Math.round((selectedScore.score / selectedScore.maxScore) * 100)}%
                        </span>
                      </div>
                      <p className="leading-relaxed">
                        {selectedScore.status === 'delay' 
                          ? '【评估建议】突触髓鞘化发育稍显阻滞。每天上午是该环路神经兴奋度的黄金干预窗口，请通过阻力器抓握或大面积重力牵拉以强化皮层下行传导。' 
                          : selectedScore.status === 'borderline' 
                          ? '【评估建议】处于边缘适应期。可塑性极大，日常增加游戏交互的注意力配给、多感官穿梭，能在一周内拉回标准安全发育带。' 
                          : '【评估建议】通路状态平稳、健康。该脑网络的神经突触剪切状态完好，可在维持现有居家陪伴质量的同时开展进一步认知拓展。'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 1. Circular Dial Gauges for Critical Brain Indices */}
          <IntegrationGauges criticalMetrics={aiReport.criticalMetrics} />

          {/* 2. Interactive Synaptic Connection Topology Diagram & Pathway Analysis */}
          <div className="space-y-4">
            <NeuralNetworkTopology completedScores={completedScores} />
            
            <div className="bg-brand-cream/35 p-4 rounded-2xl border border-brand-stone/50 text-left">
              <span className="text-[10px] font-bold text-brand-forest uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Sparkles size={11} className="text-brand-moss animate-pulse" />
                脑突触剪切与微环路协同性分析 (系统总览):
              </span>
              <p className="text-xs text-brand-charcoal leading-relaxed font-medium">
                {aiReport.neuralPathwayAnalysis}
              </p>
            </div>


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
            
            {/* Highly visual Online Appointment Booking CTA card */}
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
                    {SPECIALISTS.map((spec) => {
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
                          <img 
                            src={spec.avatar} 
                            alt={spec.name} 
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover border border-brand-stone/80"
                          />
                          <div>
                            <h4 className="text-xs font-bold text-brand-forest">{spec.name}</h4>
                            <span className="text-[8px] text-brand-charcoal/60 leading-none block mt-0.5">{spec.title}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Specialist Detail Card */}
                {(() => {
                  const spec = SPECIALISTS.find(s => s.id === selectedSpecialist);
                  if (!spec) return null;
                  return (
                    <div className="bg-brand-cream/20 border border-brand-stone/60 rounded-2xl p-4 space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-brand-moss block">专家执业专长:</span>
                        <p className="text-brand-charcoal leading-relaxed">{spec.specialty}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-brand-clay block">学术及评估背景:</span>
                        <p className="text-brand-charcoal/80">{spec.experience}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Step 2: Select Date & Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-brand-forest block uppercase tracking-wider">
                      第二步: 选择预约说明日期
                    </label>
                    <input 
                      type="date" 
                      value={bookingDate}
                      min="2026-07-09"
                      max="2026-07-30"
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full p-2.5 bg-brand-cream/20 border border-brand-stone/80 rounded-xl text-xs text-brand-charcoal font-semibold focus:outline-none focus:border-brand-forest"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-brand-forest block uppercase tracking-wider">
                      第三步: 选择专家的出诊班次
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {SPECIALISTS.find(s => s.id === selectedSpecialist)?.slots.map((slot) => {
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
                  disabled={!selectedSlot || !parentName.trim() || !parentPhone.trim() || bookingSubmitting}
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
                        {SPECIALISTS.find(s => s.id === selectedSpecialist)?.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-brand-charcoal/50 block">出诊职称:</span>
                      <span className="font-bold text-brand-forest">
                        {SPECIALISTS.find(s => s.id === selectedSpecialist)?.title.split(' ')[0]}
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
                      <span className="font-bold text-brand-forest">{child.name} ({formatAge(child.ageMonth)})</span>
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
                {PRODUCT.expertBooking.wechatId && (
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
                      微信号：
                      <span className="font-mono font-bold text-brand-forest select-all">
                        {PRODUCT.expertBooking.wechatId}
                      </span>
                      <br />
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

