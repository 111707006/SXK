import React, { useState, useEffect } from 'react';
import { Child, DimensionScore, AssessmentRecord } from '../types';
import { formatAge } from '../utils/dateUtils';
import { 
  ArrowLeft, Brain, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, 
  RefreshCw, Layers, ShieldAlert, Award, Compass, HeartHandshake, Printer,
  Activity, MessageSquare, Smile, BookOpen, Target, Home, Heart, Calendar, User, Phone, Check, Info,
  ClipboardCheck, ArrowRight
} from 'lucide-react';
import { DIMENSIONS_DATA } from '../data';
import { 
  IntegrationGauges, NeuralNetworkTopology, WeeklyRehabPlanner, PrognosisTrajectoryChart 
} from './ReportCharts';

const SPECIALISTS = [
  {
    id: 'spec-1',
    name: '张雅琴 教授',
    title: '儿童神经发育 资深研究专家',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
    specialty: '3-12岁儿童多动、言语迟缓、注意力不协同专项训练指导与发育评估。',
    experience: '研究与评估经验28年，前省儿童发育成长协会副会长。',
    slots: ['周四上午', '周五下午', '周六上午']
  },
  {
    id: 'spec-2',
    name: '王树林 主任',
    title: '数字脑科学/OT感统特级指导师',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200',
    specialty: '感觉统合异常、精细抓握阻尼、运动规划及居家游戏方案制定。',
    experience: '脑科学特邀顾问，主导多款数字脑电头戴互动实操。',
    slots: ['周一上午', '周二下午', '周三上午']
  },
  {
    id: 'spec-3',
    name: '李佳 博士',
    title: '言语发展与沟通能力评估总监',
    avatar: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200',
    specialty: '儿童精细构音、唇齿爆发音、前后鼻音、构音肌阻抗特训及双语社交融合。',
    experience: '知名学府博士，主修神经言语学、儿童社交与情绪稳健性。',
    slots: ['周三上午', '周五上午', '周日上午']
  }
];

