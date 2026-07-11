import React from 'react';
import { DimensionConfig, DimensionScore } from '../types';
import { DIMENSIONS_DATA } from '../data';
import { 
  Activity, Sparkles, Brain, MessageSquare, Smile, BookOpen, Target, Home, Heart,
  CheckCircle, ChevronRight, PieChart, ShieldAlert, BadgeInfo, Play, Lock, BrainCircuit
} from 'lucide-react';

interface DimensionGridProps {
  completedScores: DimensionScore[];
  onSelectDimension: (dimensionId: string) => void;
  onViewReport: () => void;
  onStartT1Screening: () => void;
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

export default function DimensionGrid({ completedScores, onSelectDimension, onViewReport, onStartT1Screening }: DimensionGridProps) {
  
  // Detect if T1 Screening has been completed globally
  const isT1Completed = completedScores.some(s => s.tierId === 'T1');

  // Find completed scores for a specific dimension
  const getDimensionStatus = (dimId: string) => {
    const records = completedScores.filter(s => s.dimensionId === dimId);
    if (records.length === 0) return null;
    
    // Pick the deepest completed tier (T3 > T2 > T1)
    const sorted = [...records].sort((a,b) => {
      const rank: Record<string, number> = { T1: 1, T2: 2, T3: 3 };
      return rank[b.tierId] - rank[a.tierId];
    });
    return sorted[0];
  };

  const getT1RecordForDimension = (dimId: string) => {
    return completedScores.find(s => s.dimensionId === dimId && s.tierId === 'T1');
  };

  const getDeepestRecordForDimension = (dimId: string) => {
    const records = completedScores.filter(s => s.dimensionId === dimId && s.tierId !== 'T1');
    if (records.length === 0) return null;
    const sorted = [...records].sort((a,b) => {
      const rank: Record<string, number> = { T2: 1, T3: 2 };
      return rank[b.tierId] - rank[a.tierId];
    });
    return sorted[0];
  };

  // Dimensions with pending T2/T3 actions
  const lowT1Dimensions = completedScores.filter(s => s.tierId === 'T1' && (s.status === 'borderline' || s.status === 'delay'));
  const completedDimensionsCount = new Set(completedScores.map(s => s.dimensionId)).size;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        
        {/* T1 Global Onboarding Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-gradient-to-br from-rose-50/70 via-white to-brand-sage/15 p-7 rounded-3xl border-2 border-rose-300/80 shadow-lg shadow-rose-100/40 text-left relative overflow-hidden">
          {/* Decorative Background Accent */}
          <div className="absolute right-4 -bottom-6 text-9xl font-black text-rose-500/5 select-none pointer-events-none font-mono tracking-tighter">
            01
          </div>
          
          <div className="space-y-2.5 relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-rose-600 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full tracking-widest uppercase shadow-sm animate-pulse">
                STEP 01
              </span>
              <span className="text-[10px] text-rose-700 font-extrabold tracking-wider uppercase bg-rose-100/80 px-2 py-0.5 rounded-md">
                基础准入筛查
              </span>
            </div>
            <h2 className="text-xl font-black text-brand-forest flex items-center gap-2 tracking-tight">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping shrink-0" />
              启动 T1 综合筛查入口
            </h2>
            <p className="text-xs text-brand-charcoal/90 max-w-lg leading-relaxed font-medium">
              根据孩子年龄段自适应匹配 36 题 ASQ-3/M-CHAT 问卷。完成基本筛查后，系统方能根据得分高低，自动解锁并推荐您进行 T2 言语/感统专项问卷与 T3 互动实测。
            </p>
          </div>
          
          <button
            id="global-start-t1-btn"
            onClick={onStartT1Screening}
            className={`px-7 py-4.5 rounded-2xl text-xs font-black flex items-center justify-center gap-2.5 shadow-xl transition-all duration-300 shrink-0 active:scale-95 relative z-10 overflow-hidden group ${
              isT1Completed
                ? 'bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 shadow-sm'
                : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white hover:scale-[1.05] hover:shadow-rose-600/40 ring-4 ring-rose-500/20'
            }`}
          >
            {!isT1Completed && (
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
            )}
            <BrainCircuit size={16} className={`shrink-0 ${!isT1Completed ? 'animate-bounce' : ''}`} />
            <span>{isT1Completed ? '重新进行 T1 综合筛查' : '立即开始 T1 综合筛查'}</span>
            {!isT1Completed && <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </div>

        {/* Header grid title */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-brand-stone shadow-sm">
          <div className="text-left flex-1">
            <h2 className="text-base font-extrabold text-brand-forest">神经网络 9 维精细图层</h2>
            <p className="text-[11px] text-brand-charcoal/70 mt-1">
              {isT1Completed 
                ? '以下为 9 维 T1 筛查结果。点击标有黄色/红色警告的维度卡片，直接推进 T2 问卷 与 T3 专项检测！'
                : '待完成上方 T1 综合筛查。筛查通过后，本模块将自适应更新并解锁。'
              }
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end shrink-0">
            {completedDimensionsCount > 0 && (
              <button
                id="view-assessment-report-btn"
                onClick={onViewReport}
                className="py-2.5 px-4 bg-brand-moss hover:bg-brand-moss/90 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-brand-moss/25 active:scale-[0.98] cursor-pointer"
              >
                <PieChart size={14} />
                生成全维 AI 深度评估报告
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="text-left sm:text-right">
                <div className="text-[10px] text-brand-charcoal/60 font-semibold">整体评估进度</div>
                <div className="text-xs font-bold text-brand-forest">已测 {completedDimensionsCount} / 9 维度</div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-brand-sage text-brand-forest flex items-center justify-center font-extrabold text-xs border border-brand-stone/60 select-none">
                {Math.round((completedDimensionsCount / 9) * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* The 9 entrance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DIMENSIONS_DATA.map((dim: DimensionConfig) => {
            const t1Rec = getT1RecordForDimension(dim.id);
            const deepRec = getDeepestRecordForDimension(dim.id);

            return (
              <button
                id={`dimension-card-${dim.id}`}
                key={dim.id}
                disabled={!isT1Completed}
                onClick={() => onSelectDimension(dim.id)}
                className={`relative overflow-hidden p-5 rounded-2xl border flex flex-col justify-between h-46 text-left transition ${
                  !isT1Completed 
                    ? 'border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed'
                    : t1Rec?.status === 'delay' 
                      ? 'border-rose-400 bg-white ring-2 ring-rose-500/5 hover:translate-y-[-2px] hover:shadow-md'
                      : t1Rec?.status === 'borderline'
                        ? 'border-amber-400 bg-white ring-2 ring-amber-500/5 hover:translate-y-[-2px] hover:shadow-md'
                        : 'border-emerald-200 bg-white hover:translate-y-[-2px] hover:shadow-md'
                }`}
              >
                {/* Visual Accent Top Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${dim.color.split(' ')[0]}`} />

                {/* Left corner: Icon */}
                <div className="flex items-start justify-between w-full mt-2">
                  <div className={`p-2 rounded-xl ${dim.color}`}>
                    <IconComponent name={dim.iconName} size={16} />
                  </div>
                  
                  {!isT1Completed ? (
                    <span className="flex items-center gap-0.5 py-1 px-2.5 bg-slate-100 border border-slate-200 rounded-full text-[10px] text-slate-400 font-medium">
                      <Lock size={10} />
                      待解锁
                    </span>
                  ) : t1Rec ? (
                    <span className={`flex items-center gap-0.5 py-1 px-2.5 rounded-full text-[10px] font-bold border ${
                      t1Rec.status === 'delay' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      t1Rec.status === 'borderline' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      T1 {t1Rec.status === 'delay' ? '迟缓风险' : t1Rec.status === 'borderline' ? '临界待测' : '发育良好'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-brand-charcoal/40 py-1 px-2.5 bg-brand-cream border border-brand-stone/30 rounded-full">未完成</span>
                  )}
                </div>

                {/* Dimension Details */}
                <div className="mt-3">
                  <h3 className="text-sm font-extrabold text-brand-forest">{dim.name}</h3>
                  <p className="text-[10px] text-brand-charcoal/60 mt-0.5">T2 自评量表 + T3 专项上传</p>
                </div>

                {/* Score or click helper */}
                <div className="flex items-center justify-between w-full pt-2 border-t border-brand-cream mt-2 text-[10px]">
                  {!isT1Completed ? (
                    <span className="text-slate-400 flex items-center gap-0.5">
                      待 T1 筛查入口
                    </span>
                  ) : t1Rec ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-brand-charcoal/50">T1 得分:</span>
                        <span className="font-bold text-brand-forest">{t1Rec.score}/{t1Rec.maxScore}</span>
                      </div>
                      {deepRec && (
                        <div className="text-[9px] text-brand-moss font-bold flex items-center gap-0.5">
                          <CheckCircle size={8} />
                          {deepRec.tierId}已测: {deepRec.score}/{deepRec.maxScore}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-brand-charcoal/60">点击进入本维度测定</span>
                  )}
                  
                  {isT1Completed && (t1Rec?.status === 'delay' || t1Rec?.status === 'borderline') && !deepRec ? (
                    <span className="text-rose-600 font-extrabold flex items-center gap-0.5">
                      立即深测
                      <ChevronRight size={10} className="text-rose-500 animate-bounce" />
                    </span>
                  ) : (
                    <ChevronRight size={12} className="text-brand-charcoal/40" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
    </div>
  );
}
