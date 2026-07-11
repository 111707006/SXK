import React, { useState } from 'react';
import { DimensionScore, Child } from '../types';
import { 
  Activity, Brain, Calendar, CheckSquare, Clock, Compass, Dumbbell, 
  Heart, Milestone, ShieldAlert, Sparkles, Zap, ChevronRight, Info
} from 'lucide-react';

interface ChartProps {
  completedScores: DimensionScore[];
  child: Child;
  criticalMetrics: {
    neuralPlasticity: number;
    sensoryIntegration: number;
    familyEnvironmentScore: number;
    motorControlIndex: number;
  };
  rehabSuggestions: string[];
  homeGuidance: string[];
}

// ==========================================
// 1. IntegrationGauges: Circular Dial Charts
// ==========================================
export function IntegrationGauges({ criticalMetrics }: { criticalMetrics: ChartProps['criticalMetrics'] }) {
  const metrics = [
    {
      id: 'plasticity',
      label: '突触传导发育潜力 (突触可塑度)',
      value: criticalMetrics.neuralPlasticity,
      description: '衡量未发育及受损脑区侧支神经纤维自适应重组与突触再生潜力。',
      color: 'stroke-brand-moss text-brand-forest',
      bgRing: 'stroke-brand-sage/20',
      fillColor: 'bg-brand-sage/10',
      icon: <Zap size={14} className="text-brand-moss" />,
      tag: '重塑活跃期',
    },
    {
      id: 'sensory',
      label: '大脑感觉信息系统协同度',
      value: criticalMetrics.sensoryIntegration,
      description: '听觉、视觉、前庭觉、触觉在脑干及皮质统合处理的信息关联效率。',
      color: 'stroke-brand-forest text-brand-forest',
      bgRing: 'stroke-brand-cream/60',
      fillColor: 'bg-brand-cream/20',
      icon: <Activity size={14} className="text-brand-forest" />,
      tag: '中度统合',
    },
    {
      id: 'family',
      label: '家庭康复环境赋能因子',
      value: criticalMetrics.familyEnvironmentScore,
      description: '家庭科学陪伴、正向情绪激励、成长环境低干扰指标综合评估。',
      color: 'stroke-brand-clay text-brand-clay',
      bgRing: 'stroke-brand-sand/30',
      fillColor: 'bg-brand-sand/10',
      icon: <Heart size={14} className="text-brand-clay" />,
      tag: '高赋能',
    },
    {
      id: 'motor',
      label: '中枢控制力线协调指数',
      value: criticalMetrics.motorControlIndex,
      description: '脊柱力线姿态、肌肉张力反馈、精细动作空间规划之动力学表达。',
      color: 'stroke-amber-600 text-amber-700',
      bgRing: 'stroke-amber-100/50',
      fillColor: 'bg-amber-50/20',
      icon: <Dumbbell size={14} className="text-amber-600" />,
      tag: '边缘失调',
    }
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-brand-forest flex items-center gap-1.5 font-serif italic pb-1">
        <Milestone size={16} className="text-brand-moss" /> 
        AI 神经功能整合水平计量 (突触联动与承载力指数)
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const radius = 36;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (m.value / 100) * circumference;

          return (
            <div key={m.id} className="bg-white rounded-2xl border border-brand-stone p-4 flex flex-col justify-between hover:shadow-md hover:border-brand-stone/80 transition-all text-left">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold text-brand-charcoal/80 leading-tight block">
                  {m.label}
                </span>
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-brand-cream border border-brand-stone/40 text-[9px] font-bold text-brand-charcoal/60">
                  {m.tag}
                </span>
              </div>

              {/* Progress Dial Arc */}
              <div className="flex items-center gap-4 my-2">
                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      className={`${m.bgRing} stroke-2 fill-none`}
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      className={`${m.color} stroke-2 fill-none transition-all duration-1000 ease-out`}
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-base font-extrabold font-sans text-brand-forest leading-none">
                      {m.value}%
                    </span>
                    <span className="text-[8px] text-brand-charcoal/50 scale-90 mt-0.5 font-bold">
                      突触协同
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    {m.icon}
                    <span className="text-[10px] font-bold text-brand-charcoal/80">测绘参数</span>
                  </div>
                  <p className="text-[10px] text-brand-charcoal/60 leading-normal">
                    {m.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 2. NeuralNetworkTopology: Interactive Brain Map
// ==========================================
export function NeuralNetworkTopology({ completedScores }: { completedScores: DimensionScore[] }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>('prefrontal');

  // Node configs representing key brain networks
  const nodes = [
    {
      id: 'prefrontal',
      name: '前额叶认知控制网络',
      eng: 'Prefrontal Executive Network',
      x: 100,
      y: 70,
      relatedDims: ['attention', 'cognitive'],
      desc: '负责大脑高级控制力，主导专注分配、工作记忆以及高阶思维规划。',
      clinicalNotes: '当前脑区突触剪切与微电流协同机制正常。如果注意力在问卷中较低，通常由于感觉阻断或轻微的皮层觉醒度不匀导致。'
    },
    {
      id: 'sensory',
      name: '多感官皮质处理中枢',
      eng: 'Sensory Integration Cortex',
      x: 230,
      y: 55,
      relatedDims: ['sensory'],
      desc: '调协听视触和本体觉，对外界物理信号在大脑后联合区进行深度编码。',
      clinicalNotes: '脑机理测绘显示该区域的传入阻抗偏高，需要采用大面积重力压力或特异毛刷扫刷，重建多通道传入神经元的髓鞘化。'
    },
    {
      id: 'motor',
      name: '运动规划与小脑协同区',
      eng: 'Motor Planning & Cerebellum',
      x: 350,
      y: 110,
      relatedDims: ['gross_motor', 'fine_motor'],
      desc: '指挥脊柱肌肉动力、大肌肉跨越平衡、及双手十指对捏的微米级控制。',
      clinicalNotes: '该中枢与脊髓前角细胞的反馈弧稍有延迟，抗阻行走训练和重力关节拉伸，能刺激下丘脑促进多巴胺偶联，提高控制精确度。'
    },
    {
      id: 'limbic',
      name: '边缘情感及社交网络',
      eng: 'Limbic Emotional Synapse',
      x: 200,
      y: 130,
      relatedDims: ['social_emotional'],
      desc: '调节杏仁核和海马体，处理社交互动眼神对视、情绪共情和环境应激。',
      clinicalNotes: '情绪稳健度和眼神交汇的保持，高度依赖于皮层下边缘多巴胺通路的活跃，建议家庭环境中采用正向情感高频激励。'
    },
    {
      id: 'language',
      name: '颞叶言语听觉传导带',
      eng: 'Temporal Auditory & Language Zone',
      x: 120,
      y: 160,
      relatedDims: ['language'],
      desc: 'Broca/Wernicke区，控制声带言语运动规划、回声脑干反射及字句重组。',
      clinicalNotes: '构音动作规划和词汇存储传输良好。针对性的吹气游戏与口腔肌肉阻力拉伸，可进一步激发下颌和唇部协调。'
    }
  ];

  // Helper to determine node health state based on average of related dimensions
  const getNodeState = (nodeRelatedDims: string[]) => {
    const scores = completedScores.filter(s => nodeRelatedDims.includes(s.dimensionId));
    if (scores.length === 0) return { status: 'normal', score: 90, label: '发育充沛' };

    const delayCount = scores.filter(s => s.status === 'delay').length;
    const borderlineCount = scores.filter(s => s.status === 'borderline').length;

    // Calculate percentage representation
    let totalScore = 0;
    scores.forEach(s => {
      totalScore += (s.score / s.maxScore) * 100;
    });
    const avgPercent = Math.round(totalScore / scores.length);

    if (delayCount > 0) {
      return { status: 'delay', score: avgPercent, label: '传导风险/偏弱' };
    }
    if (borderlineCount > 0) {
      return { status: 'borderline', score: avgPercent, label: '边缘发育/需介入' };
    }
    return { status: 'normal', score: avgPercent, label: '正常传导/平稳' };
  };

  const getStatusColor = (status: string, type: 'bg' | 'text' | 'stroke' | 'fill') => {
    if (status === 'delay') {
      return type === 'bg' ? 'bg-rose-50 border-rose-200' :
             type === 'text' ? 'text-rose-600' :
             type === 'stroke' ? 'stroke-rose-400' : 'fill-rose-500';
    }
    if (status === 'borderline') {
      return type === 'bg' ? 'bg-brand-sand/55 border-brand-clay/30' :
             type === 'text' ? 'text-brand-clay' :
             type === 'stroke' ? 'stroke-brand-clay' : 'fill-brand-clay';
    }
    return type === 'bg' ? 'bg-brand-sage/40 border-brand-moss/30' :
           type === 'text' ? 'text-brand-forest' :
           type === 'stroke' ? 'stroke-brand-moss' : 'fill-brand-moss';
  };

  const activeNode = nodes.find(n => n.id === selectedNode) || nodes[0];
  const activeState = getNodeState(activeNode.relatedDims);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-brand-forest flex items-center gap-1.5 font-serif italic pb-1">
        <Brain size={16} className="text-brand-moss" />
        脑机理神经网络发展拓扑图 (交互式脑区通路测绘)
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 bg-brand-cream/15 p-4 rounded-3xl border border-brand-stone/60">
        
        {/* Left column: SVG Brain Map */}
        <div className="md:col-span-7 flex flex-col items-center justify-center bg-white rounded-2xl border border-brand-stone p-4 relative min-h-[250px] overflow-hidden">
          <span className="absolute top-2.5 right-3 text-[9px] text-brand-charcoal/40 font-bold bg-brand-cream/60 border border-brand-stone/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Info size={9} /> 点击下方各脑区核心探针查看细节
          </span>

          <svg viewBox="0 0 450 220" className="w-full max-w-[420px] h-auto relative z-10">
            {/* Definitions for neural dot motion gradient */}
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2D5A27" />
                <stop offset="50%" stopColor="#8A9A5B" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#D27D2D" />
              </linearGradient>
            </defs>

            {/* Neural Synaptic Connections (Backdrop pathways) */}
            <path d="M 100,70 L 230,55" className="stroke-brand-stone stroke-[2.5]" strokeDasharray="5,5" />
            <path d="M 100,70 L 200,130" className="stroke-brand-stone stroke-[2.5]" strokeDasharray="5,5" />
            <path d="M 230,55 L 350,110" className="stroke-brand-stone stroke-[2.5]" strokeDasharray="5,5" />
            <path d="M 230,55 L 200,130" className="stroke-brand-stone stroke-[2.5]" strokeDasharray="5,5" />
            <path d="M 200,130 L 350,110" className="stroke-brand-stone stroke-[2.5]" strokeDasharray="5,5" />
            <path d="M 100,70 L 120,160" className="stroke-brand-stone stroke-[2.5]" strokeDasharray="5,5" />
            <path d="M 120,160 L 200,130" className="stroke-brand-stone stroke-[2.5]" strokeDasharray="5,5" />

            {/* Neural Impulses (Moving glowing paths) */}
            <path d="M 100,70 L 230,55" className="stroke-brand-moss stroke-[1.5] fill-none animate-[dash_4s_linear_infinite]" strokeDasharray="10, 110" />
            <path d="M 230,55 L 350,110" className="stroke-brand-clay stroke-[1.5] fill-none animate-[dash_5s_linear_infinite]" strokeDasharray="8, 120" />
            <path d="M 100,70 L 200,130" className="stroke-brand-forest stroke-[1.5] fill-none animate-[dash_3s_linear_infinite]" strokeDasharray="12, 100" />
            <path d="M 200,130 L 350,110" className="stroke-brand-moss stroke-[1.5] fill-none animate-[dash_6s_linear_infinite]" strokeDasharray="6, 150" />

            {/* Brain Nodes */}
            {nodes.map(n => {
              const state = getNodeState(n.relatedDims);
              const colorStroke = getStatusColor(state.status, 'stroke');
              const colorFill = getStatusColor(state.status, 'fill');
              const isSelected = selectedNode === n.id;
              const isHovered = hoveredNode === n.id;

              return (
                <g 
                  key={n.id}
                  className="cursor-pointer group"
                  onClick={() => setSelectedNode(n.id)}
                  onMouseEnter={() => setHoveredNode(n.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Outer pulsing ring for selected/hovered nodes */}
                  {(isSelected || isHovered) && (
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={isSelected ? 17 : 14}
                      className={`${colorStroke} stroke-1 fill-none opacity-40 animate-ping`}
                    />
                  )}

                  {/* Outer static ring */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isSelected ? 11 : 8}
                    className={`fill-white stroke-2 ${colorStroke} transition-all duration-300`}
                  />

                  {/* Core solid center */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isSelected ? 6 : 4}
                    className={`${colorFill} transition-all`}
                  />

                  {/* Text Label on map */}
                  <text
                    x={n.x}
                    y={n.y - 14}
                    textAnchor="middle"
                    className="text-[9px] font-bold text-brand-charcoal fill-brand-charcoal opacity-85 pointer-events-none select-none font-sans"
                  >
                    {n.name.slice(0, 3)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Simple Legend */}
          <div className="flex items-center gap-4 text-[9px] font-bold text-brand-charcoal/60 mt-2 border-t border-brand-stone/30 pt-2 w-full justify-center">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-moss shrink-0" /> 发育正常
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-clay shrink-0" /> 边缘关注
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> 落后风险
            </span>
          </div>
        </div>

        {/* Right column: Interactive Clinical Panel */}
        <div className="md:col-span-5 flex flex-col justify-between bg-white rounded-2xl border border-brand-stone p-5 text-left">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                activeState.status === 'normal' ? 'bg-brand-sage text-brand-forest border border-brand-moss/30' :
                activeState.status === 'borderline' ? 'bg-brand-sand text-brand-clay border border-brand-clay/30' :
                'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {activeState.label} | 协同率 {activeState.score}%
              </span>
            </div>

            <div>
              <h3 className="text-xs font-extrabold text-brand-forest">{activeNode.name}</h3>
              <p className="text-[10px] text-brand-charcoal/50 leading-none mt-0.5 font-sans uppercase font-bold tracking-tight">
                {activeNode.eng}
              </p>
            </div>

            <p className="text-[10px] text-brand-charcoal/80 leading-relaxed bg-brand-cream/30 p-2.5 rounded-xl border border-brand-stone/40">
              <span className="font-bold text-brand-forest text-xs block mb-1">💡 脑区功能定位:</span>
              {activeNode.desc}
            </p>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-clay block">🎯 临床发育病理诊断建议:</span>
              <p className="text-[10px] text-brand-charcoal leading-relaxed">
                {activeNode.clinicalNotes}
              </p>
            </div>
          </div>

          <div className="border-t border-brand-stone/30 pt-3.5 mt-3 flex items-center justify-between text-[10px] text-brand-charcoal/60">
            <span>关联评测因子:</span>
            <div className="flex gap-1">
              {activeNode.relatedDims.map(dim => {
                const dimScore = completedScores.find(s => s.dimensionId === dim);
                return (
                  <span key={dim} className="px-1.5 py-0.5 rounded bg-brand-cream border border-brand-stone/40 font-bold scale-95">
                    {dimScore?.dimensionName || dim}
                  </span>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// ==========================================
// 3. WeeklyRehabPlanner: Calendar Task Scheduler
// ==========================================
export function WeeklyRehabPlanner({ rehabSuggestions, homeGuidance }: { rehabSuggestions: string[], homeGuidance: string[] }) {
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const days = [
    { num: 1, label: '周一', theme: 'sensory' },
    { num: 2, label: '周二', theme: 'motor' },
    { num: 3, label: '周三', theme: 'language' },
    { num: 4, label: '周四', theme: 'sensory' },
    { num: 5, label: '周五', theme: 'cognitive' },
    { num: 6, label: '周六', theme: 'social' },
    { num: 7, label: '周日', theme: 'family' }
  ];

  // Distribute recommendations dynamically to weekdays
  const getTasksForDay = (dayIndex: number) => {
    const tasks = [];
    
    // Pick from OT/PT suggestions (alternate days)
    if (rehabSuggestions.length > 0) {
      const rehabIndex = dayIndex % rehabSuggestions.length;
      tasks.push({
        id: `rehab-${dayIndex}`,
        type: 'OT/PT 核心康复训练',
        text: rehabSuggestions[rehabIndex],
        time: '30分钟',
        intensity: dayIndex % 2 === 0 ? '中度负荷' : '低度负荷',
        sensorBadge: '智能肌电/重力仪支持',
        intensityClass: dayIndex % 2 === 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-brand-sage text-brand-forest border border-brand-moss/30'
      });
    }

    // Pick from Home guidance (alternate days)
    if (homeGuidance.length > 0) {
      const homeIndex = (dayIndex + 1) % homeGuidance.length;
      tasks.push({
        id: `home-${dayIndex}`,
        type: '居家亲子游戏疗法',
        text: homeGuidance[homeIndex],
        time: '20分钟',
        intensity: '低度负荷',
        sensorBadge: '无需设备/亲子伴谈',
        intensityClass: 'bg-brand-sage text-brand-forest border border-brand-moss/30'
      });
    }

    // Always append secondary standard visual tracking
    tasks.push({
      id: `std-${dayIndex}`,
      type: '前额叶神经调适游戏',
      text: '进行前额叶控制游戏：听单一哨音指令前移跨平衡墩，听双哨音指令闭眼静立15秒，刺激抗分心与神经抑制环路。',
      time: '15分钟',
      intensity: '高度专注',
      sensorBadge: '脑波感应带或手机对击',
      intensityClass: 'bg-rose-50 text-rose-700 border border-rose-200/50'
    });

    return tasks;
  };

  const currentTasks = getTasksForDay(selectedDay);
  
  // Calculate completion percentage of current day
  const currentCheckedCount = currentTasks.filter(t => checkedItems[t.id]).length;
  const completionPercentage = Math.round((currentCheckedCount / currentTasks.length) * 100);

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-brand-forest flex items-center gap-1.5 font-serif italic pb-1">
        <Calendar size={16} className="text-brand-moss" />
        多维感官康复与训练周计划图 (7日智能化干预行事历)
      </h4>

      <div className="bg-white rounded-3xl border border-brand-stone p-5 shadow-sm text-left">
        {/* Days Tab Strip */}
        <div className="flex border-b border-brand-cream pb-3 mb-4 gap-1.5 overflow-x-auto scrollbar-hide">
          {days.map((d, idx) => {
            const isSelected = selectedDay === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(idx)}
                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition flex flex-col items-center gap-0.5 border ${
                  isSelected 
                    ? 'border-brand-moss bg-brand-sage/40 text-brand-forest' 
                    : 'border-brand-stone/60 text-brand-charcoal/70 hover:bg-brand-cream/40'
                }`}
              >
                <span>{d.label}</span>
                <span className="text-[8px] font-normal text-brand-charcoal/50">Day {d.num}</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-brand-sage/20 border border-brand-moss/20 rounded-xl shrink-0">
            <div className="w-8 h-8 rounded-full bg-white border border-brand-stone flex items-center justify-center text-[10px] font-extrabold text-brand-forest">
              {completionPercentage}%
            </div>
            <div className="text-left leading-none">
              <span className="text-[10px] font-bold text-brand-forest block">今日康复打卡率</span>
              <span className="text-[8px] text-brand-charcoal/60">完成以获取动态报告提升</span>
            </div>
          </div>
        </div>

        {/* Task Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {currentTasks.map((t) => {
            const isChecked = !!checkedItems[t.id];
            return (
              <div 
                key={t.id} 
                onClick={() => toggleCheck(t.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between hover:shadow-sm ${
                  isChecked 
                    ? 'border-brand-moss bg-brand-sage/10 opacity-80' 
                    : 'border-brand-stone/80 bg-brand-cream/15'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-brand-stone/30 pb-2">
                    <span className="text-[10px] font-bold text-brand-forest block tracking-wide">
                      {t.type}
                    </span>
                    <button 
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                        isChecked 
                          ? 'bg-brand-moss border-brand-moss text-white' 
                          : 'border-brand-stone/80 bg-white hover:border-brand-moss'
                      }`}
                    >
                      {isChecked && <CheckSquare size={11} />}
                    </button>
                  </div>

                  <p className="text-[11px] text-brand-charcoal font-medium leading-relaxed">
                    {t.text}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-brand-stone/30 flex items-center justify-between text-[9px] font-bold text-brand-charcoal/60">
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <Clock size={11} />
                    {t.time}
                  </span>
                  <div className="flex gap-1 scale-90 origin-right">
                    <span className={`px-1.5 py-0.5 rounded ${t.intensityClass}`}>
                      {t.intensity}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-brand-cream border border-brand-stone/40">
                      {t.sensorBadge.slice(0, 4)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Tip Banner */}
        <div className="mt-4 p-3.5 bg-brand-sage/20 border border-brand-moss/20 rounded-2xl flex items-center gap-3 text-[11px] text-brand-forest">
          <Sparkles size={14} className="text-brand-moss shrink-0 animate-bounce" />
          <p className="leading-normal font-bold">
            💡 <strong>系统提示:</strong> 临床分层评估发现，每天上午是儿童前额叶突触活跃的黄金时间，建议在上午 10 点前进行 OT/PT 核心康复训练。
          </p>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 4. PrognosisTrajectoryChart: 3-Month SVG Graph
// ==========================================
export function PrognosisTrajectoryChart({ completedScores }: { completedScores: DimensionScore[] }) {
  const [activeTrack, setActiveTrack] = useState<'all' | 'intervention' | 'natural' | 'risk'>('all');
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  // Tracks specifications
  const tracks = [
    {
      id: 'intervention',
      name: '定制智能化介入训练轨迹 (ASQ 正常)',
      color: '#2D5A27',
      strokeClass: 'stroke-brand-moss',
      areaClass: 'fill-brand-sage/10',
      desc: '每天坚持1小时针对性OT/PT及居家感官游戏后，突触效率及各项发育指标预测路径，最快8周可回归ASQ普通范围。',
      points: [
        { week: '当期基线', score: 62, x: 50, y: 170 },
        { week: '第4周', score: 74, x: 175, y: 130 },
        { week: '第8周', score: 87, x: 300, y: 80 },
        { week: '第12周', score: 95, x: 425, y: 45 }
      ]
    },
    {
      id: 'natural',
      name: '自然发育慢速增长路径',
      color: '#B28247',
      strokeClass: 'stroke-brand-clay',
      areaClass: 'fill-brand-sand/5',
      desc: '无专门器材训练、无定期OT/PT辅导，仅依靠儿童自发发育的预测路径。发展平缓，易造成发育窗口期流失。',
      points: [
        { week: '当期基线', score: 62, x: 50, y: 170 },
        { week: '第4周', score: 66, x: 175, y: 155 },
        { week: '第8周', score: 71, x: 300, y: 140 },
        { week: '第12周', score: 76, x: 425, y: 125 }
      ]
    },
    {
      id: 'risk',
      name: '无干预及低情绪环境衰变风险',
      color: '#E11D48',
      strokeClass: 'stroke-rose-500',
      areaClass: 'fill-rose-500/5',
      desc: '若不及时矫正家庭数码沉溺及训斥环境，发育落后风险将增加，导致边缘神经环路活性自适应减退收缩。',
      points: [
        { week: '当期基线', score: 62, x: 50, y: 170 },
        { week: '第4周', score: 59, x: 175, y: 180 },
        { week: '第8周', score: 56, x: 300, y: 190 },
        { week: '第12周', score: 53, x: 425, y: 200 }
      ]
    }
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-brand-forest flex items-center gap-1.5 font-serif italic pb-1">
        <Milestone size={16} className="text-brand-moss" />
        脑发育预后轨迹走向预测图 (3个月多线神经环路预后走向)
      </h4>

      <div className="bg-white rounded-3xl border border-brand-stone p-5 shadow-sm text-left">
        {/* Legend Track Toggles */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveTrack('all')}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition ${
              activeTrack === 'all' 
                ? 'bg-brand-charcoal text-white border-brand-charcoal' 
                : 'bg-white text-brand-charcoal border-brand-stone hover:bg-brand-cream/35'
            }`}
          >
            显示全部曲线
          </button>
          {tracks.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTrack(t.id as any)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition flex items-center gap-1.5 ${
                activeTrack === t.id 
                  ? 'bg-brand-cream text-brand-forest border-brand-moss ring-1 ring-brand-moss/20' 
                  : 'bg-white text-brand-charcoal border-brand-stone hover:bg-brand-cream/35'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0`} style={{ backgroundColor: t.color }} />
              {t.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* SVG Chart viewport */}
        <div className="relative border border-brand-stone/60 bg-brand-cream/5 p-4 rounded-2xl overflow-hidden">
          <svg viewBox="0 0 480 230" className="w-full h-auto overflow-visible">
            {/* Grid Lines */}
            <line x1="50" y1="45" x2="425" y2="45" className="stroke-brand-stone/40 stroke-[0.7]" strokeDasharray="3,3" />
            <line x1="50" y1="80" x2="425" y2="80" className="stroke-brand-stone/40 stroke-[0.7]" strokeDasharray="3,3" />
            <line x1="50" y1="125" x2="425" y2="125" className="stroke-brand-stone/40 stroke-[0.7]" strokeDasharray="3,3" />
            <line x1="50" y1="170" x2="425" y2="170" className="stroke-brand-stone/40 stroke-[0.7]" strokeDasharray="3,3" />
            <line x1="50" y1="200" x2="425" y2="200" className="stroke-brand-stone/40 stroke-[0.7]" strokeDasharray="3,3" />

            {/* Vertical Y-axis guide labels */}
            <text x="18" y="50" className="text-[8px] font-bold fill-brand-charcoal/50">95% (优良)</text>
            <text x="18" y="85" className="text-[8px] font-bold fill-brand-charcoal/50">87% (普通)</text>
            <text x="18" y="130" className="text-[8px] font-bold fill-brand-charcoal/50">76% (边缘)</text>
            <text x="18" y="175" className="text-[8px] font-bold fill-brand-charcoal/50">62% (落后)</text>
            <text x="18" y="205" className="text-[8px] font-bold fill-brand-charcoal/50">50% (滞后)</text>

            {/* Timeline ticks X-axis */}
            <line x1="50" y1="210" x2="425" y2="210" className="stroke-brand-stone stroke-[1.5]" />
            
            <text x="50" y="222" textAnchor="middle" className="text-[9px] font-bold fill-brand-charcoal/80">当前评估阶段</text>
            <text x="175" y="222" textAnchor="middle" className="text-[9px] font-bold fill-brand-charcoal/80">介入第4周</text>
            <text x="300" y="222" textAnchor="middle" className="text-[9px] font-bold fill-brand-charcoal/80">核心第8周</text>
            <text x="425" y="222" textAnchor="middle" className="text-[9px] font-bold fill-brand-charcoal/80">评估3个月(12周)</text>

            {/* Hover Guide line */}
            {hoveredWeek !== null && (
              <line 
                x1={hoveredWeek === 0 ? 50 : hoveredWeek === 1 ? 175 : hoveredWeek === 2 ? 300 : 425}
                y1="30"
                x2={hoveredWeek === 0 ? 50 : hoveredWeek === 1 ? 175 : hoveredWeek === 2 ? 300 : 425}
                y2="210"
                className="stroke-brand-moss stroke-[1] opacity-60"
                strokeDasharray="4,4"
              />
            )}

            {/* Render Curves */}
            {tracks.map(t => {
              const showThis = activeTrack === 'all' || activeTrack === t.id;
              if (!showThis) return null;

              // Quadratic Bezier curves path construction
              const pathD = `M ${t.points[0].x},${t.points[0].y} 
                             Q ${(t.points[0].x + t.points[1].x)/2},${(t.points[0].y + t.points[1].y)/2 - (t.id === 'intervention' ? 10 : 0)} ${t.points[1].x},${t.points[1].y}
                             Q ${(t.points[1].x + t.points[2].x)/2},${(t.points[1].y + t.points[2].y)/2} ${t.points[2].x},${t.points[2].y}
                             T ${t.points[3].x},${t.points[3].y}`;

              const areaPathD = `${pathD} L 425,210 L 50,210 Z`;

              return (
                <g key={t.id} className="transition-opacity duration-300">
                  {/* Glowing Fill area */}
                  <path d={areaPathD} className={`${t.areaClass} transition-all`} />

                  {/* Curve Stroke */}
                  <path 
                    d={pathD} 
                    className={`${t.strokeClass} fill-none stroke-[2.5] transition-all`} 
                    strokeLinecap="round" 
                  />

                  {/* Interactive points */}
                  {t.points.map((p, pIdx) => {
                    const isPointHovered = hoveredWeek === pIdx;
                    return (
                      <g 
                        key={pIdx}
                        onMouseEnter={() => setHoveredWeek(pIdx)}
                        onMouseLeave={() => setHoveredWeek(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isPointHovered ? 7 : 4.5}
                          style={{ fill: t.color, stroke: '#FFF', strokeWidth: 2 }}
                          className="transition-all"
                        />
                        {isPointHovered && (
                          <g>
                            {/* Value tooltip callout above point */}
                            <rect 
                              x={p.x - 20} 
                              y={p.y - 25} 
                              width="40" 
                              height="16" 
                              rx="4" 
                              fill="#1B3B2B" 
                            />
                            <text 
                              x={p.x} 
                              y={p.y - 14} 
                              textAnchor="middle" 
                              className="text-[9px] font-bold fill-white font-sans"
                            >
                              {p.score}%
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dynamic Track Text Description based on selection */}
        <div className="mt-4 p-4 rounded-2xl border border-brand-stone/60 bg-brand-cream/15 text-xs text-brand-charcoal">
          {activeTrack === 'all' ? (
            <div className="space-y-2">
              <span className="font-bold text-brand-forest block">📈 神经网络康复成效走向精算:</span>
              <p className="leading-relaxed">
                上图预测展现了儿童在三种环境状态下的成长轴线。进行<strong>系统性 OT/PT 发育训练</strong>有极高概率在 8 到 12 周内建立更稳固的神经元旁支桥接，突触传导效率提升可达 30% 以上。
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 animate-fade-in">
              <span className="font-bold text-brand-forest block flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tracks.find(t => t.id === activeTrack)?.color }} />
                {tracks.find(t => t.id === activeTrack)?.name}
              </span>
              <p className="leading-relaxed">
                {tracks.find(t => t.id === activeTrack)?.desc}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