const DOMAIN_DETAILS: Record<string, {
  ability: string;
  familyAdvice: string;
  scales: string[];
}> = {
  gross_motor: {
    ability: "指大肌肉群参与的运动能力，包括身体平衡、姿势控制、双侧肢体协调、跳跃及上下楼梯等。它是儿童探索世界、进行复杂身体活动的基石。",
    familyAdvice: "每日安排至少 30 分钟大肢体活动。在安全床垫上练习侧翻滚或爬行；使用充气软墩设计小障碍跨越路线，牵着孩子单手练习单脚跳。",
    scales: ["感觉统合-动作发展评估（线上）", "粗大动作里程碑核对（发展筛查量表）", "GMFM-66 （明显粗大动作困难时）", "物理治疗 PT", "作业治疗 OT"]
  },
  fine_motor: {
    ability: "指对外界物理感觉刺激（光线、声音、材质）的调节、对身体动作的精细微调以及手眼协调操作，包括拿筷捏粒、折纸剪线等双手小肌肉协调运动。",
    familyAdvice: "多给孩子捏橡皮泥、穿引鞋带或穿彩珠，练习手指精细对捏。洗澡时鼓励使用不同触觉材质的玩具，在玩耍中逐步降低防卫性敏感。",
    scales: ["WeeFIM 精细操作指数", "儿童感觉统合发展评定量表", "感觉防卫性专科筛查", "作业治疗 OT"]
  },
  sensory: {
    ability: "在遭遇挫折、面对抚养人离别或起居环境变迁时的自我情绪适应与平复能力，以及日常生活作息节律的稳定性和配合表现。",
    familyAdvice: "建立固定的作息时间表。当孩子发脾气时，家长保持平稳，通过深呼吸或抱枕安抚；使用情绪色卡引导孩子口头表达“我现在有些生气”。",
    scales: ["CBCL 儿童行为量表", "Achenbach 情绪稳健度筛查", "ADHD 多动缺陷心理筛查", "心理沙盘与行为矫正"]
  },
  language: {
    ability: "口语词汇理解、长短句表达、人称代词辨别使用、多步骤口头指令执行以及语序逻辑的清晰度。这涉及 Broca 区及 Wernicke 区的突触偶联。",
    familyAdvice: "跟孩子对话时，放慢语速并伴随清晰的面部口型。多让孩子表达生理需求，而不是拉着父母手去指；鼓励其参与两步骤日常家务指令。",
    scales: ["CELF-5 临床语言功能评估（中文版）", "CRRC 语言发育迟缓检查法", "儿童构音障碍专项评估", "言语治疗 ST"]
  },
  social_emotional: {
    ability: "共同关注能力（视线随人手指点）、名字呼唤响应、同伴合作嬉戏意愿、分享展示玩具及眼神持续接触等社会交往特质。",
    familyAdvice: "呼唤孩子名字并保持 3 秒以上自然眼神对视，给予赞许。开展多来回的乒乓社交游戏（如互相推接皮球），训练眼神与肢体呼应。",
    scales: ["ADOS-2 自闭症诊断观察量表", "M-CHAT-R 婴幼儿孤独症筛查", "SRS-2 社交反应量表", "社交融合互动课（SCERTS）"]
  },
  cognitive: {
    ability: "指对事物的逻辑辨别、形状分类、大小对比、瞬时记忆以及类比逻辑推理能力。它直接反映了大脑皮层高级功能区突触网络的可塑性。",
    familyAdvice: "在桌前引导孩子玩“长方配孔、异色分类”形状配对玩具。可利用 3 个不透明杯子，当面移动藏物让孩子追踪寻找，锻炼工作记忆。",
    scales: ["Bayley-4 贝利婴幼儿发展量表", "Griffiths 葛斐氏发育评估", "WISC-V 韦氏儿童智力量表", "认知专项评估与训练指导"]
  },
  attention: {
    ability: "大脑前额叶皮层对无关干扰因子的抑制、动作执行规划、自我冲动抑制以及在活动中保持稳定注意力的心智调控能力。",
    familyAdvice: "在静音室内进行绘本阅读，减少视觉环境杂乱。进行“指令听哨对射”游戏：听到一声哨音前移，听到两声哨音静坐，训练反应抑制。",
    scales: ["SNAP-IV 评定量表（家长及教师版）", "Conners 儿童行为问卷", "CPT 持续性注意力测验", "注意力集中特训方案"]
  },
  self_care: {
    ability: "日常生活活动（ADL）的独立性，包括独立用勺/筷进食、配合洗手刷牙、穿脱衣物鞋袜、拉松紧带如厕及马桶规范冲洗全流程。",
    familyAdvice: "利用“穿衣扣合工作台”练习拉链与按扣。让孩子全程自主进食（允许少量洒出），并在上洗手间时由大人口型提示规范洗手闭环。",
    scales: ["WeeFIM 儿童日常生活独立功能评定", "ADL 日常生活活动能力量表", "适应行为评定量表", "生活自理指导 OT"]
  },
  family_env: {
    ability: "指对新知识、儿歌模仿、规则流程记忆和新游戏技巧的理解与学成效率。也受家庭环境中亲子伴读与赋能支持氛围的影响。",
    familyAdvice: "睡前半小时开展“无手机”的高质量伴谈与共读，多鼓励孩子重述绘本中的简单场景，用描述性肯定语强化孩子的探索兴趣。",
    scales: ["儿童学习适应性测验 (AAT)", "少儿多元智能诊断问卷", "阅读与读写障碍早期筛查", "家庭环境支持度评估 (HOME)"]
  }
};

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

interface AnalysisReportProps {
  child: Child;
  completedScores: DimensionScore[];
  onBack: () => void;
  onSaveReportToHistory: (record: AssessmentRecord) => void;
  onGoToLanguageSpecial?: () => void;
  historicalRecord?: AssessmentRecord | null;
}

