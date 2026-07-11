import React, { useState } from 'react';
import { Child, DimensionScore, AssessmentStatus } from '../types';
import { getT1QuestionsForAge, getT1AgeBandName, T1Question } from '../t1Data';
import { 
  Activity, Sparkles, Brain, MessageSquare, Smile, BookOpen, Target, Home, Heart,
  ChevronRight, ChevronLeft, CheckCircle2, ClipboardCheck, AlertTriangle, ShieldAlert,
  ArrowRight, Sparkle, BrainCircuit, RefreshCw, BadgeHelp
} from 'lucide-react';

interface T1ScreeningProps {
  child: Child;
  onBack: () => void;
  onSaveT1Results: (scores: DimensionScore[]) => void;
}

const IconComponent = ({ name, size = 20 }: { name: string; size?: number }) => {
  switch (name) {
    case 'gross_motor': return <Activity size={size} />;
    case 'fine_motor': return <Sparkles size={size} />;
    case 'sensory': return <Heart size={size} />;
    case 'language': return <MessageSquare size={size} />;
    case 'social_emotional': return <Smile size={size} />;
    case 'cognitive': return <Brain size={size} />;
    case 'attention': return <Target size={size} />;
    case 'self_care': return <Home size={size} />;
    case 'family_env': return <BookOpen size={size} />;
    default: return <Brain size={size} />;
  }
};

