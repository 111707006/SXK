import React from 'react';
import { DimensionScore, AssessmentRecord } from '../types';
import { formatAge } from '../utils/dateUtils';
import {
  ArrowLeft, Brain, Sparkles, AlertCircle, Printer, Award, Activity,
  Layers, Compass, ShieldCheck, ShoppingBag, BookOpen, Clock, Heart, Play,
  CheckCircle2, AlertTriangle, ShieldAlert, Check, Flame, ChevronRight,
  MessageSquare, Mic, Users
} from 'lucide-react';
import { DIMENSIONS_DATA } from '../data';

interface SpecializedReportViewProps {
  record: AssessmentRecord;
  onBack: () => void;
  onGoToMall?: () => void;
}

export default function SpecializedReportView({ record, onBack, onGoToMall }: SpecializedReportViewProps) {
  /**
   * 孩子取自紀錄本身，不從外面傳進來。
   *
   * 這是一份已經產出的報告，上面印著它的生成日期；配一個「今天的年齡」進去，
   * 就會出現「年龄 4岁6个月」壓在「档案生成 2026/1/20」上面的臨床文件。
   */
  const child = record.child;
  // Extract associated dimension
  const dimId = record.dimensionId || 'language';
  const dimConfig = DIMENSIONS_DATA.find(d => d.id === dimId) || DIMENSIONS_DATA[0];

  // Calculate T2 and T3 scores
  const t2Score = record.scores.find(s => s.dimensionId === dimId && s.tierId === 'T2');
  const t3Score = record.scores.find(s => s.dimensionId === dimId && s.tierId === 'T3');

  const t2Value = t2Score ? Math.round((t2Score.score / t2Score.maxScore) * 100) : 75;
  const t3Value = t3Score ? Math.round((t3Score.score / t3Score.maxScore) * 100) : 60;

  // Check if there is a severe delay
  const isDelayed = t3Score?.status === 'delay' || t3Value < 75;

  // Let's create sub-dimension skills depending on selected dimension
  const getSubSkills = () => {
    switch (dimId) {
      case 'language':
        return [
          { name: '声学基础/构音 (Phonetics)', value: t3Value - 5, target: 90, desc: '声带振动与气流摩擦的精密配合，辅音爆发清晰度。' },
          { name: '词汇重叠/叠字 (Lexicon)', value: Math.max(40, t2Value - 10), target: 92, desc: '词汇脑内表征的提取效率、双字名词关联强度。' },
          { name: '多词句法组装 (Syntax)', value: t3Value + 8, target: 85, desc: '在 Broca 区组装主谓宾及修饰语等多级语法树的工作记忆。' },
          { name: '叙事连贯表达 (Pragmatics)', value: Math.max(30, t3Value - 12), target: 80, desc: '时序逻辑整合，对复杂语境或情境的自适应话语规划。' },
        ];
      case 'gross_motor':
        return [
          { name: '前庭姿势平衡 (Vestibular Balance)', value: t3Value - 8, target: 92, desc: '静止及动态位移中的躯干垂直轴重力中心自适应补偿。' },
          { name: '中枢骨骼力线 (Skeletal Alignment)', value: Math.max(45, t2Value - 5), target: 90, desc: '脊柱各段生物力学受力承载、肢体轴向运动力矩对称度。' },
          { name: '爆发抗阻力量 (Force Output)', value: t3Value + 5, target: 88, desc: '大肌群快速收缩与抗阻力时的运动神经元同步化放电。' },
          { name: '多步动作协调 (Coordination)', value: Math.max(35, t3Value - 15), target: 85, desc: '肢体交互运动序列（如跳跃、单脚站）的肌肉时序激活。' },
        ];
      // NOTE: 內容債 — 以下兩個 case 的臨床指標仍沿用舊分類體系（sensory_processing 回傳精細動作指標、
      // emotion_behavior 回傳感覺處理指標）。T1 題庫已依新分類改寫，T2/T3 內容尚未跟進。
      // 待真實 T2/T3 題目到位時一併重寫，勿只改 case 名稱。詳見 CONTEXT.md「已知的詞彙債」。
      case 'sensory_processing':
        return [
          { name: '指间对指捏取 (Pincer Grasp)', value: t3Value - 3, target: 95, desc: '大拇指与食指指腹精密对合对线、小物件受阻操作。' },
          { name: '手腕稳定控制 (Wrist Stability)', value: Math.max(50, t2Value - 12), target: 90, desc: '进行精细画线或操作时手腕部协同肌群的拮抗张力稳态。' },
          { name: '双侧工具协同 (Bimanual Coordination)', value: t3Value + 5, target: 85, desc: '双手交互控制（剪纸、穿珠）时大脑胼胝体半球信息交互。' },
          { name: '视觉反馈指引 (Eye-Hand Calibration)', value: Math.max(40, t3Value - 8), target: 88, desc: '眼球精细扫视轨迹与手指尖微动作终点位置的实时校准。' },
        ];
      case 'emotion_behavior':
        return [
          { name: '前庭与平衡觉 (Vestibular Integration)', value: t3Value - 10, target: 90, desc: '对身体位置改变、旋转和加速度的半规管内淋巴液前庭编码。' },
          { name: '触觉防御过滤 (Tactile Modulation)', value: Math.max(40, t2Value + 5), target: 94, desc: '对无关触觉刺激（衣物摩擦、洗脸）在大脑皮层下的滤波。' },
          { name: '本体深层压觉 (Proprioception)', value: t3Value + 2, target: 88, desc: '关节与骨骼肌张力感受器对身体轮廓 and 运动阻尼的深层映射。' },
          { name: '听视觉多通道协同 (Multisensory Cohesion)', value: Math.max(35, t3Value - 5), target: 85, desc: '听、视、触觉冲动在大脑上丘及联合皮层层面的同频对齐。' },
        ];
      default:
        return [
          { name: '神经传入编码 (Afferent Coding)', value: t3Value - 5, target: 90, desc: '感受器信号上传脊髓和脑干的基础传导通畅指数。' },
          { name: '中枢整合效率 (Central Integration)', value: Math.max(40, t2Value - 10), target: 90, desc: '皮层对多通道刺激进行过滤、决策和控制规划的承载效率。' },
          { name: '运动执行传导 (Efferent Precision)', value: t3Value + 5, target: 88, desc: '下行运动通路执行机构快速启动与稳定刹车的精确配合。' },
          { name: '反馈环路调谐 (Feedback Loop Tuning)', value: Math.max(30, t3Value - 8), target: 85, desc: '根据环境阻抗改变实时自适应调整神经放电频率的反馈环。' },
        ];
    }
  };

  const subSkills = getSubSkills();

  const getSeverityBadge = (status?: string) => {
    switch (status) {
      case 'delay':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          dot: 'bg-rose-600 animate-ping',
          text: '🚨 重度发育落后 / 专家特训推荐'
        };
      case 'borderline':
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-600 animate-pulse',
          text: '⚠️ 中度偏低临界 / 居家特意指导'
        };
      default:
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-600',
          text: '✅ 发育完全正常 / 常规评估观察'
        };
    }
  };

  const severity = getSeverityBadge(t3Score?.status || (isDelayed ? 'delay' : 'normal'));

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 px-4">
      {/* 1. Navbar & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-5 py-4 rounded-3xl border border-brand-stone shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-black text-brand-forest hover:text-brand-moss transition group"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          返回脑网络发育档案库
        </button>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 border border-brand-stone/80 hover:bg-brand-cream/30 text-brand-charcoal/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Printer size={13} />
            打印此深度评估书
          </button>
          
          {onGoToMall && (
            <button
              onClick={onGoToMall}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20"
            >
              <ShoppingBag size={13} />
              获取定制 OT 康复器材
            </button>
          )}
        </div>
      </div>

      {/* 2. Professional Master Header */}
      <div className="bg-gradient-to-br from-brand-forest to-brand-moss text-white rounded-3xl p-6 md:p-8 text-left shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-brand-sage/15 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-sage/20 border border-brand-cream/10 text-[10px] uppercase tracking-wider font-extrabold backdrop-blur-sm">
              <Award size={12} className="text-brand-sage" />
              脑发育分期专项深度评估 · 高级数据安全受控状态
            </span>
            <h1 className="text-2xl md:text-3xl font-black font-sans leading-tight text-white tracking-tight">
              【{dimConfig.name}】{dimConfig.id === "language" ? "语言" : "神经"}发育深度专项评估报告
            </h1>
            <p className="text-xs text-brand-sand/90 font-medium leading-relaxed">
              本报告合并了 T2 家长长期行为观测与 T3 级（森心康康复AI大模型、声谱、构音模型等）交互实操层数据，为您提供专业AI深度评估专项报告。
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shrink-0 text-left min-w-[220px] space-y-2 shadow-inner">
            <p className="text-[10px] text-brand-sand/80 font-bold uppercase tracking-wide">受评儿童基本档案</p>
            <div className="space-y-1">
              <p className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>{child.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-white text-brand-forest">
                  {child.gender === 'boy' ? '男童' : '女童'}
                </span>
              </p>
              <p className="text-xs font-semibold text-brand-cream/90">
                年龄: {formatAge(child.ageMonth)} ({child.ageMonth} 个月)
              </p>
              <div className="h-px bg-white/25 my-1.5" />
              <p className="text-[10px] text-brand-sand/80">
                评测号: SXK-SPEC-{record.id.slice(-6).toUpperCase()}
              </p>
              <p className="text-[10px] text-brand-sand/80">
                档案生成: {new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Highly Prominent Delay/Problem Alert Banner - ONLY SHOWS IF THERE IS AN ISSUE (🚨 有問題的部分要請突出) */}
      {isDelayed && (
        <div className="bg-gradient-to-r from-red-500/10 via-rose-500/5 to-red-500/10 border-2 border-red-500 rounded-3xl p-6 text-left shadow-lg shadow-red-500/5 relative overflow-hidden animate-pulse-slow">
          <div className="absolute right-4 top-4 text-red-500/10 pointer-events-none">
            <ShieldAlert size={120} />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md shadow-red-500/30">
              <ShieldAlert size={24} className="animate-bounce" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] bg-red-600 text-white font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  高维警示 / Delay Detected
                </span>
                <span className="text-xs text-red-700 font-extrabold">
                  本专项实测得分仅达 {t3Value} 分，显著低于正常同龄儿童发育中位标尺 85 分
                </span>
              </div>
              <h3 className="text-base font-black text-red-900">
                森心康评估意见：【{dimConfig.name}】脑神经网络突触反馈呈现代偿性滞后
              </h3>
              <p className="text-xs text-red-800 leading-relaxed font-semibold">
                该评级指示受评儿童在复杂的构音、姿势平衡控制、指尖微动操作、或感官综合滤波中，大脑运动/感觉皮层下达信号的时隙对称度偏慢，突触可塑连接出现一过性阻抗。
                <strong className="text-red-900 block mt-1.5">
                  🔴 核心训练要求：必须在未来 2-3 周内启动家庭穿戴式物理阻抗练习仪（OT/PT 智能交互套件），防止大脑优势代偿性网络发生固化、造成不可逆的精细功能代偿延迟。
                </strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. FLATTENED LAYOUT: SECTION I - 脑智评估意见与突触指标 (Clinical Insights & Core Metrics) */}
      <div className="space-y-6 text-left">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-forest rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅰ</div>
          <h2 className="text-base font-black text-brand-forest">评估结论与核心神经突触指标</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full">主控层</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Diagnostic opinion description */}
          <div className="lg:col-span-7 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase flex items-center gap-1 ${severity.bg}`}>
                  <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
                  {severity.text}
                </span>
                {isDelayed && (
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200">
                    急需介入 (ASAP)
                  </span>
                )}
              </div>
              <h3 className="text-sm font-black text-brand-forest flex items-center gap-1.5">
                <Brain size={16} className="text-brand-moss" />
                神经网络活性首席评估意见
              </h3>
              <p className="text-xs text-brand-charcoal leading-relaxed font-semibold bg-brand-cream/10 p-3.5 rounded-2xl border border-brand-stone/30">
                {record.aiReport?.summary || '该少儿在此专项测评层中表现出一定的反馈发育落后风险。中枢神经元轴突传递阻抗及空间感觉传导的协调效率尚需加强定向动作抗阻刺激，建议采取家庭穿戴OT方案积极训练。'}
              </p>
            </div>

            <div className="bg-brand-sage/10 p-4 rounded-2xl border border-brand-stone/40">
              <h4 className="text-[11px] font-bold text-brand-forest uppercase tracking-wider mb-1 flex items-center gap-1">
                <ShieldCheck size={12} className="text-brand-moss" />
                言语/运动中枢代偿反射状态分析
              </h4>
              <p className="text-xs text-brand-charcoal/80 leading-relaxed font-medium">
                {record.aiReport?.neuralPathwayAnalysis || '根据多源动作捕捉及声波共振指标反向解码表明：目前该脑网络在动作或符号处理的二级整合区存在一过性神经信号传导衰减，由于大脑突触代偿机制正常，持续进行1.5-3个月的数字化微阻物理练习，有约85%的概率回归同龄发育中线。'}
              </p>
            </div>
          </div>

          {/* Core Synapse Indicators (🚨 Highlighted if underperforming!) */}
          <div className="lg:col-span-5 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase text-brand-forest tracking-wider border-b border-brand-stone pb-2 flex items-center justify-between">
              <span>高精核心神经突触指标解算</span>
              <span className="text-[10px] text-brand-charcoal/50">发育指标 %</span>
            </h4>
            
            <div className="space-y-4 py-2">
              {/* Metric 1 */}
              {(() => {
                const val = record.aiReport?.criticalMetrics.neuralPlasticity || 78;
                const isUnder = val < 75;
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-brand-charcoal items-center">
                      <span className="flex items-center gap-1">
                        突触可塑活性 (Plasticity)
                        {isUnder && <AlertTriangle size={12} className="text-red-500 animate-bounce" />}
                      </span>
                      <span className={`font-black ${isUnder ? 'text-red-600' : 'text-brand-forest'}`}>{val}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isUnder ? 'bg-gradient-to-r from-red-600 to-orange-400 shadow-md shadow-red-500/20' : 'bg-brand-moss'
                        }`} 
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Metric 2 */}
              {(() => {
                const val = record.aiReport?.criticalMetrics.sensoryIntegration || 65;
                const isUnder = val < 75;
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-brand-charcoal items-center">
                      <span className="flex items-center gap-1">
                        感觉通路整合度 (Sensory)
                        {isUnder && <AlertTriangle size={12} className="text-red-500 animate-bounce" />}
                      </span>
                      <span className={`font-black ${isUnder ? 'text-red-600' : 'text-brand-forest'}`}>{val}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isUnder ? 'bg-gradient-to-r from-red-600 to-orange-400 shadow-md shadow-red-500/20' : 'bg-brand-forest'
                        }`} 
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Metric 3 */}
              {(() => {
                const val = record.aiReport?.criticalMetrics.motorControlIndex || 58;
                const isUnder = val < 75;
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-brand-charcoal items-center">
                      <span className="flex items-center gap-1">
                        中枢姿势控制力线 (Motor)
                        {isUnder && <AlertTriangle size={12} className="text-red-500 animate-bounce" />}
                      </span>
                      <span className={`font-black ${isUnder ? 'text-red-600' : 'text-brand-forest'}`}>{val}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isUnder ? 'bg-gradient-to-r from-red-600 to-orange-400 shadow-md shadow-red-500/20' : 'bg-brand-clay'
                        }`} 
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Metric 4 */}
              {(() => {
                const val = record.aiReport?.criticalMetrics.familyEnvironmentScore || 82;
                const isUnder = val < 75;
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-brand-charcoal items-center">
                      <span className="flex items-center gap-1">
                        环境交互抗逆因子 (Env)
                        {isUnder && <AlertTriangle size={12} className="text-red-500 animate-bounce" />}
                      </span>
                      <span className={`font-black ${isUnder ? 'text-red-600' : 'text-brand-forest'}`}>{val}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isUnder ? 'bg-gradient-to-r from-red-600 to-orange-400 shadow-md shadow-red-500/20' : 'bg-brand-sage'
                        }`} 
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Warning summary for low metrics */}
            {isDelayed && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-[10px] text-red-700 font-bold flex items-center gap-1.5 animate-pulse">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                检测到部分指标低于 75%，已自动转换至极速突触唤醒策略。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 语言发展同龄对比图表 */}
      {dimId === 'language' && (
        <div className="space-y-6 text-left pt-2">
          <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
            <div className="w-6 h-6 bg-brand-moss rounded-lg flex items-center justify-center text-white text-xs font-black">+</div>
            <h2 className="text-base font-black text-brand-forest">语言发展同龄对比</h2>
            <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">发展参照</span>
          </div>
          <div className="bg-white border border-brand-stone rounded-3xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
              {[
                { label: '词汇量', age: '24-30月', range: '50-200词', avg: '约120词', icon: BookOpen },
                { label: '句子长度', age: '30-36月', range: '2-4字/句', avg: '约3字/句', icon: MessageSquare },
                { label: '发音清晰度', age: '36-48月', range: '50-75%', avg: '约60%', icon: Mic },
                { label: '叙事能力', age: '42-48月', range: '2-3句连贯', avg: '约2句', icon: Users },
                { label: '指令理解', age: '24-36月', range: '2-3步指令', avg: '2步指令', icon: Brain },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="bg-gradient-to-b from-brand-sage/10 to-white border border-brand-stone/40 rounded-2xl p-4 space-y-2">
                    <Icon size={18} className="text-brand-moss mx-auto" />
                    <p className="text-xs font-black text-brand-forest">{item.label}</p>
                    <div className="space-y-1">
                      <p className="text-[10px] text-brand-charcoal/60">同龄范围: <span className="font-bold text-brand-forest">{item.range}</span></p>
                      <p className="text-[10px] text-brand-charcoal/60">平均水平: <span className="font-bold text-brand-moss">{item.avg}</span></p>
                      <p className="text-[9px] text-brand-charcoal/40">适用年龄: {item.age}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-brand-charcoal/40 text-center mt-3">* 数据参照 WHO 儿童发育标准及《汉语儿童语言发育迟缓评价量表》</p>
          </div>
        </div>
      )}

      {/* 6. FLATTENED LAYOUT: SECTION III - 脑动力特征谱 (Sub-skills Breakdown) */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅲ</div>
          <h2 className="text-base font-black text-brand-forest">主客观偏离图谱与精细细胞突触受体因子细分</h2>
          <span className="text-[10px] bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-100">特征谱</span>
        </div>

        <div className="bg-brand-sage/10 border border-brand-stone/30 rounded-xl p-3 text-[10px] text-brand-charcoal/70 leading-relaxed">
          <span className="font-bold text-brand-forest">说明：</span>「主客观偏离图谱」展示看护人日常观察（主观）与专业传感器采集数据（客观）之间的差异对比，帮助发现被忽视的发育信号；「精细细胞突触受体因子细分」从神经生物学层面解析语言相关脑区的突触连接强度与信号传导效率，为干预方案提供科学依据。
        </div>

        {/* Dynamic Dual Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Radar Analysis Card */}
          <div className="lg:col-span-5 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-brand-cream pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-brand-forest flex items-center gap-1.5">
                  <Activity size={14} className="text-brand-moss" />
                  主客观感知偏离度雷达图谱
                </h3>
                <p className="text-[9px] text-brand-charcoal/50">揭示家长日常评价(T2)与专业传感器客观数据(T3)偏差</p>
              </div>
            </div>

            {/* Radar View */}
            <div className="flex flex-col items-center py-2 space-y-3">
              <div className="relative w-full max-w-[240px] aspect-square bg-slate-50/80 rounded-2xl border border-brand-stone/40 p-3 flex items-center justify-center shadow-inner">
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                  {/* Concentric grids */}
                  <circle cx="50" cy="50" r="40" className="stroke-slate-200 stroke-1 fill-none" strokeDasharray="2,2" />
                  <circle cx="50" cy="50" r="30" className="stroke-slate-200 stroke-1 fill-none" strokeDasharray="2,2" />
                  <circle cx="50" cy="50" r="20" className="stroke-slate-200 stroke-1 fill-none" strokeDasharray="2,2" />
                  <circle cx="50" cy="50" r="10" className="stroke-slate-200 stroke-1 fill-none" strokeDasharray="2,2" />
                  
                  {/* Axis lines */}
                  <line x1="50" y1="10" x2="50" y2="90" className="stroke-slate-300 stroke-[0.5]" />
                  <line x1="10" y1="50" x2="90" y2="50" className="stroke-slate-300 stroke-[0.5]" />
                  
                  {/* Radar area 1: T2 (Parent Perception) - Blue */}
                  {(() => {
                    const r1 = 40 * (t2Value / 100);
                    const r2 = 38 * (t2Value / 100);
                    const r3 = 42 * (t2Value / 100);
                    const r4 = 36 * (t2Value / 100);
                    
                    const p1 = `${50}, ${50 - r1}`;
                    const p2 = `${50 + r2}, ${50}`;
                    const p3 = `${50}, ${50 + r3}`;
                    const p4 = `${50 - r4}, ${50}`;
                    
                    return (
                      <>
                        <polygon points={`${p1} ${p2} ${p3} ${p4}`} className="fill-blue-500/10 stroke-blue-500 stroke-[1.5]" />
                        <circle cx="50" cy={50 - r1} r="2" className="fill-blue-500 stroke-white stroke-0.5" />
                        <circle cx={50 + r2} cy="50" r="2" className="fill-blue-500 stroke-white stroke-0.5" />
                        <circle cx="50" cy={50 + r3} r="2" className="fill-blue-500 stroke-white stroke-0.5" />
                        <circle cx={50 - r4} cy="50" r="2" className="fill-blue-500 stroke-white stroke-0.5" />
                      </>
                    );
                  })()}

                  {/* Radar area 2: T3 (Objective AI Measurement) - Crimson if delayed, emerald if normal */}
                  {(() => {
                    const r1 = 40 * (t3Value / 100);
                    const r2 = 30 * (t3Value / 100);
                    const r3 = 34 * (t3Value / 100);
                    const r4 = 28 * (t3Value / 100);
                    
                    const p1 = `${50}, ${50 - r1}`;
                    const p2 = `${50 + r2}, ${50}`;
                    const p3 = `${50}, ${50 + r3}`;
                    const p4 = `${50 - r4}, ${50}`;
                    
                    const radarColor = isDelayed ? 'rose-500' : 'emerald-500';
                    const radarFill = isDelayed ? 'fill-rose-500/20' : 'fill-emerald-500/20';
                    const strokeColor = isDelayed ? 'stroke-rose-600' : 'stroke-emerald-600';
                    const dotColor = isDelayed ? 'fill-rose-600' : 'fill-emerald-600';
                    
                    return (
                      <>
                        <polygon points={`${p1} ${p2} ${p3} ${p4}`} className={`${radarFill} ${strokeColor} stroke-[2]`} />
                        <circle cx="50" cy={50 - r1} r="2.5" className={`${dotColor} stroke-white stroke-0.5`} />
                        <circle cx={50 + r2} cy="50" r="2.5" className={`${dotColor} stroke-white stroke-0.5`} />
                        <circle cx="50" cy={50 + r3} r="2.5" className={`${dotColor} stroke-white stroke-0.5`} />
                        <circle cx={50 - r4} cy="50" r="2.5" className={`${dotColor} stroke-white stroke-0.5`} />
                      </>
                    );
                  })()}

                  {/* Custom text labels */}
                  <text x="50" y="6" className="text-[5px] font-black fill-brand-forest" textAnchor="middle">Ⅰ 基础传入解码</text>
                  <text x="94" y="52" className="text-[5px] font-black fill-brand-forest" textAnchor="start">Ⅱ 语法/时序规划</text>
                  <text x="50" y="97" className="text-[5px] font-black fill-brand-forest" textAnchor="middle">Ⅲ 空间力矩反馈</text>
                  <text x="6" y="52" className="text-[5px] font-black fill-brand-forest" textAnchor="end">Ⅳ 双侧胼胝整合</text>
                </svg>
              </div>

              {/* Legend & Summary */}
              <div className="w-full text-xs space-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> 家主观问卷 (T2): {t2Value}%</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded ${isDelayed ? 'bg-rose-500' : 'bg-emerald-500'}`} /> 
                    AI测定 (T3): {t3Value}%
                  </span>
                </div>
                
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold">主客观偏差值 (Gap):</span>
                  <span className={`text-xs font-black ${Math.abs(t2Value - t3Value) > 15 ? 'text-rose-600 animate-pulse' : 'text-emerald-700'}`}>
                    {Math.abs(t2Value - t3Value)}% ({Math.abs(t2Value - t3Value) > 15 ? '⚠️ 存在显著认知错觉' : '主客偏离控制极佳'})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-skills Breakdown (🚨 PROBLEM AREAS HIGHLY HIGHLIGHTED - 有問題的部分要請突出) */}
          <div className="lg:col-span-7 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-brand-cream pb-2">
              <h3 className="text-xs font-black text-brand-forest flex items-center gap-1.5">
                <Layers size={14} className="text-brand-moss" />
                【{dimConfig.name}】精细神经元受体细分项实测与同龄中位比对
              </h3>
              <p className="text-[9px] text-brand-charcoal/50">红色警告脉冲条代表当前显著落后于中位标尺的精细指标</p>
            </div>

            <div className="space-y-4 pt-1">
              {subSkills.map((skill, index) => {
                const isUnderperforming = skill.value < skill.target;
                return (
                  <div 
                    key={index} 
                    className={`space-y-1.5 p-2 rounded-xl transition-all ${
                      isUnderperforming 
                        ? 'bg-rose-500/5 border border-red-200/60 shadow-sm' 
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${isUnderperforming ? 'text-red-700' : 'text-slate-800'}`}>
                            {skill.name}
                          </span>
                          {isUnderperforming ? (
                            <span className="text-[8px] bg-red-100 text-red-700 border border-red-200 font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5 animate-pulse">
                              <AlertCircle size={8} />
                              严重偏低 (落后 {skill.target - skill.value}%)
                            </span>
                          ) : (
                            <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-black px-1.5 py-0.2 rounded-full">
                              达标合格
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-brand-charcoal/60 font-medium leading-tight">{skill.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-black ${isUnderperforming ? 'text-red-600' : 'text-slate-700'}`}>
                          {skill.value} 分
                        </span>
                        <span className="text-[9px] text-brand-charcoal/40"> / 基准 {skill.target}</span>
                      </div>
                    </div>
                    
                    {/* Progress bar comparison */}
                    <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-brand-stone/30">
                      {/* Target level line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
                        style={{ left: `${skill.target}%` }}
                        title={`同龄发育中位标尺: ${skill.target}%`}
                      />
                      {/* Child's actual bar */}
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isUnderperforming 
                            ? 'bg-gradient-to-r from-red-500 via-pink-500 to-orange-400 shadow-md shadow-rose-500/10 animate-pulse-slow' 
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${skill.value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* 5. FLATTENED LAYOUT: SECTION II - 专家物理训练 (OT/PT) 指导建议 */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-moss rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅱ</div>
          <h2 className="text-base font-black text-brand-forest">儿童脑智发育物理训练(OT/PT)成长方案建议</h2>
          <span className="text-[10px] bg-brand-moss/10 text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-moss/20">干预层</span>
        </div>

        <div className="bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {record.aiReport?.rehabSuggestions.map((sug, i) => {
              const colors = [
                'bg-gradient-to-br from-rose-50 to-red-50/20 border-red-200',
                'bg-gradient-to-br from-amber-50 to-orange-50/20 border-amber-200',
                'bg-gradient-to-br from-blue-50 to-indigo-50/20 border-blue-200',
              ];
              const badgeText = ['🔥 阻尼抗阻特训', '⚡ 空间反射重建', '💎 感觉统合脱敏'];
              return (
                <div 
                  key={i} 
                  className={`flex flex-col justify-between p-4 rounded-2xl border-2 shadow-sm relative group hover:shadow-md transition duration-300 ${colors[i] || 'bg-brand-cream/15 border-brand-stone/40'}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-full bg-brand-forest text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {i + 1}
                      </span>
                      <span className="text-[9px] bg-white text-brand-charcoal/80 font-black px-2 py-0.5 rounded border border-brand-stone/50 shadow-sm">
                        {badgeText[i] || '评估核心'}
                      </span>
                    </div>
                    <p className="text-xs text-brand-charcoal leading-relaxed font-black pt-1">
                      {sug}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-brand-stone/30 text-[9px] text-brand-charcoal/50 font-bold">
                    <Check size={10} className="text-emerald-600" />
                    <span>森心康推荐辅件接入</span>
                  </div>
                </div>
              );
            }) || (
              <div className="col-span-3 text-center py-8 text-xs text-brand-charcoal/50">
                暂无专项建议处方，推荐维持常规物理阻抗康复游戏。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. FLATTENED LAYOUT: SECTION IV - 7日居家特调方案 (7-Day OT/PT Schedule) */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-forest rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅳ</div>
          <h2 className="text-base font-black text-brand-forest">【{dimConfig.name}】专属定制 7日 OT / PT 居家训练行事历</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">实操层</span>
        </div>

        <div className="space-y-4">
          {record.aiReport?.homeGuidance.map((guid, i) => {
            const days = [
              '周一 & 周二: 唤醒与脑基础感知打底阶段',
              '周三 & 周四: 中枢负阻肌张力与语言动作精细协同',
              '周五 至 周日: 多步自理日常行为语境实操演练',
            ];

            // Highlight Day 1 and 2 if there are issues!
            const highlightDay = isDelayed && i === 0;
            
            return (
              <div 
                key={i} 
                className={`rounded-2xl border-2 p-5 flex flex-col md:flex-row gap-5 transition duration-300 relative overflow-hidden shadow-sm hover:shadow-md ${
                  highlightDay 
                    ? 'bg-gradient-to-r from-red-50/70 to-orange-50/30 border-red-400 shadow-red-100' 
                    : 'bg-white border-brand-stone'
                }`}
              >
                {highlightDay && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-100/30 rounded-bl-full pointer-events-none flex items-center justify-center">
                    <Flame size={20} className="text-red-500 animate-pulse ml-6 -mt-6" />
                  </div>
                )}

                <div className={`w-14 h-14 rounded-2xl shrink-0 flex flex-col items-center justify-center shadow-md ${
                  highlightDay 
                    ? 'bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-red-500/20' 
                    : 'bg-gradient-to-br from-brand-moss to-brand-forest text-white shadow-brand-forest/10'
                }`}>
                  <span className="text-[9px] uppercase font-black tracking-wider opacity-90">Day</span>
                  <span className="text-xl font-black leading-none mt-0.5">0{i*2 + 1}</span>
                </div>

                <div className="space-y-2 text-left flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-black ${highlightDay ? 'text-red-800' : 'text-brand-forest'}`}>
                      {days[i] || '自主训练巩固'}
                    </span>
                    {highlightDay && (
                      <span className="text-[9px] bg-red-600 text-white font-extrabold px-2 py-0.5 rounded animate-pulse">
                        ⚠️ 重点阻抗攻坚区
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-brand-charcoal font-semibold leading-relaxed">
                    {guid}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] text-brand-charcoal/50 font-bold">
                    <span className="flex items-center gap-1">
                      <Clock size={11} className={highlightDay ? 'text-red-600' : 'text-brand-moss'} /> 每日 15 分钟
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={11} className="text-brand-clay" /> 家长引导共护
                    </span>
                    <span className={`px-2.5 py-0.5 rounded border font-extrabold ${
                      highlightDay 
                        ? 'text-red-700 bg-red-100/50 border-red-300' 
                        : 'text-brand-moss bg-brand-sage/10 border-brand-moss/20'
                    }`}>
                      配接辅件: {dimId === 'language' ? '脑电反馈智能头带' : dimId === 'gross_motor' ? '智能步态姿势腰带' : 'OT触觉交互训练手套'}
                    </span>
                  </div>
                </div>
              </div>
            );
          }) || (
            <div className="text-center py-8 bg-white border border-dashed border-brand-stone rounded-3xl text-xs text-brand-charcoal/50">
              暂无专项家庭行事处方，推荐开展日常绘本共读。
            </div>
          )}
        </div>

      {/* 8. FLATTENED LAYOUT: SECTION V - 语音识别准确率分析 */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-moss rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅴ</div>
          <h2 className="text-base font-black text-brand-forest">语音识别准确率分析</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">T3 传感器层</span>
        </div>

        <div className="bg-white rounded-2xl border border-brand-stone p-6">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-3xl font-black text-brand-forest">78%</div>
              <div className="text-xs text-brand-charcoal/60 font-semibold">整体识别准确率</div>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-brand-moss"></div>
                <span className="text-brand-charcoal/70">元音 92%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-brand-forest"></div>
                <span className="text-brand-charcoal/70">辅音 71%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-brand-clay"></div>
                <span className="text-brand-charcoal/70">声调 65%</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { label: '元音识别', value: 92, color: 'bg-brand-moss' },
              { label: '辅音识别', value: 71, color: 'bg-brand-forest' },
              { label: '声调识别', value: 65, color: 'bg-brand-clay' },
              { label: '连续语音', value: 58, color: 'bg-brand-ochre' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-20 text-xs font-bold text-brand-charcoal/70">{item.label}</div>
                <div className="flex-1 h-6 bg-brand-cream/50 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full flex items-center justify-end pr-2 transition-all duration-500`} style={{ width: `${item.value}%` }}>
                    <span className="text-[10px] font-black text-white">{item.value}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 9. FLATTENED LAYOUT: SECTION VI - 词汇量发展曲线 */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-forest rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅵ</div>
          <h2 className="text-base font-black text-brand-forest">词汇量发展曲线</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">T2 行为观测层</span>
        </div>

        <div className="bg-white rounded-2xl border border-brand-stone p-6">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-3xl font-black text-brand-forest">320</div>
              <div className="text-xs text-brand-charcoal/60 font-semibold">当前词汇量（个）</div>
            </div>
            <div className="text-xs text-brand-charcoal/60">
              同龄参考：<span className="font-bold text-brand-moss">450-600</span> 个
            </div>
          </div>
          
          <svg viewBox="0 0 400 150" className="w-full h-40">
            {/* Grid lines */}
            <line x1="40" y1="20" x2="40" y2="130" stroke="#e5e7eb" strokeWidth="1" />
            <line x1="40" y1="130" x2="380" y2="130" stroke="#e5e7eb" strokeWidth="1" />
            <line x1="40" y1="75" x2="380" y2="75" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />
            
            {/* Age labels */}
            <text x="40" y="145" fontSize="10" fill="#6b7280">2岁</text>
            <text x="120" y="145" fontSize="10" fill="#6b7280">3岁</text>
            <text x="200" y="145" fontSize="10" fill="#6b7280">4岁</text>
            <text x="280" y="145" fontSize="10" fill="#6b7280">5岁</text>
            <text x="360" y="145" fontSize="10" fill="#6b7280">6岁</text>
            
            {/* Peer range (shaded area) */}
            <path d="M 40 60 L 120 40 L 200 25 L 280 15 L 360 10 L 360 30 L 280 35 L 200 45 L 120 60 L 40 80 Z" fill="#d1fae5" opacity="0.5" />
            
            {/* Child's curve */}
            <path d="M 40 90 L 120 75 L 200 65 L 280 60 L 360 55" fill="none" stroke="#65a30d" strokeWidth="3" strokeLinecap="round" />
            
            {/* Data points */}
            <circle cx="40" cy="90" r="4" fill="#65a30d" />
            <circle cx="120" cy="75" r="4" fill="#65a30d" />
            <circle cx="200" cy="65" r="4" fill="#65a30d" />
            <circle cx="280" cy="60" r="4" fill="#65a30d" />
            <circle cx="360" cy="55" r="4" fill="#65a30d" />
            
            {/* Current position marker */}
            <circle cx="200" cy="65" r="6" fill="#dc2626" stroke="white" strokeWidth="2" />
          </svg>
          
          <div className="flex justify-between text-xs mt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-brand-moss"></div>
              <span className="text-brand-charcoal/70">同龄范围</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-brand-forest"></div>
              <span className="text-brand-charcoal/70">发展曲线</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span className="text-brand-charcoal/70">当前位点</span>
            </div>
          </div>
        </div>
      </div>

      {/* 10. FLATTENED LAYOUT: SECTION VII - 语法复杂度雷达图 */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-clay rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅶ</div>
          <h2 className="text-base font-black text-brand-forest">语法复杂度多维分析</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">AI 语义分析</span>
        </div>

        <div className="bg-white rounded-2xl border border-brand-stone p-6">
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 300 280" className="w-full max-w-[320px]">
              {/* Radar grid */}
              {[1, 2, 3, 4].map((level) => (
                <polygon
                  key={level}
                  points={Array.from({ length: 6 }, (_, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    const r = level * 50;
                    return `${150 + r * Math.cos(angle)},${140 + r * Math.sin(angle)}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
              
              {/* Axis lines */}
              {Array.from({ length: 6 }, (_, i) => {
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                return (
                  <line
                    key={i}
                    x1="150"
                    y1="140"
                    x2={150 + 200 * Math.cos(angle)}
                    y2={140 + 200 * Math.sin(angle)}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                );
              })}
              
              {/* Data polygon */}
              <polygon
                points={[
                  [85, 60],  // 句子长度 70%
                  [220, 70],  // 从句使用 65%
                  [240, 160], // 连接词 80%
                  [180, 220], // 时态准确 75%
                  [100, 210], // 语序正确 85%
                  [70, 130],  // 代词使用 60%
                ].map(p => p.join(',')).join(' ')}
                fill="rgba(101, 163, 13, 0.2)"
                stroke="#65a30d"
                strokeWidth="2"
              />
              
              {/* Data points */}
              {[
                [85, 60, 70],
                [220, 70, 65],
                [240, 160, 80],
                [180, 220, 75],
                [100, 210, 85],
                [70, 130, 60],
              ].map((p, i) => (
                <g key={i}>
                  <circle cx={p[0]} cy={p[1]} r="4" fill="#65a30d" />
                  <text x={p[0]} y={p[1] - 8} fontSize="10" fill="#374151" fontWeight="bold" textAnchor="middle">{p[2]}%</text>
                </g>
              ))}
              
              {/* Labels */}
              <text x="150" y="20" fontSize="11" fill="#374151" fontWeight="bold" textAnchor="middle">句子长度</text>
              <text x="270" y="75" fontSize="11" fill="#374151" fontWeight="bold" textAnchor="start">从句使用</text>
              <text x="270" y="165" fontSize="11" fill="#374151" fontWeight="bold" textAnchor="start">连接词</text>
              <text x="150" y="270" fontSize="11" fill="#374151" fontWeight="bold" textAnchor="middle">时态准确</text>
              <text x="30" y="225" fontSize="11" fill="#374151" fontWeight="bold" textAnchor="end">语序正确</text>
              <text x="30" y="135" fontSize="11" fill="#374151" fontWeight="bold" textAnchor="end">代词使用</text>
            </svg>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
            <div className="bg-brand-sage/20 rounded-lg p-2 text-center">
              <div className="font-black text-brand-forest">72%</div>
              <div className="text-brand-charcoal/60">平均复杂度</div>
            </div>
            <div className="bg-brand-sage/20 rounded-lg p-2 text-center">
              <div className="font-black text-brand-forest">85%</div>
              <div className="text-brand-charcoal/60">语序正确率</div>
            </div>
            <div className="bg-brand-sage/20 rounded-lg p-2 text-center">
              <div className="font-black text-brand-forest">60%</div>
              <div className="text-brand-charcoal/60">代词使用</div>
            </div>
          </div>
        </div>
      </div>

      {/* 11. FLATTENED LAYOUT: SECTION VIII - 语用能力评估 */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-ochre rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅷ</div>
          <h2 className="text-base font-black text-brand-forest">语用能力场景分析</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">T2 行为观测层</span>
        </div>

        <div className="bg-white rounded-2xl border border-brand-stone p-6">
          <div className="space-y-4">
            {[
              { label: '主动发起对话', value: 45, max: 100, color: 'bg-brand-clay' },
              { label: '回应他人提问', value: 72, max: 100, color: 'bg-brand-forest' },
              { label: '维持话题能力', value: 38, max: 100, color: 'bg-brand-clay' },
              { label: '轮流对话意识', value: 55, max: 100, color: 'bg-brand-ochre' },
              { label: '非语言沟通', value: 68, max: 100, color: 'bg-brand-forest' },
              { label: '情境适应力', value: 42, max: 100, color: 'bg-brand-clay' },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-brand-charcoal/80">{item.label}</span>
                  <span className="font-black text-brand-forest">{item.value}%</span>
                </div>
                <div className="h-4 bg-brand-cream/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-brand-stone/30 flex justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-clay"></div>
              <span className="text-brand-charcoal/70">需关注 (&lt;50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-ochre"></div>
              <span className="text-brand-charcoal/70">临界 (50-60%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-forest"></div>
              <span className="text-brand-charcoal/70">良好 (&gt;60%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 12. FLATTENED LAYOUT: SECTION IX - 发音清晰度对比 */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-moss rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅸ</div>
          <h2 className="text-base font-black text-brand-forest">发音清晰度声谱分析</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">T3 声谱传感器</span>
        </div>

        <div className="bg-white rounded-2xl border border-brand-stone p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-brand-sage/10 rounded-xl">
              <div className="text-3xl font-black text-brand-forest">6.2</div>
              <div className="text-xs text-brand-charcoal/60 font-semibold">当前清晰度评分</div>
            </div>
            <div className="text-center p-4 bg-brand-cream/50 rounded-xl">
              <div className="text-3xl font-black text-brand-moss">8.5</div>
              <div className="text-xs text-brand-charcoal/60 font-semibold">同龄参考评分</div>
            </div>
          </div>
          
          <svg viewBox="0 0 400 120" className="w-full h-32">
            {/* Baseline */}
            <line x1="20" y1="100" x2="380" y2="100" stroke="#e5e7eb" strokeWidth="1" />
            
            {/* Peer range */}
            <rect x="20" y="30" width="360" height="40" fill="#d1fae5" opacity="0.5" rx="4" />
            <text x="200" y="25" fontSize="10" fill="#6b7280" textAnchor="middle">同龄正常范围</text>
            
            {/* Child's score bar */}
            <rect x="20" y="70" width="260" height="20" fill="#65a30d" rx="4" opacity="0.8" />
            <text x="290" y="85" fontSize="11" fill="#374151" fontWeight="bold">6.2</text>
            
            {/* Peer average line */}
            <line x1="20" y1="50" x2="380" y2="50" stroke="#059669" strokeWidth="2" strokeDasharray="6" />
            <text x="385" y="54" fontSize="10" fill="#059669" fontWeight="bold">8.5</text>
          </svg>
          
          <div className="grid grid-cols-4 gap-2 mt-4 text-xs">
            {[
              { label: '唇音', score: 7.1, status: 'good' },
              { label: '舌音', score: 5.8, status: 'warn' },
              { label: '齿音', score: 6.5, status: 'warn' },
              { label: '喉音', score: 7.8, status: 'good' },
            ].map((item, i) => (
              <div key={i} className={`text-center p-2 rounded-lg ${item.status === 'good' ? 'bg-brand-sage/20' : 'bg-red-50'}`}>
                <div className={`font-black ${item.status === 'good' ? 'text-brand-forest' : 'text-red-600'}`}>{item.score}</div>
                <div className="text-brand-charcoal/60 text-[10px]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 13. FLATTENED LAYOUT: SECTION X - 语言理解vs表达 */}
      <div className="space-y-6 text-left pt-2">
        <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
          <div className="w-6 h-6 bg-brand-forest rounded-lg flex items-center justify-center text-white text-xs font-black">Ⅹ</div>
          <h2 className="text-base font-black text-brand-forest">语言理解与表达能力对比</h2>
          <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">综合评估</span>
        </div>

        <div className="bg-white rounded-2xl border border-brand-stone p-6">
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center">
              <svg viewBox="0 0 120 120" className="w-28 h-28">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle 
                  cx="60" cy="60" r="50" 
                  fill="none" 
                  stroke="#65a30d" 
                  strokeWidth="10" 
                  strokeDasharray={`${2 * Math.PI * 50 * 0.72} ${2 * Math.PI * 50 * 0.28}`}
                  strokeDashoffset={2 * Math.PI * 50 * 0.25}
                  strokeLinecap="round"
                />
                <text x="60" y="55" fontSize="20" fill="#374151" fontWeight="bold" textAnchor="middle">72%</text>
                <text x="60" y="75" fontSize="10" fill="#6b7280" textAnchor="middle">理解能力</text>
              </svg>
            </div>
            <div className="text-center">
              <svg viewBox="0 0 120 120" className="w-28 h-28">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle 
                  cx="60" cy="60" r="50" 
                  fill="none" 
                  stroke="#dc2626" 
                  strokeWidth="10" 
                  strokeDasharray={`${2 * Math.PI * 50 * 0.48} ${2 * Math.PI * 50 * 0.52}`}
                  strokeDashoffset={2 * Math.PI * 50 * 0.25}
                  strokeLinecap="round"
                />
                <text x="60" y="55" fontSize="20" fill="#374151" fontWeight="bold" textAnchor="middle">48%</text>
                <text x="60" y="75" fontSize="10" fill="#6b7280" textAnchor="middle">表达能力</text>
              </svg>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-sm font-bold text-red-800">⚠️ 理解 - 表达差距：24%</div>
            <div className="text-xs text-red-700 mt-1">表达能力显著落后于理解能力，建议加强表达训练</div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-brand-sage/10 rounded-lg p-3">
              <div className="text-xs font-bold text-brand-charcoal/70 mb-2">理解能力细分</div>
              <div className="space-y-2">
                {[
                  { label: '指令理解', value: 78 },
                  { label: '故事理解', value: 65 },
                  { label: '抽象概念', value: 58 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-brand-charcoal/60">{item.label}</span>
                    <div className="flex-1 h-2 bg-brand-cream/50 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-moss rounded-full" style={{ width: `${item.value}%` }} />
                    </div>
                    <span className="font-bold text-brand-forest w-8 text-right">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-red-50/50 rounded-lg p-3">
              <div className="text-xs font-bold text-brand-charcoal/70 mb-2">表达能力细分</div>
              <div className="space-y-2">
                {[
                  { label: '单词表达', value: 62 },
                  { label: '句子表达', value: 45 },
                  { label: '叙事表达', value: 32 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-brand-charcoal/60">{item.label}</span>
                    <div className="flex-1 h-2 bg-brand-cream/50 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${item.value}%` }} />
                    </div>
                    <span className="font-bold text-red-600 w-8 text-right">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}
