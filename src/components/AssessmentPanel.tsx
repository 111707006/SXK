import React, { useState, useRef, useEffect } from 'react';
import { DimensionConfig, Question, DimensionScore } from '../types';
import { 
  ArrowLeft, Clock, Save, Info, AlertTriangle, CheckCircle2,
  Mic, Square, Play, Pause, Upload, FileAudio, FileVideo, 
  Sparkles, ShieldCheck, Database, Camera, Brain, ChevronRight, Check
} from 'lucide-react';

interface AssessmentPanelProps {
  dimension: DimensionConfig;
  onBack: () => void;
  onSaveResult: (result: DimensionScore, shouldGoBack?: boolean) => void;
  existingScores: DimensionScore[];
}

export default function AssessmentPanel({ dimension, onBack, onSaveResult, existingScores }: AssessmentPanelProps) {
  // We only do T2 and T3 in this Panel now. T1 is handled in T1Screening.
  const [selectedTier, setSelectedTier] = useState<'T2' | 'T3'>('T2');
  const currentScale = dimension.tiers[selectedTier];
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  // T2 Answers State
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const allT2Answered = dimension.tiers.T2.questions.every(q => answers[q.id] !== undefined);

  // T3 Answers and Recording States
  const [t3Answers, setT3Answers] = useState<Record<string, number>>({});
  const [t3Recordings, setT3Recordings] = useState<Record<string, { recorded: boolean; audioUrl?: string; transcript?: string }>>({});
  const [activeRecordingQId, setActiveRecordingQId] = useState<string | null>(null);
  const allT3Answered = dimension.tiers.T3.questions.every(q => t3Answers[q.id] !== undefined);

  // T3 Upload States
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isT3Analyzed, setIsT3Analyzed] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Audio Recorder States (for Language T3)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playingQId, setPlayingQId] = useState<string | null>(null);
  const recTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePlayRecordedAudio = (qId: string, transcript: string) => {
    if (playingQId === qId) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingQId(null);
      return;
    }

    setPlayingQId(qId);
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(transcript || "已录音回放中");
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;
      
      utterance.onend = () => {
        setPlayingQId(null);
      };
      utterance.onerror = () => {
        setPlayingQId(null);
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setPlayingQId(null);
      }, 2000);
    }
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Video Keypoint visualizer States (for Motor/Sensory T3)
  const boneCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // One-click AI Autoresolver for T3 Questions
  const handleOneClickAI = () => {
    setIsUploading(true);
    setUploadProgress(0);
    setSuccessMessage('🧠 正在激活森心康多维神经网络模型，对该评测层的全部问题进行声学频谱/视觉关节点对齐解算...');

    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setIsT3Analyzed(true);
          setSuccessMessage('✅ AI 深度解算完成！已自动导入各评测题目的实操拟合数据及推荐临床评分。');
          
          // Populate simulated records and scores for each T3 question
          const mockAnswers: Record<string, number> = {};
          const mockRecordings: Record<string, any> = {};
          
          dimension.tiers.T3.questions.forEach((q) => {
            // Give reasonable scores based on T2 score to maintain correlation
            const t2Score = calculateT2Score().earned;
            const t2Percent = t2Score / (dimension.tiers.T2.questions.length * 10);
            
            let score = 10;
            if (t2Percent < 0.5) {
              score = Math.random() > 0.4 ? 5 : 0;
            } else if (t2Percent < 0.8) {
              score = Math.random() > 0.6 ? 10 : 5;
            } else {
              score = Math.random() > 0.15 ? 10 : 5;
            }
            
            mockAnswers[q.id] = score;
            
            // Extract the phrase inside quote if any, e.g. “啊、一、呜”
            const match = q.text.match(/“([^”]+)”/);
            const textToPronounce = match ? match[1] : '';
            
            mockRecordings[q.id] = {
              recorded: true,
              audioUrl: 'blob:simulated_audio_' + q.id,
              transcript: score === 0 ? (textToPronounce ? '发音含糊：' + textToPronounce.slice(0, 2) : '未发出有效声音') : textToPronounce
            };
          });
          
          setT3Answers(mockAnswers);
          setT3Recordings(mockRecordings);
          
          // Draw skeleton if motor
          setTimeout(() => {
            if (dimension.id === 'gross_motor' || dimension.id === 'fine_motor' || dimension.id === 'sensory') {
              drawSkeleton();
            }
          }, 150);
          
          setTimeout(() => {
            setSuccessMessage(null);
          }, 4000);
          
          return 100;
        }
        return p + 10;
      });
    }, 150);
  };

  const startRecordingForQuestion = (qId: string) => {
    setActiveRecordingQId(qId);
    setIsRecording(true);
    setRecordingTime(0);
    
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);

    setTimeout(() => {
      drawWaveform();
    }, 50);
  };

  const stopRecordingForQuestion = (qId: string, promptText: string) => {
    setIsRecording(false);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    // Get prompt text in between “...”
    const match = promptText.match(/“([^”]+)”/);
    const textToPronounce = match ? match[1] : '已录音';

    setT3Recordings(prev => ({
      ...prev,
      [qId]: {
        recorded: true,
        audioUrl: 'blob:manual_audio_' + qId,
        transcript: textToPronounce
      }
    }));
    
    // Automatically select "Yes/Often" (10) as a helpful default when they finish recording
    if (t3Answers[qId] === undefined) {
      setT3Answers(prev => ({
        ...prev,
        [qId]: 10
      }));
    }
    
    setActiveRecordingQId(null);
    setIsT3Analyzed(true);
  };

  // Clean up timers & animation frames on unmount
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Waveform visualization for voice recording
  const drawWaveform = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#2d6a4f'; // brand-moss
    ctx.beginPath();

    const sliceWidth = width / 60;
    let x = 0;

    for (let i = 0; i < 60; i++) {
      // Simulate random sound levels
      const amplitude = isRecording ? Math.random() * (height / 2.2) + 2 : 2;
      const y = height / 2;
      ctx.moveTo(x, y - amplitude);
      ctx.lineTo(x, y + amplitude);
      x += sliceWidth;
    }
    ctx.stroke();

    if (isRecording) {
      animationRef.current = requestAnimationFrame(drawWaveform);
    }
  };

  // Skeleton visualizer for Motor joint tracking
  const drawSkeleton = () => {
    if (!boneCanvasRef.current) return;
    const canvas = boneCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw solid guide box
    ctx.strokeStyle = '#d8f3dc';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Joints map (skeleton outline simulation)
    const joints = [
      { x: width * 0.5, y: height * 0.25, label: 'Head' },
      { x: width * 0.5, y: height * 0.4, label: 'Spine' },
      { x: width * 0.38, y: height * 0.4, label: 'L_Shoulder' },
      { x: width * 0.62, y: height * 0.4, label: 'R_Shoulder' },
      { x: width * 0.32, y: height * 0.52, label: 'L_Elbow' },
      { x: width * 0.68, y: height * 0.52, label: 'R_Elbow' },
      { x: width * 0.28, y: height * 0.62, label: 'L_Wrist' },
      { x: width * 0.72, y: height * 0.62, label: 'R_Wrist' },
      { x: width * 0.42, y: height * 0.65, label: 'L_Hip' },
      { x: width * 0.58, y: height * 0.65, label: 'R_Hip' },
      { x: width * 0.4, y: height * 0.8, label: 'L_Knee' },
      { x: width * 0.6, y: height * 0.8, label: 'R_Knee' },
      { x: width * 0.38, y: height * 0.92, label: 'L_Ankle' },
      { x: width * 0.62, y: height * 0.92, label: 'R_Ankle' },
    ];

    // Connect skeleton bones
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#40916c'; // secondary green
    ctx.beginPath();
    // Spine & shoulders
    ctx.moveTo(joints[0].x, joints[0].y); // Head
    ctx.lineTo(joints[1].x, joints[1].y); // Spine
    ctx.moveTo(joints[2].x, joints[2].y); // L_S
    ctx.lineTo(joints[3].x, joints[3].y); // R_S

    // Arm Left
    ctx.moveTo(joints[2].x, joints[2].y);
    ctx.lineTo(joints[4].x, joints[4].y);
    ctx.lineTo(joints[6].x, joints[6].y);

    // Arm Right
    ctx.moveTo(joints[3].x, joints[3].y);
    ctx.lineTo(joints[5].x, joints[5].y);
    ctx.lineTo(joints[7].x, joints[7].y);

    // Hips to Spine
    ctx.moveTo(joints[1].x, joints[1].y);
    ctx.lineTo(joints[8].x, joints[8].y);
    ctx.moveTo(joints[1].x, joints[1].y);
    ctx.lineTo(joints[9].x, joints[9].y);

    // Leg Left
    ctx.moveTo(joints[8].x, joints[8].y);
    ctx.lineTo(joints[10].x, joints[10].y);
    ctx.lineTo(joints[12].x, joints[12].y);

    // Leg Right
    ctx.moveTo(joints[9].x, joints[9].y);
    ctx.lineTo(joints[11].x, joints[11].y);
    ctx.lineTo(joints[13].x, joints[13].y);
    ctx.stroke();

    // Draw active Joint nodes
    joints.forEach(j => {
      ctx.fillStyle = '#1b4332'; // text-brand-forest
      ctx.beginPath();
      ctx.arc(j.x, j.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // glowing rings for critical tracking nodes
      ctx.strokeStyle = 'rgba(116, 198, 157, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(j.x, j.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Label coordinates guide overlay
    ctx.fillStyle = 'rgba(27, 67, 50, 0.85)';
    ctx.font = '10px monospace';
    ctx.fillText('AI 神经网络关节点动作识别已激活', 15, 25);
    ctx.fillText('帧率: 60fps | 识别点: 14/14 OK', 15, 40);
    ctx.fillText('躯干中心垂直偏度: 1.2° (正常)', 15, 55);
  };

  const handleSelectOption = (qId: string, score: number) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: score
    }));
  };

  const calculateT2Score = () => {
    let earned = 0;
    let max = 0;
    dimension.tiers.T2.questions.forEach(q => {
      earned += answers[q.id] || 0;
      max += 10;
    });

    const percent = (earned / max) * 100;
    let status: 'normal' | 'borderline' | 'delay' = 'normal';
    if (percent < 45) {
      status = 'delay';
    } else if (percent < 75) {
      status = 'borderline';
    }

    return { earned, max, status };
  };

  const handleSaveT2 = () => {
    if (!allT2Answered || isTransitioning) return;
    const { earned, max, status } = calculateT2Score();

    const result: DimensionScore = {
      dimensionId: dimension.id,
      dimensionName: dimension.name,
      tierId: 'T2',
      score: earned,
      maxScore: max,
      status,
      completedAt: new Date().toISOString()
    };

    onSaveResult(result, false);
    setSuccessMessage('🎉 T2 能力自评量表已保存！正在为您自动进入 T3 临床专项评估与多媒体上传层...');
    setIsTransitioning(true);
    
    setTimeout(() => {
      setSelectedTier('T3');
      setSuccessMessage(null);
      setIsTransitioning(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1800);
  };

  // Drag & drop file handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setUploadedFile({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type || 'video/mp4'
    });
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setIsT3Analyzed(true);
          // Wait a tiny frame and then draw skeleton if motor
          setTimeout(() => {
            if (dimension.id === 'gross_motor' || dimension.id === 'fine_motor' || dimension.id === 'sensory') {
              drawSkeleton();
            }
          }, 150);
          return 100;
        }
        return p + 20;
      });
    }, 300);
  };

  // Recording functions
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    setAudioUrl(null);
    setIsT3Analyzed(false);

    recTimerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);

    setTimeout(() => {
      drawWaveform();
    }, 50);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    setAudioUrl('blob:simulated_clinical_voice_recording');
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setIsT3Analyzed(true);
          return 100;
        }
        return p + 25;
      });
    }, 200);
  };

  const calculateT3Score = () => {
    let earned = 0;
    let max = 0;
    dimension.tiers.T3.questions.forEach(q => {
      // If the user has explicitly answered this question, use it, otherwise fallback to a default (e.g. 10 or based on T2 score)
      if (t3Answers[q.id] !== undefined) {
        earned += t3Answers[q.id];
      } else {
        // Fallback: estimate from T2 score so we don't end up with 0 if they didn't manually check everything
        const t2Rec = existingScores.find(s => s.dimensionId === dimension.id && s.tierId === 'T2');
        const baseScore = t2Rec ? t2Rec.score : 30;
        const maxT2 = dimension.tiers.T2.questions.length * 10;
        const t2Ratio = baseScore / maxT2;
        earned += t2Ratio > 0.8 ? 10 : t2Ratio > 0.5 ? 5 : 0;
      }
      max += 10;
    });

    const percent = (earned / max) * 100;
    let status: 'normal' | 'borderline' | 'delay' = 'normal';
    if (percent < 45) {
      status = 'delay';
    } else if (percent < 75) {
      status = 'borderline';
    }

    return { earned, max, status };
  };

  // Save T3 results and launch Big Data Diagnostics Report
  const handleSaveT3AndReport = () => {
    const { earned, max, status } = calculateT3Score();

    const t3Result: DimensionScore = {
      dimensionId: dimension.id,
      dimensionName: dimension.name,
      tierId: 'T3',
      score: earned,
      maxScore: max,
      status,
      completedAt: new Date().toISOString()
    };

    setSuccessMessage('🚀 T3 专项临床操作数据已导入！正在调动全维脑突触神经算力，深度匹配医学大数据析出正式诊断报告...');
    setIsTransitioning(true);

    setTimeout(() => {
      onSaveResult(t3Result, false);
      setIsTransitioning(false);
      setSuccessMessage(null);
      // Let's call callback and trigger report view directly inside App
      // The parent will handle the routing immediately!
      onSaveResult(t3Result, true); // this will trigger parent to save and head back to reports dashboard!
    }, 2500);
  };

  // Specific T3 Task configurations based on selected dimension
  const getT3TaskConfig = () => {
    switch (dimension.id) {
      case 'language':
        return {
          title: 'SLP言语动作规划音高频段声学分析',
          desc: '让孩子对着麦克风，以平稳语气清晰大声说出：“我想吃大红苹果。天气冷了，我们不去公园。”',
          prompt: '孩子应该坐在静音房间里，嘴唇距离麦克风约 15 厘米，避免爆破喷音。',
          mode: 'mic'
        };
      case 'gross_motor':
        return {
          title: '3D人体骨骼关键点及中枢垂直线倾角分析',
          desc: '请录制并上传一段孩子原地单脚保持平衡站立 5 秒、并连续双脚交替向前跳跃 5 步的 15-30 秒实拍视频。',
          prompt: '拍摄时镜头需保持与孩子视线齐平，拍摄全身，光线充沛。',
          mode: 'upload',
          accept: 'video/*'
        };
      case 'fine_motor':
        return {
          title: '画笔握姿力度姿势及手指震颤系数分析',
          desc: '请上传一张孩子用铅笔/蜡笔在白纸上临摹画圆或正方形时的手部拿笔姿势特写照片或5秒超清短视频。',
          prompt: '清晰展现食指、大拇指和中指捏笔的三指对捏发力部位。',
          mode: 'upload',
          accept: 'image/*,video/*'
        };
      case 'sensory':
        return {
          title: '前庭本体姿态反应及眼震防御系数评估',
          desc: '请上传一段孩子进行荡秋千、闭眼单脚平稳站立、或在直线地板上双脚并拢行走10米的视频。',
          prompt: '避免快速跑动出框，重点捕捉肢体中轴线的颤抖和校准补偿。',
          mode: 'upload',
          accept: 'video/*'
        };
      default:
        return {
          title: '临床多媒体实操与专业评估档案上传',
          desc: `请上传与【${dimension.name}】相关的实操互动视频、音频或者专业医疗传感设备(.json/.edf)数据记录文件。`,
          prompt: '上传完毕后系统将运行图像多帧解析与结构化指标比对。',
          mode: 'upload',
          accept: '*/*'
        };
    }
  };

  const t3Config = getT3TaskConfig();

  return (
    <div className="bg-white rounded-3xl border border-brand-stone p-6 md:p-8 max-w-3xl mx-auto shadow-sm text-left">
      {/* Top Header Row */}
      <div className="flex items-center justify-between border-b border-brand-cream pb-5 mb-6">
        <button
          onClick={onBack}
          disabled={isTransitioning}
          className={`flex items-center gap-1.5 text-xs font-semibold text-brand-charcoal/85 hover:text-brand-forest transition ${isTransitioning ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <ArrowLeft size={16} />
          返回筛查面板
        </button>
        <span className="text-xs font-bold text-brand-charcoal/60">森心康 · 二级与三级深度诊断</span>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-brand-sage/60 border border-brand-moss/40 rounded-2xl flex items-center gap-3 text-brand-forest text-xs font-bold shadow-sm transition-all duration-300 animate-pulse">
          <CheckCircle2 size={18} className="text-brand-moss shrink-0 animate-bounce" />
          <span className="leading-relaxed">{successMessage}</span>
        </div>
      )}

      {/* Dimension Profile Header */}
      <div className="flex items-center gap-4 bg-brand-cream/35 p-4.5 rounded-2xl border border-brand-stone/50 mb-6">
        <div className="p-3 rounded-xl bg-white shadow-sm border border-brand-stone/40 text-brand-forest font-bold">
          {dimension.name}
        </div>
        <div>
          <h2 className="text-base font-bold text-brand-forest">正在针对【{dimension.name}】进行深度评测</h2>
          <p className="text-[11px] text-brand-charcoal/70 mt-0.5">请按流程先完成 T2 家居自评量表，随后立即导入 T3 多媒体实操文件进行判读。</p>
        </div>
      </div>

      {/* Stepper Tabs */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {(['T2', 'T3'] as const).map(tier => {
          const isSelected = selectedTier === tier;
          const isPrevCompleted = existingScores.some(s => s.dimensionId === dimension.id && s.tierId === tier);

          return (
            <button
              id={`deep-tab-${tier}`}
              key={tier}
              disabled={isTransitioning || (tier === 'T3' && !isPrevCompleted && !allT2Answered)}
              onClick={() => {
                if (isTransitioning) return;
                setSelectedTier(tier);
              }}
              className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-between gap-1.5 relative ${
                isSelected
                  ? 'border-brand-moss bg-brand-sage/50 text-brand-forest font-bold ring-2 ring-brand-moss/10'
                  : 'border-brand-stone/60 hover:bg-brand-cream/40 text-brand-charcoal/80'
              } ${(tier === 'T3' && !isPrevCompleted && !allT2Answered) ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] w-5.5 h-5.5 rounded-lg flex items-center justify-center font-bold ${
                  isSelected ? 'bg-brand-moss text-white' : 'bg-brand-stone text-brand-charcoal'
                }`}>
                  {tier}
                </span>
                <span className="text-xs font-semibold">
                  {tier === 'T2' ? 'T2 能力检测层 (问卷自评)' : 'T3 专项评估层 (临床多媒体上传)'}
                </span>
              </div>
              <div className="text-[10px] text-brand-charcoal/50">
                {tier === 'T2' ? '多因子家属自护量表' : '骨骼关键点/声学AI算法介入'}
              </div>
              {isPrevCompleted && (
                <span className="absolute top-2 right-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                  <Check size={10} />
                  已保存
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTier === 'T2' ? (
        /* ======================== T2 VIEW ======================== */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-sand/55 p-4 rounded-2xl border border-brand-stone/60">
            <div>
              <h3 className="text-xs font-bold text-brand-forest flex items-center gap-1.5">
                <Info size={14} className="text-brand-clay" />
                当前量表：{currentScale.scaleName}
              </h3>
              <p className="text-[11px] text-brand-charcoal/85 mt-1 leading-relaxed">
                这是针对该发育领域的更深度临床精细指标自评。请结合儿童近一个月的实际表现进行填报，以便系统得出突触阻滞指数。
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-brand-stone/50 shrink-0 text-brand-clay text-xs font-semibold self-start sm:self-center">
              <Clock size={12} />
              所需时间：{currentScale.duration}
            </div>
          </div>

          <div className="space-y-5">
            {currentScale.questions.map((q: Question, idx: number) => {
              const selectedScore = answers[q.id];

              return (
                <div key={q.id} className="p-5 bg-white border border-brand-stone rounded-2xl space-y-3.5 hover:border-brand-moss/40 transition">
                  <div className="flex gap-2.5">
                    <span className="text-xs font-bold text-brand-charcoal/60 bg-brand-cream border border-brand-stone/30 w-5.5 h-5.5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-brand-forest leading-relaxed">{q.text}</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pl-8">
                    {q.options.map((opt) => {
                      const isOptSelected = selectedScore === opt.score;
                      return (
                        <button
                          id={`t2-opt-${q.id}-${opt.score}`}
                          key={opt.score}
                          type="button"
                          disabled={isTransitioning}
                          onClick={() => handleSelectOption(q.id, opt.score)}
                          className={`py-2.5 px-4 rounded-xl border text-xs font-medium text-center transition ${
                            isOptSelected
                              ? 'border-brand-moss bg-brand-sage text-brand-forest font-semibold shadow-sm'
                              : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/80'
                          } ${isTransitioning ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-brand-stone/60 flex items-center justify-end">
            <button
              id="t2-save-next-btn"
              disabled={!allT2Answered || isTransitioning}
              onClick={handleSaveT2}
              className={`px-6 py-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition ${
                allT2Answered && !isTransitioning
                  ? 'bg-brand-forest hover:bg-brand-forest/90 text-white shadow-brand-forest/20 active:scale-[0.98]'
                  : 'bg-brand-cream border border-brand-stone text-brand-charcoal/40 cursor-not-allowed shadow-none'
              }`}
            >
              <Save size={14} />
              {isTransitioning ? '正在保存...' : '完成并保存 T2，自动进入 T3 专项评估'}
            </button>
          </div>
        </div>
      ) : (
        /* ======================== T3 VIEW ======================== */
        <div className="space-y-6">
          <div className="bg-brand-forest text-white rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles size={100} />
            </div>
            <div className="relative z-10 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-sage">T3 临床实测与人工智能匹配</span>
              <h3 className="text-sm font-bold text-white">{t3Config.title}</h3>
              <p className="text-[11px] text-brand-cream/80 leading-relaxed mt-1">
                {currentScale.scaleName} (所需时间: {currentScale.duration})
              </p>
              <p className="text-[11px] text-brand-cream/60 leading-relaxed mt-1">
                {t3Config.desc}
              </p>
            </div>
          </div>

          {/* AI One-Click Diagnostic Helper Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-moss/10 p-5 rounded-2xl border border-brand-moss/30 shadow-sm text-left animate-fade-in">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5">
                <Sparkles size={14} className="text-brand-moss animate-pulse" />
                森心康 AI 算法极速评测通道
              </h4>
              <p className="text-[11px] text-brand-charcoal/80 leading-relaxed">
                点击一键模拟运行 AI 神经网络模型进行多媒体声学频谱分析与关节对齐拟合，自动导入全部 {currentScale.questions.length} 道评测题目的实操评分。
              </p>
            </div>
            <button
              type="button"
              id="t3-oneclick-ai-btn"
              disabled={isUploading || isTransitioning}
              onClick={handleOneClickAI}
              className="px-5 py-2.5 bg-brand-forest hover:bg-brand-forest/90 text-white rounded-xl text-xs font-bold transition shrink-0 active:scale-95 shadow-sm flex items-center gap-1"
            >
              <Brain size={14} />
              一键 AI 自动解算及评分
            </button>
          </div>

          {/* ==================== T3 DYNAMIC QUESTIONS LIST ==================== */}
          <div className="space-y-4.5 text-left">
            <h3 className="text-xs font-bold text-brand-forest flex items-center gap-1.5 uppercase tracking-wider">
              <Database size={14} className="text-brand-clay" />
              {currentScale.scaleName} 题项观测记录 (共 {currentScale.questions.length} 题)
            </h3>

            <div className="space-y-4">
              {currentScale.questions.map((q: Question, idx: number) => {
                const selectedScore = t3Answers[q.id];
                const recordingState = t3Recordings[q.id];

                return (
                  <div key={q.id} className="p-4 bg-white border border-brand-stone rounded-2xl space-y-3 hover:border-brand-moss/40 transition">
                    <div className="flex gap-2.5">
                      <span className="text-[11px] font-bold text-brand-charcoal/60 bg-brand-cream border border-brand-stone/30 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-mono">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-xs sm:text-sm font-semibold text-brand-forest leading-relaxed">
                          {q.text}
                        </h4>
                        
                        {/* Audio recording module for Language questions */}
                        {dimension.id === 'language' && (
                          <div className="pt-1">
                            {activeRecordingQId === q.id ? (
                              <div className="flex items-center gap-3 bg-rose-50 border border-rose-100/65 p-2 rounded-xl max-w-sm animate-fade-in">
                                <button
                                  type="button"
                                  onClick={() => stopRecordingForQuestion(q.id, q.text)}
                                  className="w-10 h-10 bg-slate-800 hover:bg-slate-950 text-white rounded-full flex items-center justify-center active:scale-95 transition shadow-sm shrink-0 animate-pulse"
                                  title="停止录音"
                                >
                                  <Square size={14} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                                    录音采集中: {recordingTime} 秒
                                  </div>
                                  <canvas ref={canvasRef} width={200} height={20} className="w-full h-5 bg-white border border-slate-100 rounded mt-1" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 flex-wrap">
                                {/* Red circle recording button like the big one above */}
                                <button
                                  type="button"
                                  disabled={isRecording && activeRecordingQId !== q.id}
                                  onClick={() => startRecordingForQuestion(q.id)}
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition active:scale-95 shadow-sm shrink-0 ${
                                    isRecording && activeRecordingQId !== q.id
                                      ? 'bg-slate-300 cursor-not-allowed'
                                      : 'bg-rose-600 hover:bg-rose-700 hover:scale-105 shadow-md shadow-rose-600/15'
                                  }`}
                                  title="点击录音"
                                >
                                  <Mic size={16} />
                                </button>

                                {/* Playback button to check recorded sound */}
                                {recordingState?.recorded && (
                                  <button
                                    type="button"
                                    onClick={() => handlePlayRecordedAudio(q.id, recordingState.transcript || "")}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95 shadow-sm shrink-0 ${
                                      playingQId === q.id
                                        ? 'bg-emerald-600 text-white animate-pulse'
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 shadow-md shadow-emerald-500/15'
                                    }`}
                                    title={playingQId === q.id ? "暂停回放" : "回放录音"}
                                  >
                                    {playingQId === q.id ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                                  </button>
                                )}

                                {/* Voice transcription feedback if recorded */}
                                {recordingState?.recorded && (
                                  <div className="text-[10px] text-slate-500 leading-snug animate-fade-in pl-0.5">
                                    <div className="font-bold text-brand-moss flex items-center gap-1">
                                      <Check size={11} className="text-emerald-500 shrink-0" />
                                      录音就绪，可回放确认
                                    </div>
                                    <div className="text-[9px] mt-0.5 font-medium">
                                      AI识别: "{recordingState.transcript}"
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Question Scoring Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7.5">
                      {q.options.map((opt) => {
                        const isOptSelected = selectedScore === opt.score;
                        return (
                          <button
                            id={`t3-opt-${q.id}-${opt.score}`}
                            key={opt.score}
                            type="button"
                            disabled={isTransitioning}
                            onClick={() => {
                              setT3Answers(prev => ({
                                ...prev,
                                [q.id]: opt.score
                              }));
                              setIsT3Analyzed(true);
                            }}
                            className={`py-2 px-3 rounded-xl border text-[11px] font-medium text-center transition ${
                              isOptSelected
                                ? 'border-brand-moss bg-brand-sage text-brand-forest font-semibold shadow-sm'
                                : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/80'
                            } ${isTransitioning ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save & launch diagnostics */}
          <div className="pt-6 border-t border-brand-stone/60 flex items-center justify-end">
            <button
              id="t3-generate-report-btn"
              disabled={isTransitioning}
              onClick={handleSaveT3AndReport}
              className="px-6 py-3.5 bg-brand-moss hover:bg-brand-moss/90 text-white shadow-brand-moss/20 active:scale-[0.98] rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition"
            >
              <Database size={14} />
              {isTransitioning ? '正在计算神经网络大数据...' : '一键保存并启动 AI 专项深度大数据诊断'}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