const dimensionColors: Record<string, { bg: string; text: string; border: string }> = {
  gross_motor: { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-800', border: 'border-amber-200' },
  fine_motor: { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-800', border: 'border-emerald-200' },
  sensory: { bg: 'bg-indigo-50 text-indigo-700', text: 'text-indigo-800', border: 'border-indigo-200' },
  language: { bg: 'bg-blue-50 text-blue-700', text: 'text-blue-800', border: 'border-blue-200' },
  social_emotional: { bg: 'bg-pink-50 text-pink-700', text: 'text-pink-800', border: 'border-pink-200' },
  cognitive: { bg: 'bg-purple-50 text-purple-700', text: 'text-purple-800', border: 'border-purple-200' },
  attention: { bg: 'bg-rose-50 text-rose-700', text: 'text-rose-800', border: 'border-rose-200' },
  self_care: { bg: 'bg-teal-50 text-teal-700', text: 'text-teal-800', border: 'border-teal-200' },
  family_env: { bg: 'bg-lime-50 text-lime-700', text: 'text-lime-800', border: 'border-lime-200' },
};

const dimensionNames: Record<string, string> = {
  gross_motor: '动作发展',
  fine_motor: '感觉处理',
  sensory: '情绪与行为',
  language: '语言沟通',
  social_emotional: '社交互动',
  cognitive: '认知',
  attention: '注意力与执行',
  self_care: '生活自理与适应',
  family_env: '学习能力',
};

const dimensionDescs: Record<string, string> = {
  gross_motor: '评估大动作运动协调性、平衡能力、姿势控制及下肢力量。',
  fine_motor: '评测对光线、声音、材质等外界感觉刺激的反应及感统耐受度。',
  sensory: '评测挫折应对、情绪自我调节、主要抚养人分离焦虑及作息规律性。',
  language: '测试日常词汇表达、长短句组织、听说指令理解及言语流畅度。',
  social_emotional: '分析眼神接触、同伴社交、轮流分享及玩具互动分享意愿。',
  cognitive: '评估逻辑推理、数量点数、空间位置概念及解决小问题能力。',
  attention: '评测课堂或日常活动专注度、冲动控制及规则遵从表现。',
  self_care: '检验独立进食、穿脱衣鞋、如厕训练、洗手配合等日常自理。',
  family_env: '评估绘本阅读兴趣、模仿能力、日常流程记忆与新玩法学成效率。',
};

export default function T1Screening({ child, onBack, onSaveT1Results }: T1ScreeningProps) {
  const ageBandName = getT1AgeBandName(child.ageMonth);
  const questions = getT1QuestionsForAge(child.ageMonth);

  // Group questions by dimension (each should have exactly 4 questions)
  const dimensionsList = Array.from(new Set(questions.map(q => q.dimensionId)));
  
  const [currentStep, setCurrentStep] = useState(0); // 0 to 8 representing the 9 dimensions
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [calculatedScores, setCalculatedScores] = useState<DimensionScore[]>([]);

  const activeDimId = dimensionsList[currentStep];
  const activeQuestions = questions.filter(q => q.dimensionId === activeDimId);

  const handleSelectOption = (qId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [qId]: score }));
  };

  // Check if all questions in the current step are answered
  const isCurrentStepFinished = activeQuestions.every(q => answers[q.id] !== undefined);

  const handleNext = () => {
    if (currentStep < 8) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  React.useEffect(() => {
    if (currentStep === 0) return;

    const timer = setTimeout(() => {
      const activeQuestionsForStep = questions.filter(q => q.dimensionId === dimensionsList[currentStep]);
      if (activeQuestionsForStep.length > 0) {
        const firstQId = activeQuestionsForStep[0].id;
        const firstQuestionBlock = document.getElementById(`t1-question-block-${firstQId}`);
        if (firstQuestionBlock) {
          const headerOffset = 110; // Account for sticky header height
          const elementPosition = firstQuestionBlock.getBoundingClientRect().top + window.scrollY;
          const offsetPosition = elementPosition - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [currentStep, questions, dimensionsList]);

  const handleSubmitT1 = () => {
    const scores: DimensionScore[] = dimensionsList.map(dimId => {
      const dimQuestions = questions.filter(q => q.dimensionId === dimId);
      let earned = 0;
      let hasRedFlagIssue = false;

      dimQuestions.forEach(q => {
        const val = answers[q.id];
        earned += val !== undefined ? val : 0;
        if (q.isRedFlag && val !== undefined && val < 2) {
          hasRedFlagIssue = true;
        }
      });

      const max = 8; // 4 questions * 2
      let status: AssessmentStatus = 'normal';
      
      if (earned <= 5) {
        status = 'delay';
      } else if (earned < 8) {
        status = 'borderline';
      } else if (hasRedFlagIssue) {
        status = 'borderline';
      }

      return {
        dimensionId: dimId,
        dimensionName: dimensionNames[dimId] || dimId,
        tierId: 'T1',
        score: earned,
        maxScore: max,
        status,
        completedAt: new Date().toISOString()
      };
    });

    setCalculatedScores(scores);
    setIsCompleted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleActivateDeepAssessment = () => {
    onSaveT1Results(calculatedScores);
  };

  const progressPercent = Math.round(((currentStep + 1) / 9) * 100);

  if (isCompleted) {
    const lowDimensions = calculatedScores.filter(s => s.status === 'borderline' || s.status === 'delay');

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* T1 Results Dashboard Screen */}
        <div className="bg-white rounded-3xl border border-brand-stone p-6 md:p-8 shadow-sm text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-brand-sage/70 rounded-2xl text-brand-forest">
              <ClipboardCheck size={26} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-forest">T1 综合筛查评估结论</h2>
              <p className="text-xs text-brand-charcoal/70 mt-0.5">
                受测儿童：{child.name} | 实足月龄：{child.ageMonth}个月 | 筛查量表：{ageBandName}
              </p>
            </div>
          </div>

          {/* Core conclusion alert */}
          <div className={`p-5 rounded-2xl border mb-8 flex flex-col md:flex-row items-start md:items-center gap-4 ${
            lowDimensions.length > 0 
              ? 'bg-amber-50/50 border-amber-200 text-amber-900' 
              : 'bg-emerald-50/40 border-emerald-100 text-emerald-900'
          }`}>
            {lowDimensions.length > 0 ? (
              <ShieldAlert className="text-amber-600 shrink-0 mt-1 md:mt-0" size={24} />
            ) : (
              <CheckCircle2 className="text-brand-moss shrink-0" size={24} />
            )}
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-bold">
                {lowDimensions.length > 0 
                  ? `筛查提示：发现孩子在 ${lowDimensions.map(d => d.dimensionName).join('、')} 等 ${lowDimensions.length} 个维度上存在发育边缘或落后风险。`
                  : '筛查提示：恭喜，孩子在所有 9 大维度上的基本发育状态均符合标准指标值。'
                }
              </h3>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                {lowDimensions.length > 0
                  ? '为了精确定位孩子在大脑突触环路与功能上的发展状况并建立成长引导方案，推荐立即进入相应维度的 T2 能力评估层 与 T3 专项深入评估。'
                  : '基本发育水平良好。如需作为成长记录归档并获得脑神经网络的高清动力学分析图谱，您亦可点击下方一键对接 AI 判读建档并视情探索 T2/T3 检测。'
                }
              </p>
            </div>
          </div>

          {/* 9 Dimensions Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {calculatedScores.map(score => {
              const theme = dimensionColors[score.dimensionId] || { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' };
              const percent = (score.score / score.maxScore) * 100;

              return (
                <div 
                  id={`t1-result-card-${score.dimensionId}`}
                  key={score.dimensionId} 
                  className={`p-4 rounded-2xl border bg-white flex flex-col justify-between h-40 transition ${
                    score.status === 'delay' ? 'border-rose-300 ring-2 ring-rose-500/5' :
                    score.status === 'borderline' ? 'border-amber-300' : 'border-emerald-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${theme.bg}`}>
                        <IconComponent name={score.dimensionId} size={16} />
                      </div>
                      <span className="text-xs font-extrabold text-brand-forest">{score.dimensionName}</span>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      score.status === 'delay' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      score.status === 'borderline' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {score.status === 'delay' ? '发育迟缓' : score.status === 'borderline' ? '临界状态' : '良好'}
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-3">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-brand-charcoal/60">实测得分:</span>
                      <span className="font-bold text-brand-forest">{score.score} / {score.maxScore}</span>
                    </div>
                    {/* Tiny Progress bar inside */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          score.status === 'delay' ? 'bg-rose-500' :
                          score.status === 'borderline' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Deep Assessment indicator */}
                  <div className="border-t border-brand-cream mt-2 pt-2 text-[10px] text-right flex items-center justify-between">
                    <span className="text-[9px] text-brand-charcoal/40">T1 基础筛查层</span>
                    {(score.status === 'delay' || score.status === 'borderline') ? (
                      <span className="text-rose-600 font-extrabold flex items-center gap-0.5">
                        <AlertTriangle size={10} className="shrink-0" />
                        推荐 T2+T3 深度
                      </span>
                    ) : (
                      <span className="text-brand-moss font-medium">基本正常</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-brand-stone/60">
            <button
              onClick={() => {
                setIsCompleted(false);
                setCurrentStep(0);
                setAnswers({});
              }}
              className="w-full sm:w-auto px-5 py-3.5 border border-brand-stone bg-brand-cream/20 text-brand-charcoal/80 hover:text-brand-charcoal hover:bg-brand-cream/50 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw size={14} />
              重新填写筛查问卷
            </button>
            <button
              id="activate-t2-btn"
              onClick={handleActivateDeepAssessment}
              className="w-full sm:flex-1 py-3.5 bg-brand-forest hover:bg-brand-forest/95 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-md shadow-brand-forest/15"
            >
              <BrainCircuit size={15} />
              一键对接 AI 判读并启动 T2/T3 深度专项评估
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeTheme = dimensionColors[activeDimId] || { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-800', border: 'border-emerald-200' };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Breadcrumb & age indicator */}
      <div className="bg-white rounded-3xl border border-brand-stone p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-sm">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-brand-charcoal/60 uppercase tracking-wider">分龄自适应 AI 精准评估</h3>
          <h2 className="text-base font-extrabold text-brand-forest flex items-center gap-1.5">
            <Sparkle size={16} className="text-brand-moss animate-spin-slow" />
            T1 综合筛查层 —— 全维度分龄极速检评
          </h2>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-sage/40 border border-brand-stone/60 rounded-xl text-xs font-bold text-brand-forest">
          <span>量表：{ageBandName}</span>
        </div>
      </div>

      {/* Progress visual tracker */}
      <div className="bg-white rounded-2xl border border-brand-stone p-4 shadow-sm text-left">
        <div className="flex justify-between items-center text-xs font-semibold mb-2 text-brand-charcoal/70">
          <span>筛查进度：9 大维度已填 {currentStep} / 9</span>
          <span className="font-bold text-brand-forest">{progressPercent}%</span>
        </div>
        <div className="w-full bg-brand-cream/50 h-2 rounded-full overflow-hidden border border-brand-stone/30">
          <div 
            className="h-full bg-brand-forest transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Active Dimension Questionnaire Form */}
      <div className="bg-white rounded-3xl border border-brand-stone p-6 md:p-8 text-left shadow-sm space-y-6">
        <div className="flex items-center gap-3.5 pb-4 border-b border-brand-cream">
          <div className={`p-3 rounded-2xl ${activeTheme.bg} ${activeTheme.border} border`}>
            <IconComponent name={activeDimId} size={22} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-wide text-brand-charcoal/55 flex items-center gap-1.5">
              <span>DIMENSION 0{currentStep + 1} / 09</span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-moss" />
              <span>T1 筛查入口</span>
            </div>
            <h3 className="text-base font-bold text-brand-forest mt-0.5">{dimensionNames[activeDimId]}</h3>
            <p className="text-[11px] text-brand-charcoal/70 mt-1 leading-relaxed">
              {dimensionDescs[activeDimId]}
            </p>
          </div>
        </div>

        {/* Questions card list */}
        <div className="space-y-6">
          {activeQuestions.map((q: T1Question, idx: number) => {
            const selectedScore = answers[q.id];

            return (
              <div 
                id={`t1-question-block-${q.id}`}
                key={q.id} 
                className={`p-5 rounded-2xl border transition-all ${
                  selectedScore !== undefined 
                    ? 'bg-slate-50/30 border-slate-200' 
                    : 'bg-white border-brand-stone'
                }`}
              >
                <div className="flex gap-3 items-start">
                  <span className="text-xs font-bold text-brand-charcoal/50 bg-brand-cream border border-brand-stone/20 w-5.5 h-5.5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="space-y-3.5 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-brand-forest leading-relaxed flex items-center flex-wrap gap-1.5">
                      {q.isRedFlag && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 border border-rose-200 text-[9px] font-bold text-rose-700 rounded shadow-sm shrink-0">
                          🚩 红旗警示指标
                        </span>
                      )}
                      <span>{q.text}</span>
                    </h4>

                    {/* Radio Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {q.options.map((opt) => {
                        const isOptSelected = selectedScore === opt.score;
                        return (
                          <button
                            id={`t1-opt-${q.id}-${opt.score}`}
                            key={opt.score}
                            type="button"
                            onClick={() => handleSelectOption(q.id, opt.score)}
                            className={`py-3 px-4 rounded-xl border text-xs font-medium text-center transition active:scale-[0.98] ${
                              isOptSelected
                                ? 'border-brand-moss bg-brand-sage text-brand-forest font-bold shadow-sm'
                                : 'border-brand-stone/40 bg-brand-cream/10 hover:bg-brand-cream/35 text-brand-charcoal/80'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Form controls */}
        <div className="flex items-center justify-between pt-6 border-t border-brand-stone/60">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-4 py-3 border border-brand-stone/80 text-brand-charcoal/80 hover:bg-brand-cream/30 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
              currentStep === 0 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
          >
            <ChevronLeft size={14} />
            上一步
          </button>

          <div className="text-[11px] font-semibold text-brand-charcoal/60">
            维度 {currentStep + 1} / 9
          </div>

          {currentStep === 8 ? (
            <button
              id="t1-submit-all-btn"
              onClick={handleSubmitT1}
              disabled={!isCurrentStepFinished}
              className={`px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition ${
                isCurrentStepFinished
                  ? 'bg-brand-moss hover:bg-brand-moss/90 text-white shadow-brand-moss/10 active:scale-[0.98]'
                  : 'bg-brand-cream border border-brand-stone text-brand-charcoal/40 cursor-not-allowed shadow-none'
              }`}
            >
              提交 T1 综合筛查
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              id="t1-next-step-btn"
              onClick={handleNext}
              disabled={!isCurrentStepFinished}
              className={`px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition ${
                isCurrentStepFinished
                  ? 'bg-brand-forest hover:bg-brand-forest/95 text-white shadow-brand-forest/10 active:scale-[0.98]'
                  : 'bg-brand-cream border border-brand-stone text-brand-charcoal/40 cursor-not-allowed shadow-none'
              }`}
            >
              下一个维度
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