export default function AnalysisReport({ child, completedScores, onBack, onSaveReportToHistory, onGoToLanguageSpecial, historicalRecord }: AnalysisReportProps) {
  const [loading, setLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AssessmentRecord['aiReport'] | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (historicalRecord && historicalRecord.aiReport) {
      setAiReport(historicalRecord.aiReport);
      setIsAiGenerated(true);
    }
  }, [historicalRecord]);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>('spec-1');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('2026-07-13');
  const [parentName, setParentName] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'success'>('idle');
  const [activePill, setActivePill] = useState<string | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);

  const delayList = completedScores.filter(s => s.status === 'delay');
  const borderlineList = completedScores.filter(s => s.status === 'borderline');
  const normalList = completedScores.filter(s => s.status === 'normal');

  const languageScore = completedScores.find(s => s.dimensionId === 'language');
  const hasLanguageIssue = languageScore && (languageScore.status === 'borderline' || languageScore.status === 'delay');

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
      setIsAiGenerated(data.isAiGenerated);

      // Optionally trigger parent state to record the report
      const newRecord: AssessmentRecord = {
        id: 'rec_' + Date.now(),
        type: 'T1_SCREENING',
        child,
        scores: completedScores,
        aiReport: data.report,
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
          返回筛查面板
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
                结合 9 维脑网络，由 AI 前额叶机制算法一键计算，输出脑发育程度评价、神经网络发育解析、动作/感统训练建议及居家互动方案。
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
              <h3 className="text-base font-bold text-brand-forest">9 维度筛查结果明细</h3>
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
                            {score.tierId === 'T1' ? 'T1 筛查层' : score.tierId === 'T2' ? 'T2 问卷层' : 'T3 评估层'}
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
                {isAiGenerated ? '首脑神经网络大模型生成' : '深度特型匹配知识库组装'}
              </div>
              <h2 className="text-xl font-bold text-brand-forest mt-1">数字成长评估综合分析报告</h2>
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
              .filter(s => (8 - s.score) >= 5)
              .map(s => s.dimensionName);
            const yellowNames = completedScores
              .filter(s => (8 - s.score) >= 3 && (8 - s.score) <= 4)
              .map(s => s.dimensionName);
            
            if (redNames.length === 0 && yellowNames.length === 0) {
              return (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-xs font-semibold leading-relaxed">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    建议维持当前的常规筛查观察。本次筛查结果显示所有 9 项发育领域表现大致良好，神经系统联动与行为适应能力发育平衡，请配合日常亲子伴读及益智活动继续保持。
                  </div>
                </div>
              );
            }

            return (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl flex items-start gap-3 text-xs leading-relaxed font-medium">
                <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-bold text-rose-800">建议尽快进入第二层「量表评估中心」。</span>
                  本次筛查在{' '}
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
                9 维度筛查结果明细
              </h3>
              <p className="text-[10px] text-brand-charcoal/50 mt-0.5">条形图代表该领域的「关注分」（0-8分，分数越高越需关注）</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {DIMENSIONS_DATA.map((dim) => {
                const score = completedScores.find(s => s.dimensionId === dim.id);
                if (!score) return null;
                const concernScore = 8 - score.score;
                let statusBadge = "大致良好";
                let badgeClass = "bg-emerald-50 border-emerald-200 text-emerald-700";
                let fillClass = "bg-emerald-500";
                let actionText = "继续观察";
                let actionClass = "text-emerald-600";

                if (concernScore >= 5) {
                  statusBadge = "需关注";
                  badgeClass = "bg-rose-50 border-rose-200 text-rose-700 font-bold";
                  fillClass = "bg-rose-500";
                  actionText = "第二层评估";
                  actionClass = "text-rose-600 font-bold";
                } else if (concernScore >= 3) {
                  statusBadge = "需留意";
                  badgeClass = "bg-amber-50 border-amber-200 text-amber-700 font-bold";
                  fillClass = "bg-amber-500";
                  actionText = "第二层评估";
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
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 需留意 (进入第二层评估)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 需关注 (建议进入第二层评估)
              </span>
            </div>
          </div>

          {/* SECTION 3: 重点问题标注 KEY FINDINGS */}
          {(() => {
            const sortedScores = [...completedScores]
              .map(s => {
                const concernScore = 8 - s.score;
                let severityLabel = "大致良好";
                let severityColor = "bg-emerald-500 text-white";
                let listBg = "hover:bg-emerald-50/20";
                let severityVal = 1;

                if (concernScore >= 6) {
                  severityLabel = "需重点关注";
                  severityColor = "bg-rose-600 text-white";
                  listBg = "bg-rose-50/10 hover:bg-rose-50/20";
                  severityVal = 4;
                } else if (concernScore === 5) {
                  severityLabel = "需关注";
                  severityColor = "bg-amber-500 text-white";
                  listBg = "bg-amber-50/10 hover:bg-amber-50/20";
                  severityVal = 3;
                } else if (concernScore >= 3) {
                  severityLabel = "临界";
                  severityColor = "bg-amber-400 text-brand-charcoal";
                  listBg = "bg-yellow-50/10 hover:bg-yellow-50/20";
                  severityVal = 2;
                }

                return {
                  ...s,
                  concernScore,
                  severityLabel,
                  severityColor,
                  listBg,
                  severityVal
                };
              })
              .sort((a, b) => b.concernScore - a.concernScore || b.severityVal - a.severityVal);

            const redCount = sortedScores.filter(s => s.concernScore >= 5).length;
            const yellowCount = sortedScores.filter(s => s.concernScore >= 3 && s.concernScore <= 4).length;
            const attentionCount = redCount + yellowCount;

            const getRecText = (id: string, concern: number) => {
              if (concern <= 2) return "发育正常，建议继续进行家庭常规观察与良性刺激。";
              switch(id) {
                case 'cognitive': return "建议进入第二层评估（心理/智力，如贝利或葛斐氏发育评估）";
                case 'social_emotional': return "建议进入第二层评估（心理/社交行为，如 ADOS-2 或 M-CHAT-R 评估）";
                case 'sensory': return "建议进入第二层评估（心理/行为情绪筛查，如 CBCL 或沙盘分析）";
                case 'attention': return "建议进入第二层评估（心理/执行功能，如 SNAP-IV 评定或持续性注意力测验）";
                case 'language': return "建议进入第二层评估（言语发育筛查 ST，如 CELF-5 评估）";
                case 'fine_motor': return "建议留意并持续进行精细手眼协调与感觉处理游戏训练";
                case 'gross_motor': return "建议留意并持续进行粗大动作抗阻与肢体平衡协调锻炼";
                case 'family_env': return "建议留意并提供多元化的家庭赋能环境与高质量伴读刺激";
                case 'self_care': return "建议留意并引导孩子自主练习个人洗漱及起居衣物穿戴自理";
                default: return "建议留意并持续观察";
              }
            };

            return (
              <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
                <div className="border-b border-brand-cream pb-2.5">
                  <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
                    <ClipboardCheck size={15} className="text-brand-moss" />
                    重点问题标注 Key Findings - 依严重程度排序
                  </h3>
                  <p className="text-[10px] text-brand-charcoal/50 mt-0.5">
                    共评测 9 项发育维度，检测到 <span className="font-bold text-rose-600">{attentionCount} 项</span> 需留意/关注领域（其中 <span className="font-bold text-rose-600">{redCount} 项</span> 需重点关注）
                  </p>
                </div>

                <div className="divide-y divide-brand-cream/40">
                  {sortedScores.map((item, idx) => (
                    <div key={item.dimensionId} className={`flex items-center justify-between py-3 px-2 rounded-xl transition ${item.listBg}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${item.severityColor}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-brand-forest">{item.dimensionName}</span>
                            <span className={`text-[9px] px-1.5 py-0.25 rounded font-extrabold ${
                              item.concernScore >= 5 ? 'bg-rose-100 text-rose-700' :
                              item.concernScore >= 3 ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.severityLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-brand-charcoal/60 mt-0.5">
                            {getRecText(item.dimensionId, item.concernScore)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0 pl-4">
                        <span className="text-xs font-extrabold text-brand-forest">关注分 {item.concernScore}</span>
                        <span className="text-[10px] text-brand-charcoal/40 block">/ 8</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* SECTION 4: 标记领域说明与第二层建议量表 */}
          <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
            <div className="border-b border-brand-cream pb-2.5">
              <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
                <BookOpen size={15} className="text-brand-moss" />
                标记领域说明与第二层建议量表
              </h3>
              <p className="text-[10px] text-brand-charcoal/50 mt-0.5">针对有延迟风险的领域，提供深度评测指导及临床建议推荐量表</p>
            </div>

            <div className="space-y-4">
              {(() => {
                const filtered = DIMENSIONS_DATA.map(dim => {
                  const s = completedScores.find(score => score.dimensionId === dim.id);
                  const concernScore = s ? (8 - s.score) : 0;
                  return { dim, s, concernScore };
                });

                const attentionItems = filtered.filter(item => item.concernScore >= 3);
                const itemsToRender = showAllDomains || attentionItems.length === 0 ? filtered : attentionItems;

                return (
                  <>
                    {itemsToRender.map(({ dim, s, concernScore }) => {
                      const details = DOMAIN_DETAILS[dim.id];
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
                            <div>
                              <span className="font-bold text-brand-moss block text-[11px] mb-1.5">📋 第二层（量表评估中心）建议量表与发展特训:</span>
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
                          key={score.dimensionId}
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
                          key={score.dimensionId}
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
            <div className="bg-gradient-to-r from-brand-forest to-brand-moss text-white rounded-3xl p-6 shadow-md relative overflow-hidden mt-6 text-left">
              <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none" />
              <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-brand-sage/20 rounded-full blur-2xl" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="space-y-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-sage/30 text-[10px] font-bold text-brand-sage inline-block uppercase tracking-wider">
                    ⭐ 线上发育辅导连通系统
                  </span>
                  <h3 className="text-lg font-bold">线上预约 1对1 脑发育与感统指导专家说明指导</h3>
                  <p className="text-xs text-brand-cream/90 max-w-xl leading-relaxed">
                    基于本次 AI 九维筛查报告，特邀三甲儿童发展评估专家提供在线可视化深度辅导，为您量身解密大脑特定环路发育，指导日常脑机及多媒体工具实操。
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setParentName('');
                    setParentPhone('');
                    setBookingStatus('idle');
                    setSelectedSlot('');
                    setShowBookingModal(true);
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
                <p className="text-[10px] text-brand-cream/80 mt-0.5">连线三甲儿童发展专家，多维解读筛查指标</p>
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
                <button
                  type="button"
                  disabled={!selectedSlot || !parentName.trim() || !parentPhone.trim()}
                  onClick={() => setBookingStatus('success')}
                  className="w-full py-3 bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-bold rounded-xl transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  确认并预约专家说明
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

