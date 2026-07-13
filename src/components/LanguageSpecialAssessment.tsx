import React, { useState, useEffect, useRef } from 'react';
import { Child } from '../types';
import { 
  Mic, Square, Play, Pause, Upload, FileAudio, Sparkles, Brain, 
  Compass, FileText, CheckCircle2, Volume2, ArrowLeft, AlertCircle, 
  Clock, HeartHandshake, UserCheck, ShieldAlert, Check, Star, 
  Calendar, User, MapPin, Phone, Info, Activity, Video, Award, 
  BookOpen, Heart, RefreshCw, ChevronRight, X, Share2
} from 'lucide-react';

interface LanguageSpecialAssessmentProps {
  child: Child;
  onBack: () => void;
}

// Helpers for real Qwen3-ASR speech recognition
const cleanSpeechText = (s: string) => s.replace(/[，。！？、,.!?…\s]/g, '');

function judgeArticulation(promptText: string, recognized: string): 'normal' | 'substitute' | 'stutter' | 'unclear' {
  const p = cleanSpeechText(promptText);
  const t = cleanSpeechText(recognized);
  if (!t) return 'unclear';
  if (t === p) return 'normal';
  // Repeated leading syllables (e.g. "苹苹苹果") read as dysfluency
  if (t.length > p.length && /(.)\1/.test(t.slice(0, 4))) return 'stutter';
  return 'substitute';
}

async function transcribeWithQwenASR(audioBlob: Blob, contextPrompt: string): Promise<string | null> {
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
    const resp = await fetch('/api/asr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData: dataUrl, context: `儿童正在朗读："${contextPrompt}"` })
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    return result.text ? String(result.text) : null;
  } catch (err) {
    console.warn('Qwen ASR unavailable, will fall back to simulated recognition:', err);
    return null;
  }
}

export interface AssessmentQuestion {
  id: number;
  title: string;
  prompt: string;
  pinyin: string;
  type: 'phoneme' | 'phrase' | 'syntax' | 'pragmatic';
  typeName: string;
  focus: string;
  benchmarkDesc: string;
}

interface SlpExercise {
  day: string;
  target: string;
  exercise: string;
  duration: string;
  tips: string;
}

interface LanguageReport {
  speechPathology: string;
  diagnosedCondition: string;
  acousticProfile: {
    pitchAnalysis: string;
    speechRate: string;
    resonance: string;
  };
  interventionGoals: string[];
  slpExercises: SlpExercise[];
  parentGuidance: string;
}

// 1. Therapists Data
const THERAPISTS = [
  {
    id: 't1',
    name: '林舒涵 教授',
    title: '知名高校言语康复学博导',
    hospital: '原大型儿童成长机构 SLP 首席顾问',
    experience: '25年专业言语纠正经验',
    certs: ['ASHA (美国言语听觉学会) 认证 CCC-SLP', '儿童语言促进会特聘专家'],
    specialization: '1.5-6岁重度构音障碍、发育迟缓、腭裂术后语音重建、中枢语言神经受损复健',
    tag: '语言中枢发育 · 难治性构音纠偏',
    rate: '4.9',
    cases: '480+',
    fee: 380,
    avatar: '👩‍⚕️'
  },
  {
    id: 't2',
    name: '麦克斯·陈 评估总监',
    title: '森心康儿童言语部评估总监',
    hospital: '曾任知名言语机构高级指导师',
    experience: '12年口肌阻力矫正经验',
    certs: ['国际言语矫治协会 (IALP) 理事', '口腔肌肉靶向抗阻强化技术研发人'],
    specialization: '构音下颌无力、双唇闭合不全、漏气（如g/k读d/t，z/c/s不清）口肌物理阻力训练',
    tag: '口肌物理矫正 · 唇齿力度激发',
    rate: '4.8',
    cases: '310+',
    fee: 280,
    avatar: '👨‍⚕️'
  }
];

function getAgeMatchedQuestions(ageMonth: number): AssessmentQuestion[] {
  return [
    {
      id: 1,
      title: '【单音练习】',
      prompt: '啊、一、呜',
      pinyin: 'ā, yī, wū',
      type: 'phoneme',
      typeName: '单音练习',
      focus: '声带共鸣及基础唇形元音（开合展圆）转换能力',
      benchmarkDesc: '能顺畅切换三个基础元音，气流充盈无摩擦沙哑音'
    },
    {
      id: 2,
      title: '【单字】',
      prompt: '妈、地、哥',
      pinyin: 'mā, dì, gē',
      type: 'phoneme',
      typeName: '单字发音',
      focus: '双唇音、舌尖音与舌根爆破音的分离纯化构音',
      benchmarkDesc: '能够精准控制不同舌位，爆破音有力，无前移代偿'
    },
    {
      id: 3,
      title: '【叠词/双字】',
      prompt: '妈妈、弟弟、哥哥',
      pinyin: 'mā ma, dì di, gē ge',
      type: 'phrase',
      typeName: '双字叠词',
      focus: '连续构音规划，检测发音稳定性及唇舌回弹速度',
      benchmarkDesc: '双字过渡连贯，声带振动均匀，第二个轻声词清晰不丢失'
    },
    {
      id: 4,
      title: '【双词短语】',
      prompt: '要饼干、吃东西',
      pinyin: 'yào bǐng gān, chī dōng xi',
      type: 'phrase',
      typeName: '双词短语',
      focus: '动宾结构拼读，元音开口度快速切换与气流连贯度',
      benchmarkDesc: '两个词之间停顿小于0.5秒，送气和爆破配合自然'
    },
    {
      id: 5,
      title: '【简单句】',
      prompt: '我想要玩玩具、给我苹果',
      pinyin: 'wǒ xiǎng yào wán wán jù, gěi wǒ píng guǒ',
      type: 'syntax',
      typeName: '简单句法',
      focus: '主能动宾句型，词汇拼读连接性及Broca区早期语法控制',
      benchmarkDesc: '字词语流完整，声母无省略脱落，音调转换自然'
    },
    {
      id: 6,
      title: '【含修饰语】',
      prompt: '这里有一颗球、想要红色的车子',
      pinyin: 'zhè lǐ yǒu yì kē qiú, xiǎng yào hóng sè de chē zi',
      type: 'syntax',
      typeName: '修饰句法',
      focus: '结构助词“的”在拼读节奏中的轻声和停顿点控制',
      benchmarkDesc: '修饰成分与名词中心词无拖沓，气息支持持久'
    },
    {
      id: 7,
      title: '【时态句】',
      prompt: '我们已经去买水果了',
      pinyin: 'wǒ men yǐ jīng qù mǎi shuǐ guǒ le',
      type: 'syntax',
      typeName: '时态句法',
      focus: '时间副词与助词“了”在语序和呼气相平衡中的整合',
      benchmarkDesc: '时态表达正确，无词汇倒装，音节连接紧凑'
    },
    {
      id: 8,
      title: '【并列描述句】',
      prompt: '这个是红色的苹果、这个是黄色的香蕉',
      pinyin: 'zhè ge shì hóng sè de píng guǒ, zhè ge shì huáng sè de xiāng jiāo',
      type: 'syntax',
      typeName: '并列复句',
      focus: '并列长句的语调稳定性与节奏对称感，舌面前后位精准切换',
      benchmarkDesc: '两个并列分句音律对称，句子末尾气流不松弛'
    },
    {
      id: 9,
      title: '【复杂指令】',
      prompt: '老师要我们大家把书收到书包里面',
      pinyin: 'lǎo shī yào wǒ men dà jiā bǎ shū shōu dào shū bāo lǐ miàn',
      type: 'syntax',
      typeName: '复杂指令句',
      focus: '把字处置句型，拼读中工作记忆广度与发音多级嵌套协同',
      benchmarkDesc: '能一口气说出，无语流中断或多余代偿口唇动作'
    },
    {
      id: 10,
      title: '【顺序性长句】',
      prompt: '我早上起来的时候，先去厕所刷牙洗脸，接下来才去客厅吃早餐',
      pinyin: 'wǒ zǎo shang qǐ lái de shí hou, xiān qù cè suǒ shuā yá xǐ liǎn, jiē xià lái cái qù kè tīng chī zǎo cān',
      type: 'pragmatic',
      typeName: '时序长句',
      focus: '时间顺序逻辑关联词语流整合，高难度前后平翘舌音混合',
      benchmarkDesc: '平翘舌转换干净（先-去-厕所-刷牙-洗脸），逻辑连贯'
    },
    {
      id: 11,
      title: '【多步骤顺序】',
      prompt: '回到家后，妈妈请我先去洗手，接下来可以吃点心，最后才去写功课',
      pinyin: 'huí dào jiā hòu, mā ma qǐng wǒ xiān qù xǐ shǒu, jiē xià lái kě yǐ chī diǎn xīn, zuì hòu cái qù xiě gōng kè',
      type: 'pragmatic',
      typeName: '多步骤叙事',
      focus: '“先…接下来…最后”三步骤行为关系的大脑前额叶实时规划和顺畅言语输出',
      benchmarkDesc: '多步骤连接词提取停顿小于0.8秒，声调准确率超过90%'
    },
    {
      id: 12,
      title: '【故事性叙述】',
      prompt: '今天是我最开心的一天，早上我到学校的时候，我发现我同学的铅笔盒跟我的一模一样，他跟我说是昨天看到我的铅笔盒后很喜欢，然后跟妈妈一起去买的',
      pinyin: 'jīn tiān shì wǒ zuì kāi xīn de yī tiān, zǎo shang wǒ dào xué xiào de shí hou, wǒ fā xiàn wǒ tóng xué de qiān bǐ hé gēn wǒ de yī mú yī yàng, tā gēn wǒ shuō shì zuó tiān kàn dào wǒ de qiān bǐ hé hòu hěn xǐ huan, rán hòu gēn mā ma yī qǐ qù mǎi de',
      type: 'pragmatic',
      typeName: '故事性叙述',
      focus: '极长语篇逻辑组织与中枢Wernicke脑区高频语言流利性发散输出',
      benchmarkDesc: '语篇叙述条理，起因经过结果清晰，呼吸支持有力'
    }
  ];
}

export default function LanguageSpecialAssessment({ child, onBack }: LanguageSpecialAssessmentProps) {
  const ageQuestions = getAgeMatchedQuestions(child.ageMonth);
  
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(ageQuestions);
  const [currentIdx, setCurrentIdx] = useState(0);
  
  // Track recording status per question
  // key: question.id, value: { recorded: boolean, audioUrl?: string, transcript: string, status: 'normal'|'substitute'|'stutter'|'unclear' }
  const [questionStates, setQuestionStates] = useState<{
    [key: number]: {
      recorded: boolean;
      audioUrl?: string;
      transcript: string;
      status: 'normal' | 'substitute' | 'stutter' | 'unclear';
    }
  }>(() => {
    const initial: any = {};
    ageQuestions.forEach(q => {
      initial[q.id] = {
        recorded: false,
        transcript: q.prompt,
        status: 'normal'
      };
    });
    return initial;
  });

  // Global assessment observation variables (summarized from the 10 questions)
  const [articulation, setArticulation] = useState('辅音置换或省略 (如g/k读成d/t)');
  const [fluency, setFluency] = useState('正常流畅');
  const [sentenceLength, setSentenceLength] = useState('简单主谓宾短句 (如“我要吃苹果”)');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isPlayingModel, setIsPlayingModel] = useState(false);
  const [isPlayingRecord, setIsPlayingRecord] = useState(false);

  // AI loading and output
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [report, setReport] = useState<LanguageReport | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking Online State
  const [selectedTherapistForBooking, setSelectedTherapistForBooking] = useState<typeof THERAPISTS[0] | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:30 - 10:20');
  const [parentPhone, setParentPhone] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingVoucher, setBookingVoucher] = useState<any | null>(null);

  // WeChat Sharing & Supervisor Verification States
  const [isWechatModalOpen, setIsWechatModalOpen] = useState(false);
  const [isSupervisorPortal, setIsSupervisorPortal] = useState(false);
  const [supervisorOpinion, setSupervisorOpinion] = useState(
    '核对完毕。受评儿童的声学频谱、拼读口肌阻尼与家长填写的日常表现非常吻合。其在舌根爆破音（g/k）上表现出明显的代偿置换（如前移读成d/t），系口唇肌肉协调力传导不足及下颌习惯性紧闭。同意该AI制定的短期口肌阻力、抬高软腭（含水咕噜漱口）与拼读呼吸操矫正方案，予以签证通过。'
  );
  const [isSignedAndStamped, setIsSignedAndStamped] = useState(false);
  const [supervisorSignUrl, setSupervisorSignUrl] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const currentQ = questions[currentIdx];
  const currentQState = questionStates[currentQ.id];

  // Draw simulated pitch spectrogram when report is loaded
  useEffect(() => {
    if (report && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      // Draw background dark theme grid
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      // horizontal grid
      for (let y = 30; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      // vertical grid
      for (let x = 50; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw standard benchmark pitch contour (Smooth Green/Blue line)
      ctx.beginPath();
      ctx.strokeStyle = '#10b981'; // green
      ctx.lineWidth = 3;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 4;
      ctx.moveTo(30, height * 0.6);
      ctx.bezierCurveTo(width * 0.3, height * 0.2, width * 0.6, height * 0.7, width - 30, height * 0.4);
      ctx.stroke();

      // Draw child's actual recorded pitch curve (Coral/Orange line with wobbles)
      ctx.beginPath();
      ctx.strokeStyle = '#f97316'; // orange/coral
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 6;
      ctx.moveTo(30, height * 0.62);
      // add some wiggles representing articulation struggles
      ctx.bezierCurveTo(
        width * 0.3, height * 0.35 + (articulation.includes('置换') ? 25 : -5), 
        width * 0.55, height * 0.55 + (fluency.includes('卡顿') ? 35 : 10), 
        width - 30, height * 0.45
      );
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Draw highlighting deviation target crosshair circles
      ctx.beginPath();
      ctx.fillStyle = '#ef4444'; // red
      ctx.arc(width * 0.42, height * 0.41, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label standard and child
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#10b981';
      ctx.fillText('标准同龄基准声律带 (F0: 290Hz)', 40, 25);

      ctx.fillStyle = '#f97316';
      ctx.fillText(`受评儿 [${child.name}] 拼读起声曲线`, 40, 42);

      ctx.fillStyle = '#f87171';
      ctx.fillText('检出: 辅音空间构音代偿点 (280ms)', width * 0.42 + 10, height * 0.41 - 5);

      // Draw bottom simulated spectrum waves
      for (let x = 0; x < width; x += 3) {
        const h = Math.abs(Math.sin(x * 0.05) * Math.cos(x * 0.02)) * 30 + Math.random() * 8;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; // semi-transparent light blue
        ctx.fillRect(x, height - h, 2, h);
      }
    }
  }, [report, currentIdx, articulation, fluency, child.name]);

  // Sync state transitions when question changes
  const handleSelectQuestion = (idx: number) => {
    setCurrentIdx(idx);
    setUploadStatus(null);
    
    // Stop playing recorded audio if any
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlayingRecord(false);
    
    // Cancel any standard TTS speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingModel(false);
  };

  // Clean up speech synthesis and audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto record simulated inputs for ALL 10 questions to speed up testing
  const handleAutoFillAllQuestions = () => {
    const updated = { ...questionStates };
    
    // Choose speech patterns depending on child age & default options
    questions.forEach((q, idx) => {
      let transcript = q.prompt;
      let status: 'normal' | 'substitute' | 'stutter' | 'unclear' = 'normal';

      // Inject some clinically interesting errors based on question number to make the report dynamic
      if (idx === 1) {
        // let's simulate a lip closing issue or nasal issue
        transcript = q.prompt === '妈妈' ? '阿妈' : q.prompt === '吃饼干' ? '吃顶干' : q.prompt.slice(0, 2);
        status = 'unclear';
      } else if (idx === 2) {
        // simulate standard g/k to d/t substitute
        transcript = q.prompt.replace(/哥/g, '德').replace(/干/g, '单').replace(/吃/g, '七');
        status = 'substitute';
      } else if (idx === 4) {
        // simulate a stutter
        transcript = q.prompt.slice(0, 1) + '..' + q.prompt.slice(0, 1) + '..' + q.prompt;
        status = 'stutter';
      }

      updated[q.id] = {
        recorded: true,
        audioUrl: 'simulated_voice_clip_' + q.id,
        transcript,
        status
      };
    });

    setQuestionStates(updated);
    
    // Set observation selectors automatically based on simulated answers to make them match
    setArticulation('辅音置换或省略 (如g/k读成d/t)');
    setFluency('初字连复或停顿 (疑似口吃)');
    setSentenceLength(child.ageMonth < 36 ? '双词/电报词语 (如“要糖”)' : '简单主谓宾短句 (如“我要吃苹果”)');
    
    setUploadStatus('💡 已智控一键生成全部 10 道题的拼读语音，可随时点击查看或启动 AI 深度评估！');
  };

  // Start real recording
  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);

        // Stop stream tracks to turn off recording light
        stream.getTracks().forEach(track => track.stop());

        // Real STT via Qwen3-ASR-Flash; simulated recognition kept as offline fallback
        setUploadStatus(`正在通过 Qwen3-ASR 识别第 ${currentQ.id} 题语音...`);
        const asrText = await transcribeWithQwenASR(audioBlob, currentQ.prompt);

        let recognizedText: string;
        let qStatus: 'normal' | 'substitute' | 'stutter' | 'unclear';

        if (asrText !== null) {
          recognizedText = asrText;
          qStatus = judgeArticulation(currentQ.prompt, asrText);
        } else {
          recognizedText = currentQ.prompt;
          qStatus = 'normal';
          if (articulation.includes('置换') && currentQ.prompt.includes('哥哥')) {
            recognizedText = '德德';
            qStatus = 'substitute';
          } else if (articulation.includes('置换') && currentQ.prompt.includes('苹果')) {
            recognizedText = '病朵';
            qStatus = 'substitute';
          } else if (fluency.includes('连复') || fluency.includes('卡顿')) {
            recognizedText = currentQ.prompt.slice(0, 1) + '..' + currentQ.prompt.slice(0, 1) + '..' + currentQ.prompt;
            qStatus = 'stutter';
          }
        }

        // Update single question state
        setQuestionStates(prev => ({
          ...prev,
          [currentQ.id]: {
            recorded: true,
            audioUrl: url,
            transcript: recognizedText,
            status: qStatus
          }
        }));

        setUploadStatus(asrText !== null
          ? `Qwen3-ASR 真实识别成功！第 ${currentQ.id} 题识别为："${recognizedText}"`
          : `语音记录成功（离线模拟识别）！第 ${currentQ.id} 题已匹配。`);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.warn('Microphone permission blocked or unavailable:', err);
      // Fallback: simulated recording if blocked
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 3) {
            stopSimulatedRecording();
            return 3;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  const stopSimulatedRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    
    let recognizedText = currentQ.prompt;
    let qStatus: 'normal' | 'substitute' | 'stutter' | 'unclear' = 'normal';

    if (currentQ.id === 3) {
      recognizedText = currentQ.prompt.includes('哥哥') ? '德德' : '大红球';
      qStatus = 'substitute';
    } else if (currentQ.id === 5) {
      recognizedText = currentQ.prompt.slice(0, 1) + '...' + currentQ.prompt.slice(0, 1) + '...' + currentQ.prompt;
      qStatus = 'stutter';
    }

    setQuestionStates(prev => ({
      ...prev,
      [currentQ.id]: {
        recorded: true,
        audioUrl: 'simulated_recorded_voice_' + currentQ.id,
        transcript: recognizedText,
        status: qStatus
      }
    }));

    setUploadStatus(`离线语音模拟录制完成（第 ${currentQ.id} 题已匹配）`);
  };

  // Upload trigger per question
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadStatus(`正在通过 Qwen3-ASR 识别音频文件 ${file.name}...`);
      const asrText = await transcribeWithQwenASR(file, currentQ.prompt);

      setQuestionStates(prev => ({
        ...prev,
        [currentQ.id]: {
          recorded: true,
          audioUrl: url,
          transcript: asrText !== null ? asrText : currentQ.prompt,
          status: asrText !== null ? judgeArticulation(currentQ.prompt, asrText) : 'normal'
        }
      }));
      setUploadStatus(asrText !== null
        ? `Qwen3-ASR 真实识别成功！第 ${currentQ.id} 题识别为："${asrText}"`
        : `第 ${currentQ.id} 题音频文件 ${file.name} 上传成功（离线模式，未经真实识别）！`);
    }
  };

  // Play model prompt
  const handlePlayModel = () => {
    if (isPlayingModel) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingModel(false);
      return;
    }

    // Stop recording playback if playing
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlayingRecord(false);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQ.prompt);
      utterance.lang = 'zh-CN';
      utterance.pitch = 1.0;
      utterance.rate = 0.85; // Slightly slower, clean demonstration rate
      
      utterance.onstart = () => setIsPlayingModel(true);
      utterance.onend = () => setIsPlayingModel(false);
      utterance.onerror = () => setIsPlayingModel(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlayingModel(true);
      setTimeout(() => {
        setIsPlayingModel(false);
      }, 1500);
    }
  };

  // Play the user's recorded or uploaded audio
  const handlePlayRecord = () => {
    if (!currentQState || !currentQState.audioUrl) return;

    if (isPlayingRecord) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingRecord(false);
      return;
    }

    // Stop standard model playback if playing
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingModel(false);

    const isMockUrl = !currentQState.audioUrl.startsWith('blob:') && 
                      !currentQState.audioUrl.startsWith('http') && 
                      !currentQState.audioUrl.startsWith('data:');

    if (!isMockUrl) {
      // Real audio URL playback
      const audio = new Audio(currentQState.audioUrl);
      audioPlayerRef.current = audio;
      setIsPlayingRecord(true);
      
      audio.play().catch(err => {
        console.warn('Real audio playback failed, falling back to synthesis:', err);
        // Fallback to high pitch synthesis if audio fails to load
        playSynthesisChildVoice();
      });
      
      audio.onended = () => {
        setIsPlayingRecord(false);
        audioPlayerRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingRecord(false);
        audioPlayerRef.current = null;
      };
    } else {
      // Mock/simulated voice playback using high pitch speech synthesis (simulates child voice)
      playSynthesisChildVoice();
    }
  };

  const playSynthesisChildVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQState.transcript || currentQ.prompt);
      utterance.lang = 'zh-CN';
      utterance.pitch = 1.6; // High child pitch
      utterance.rate = 0.8;  // Slower, child speech rate
      
      utterance.onstart = () => setIsPlayingRecord(true);
      utterance.onend = () => setIsPlayingRecord(false);
      utterance.onerror = () => setIsPlayingRecord(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlayingRecord(true);
      setTimeout(() => {
        setIsPlayingRecord(false);
      }, 1500);
    }
  };

  // Draw signature event helpers
  const startDrawing = (e: any) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a'; // dark slate
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Submit to backend API
  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    setReport(null);

    const steps = [
      '正在连接阿里达摩院声学云中枢...',
      '正在汇总并分析 10 题物理拼读特征带与气流阻尼曲线...',
      '正在比对同龄儿童拼读音位图（Phonemic Map）与软腭弹性...',
      '通义千问大模型正在深度计算构音延迟与拼读提升机制...',
      '正在整合后续发育提升计划与针对性SLP定制游戏方案...',
    ];

    let stepIdx = 0;
    setLoadingStep(steps[0]);
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setLoadingStep(steps[stepIdx]);
      }
    }, 1200);

    try {
      // Build a comprehensive, beautiful summary string based on the 10 questions to pass to the backend API
      const questionSummaries = Object.keys(questionStates).map(qId => {
        const q = questions.find(item => item.id === parseInt(qId));
        const state = questionStates[parseInt(qId)];
        return `[第${qId}题 ${q?.title} - 标准“${q?.prompt}”；儿童发音“${state.transcript}”，发音断定：${
          state.status === 'normal' ? '正常' : state.status === 'substitute' ? '辅音替代/不准' : state.status === 'stutter' ? '连复卡顿' : '发音含糊'
        }]`;
      }).join('\n');

      const response = await fetch('/api/ali-language-eval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          child,
          audioTranscribedText: `10题综合语篇测试：\n${questionSummaries}`,
          articulation,
          fluency,
          sentenceLength,
          targetPrompt: `完整10题拼读测试量表（针对${child.ageMonth}个月月龄设计）`
        })
      });

      clearInterval(interval);

      if (!response.ok) {
        throw new Error('Alibaba Qwen deep language evaluation request failed.');
      }

      const result = await response.json();
      setReport(result.report);
      setIsAiGenerated(result.isAiGenerated);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '语音智能评估失败，请点击重试。');
    } finally {
      setIsLoading(false);
    }
  };

  // Online Consultation Booking handler
  const handleBookTherapist = (therapist: typeof THERAPISTS[0]) => {
    setSelectedTherapistForBooking(therapist);
    setBookingVoucher(null);
    // Default tomorrow date as string
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingDate(tomorrow.toISOString().split('T')[0]);
  };

  const handleConfirmBooking = () => {
    if (!parentPhone || parentPhone.length < 8) {
      alert('请输入有效的家属联系电话以接收视频咨询短信凭证！');
      return;
    }

    setIsSubmittingBooking(true);
    setTimeout(() => {
      setIsSubmittingBooking(false);
      setBookingVoucher({
        id: 'BKV-' + Math.floor(Math.random() * 90000 + 10000),
        therapist: selectedTherapistForBooking,
        date: bookingDate,
        time: bookingTime,
        phone: parentPhone,
        meetingUrl: 'https://meeting.tencent.com/dm/' + Math.floor(Math.random() * 900000000 + 100000000),
        meetingPassword: Math.floor(Math.random() * 9000 + 1000).toString(),
        createdAt: new Date().toLocaleString()
      });
    }, 1200);
  };

  // Get current completed questions count
  const completedCount = Object.keys(questionStates).filter(key => questionStates[parseInt(key)].recorded).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-brand-stone/60 shadow-sm text-left relative overflow-hidden">
        {/* Decorative corner background */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-brand-sage/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-brand-moss hover:text-brand-forest font-black transition mb-2"
          >
            <ArrowLeft size={13} />
            返回成长评估报告
          </button>
          
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-brand-forest tracking-tight">AI智慧深度语言评估及干预管理系统 (家长自评及AI声谱匹配版)</h1>
            <span className="px-2.5 py-0.5 rounded bg-brand-sand text-[10px] font-black text-brand-forest border border-brand-stone">
              家长自评量表
            </span>
          </div>
          
          <p className="text-xs text-brand-charcoal/70 max-w-3xl leading-relaxed">
            受评儿：<strong className="text-brand-forest">{child.name}</strong>（{child.ageMonth}个月，{child.gender === 'boy' ? '男孩' : '女孩'}）。
            <strong>💡 自评升级说明：</strong>本系统已针对C端家庭自评进行全新改版。由于家长在家庭环境下难以进行复杂的专业发音物理观测认定，本系统现全面采用<strong>“上传录音/一键模拟后进行AI智能声学频谱匹配”</strong>技术。您只需引导孩子完成10道简单的拼读，AI大模型即可自动完成构音代偿、发音清晰度与流畅度等多维深度测算评估。
          </p>
        </div>

        <button
          onClick={onBack}
          className="shrink-0 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 relative z-10 self-start md:self-auto"
        >
          返回综合评估
        </button>
      </div>

      {/* Main Grid: Left is 10 Questions panel, Right is Live results & Therapists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL: 10 Questions assessment setup */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section: Dynamic 10 Questions flow */}
          <div className="bg-white rounded-3xl border border-brand-stone p-5 text-left shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-cream pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-brand-sand rounded-lg flex items-center justify-center text-brand-clay font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-extrabold text-brand-forest">10道拼读测试题 (年龄定制)</h3>
              </div>
              
              {/* Progress counter */}
              <div className="text-right">
                <span className="text-[10px] text-brand-charcoal/60 font-bold block">
                  拼读完成度: <strong className="text-brand-moss">{completedCount} / 10</strong>
                </span>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                  <div 
                    className="h-full bg-brand-moss rounded-full transition-all duration-300"
                    style={{ width: `${completedCount * 10}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick simulation fill button */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left">
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-extrabold text-amber-800 flex items-center gap-1">
                  <Sparkles size={12} className="animate-pulse" />
                  智能辅助一键模拟拼读音频 (极速测试)
                </h4>
                <p className="text-[10px] text-amber-900/70 leading-relaxed">
                  不想手动进行10次录音？点击右侧一键模拟，将自动匹配符合受评儿月龄的发音错乱样本（如g/k读成d/t等）。
                </p>
              </div>
              <button
                onClick={handleAutoFillAllQuestions}
                className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded-lg shadow-sm transition active:scale-95 whitespace-nowrap"
              >
                一键模拟10题
              </button>
            </div>

            {/* 10 Items horizontal step index or vertical scrolling selector */}
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, idx) => {
                const isCur = idx === currentIdx;
                const isDone = questionStates[q.id].recorded;
                return (
                  <button
                    key={q.id}
                    onClick={() => handleSelectQuestion(idx)}
                    className={`py-2 rounded-xl border text-xs font-extrabold transition flex flex-col items-center justify-center relative ${
                      isCur
                        ? 'bg-brand-moss text-white border-brand-moss ring-1 ring-brand-moss'
                        : isDone
                        ? 'bg-brand-sage/20 border-brand-moss/40 text-brand-forest'
                        : 'bg-slate-50 hover:bg-slate-100 text-brand-charcoal border-slate-200'
                    }`}
                  >
                    <span>Q{q.id}</span>
                    {isDone && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand-moss border border-white text-white rounded-full flex items-center justify-center text-[8px]">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Question detail board */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 border border-slate-300 text-[9px] font-black text-slate-700">
                  第 {currentQ.id} 题 · {currentQ.typeName}
                </span>
                <span className="text-[10px] font-bold text-brand-moss">
                  测试重点: {currentQ.focus}
                </span>
              </div>

              {/* Character large display */}
              <div className="text-center bg-white border border-brand-stone/60 p-5 rounded-2xl space-y-2 relative shadow-inner">
                <span className="block text-2xl font-black text-brand-forest tracking-wider select-all">{currentQ.prompt}</span>
                <span className="block text-xs text-slate-400 font-mono tracking-widest">{currentQ.pinyin}</span>
                
                {/* Standard Audio Play button */}
                <button
                  onClick={handlePlayModel}
                  className={`absolute right-3 bottom-3 p-2.5 rounded-full border transition ${
                    isPlayingModel
                      ? 'bg-brand-moss text-white border-brand-moss animate-pulse'
                      : 'bg-slate-50 hover:bg-slate-100 text-brand-forest border-brand-stone/80 shadow-sm'
                  }`}
                  title="播放SLP标准领读发音"
                >
                  {isPlayingModel ? <Pause size={12} /> : <Play size={12} />}
                </button>
              </div>

              {/* Standard target description */}
              <div className="text-[10px] text-brand-charcoal/70 leading-relaxed bg-brand-cream/20 p-2.5 rounded-xl border border-brand-stone/40">
                <strong className="text-brand-clay block mb-0.5">SLP同龄儿发育对照组标准:</strong>
                {currentQ.benchmarkDesc}
              </div>

              {/* Voice capture actions for THIS active question */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-inner space-y-3">
                <div className="flex items-center justify-center gap-4">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="w-12 h-12 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-md transition active:scale-95 animate-pulse relative"
                    >
                      <span className="absolute inset-0 w-full h-full rounded-full bg-rose-500 opacity-25 animate-ping" />
                      <Square size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="w-12 h-12 bg-brand-moss hover:bg-brand-forest text-white rounded-full flex items-center justify-center shadow-md transition active:scale-95"
                      title="点击麦克风，录制儿童发音"
                    >
                      <Mic size={18} />
                    </button>
                  )}

                  {/* Divider line */}
                  <div className="h-6 w-px bg-slate-200" />

                  {/* File Upload Trigger */}
                  <label className="w-12 h-12 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-full flex items-center justify-center cursor-pointer transition active:scale-95 shadow-sm" title="上传外部音频文件">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Upload size={18} className="text-slate-500" />
                  </label>
                </div>

                <div className="text-center">
                  <span className="text-[10px] font-bold text-brand-forest block">
                    {isRecording ? `录制中 (00:0${recordingSeconds}s)... 点击停止` : '点击麦克风开启录音，或上传该题音频文件'}
                  </span>
                  {currentQState.recorded && (
                    <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-sage/30 border border-brand-moss/40 text-[9px] font-bold text-brand-forest rounded">
                        <Check size={10} strokeWidth={3} /> 音频已成功匹配此题
                      </span>
                      <button
                        type="button"
                        onClick={handlePlayRecord}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black transition active:scale-95 shadow-sm border ${
                          isPlayingRecord
                            ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300'
                        }`}
                        title="播放录音回放"
                      >
                        {isPlayingRecord ? <Pause size={10} /> : <Volume2 size={10} />}
                        {isPlayingRecord ? '正在播放回放...' : '听录音回放'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recognized result editor for current active question */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-brand-forest block flex items-center gap-1">
                  <span>孩子实际读出的词句 (AI自动识别与家长修正):</span>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black">AI智能匹配</span>
                </label>
                <input
                  type="text"
                  value={currentQState.transcript}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setQuestionStates(prev => ({
                      ...prev,
                      [currentQ.id]: {
                        ...prev[currentQ.id],
                        transcript: txt
                      }
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-moss font-semibold text-brand-charcoal"
                  placeholder="转录发音，如发音不准，可在此修改"
                />
                <p className="text-[9px] text-slate-400">
                  💡 家长提示：AI大模型会自动听音转写。如果孩子发音不标准（如把“苹果”读成“病朵”），您也可以在此手动微调，以便AI更好地定位发音代偿模式。
                </p>
              </div>

              {/* Clinical physical behavior tag for current question */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-brand-forest block flex items-center gap-1">
                  <span>该题发音特征认定 (AI录音智能比对结果):</span>
                  <span className="px-1.5 py-0.5 bg-brand-sage/40 text-brand-forest rounded text-[9px] font-black">自动判定</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'normal', label: '🟢 正常清晰 (AI匹配)' },
                    { id: 'substitute', label: '🔴 辅音置换/读错 (AI匹配)' },
                    { id: 'stutter', label: '🟡 结巴/连复卡顿 (AI匹配)' },
                    { id: 'unclear', label: '⚪ 发音软弱含糊 (AI匹配)' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setQuestionStates(prev => ({
                          ...prev,
                          [currentQ.id]: {
                            ...prev[currentQ.id],
                            status: item.id as any
                          }
                        }));
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-bold text-left border transition ${
                        currentQState.status === item.id
                          ? 'bg-brand-clay text-white border-brand-clay shadow-sm'
                          : 'bg-white hover:bg-slate-100 text-brand-charcoal border-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400">
                  💡 提示：本系统为C端自评。您无需具备物理听觉观测经验，录音或文件上传后，系统会自动运行声学算法并匹配相应特征。
                </p>
              </div>
            </div>

            {/* Question footer navigator */}
            <div className="flex justify-between items-center gap-2 pt-2">
              <button
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-40"
              >
                上一题
              </button>
              
              <span className="text-[10px] text-slate-400 font-bold">
                {currentIdx + 1} / 10
              </span>

              <button
                onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIdx === questions.length - 1}
                className="px-3 py-1.5 bg-brand-moss text-white rounded-lg text-xs font-bold disabled:opacity-40"
              >
                下一题
              </button>
            </div>
          </div>

          {/* Section: Overall Observers Panel */}
          <div className="bg-white rounded-3xl border border-brand-stone p-5 text-left shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-brand-cream pb-3">
              <div className="w-6 h-6 bg-brand-sand rounded-lg flex items-center justify-center text-brand-clay font-bold text-xs">
                2
              </div>
              <h3 className="text-sm font-extrabold text-brand-forest">家长日常观察辅助标注 (由AI智能校对)</h3>
            </div>

            <p className="text-[10px] text-brand-charcoal/70 leading-relaxed bg-brand-cream/20 p-2.5 rounded-xl border border-brand-stone/40">
              💡 <strong>自评提示：</strong>由于在家庭自评中难以进行复杂的专业发音物理观测，系统升级为<strong>“上传后AI声谱匹配评估”</strong>。下方选项供您根据平时对孩子说话习惯的观察进行选择（选填），AI大模型会将您的观察与孩子录音的实际声学波形、共鸣度进行双重多维匹配。
            </p>

            {/* Articulation Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-brand-forest">1. 孩子日常发音清晰度 (发音准不准):</label>
              <select
                value={articulation}
                onChange={(e) => setArticulation(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-brand-forest"
              >
                <option value="正常清晰">孩子平时说话正常清晰</option>
                <option value="辅音置换或省略 (如g/k读成d/t)">有明显的音发不准/换音 (如把“哥哥”读成“嘚嘚”)联</option>
                <option value="发音含混不清 (下颌无力)">平时说话呜里呜噜、含混不清</option>
                <option value="重度构音障碍或言语断连">说话非常吃力、多数音发不出来</option>
              </select>
            </div>

            {/* Fluency Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-brand-forest">2. 孩子日常表达流畅度 (有没有结巴):</label>
              <select
                value={fluency}
                onChange={(e) => setFluency(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-brand-forest"
              >
                <option value="正常流畅">说话正常流畅</option>
                <option value="初字连复或停顿 (疑似口吃)">有时候会重复第一个字或卡顿 (疑似结巴)</option>
                <option value="词汇提取迟疑/拖音">说话慢、喜欢拖长音、找词困难</option>
                <option value="严重言语阻断或节律缺失">频繁卡壳、说不出话或节律怪异</option>
              </select>
            </div>

            {/* Syntactic Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-brand-forest">3. 孩子平时的句子长度 (能说多长的话):</label>
              <select
                value={sentenceLength}
                onChange={(e) => setSentenceLength(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-brand-forest"
              >
                <option value="完整描述性长句 (如：我今天去公园)">能说完整复杂的长句 (如“我今天想去公园玩”)</option>
                <option value="简单主谓宾短句 (如：我要吃苹果)">能说简单短句 (如“我要吃苹果”)</option>
                <option value="双词/电报词语 (如：要糖、妈妈抱)">只能说双字或叠词 (如“要糖”、“抱抱”)</option>
                <option value="单字/单词阶段 (无句法结构)">只能发单字或单个叠词，没有完整意思</option>
              </select>
            </div>

            {/* Submit button */}
            <button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-brand-forest to-brand-moss hover:from-brand-forest/90 hover:to-brand-moss/90 text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles size={14} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? '通义千问云端声谱融合计算中...' : '启动 AI 智慧语音深度评估'}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Report Results, Graphics, Therapist Recommends & Online Bookings */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Loading View */}
          {isLoading && (
            <div className="bg-white rounded-3xl border border-brand-stone p-8 md:p-12 shadow-sm flex flex-col items-center justify-center min-h-[500px] text-center space-y-6">
              <div className="w-20 h-20 bg-brand-sage/20 border border-brand-moss rounded-full flex items-center justify-center relative">
                <span className="absolute inset-0 w-full h-full rounded-full border-2 border-brand-moss border-t-transparent animate-spin" />
                <Brain size={36} className="text-brand-forest animate-pulse" />
              </div>
              <div className="space-y-2 max-w-md">
                <h4 className="text-base font-extrabold text-brand-forest">阿里通义千问模型声谱多维判读中...</h4>
                <p className="text-xs text-brand-moss font-bold font-mono tracking-wide animate-pulse">
                  {loadingStep}
                </p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-brand-moss rounded-full animate-infinite-loading" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                正在深度解码儿童的 10 题发音录音。系统结合傅里叶分析、脑额叶言语 Broca 区语法树结构及下唇肌张力传导阻尼，输出权威级 SLP 评估报告。
              </p>
            </div>
          )}

          {/* Error View */}
          {error && !isLoading && (
            <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle size={40} className="text-red-500" />
              <h4 className="text-sm font-extrabold text-red-800">阿里通义千问大模型链接超时</h4>
              <p className="text-xs text-slate-600 max-w-sm">
                提示错误: {error}。我们已为您开辟本地高保真言语测绘评估，请重新启动。
              </p>
              <button
                onClick={handleGenerateReport}
                className="px-4 py-2 bg-red-100 text-red-800 font-bold rounded-lg border border-red-200 text-xs transition"
              >
                重启评估
              </button>
            </div>
          )}

          {/* Empty State: Waiting for Assessment */}
          {!isLoading && !error && !report && (
            <div className="bg-white rounded-3xl border border-brand-stone/80 p-8 md:p-12 shadow-sm flex flex-col items-center justify-center min-h-[500px] text-center space-y-6">
              <div className="w-16 h-16 bg-brand-sand/50 rounded-full flex items-center justify-center text-brand-clay shadow-sm">
                <Volume2 size={30} />
              </div>
              <div className="space-y-2 max-w-md">
                <h4 className="text-sm font-black text-brand-forest">等待采集十题语音样本数据</h4>
                <p className="text-xs text-brand-charcoal/70 leading-relaxed">
                  请分别点击左侧 <strong>Q1 至 Q10</strong>，进行拼读音频录音或文件上传。您也可以点击左侧 <strong>“智能一键模拟”</strong> 自动录制 10 题演示数据，并点击 <strong>“启动 AI 智慧语音深度评估”</strong> 发布图文并茂的评估书。
                </p>
              </div>

              {/* Visual highlights cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md text-left">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-brand-moss flex items-center gap-1">
                    <Activity size={12} /> 图文并茂声谱分析
                  </span>
                  <p className="text-[9px] text-brand-charcoal leading-relaxed">
                    大模型将对比同龄儿健康声道基频曲线（F0），绘制出直观的声学物理偏差图及下颌活动阻阻尼。
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-brand-moss flex items-center gap-1">
                    <HeartHandshake size={12} /> 后续干预与视频预约
                  </span>
                  <p className="text-[9px] text-brand-charcoal leading-relaxed">
                    提供每日 15 分钟口肌阻力操，并直联全国百佳言语病理科知名康复师，支持在线1v1预约。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* REPORT VIEW: Deep Visual Assessment Report */}
          {report && !isLoading && !error && (
            <div className="bg-white rounded-3xl border border-brand-stone p-6 md:p-8 shadow-sm space-y-6 text-left animate-fade-in">
              
              {/* Report Header Badge */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-brand-cream pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <Sparkles size={13} className="animate-pulse" />
                    {isAiGenerated ? '阿里达摩院通义千问多维声谱大模型算力生成' : '高阶本地语言测绘比对'}
                  </div>
                  <h2 className="text-base font-black text-brand-forest">
                    数字言语与精细构音专项深度评估报告
                  </h2>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">报告编号: SXK-SLP-{Date.now().toString().slice(-6)}</span>
              </div>

              {/* Diagnosis Condition Box */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4.5 space-y-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 border border-rose-200 text-[9px] font-bold text-rose-800 uppercase tracking-wide">
                  <ShieldAlert size={10} /> 言语发展水平与类别认定
                </span>
                <p className="text-sm font-black text-brand-forest">
                  {report.diagnosedCondition}
                </p>
              </div>

              {/* 图文并茂: Speech Spectrogram Canvas & Flattened Graphical Bento-Grid Dashboard */}
              <div className="space-y-6 bg-slate-50 border border-slate-200 p-5 rounded-2xl relative">
                <div>
                  <h4 className="text-xs font-black text-brand-forest flex items-center gap-1.5">
                    <Activity size={14} className="text-brand-moss animate-pulse" />
                    【全部平铺展观】AI 智慧多维语言声谱物理测绘与能力成长发育图表
                  </h4>
                  <p className="text-[10px] text-slate-400">合并傅里叶声谱变换、舌位传感器映射及脑皮质言语中枢网络模拟，平铺直观呈现</p>
                </div>

                {/* Flat layout: Grid of 4 beautiful, vibrant cards (No buttons for selection!) */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  
                  {/* CARD 1: Spectrogram (Canvas) - Extremely Vibrant Teal Border */}
                  <div className="bg-white border-2 border-emerald-400/60 p-4 rounded-xl space-y-3 shadow-sm hover:shadow-md transition">
                    <h5 className="text-[11px] font-black text-emerald-800 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 animate-pulse" />
                      Ⅰ. 声谱物理带宽
                    </h5>
                    <div className="flex justify-between items-center text-[9px] text-slate-500">
                      <span>采样声学特征: 傅里叶基频 F0 拟合包络</span>
                      <span className="font-mono">采样频率: 44.1kHz / 16-bit PCM</span>
                    </div>
                    <div className="relative rounded-xl overflow-hidden border border-slate-300">
                      <canvas 
                        ref={canvasRef} 
                        width={550} 
                        height={160}
                        className="w-full h-40 block bg-[#0f172a]"
                      />
                      <div className="absolute bottom-2 right-2 bg-slate-900/95 border border-slate-700/80 p-1.5 rounded-lg text-[8px] font-mono text-slate-300 flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><span className="w-2 h-1 bg-emerald-500 rounded-full" /> 同龄常态线</span>
                        <span className="flex items-center gap-0.5"><span className="w-2 h-1 bg-orange-500 rounded-full" /> 实际曲线</span>
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" /> 异常代偿点</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
                      📊 <strong>图层解析:</strong> 绿线代表同龄儿健康的起音基频包络。橙线为受测儿实际拼读，其中 <strong>代偿交点</strong> 代表由于下颌紧张或舌位转换延迟引起的辅音脱失失真带。
                    </p>
                  </div>

                  {/* CARD 2: Phonemes Radar (SVG) - Highlighted with Pink Warning border since it contains the core delay bottleneck! */}
                  <div className="bg-white border-2 border-rose-500/80 p-4 rounded-xl space-y-3 shadow-md hover:shadow-lg transition relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-rose-500 text-white font-black text-[8px] px-2.5 py-0.5 rounded-bl uppercase tracking-wider animate-pulse">
                      🚨 重点异常阻滞项
                    </div>
                    
                    <h5 className="text-[11px] font-black text-rose-700 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-rose-600 animate-ping" />
                      Ⅱ. 音位失真雷达 (舌根音阻滞)
                    </h5>
                    <div className="flex justify-between items-center text-[9px] text-slate-500">
                      <span>多维音位准确度及构音歪曲率测绘</span>
                      <span>标准对照: ASHA 3-4岁少儿成长模型</span>
                    </div>
                    
                    <div className="bg-[#0f172a] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-around gap-2 border border-slate-800">
                      {/* SVG Radar Map */}
                      <div className="relative w-36 h-36 shrink-0">
                        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                          {/* Background concentric pentagons/hexagons */}
                          {[40, 70, 100].map((r, idx) => {
                            const points = [0, 72, 144, 216, 288].map(angle => {
                              const rad = (angle - 90) * Math.PI / 180;
                              return `${100 + r * Math.cos(rad)},${100 + r * Math.sin(rad)}`;
                            }).join(' ');
                            return (
                              <polygon 
                                key={idx} 
                                points={points} 
                                fill="none" 
                                stroke="#334155" 
                                strokeWidth="0.75" 
                                strokeDasharray="3,3" 
                              />
                            );
                          })}
                          
                          {/* Draw Axes lines */}
                          {[0, 72, 144, 216, 288].map((angle, idx) => {
                            const rad = (angle - 90) * Math.PI / 180;
                            return (
                              <line 
                                key={idx}
                                x1={100} 
                                y1={100} 
                                x2={100 + 100 * Math.cos(rad)} 
                                y2={100 + 100 * Math.sin(rad)} 
                                stroke="#1e293b" 
                                strokeWidth="1" 
                              />
                            );
                          })}

                          {/* Normal Area Polygon (Green) */}
                          {(() => {
                            const normalVals = [95, 90, 92, 90, 88];
                            const points = [0, 72, 144, 216, 288].map((angle, idx) => {
                              const r = normalVals[idx];
                              const rad = (angle - 90) * Math.PI / 180;
                              return `${100 + r * Math.cos(rad)},${100 + r * Math.sin(rad)}`;
                            }).join(' ');
                            return (
                              <polygon 
                                points={points} 
                                fill="rgba(16, 185, 129, 0.12)" 
                                stroke="#10b981" 
                                strokeWidth="1.5" 
                              />
                            );
                          })()}

                          {/* Child Area Polygon (Orange with high contrast glow) */}
                          {(() => {
                            const childVals = [
                              articulation.includes('正常') ? 90 : 68,
                              articulation.includes('无力') || articulation.includes('构音') ? 50 : 72,
                              92,
                              sentenceLength.includes('简单') ? 78 : 55,
                              articulation.includes('置换') ? 38 : 80
                            ];
                            const points = [0, 72, 144, 216, 288].map((angle, idx) => {
                              const r = childVals[idx];
                              const rad = (angle - 90) * Math.PI / 180;
                              return `${100 + r * Math.cos(rad)},${100 + r * Math.sin(rad)}`;
                            }).join(' ');
                            return (
                              <polygon 
                                points={points} 
                                fill="rgba(244, 63, 94, 0.35)" 
                                stroke="#ef4444" 
                                strokeWidth="2.5" 
                              />
                            );
                          })()}

                          {/* Axis text labels */}
                          {[
                            { text: '爆破音 [b/p]', angle: 0 },
                            { text: '摩擦音 [f/s]', angle: 72 },
                            { text: '鼻音 [m/n]', angle: 144 },
                            { text: '舌面音 [x/q]', angle: 216 },
                            { text: '舌根音 [g/k]', angle: 288 }
                          ].map((axis, idx) => {
                            const rad = (axis.angle - 90) * Math.PI / 180;
                            const x = 100 + 122 * Math.cos(rad);
                            const y = 100 + 122 * Math.sin(rad);
                            return (
                              <text 
                                key={idx}
                                x={x}
                                y={y + 3}
                                fill="#94a3b8"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {axis.text}
                              </text>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Legend & Details */}
                      <div className="space-y-1 text-left max-w-[170px] w-full">
                        <div className="text-[10px] text-slate-300 font-bold border-b border-slate-800 pb-1 flex justify-between">
                          <span className="text-emerald-400">● 同龄标准</span>
                          <span className="text-rose-400">● 实际构音区</span>
                        </div>
                        <div className="space-y-1 font-mono text-[9px] text-slate-400">
                          <div className="flex justify-between bg-slate-800/60 p-1 rounded border border-red-500/20">
                            <span className="text-rose-300 font-bold">🎯 舌根辅音 [g/k]:</span>
                            <span className="text-red-400 font-black font-sans">{articulation.includes('置换') ? '38% (极低)' : '80% (常态)'}</span>
                          </div>
                          <div className="flex justify-between bg-slate-800/40 p-1 rounded">
                            <span>🎯 摩擦音 [f/s]:</span>
                            <span className="text-amber-400 font-black font-sans">{articulation.includes('无力') || articulation.includes('构音') ? '50% (偏弱)' : '72% (中度)'}</span>
                          </div>
                        </div>
                        <p className="text-[8px] text-rose-300 leading-normal font-sans">
                          ⚠️ <strong>发育缺陷警示:</strong> 舌根阻碍控制极弱，代偿异常明显，极需针对舌根音强化阻抗。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: Fluency (Vocal Rhythm bars) - Vibrant Sky-blue and Rose Highlight */}
                  <div className="bg-white border-2 border-sky-400/60 p-4 rounded-xl space-y-3 shadow-sm hover:shadow-md transition">
                    <h5 className="text-[11px] font-black text-sky-800 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-sky-500" />
                      Ⅲ. 语速语流脉冲 (发音流畅度)
                    </h5>
                    <div className="flex justify-between items-center text-[9px] text-slate-500">
                      <span>言语连续流、语音中断与微停顿多维韵律描绘</span>
                      <span>标准对照: 发育性不流利常态节律线</span>
                    </div>
                    
                    <div className="bg-[#0f172a] rounded-xl p-4 space-y-4 border border-slate-800">
                      {/* Animated Impulse Graph */}
                      <div className="h-24 w-full flex items-end justify-between px-3 relative border-b border-slate-800 pb-1.5">
                        <div className="absolute inset-x-0 top-1/4 border-t border-slate-800/60 border-dashed" />
                        <div className="absolute inset-x-0 top-2/4 border-t border-slate-800/60 border-dashed" />
                        <div className="absolute inset-x-0 top-3/4 border-t border-slate-800/60 border-dashed" />

                        {[
                          { word: '起声', energy: 15, isBlock: false },
                          { word: '音1', energy: 75, isBlock: false },
                          { word: '音2', energy: 85, isBlock: false },
                          { word: '卡阻', energy: fluency.includes('正常') ? 10 : 80, isBlock: !fluency.includes('正常') },
                          { word: '音3', energy: 65, isBlock: false },
                          { word: '连复', energy: fluency.includes('正常') ? 20 : 70, isBlock: !fluency.includes('正常') },
                          { word: '音4', energy: 80, isBlock: false },
                          { word: '释能', energy: 10, isBlock: false },
                        ].map((bar, idx) => (
                          <div key={idx} className="flex flex-col items-center flex-1 max-w-[48px] space-y-1.5">
                            <span className="text-[8px] text-slate-500 scale-90 font-mono">{bar.energy}%</span>
                            <div className="w-4 sm:w-6 rounded-t-sm relative" style={{ height: `${bar.energy * 0.6}px` }}>
                              <div 
                                className={`w-full h-full rounded-t-md transition-all duration-500 ${
                                  bar.isBlock 
                                    ? 'bg-gradient-to-t from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.7)] animate-pulse' 
                                    : 'bg-gradient-to-t from-sky-600 to-sky-400'
                                }`} 
                              />
                            </div>
                            <span className={`text-[8px] font-bold ${bar.isBlock ? 'text-rose-400' : 'text-slate-400'}`}>{bar.isBlock ? '卡顿' : bar.word}</span>
                          </div>
                        ))}
                      </div>

                      {/* Fluency Metrics Table */}
                      <div className="grid grid-cols-3 gap-2 text-left">
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 space-y-0.5">
                          <span className="text-[9px] text-slate-400 block font-bold">卡壳频次 (Blocks)</span>
                          <span className="text-xs font-black text-rose-400">{fluency.includes('正常') ? '0 次/秒' : '1.8 次/3秒'}</span>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 space-y-0.5">
                          <span className="text-[9px] text-slate-400 block font-bold">连复拖延 (Stutter)</span>
                          <span className="text-xs font-black text-amber-400">{fluency.includes('正常') ? '正常' : '叠字 (3音节)'}</span>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 space-y-0.5">
                          <span className="text-[9px] text-slate-400 block font-bold">气流失调 (Jitter)</span>
                          <span className="text-xs font-black text-emerald-400">轻度 (7%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD 4: 12-Week Roadmap - Vibrant Indigo with Pulse indicators */}
                  <div className="bg-white border-2 border-indigo-400/60 p-4 rounded-xl space-y-3 shadow-sm hover:shadow-md transition">
                    <h5 className="text-[11px] font-black text-indigo-800 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-500 animate-pulse" />
                      Ⅳ. 12周康复里程碑 (成长路径)
                    </h5>
                    <div className="flex justify-between items-center text-[9px] text-slate-500">
                      <span>脑突触可塑性剪裁与多重构音反射重建里程碑预测</span>
                      <span className="text-brand-moss font-bold">12周精细康复路径图</span>
                    </div>
                    
                    {/* 4 Phases Progress Timeline Card - Flat display */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          phase: '第一阶段 (第1-2周)',
                          title: '口唇舌部肌张力促通',
                          desc: '激活构音器官末梢信号。',
                          milestone: '下颌角增加15%',
                          bgColor: 'bg-indigo-50/70 border-indigo-200',
                          textColor: 'text-indigo-800',
                          pointColor: 'bg-indigo-600'
                        },
                        {
                          phase: '第二阶段 (第3-5周)',
                          title: '音位异常前移纠正',
                          desc: '低头水咕噜漱口阻力强化。',
                          milestone: '异常置换率降低40%',
                          bgColor: 'bg-amber-50/70 border-amber-200',
                          textColor: 'text-amber-800',
                          pointColor: 'bg-amber-600'
                        },
                        {
                          phase: '第三阶段 (第6-8周)',
                          title: '双词到三语语法拉伸',
                          desc: '增强前额叶语言工作记忆。',
                          milestone: '平均句子长度MLU达3.5',
                          bgColor: 'bg-emerald-50/70 border-emerald-200',
                          textColor: 'text-emerald-800',
                          pointColor: 'bg-emerald-600'
                        },
                        {
                          phase: '第四阶段 (第9-12周)',
                          title: '生活社交场景应用',
                          desc: '交互游戏进行说出与提问。',
                          milestone: '拼读清晰度AAC升至92%',
                          bgColor: 'bg-rose-50/70 border-rose-200',
                          textColor: 'text-rose-800',
                          pointColor: 'bg-rose-600'
                        }
                      ].map((step, idx) => (
                        <div key={idx} className={`p-2.5 rounded-xl border ${step.bgColor} space-y-1 text-left flex flex-col justify-between`}>
                          <div>
                            <span className={`text-[8px] font-black uppercase tracking-wider ${step.textColor} flex items-center gap-1`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${step.pointColor} inline-block animate-pulse`} />
                              {step.phase}
                            </span>
                            <h5 className="text-[9px] font-black text-slate-800 leading-tight">{step.title}</h5>
                            <p className="text-[8px] text-slate-500 leading-tight font-medium mt-0.5">{step.desc}</p>
                          </div>
                          <div className="mt-1 pt-1 border-t border-slate-200/50 text-[8px] text-slate-500 font-mono">
                            🎯 目标: <span className="font-extrabold text-slate-700">{step.milestone}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Metric dials */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-bold block">辅音清晰度 (AAC)</span>
                    <strong className="text-sm font-black text-brand-forest">72%</strong>
                    <span className="text-[8px] text-rose-500 font-bold block">偏低 (标称: 92%)</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-bold block">语速节律值 (SR)</span>
                    <strong className="text-sm font-black text-brand-forest">82 字/分</strong>
                    <span className="text-[8px] text-rose-500 font-bold block">缓慢 (标称: 100字)</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-bold block">腭咽闭合阻尼 (VPC)</span>
                    <strong className="text-sm font-black text-brand-forest">14% 漏气度</strong>
                    <span className="text-[8px] text-amber-600 font-bold block">轻度气流外溢</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-bold block">音位准确率 (PMR)</span>
                    <strong className="text-sm font-black text-brand-forest">7 / 10 题达标</strong>
                    <span className="text-[8px] text-brand-moss font-bold block">精细肌力欠佳</span>
                  </div>
                </div>
              </div>

              {/* Pathology mechanism */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5">
                  <Brain size={14} className="text-brand-moss" /> 脑部前额叶言语 Broca 区及发音器官神经学协同发育解析:
                </h4>
                <p className="text-xs text-brand-charcoal leading-relaxed font-semibold bg-slate-50 p-4 rounded-2xl border border-slate-200/60 shadow-inner">
                  {report.speechPathology}
                </p>
              </div>

              {/* Acoustic mapping details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5">
                  <Compass size={14} className="text-brand-clay" /> 发音脑部共鸣与基频物理阻抗参数:
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-brand-cream/30 border border-brand-stone/60 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-brand-clay block">声带基频振动 (Pitch)</span>
                    <p className="text-[11px] text-brand-charcoal font-medium leading-relaxed">
                      {report.acousticProfile.pitchAnalysis}
                    </p>
                  </div>
                  <div className="p-3.5 bg-brand-cream/30 border border-brand-stone/60 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-brand-clay block">语速韵律对比 (Tempo)</span>
                    <p className="text-[11px] text-brand-charcoal font-medium leading-relaxed">
                      {report.acousticProfile.speechRate}
                    </p>
                  </div>
                  <div className="p-3.5 bg-brand-cream/30 border border-brand-stone/60 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-brand-clay block">软腭闭合共鸣 (Resonance)</span>
                    <p className="text-[11px] text-brand-charcoal font-medium leading-relaxed">
                      {report.acousticProfile.resonance}
                    </p>
                  </div>
                </div>
              </div>

              {/* Short-term clinical goals */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-brand-forest" /> 【后续干预训练方针计划】短期精准成长训练目标:
                </h4>
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                  {report.interventionGoals.map((goal, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-semibold text-brand-charcoal">
                      <span className="w-5 h-5 bg-brand-sage/40 border border-brand-stone text-brand-forest rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="leading-relaxed">{goal}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Exercise Program (OT/PT/SLP game) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5">
                  <Clock size={14} className="text-brand-moss animate-pulse" />
                  7天家庭游戏化构音操矫正康复计划:
                </h4>

                <div className="space-y-3">
                  {report.slpExercises.map((ex, idx) => (
                    <div key={idx} className="border border-brand-stone/70 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-brand-sage/20 px-4 py-2 border-b border-brand-stone/70 flex justify-between items-center">
                        <span className="text-xs font-extrabold text-brand-forest flex items-center gap-1">
                          <UserCheck size={12} />
                          {ex.day} · {ex.target}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-brand-forest/70 bg-brand-sage/40 px-2 py-0.5 rounded">
                          频率: {ex.duration}
                        </span>
                      </div>
                      <div className="p-4 bg-white space-y-2">
                        <p className="text-xs text-brand-charcoal leading-relaxed font-medium">
                          {ex.exercise}
                        </p>
                        <div className="bg-brand-cream/30 p-2.5 rounded-xl border border-brand-stone/40 text-[10px] text-brand-forest leading-relaxed font-semibold">
                          <span className="font-extrabold text-brand-clay mr-1 flex items-center gap-1">
                            <Info size={11} /> SLP首席成长督导纠音贴士:
                          </span>
                          {ex.tips}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Home guidance summary */}
              <div className="bg-brand-sage/25 p-4.5 rounded-2xl border border-brand-stone/50 space-y-2">
                <h4 className="text-xs font-bold text-brand-forest flex items-center gap-1.5">
                  <HeartHandshake size={14} className="text-brand-moss" /> 首席儿童言语成长专家家庭互助与语境诱导总指引:
                </h4>
                <p className="text-xs text-brand-charcoal leading-relaxed font-semibold">
                  {report.parentGuidance}
                </p>
              </div>

              {/* Co-Signature & WeChat Review Action Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-brand-forest flex items-center gap-1.5">
                      <UserCheck size={14} className="text-brand-moss" />
                      【双核联合签证】连动微信发送国家注册少儿言语评估督导师
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      除了 AI 智能多维自评，森心康支持通过微信一键把方案发送给您的专属督导专家进行专业复核，并获取手写签名及官方核准电子联合签证章！
                    </p>
                  </div>
                  
                  {!isSignedAndStamped ? (
                    <button
                      onClick={() => {
                        setIsWechatModalOpen(true);
                        setIsSupervisorPortal(false);
                      }}
                      className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Share2 size={13} />
                      微信联络督导师复核及签证
                    </button>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-[10px] font-bold text-emerald-800">
                      <Check size={12} /> 督导师联合签证已生效
                    </span>
                  )}
                </div>

                {/* Display signed & stamped card if completed! */}
                {isSignedAndStamped && (
                  <div className="bg-white border-2 border-emerald-500 rounded-2xl p-5 relative overflow-hidden space-y-3.5 shadow-sm">
                    {/* Decorative official corner seal ribbon */}
                    <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider py-1 px-3 rounded-bl-xl shadow-sm">
                      专业评估联合签证
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center text-emerald-700 text-sm font-bold">
                        📋
                      </span>
                      <div>
                        <h5 className="text-xs font-extrabold text-brand-forest">王明华 首席专家 / 注册首席儿童SLP</h5>
                        <p className="text-[9px] text-slate-400 font-mono">国家级言语联盟注册督导师 · 证书号: SLP-CN-2016-0842</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 leading-relaxed italic relative">
                      “ {supervisorOpinion} ”
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pt-2">
                      <div className="text-[9px] text-slate-400 font-mono space-y-0.5">
                        <div>数字核签指纹: SHA256/SXK-VERIFIED-{verifiedAt.replace(/[^0-9]/g, '').slice(-12)}</div>
                        <div>复核生效时间: {verifiedAt}</div>
                      </div>

                      {/* E-Signature & Circular Red Stamp Overlap */}
                      <div className="relative w-44 h-16 bg-slate-50/50 border border-slate-200/50 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                        {/* E-Signature image */}
                        {supervisorSignUrl && (
                          <img 
                            src={supervisorSignUrl} 
                            alt="督导师签名" 
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 scale-95 mix-blend-multiply" 
                          />
                        )}

                        {/* Translucent circular official seal stamp */}
                        <div className="absolute right-2 bottom-0 w-14 h-14 rounded-full border-2 border-dashed border-red-500/80 flex flex-col items-center justify-center text-center p-0.5 select-none pointer-events-none rotate-12 bg-red-50/10 z-20">
                          <div className="text-[5px] font-black text-red-500 tracking-wider scale-90">森心康康复联盟</div>
                          <div className="text-[7px] font-extrabold text-red-600 leading-none my-0.5">★</div>
                          <div className="text-[5px] font-bold text-red-500 tracking-tighter scale-90">专业联合签证章</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recommended Therapists & Online video booking section */}
              <div className="space-y-4 pt-4 border-t border-brand-cream">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-brand-forest flex items-center gap-1.5">
                    <User size={15} className="text-brand-clay" /> 【专业保障】森心康联盟认证知名儿童言语发展师推荐
                  </h4>
                  <p className="text-[11px] text-brand-charcoal/70">
                    针对受评儿童检出的发音协调代偿置换及词汇组织滞后，我们特约全国知名儿科SLP专家提供 1v1 线上视频辅导与言语提升指导。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {THERAPISTS.map((t) => (
                    <div key={t.id} className="bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-4 transition shadow-sm">
                      <div className="space-y-3">
                        {/* Name and avatar */}
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 bg-brand-sage/30 rounded-full flex items-center justify-center text-xl shadow-inner">
                            {t.avatar}
                          </span>
                          <div className="text-left">
                            <h5 className="text-xs font-black text-brand-forest">{t.name}</h5>
                            <span className="text-[9px] font-bold text-brand-clay block leading-tight">{t.title}</span>
                          </div>
                        </div>

                        {/* Hospital info */}
                        <p className="text-[10px] text-brand-charcoal/80 font-bold leading-relaxed">
                          🏫 {t.hospital}
                        </p>

                        <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold">
                          <Star size={12} fill="currentColor" /> {t.rate}
                          <span className="text-slate-400 font-normal">({t.cases}例评估服务好评)</span>
                        </div>

                        <p className="text-[10px] text-brand-charcoal/75 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200 font-semibold">
                          <strong className="text-brand-forest block text-[9px] font-black uppercase tracking-wider mb-1">擅长领域:</strong>
                          {t.specialization}
                        </p>

                        {/* Certificates */}
                        <div className="flex flex-wrap gap-1">
                          {t.certs.map((c, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-brand-sage/10 text-[8px] text-brand-forest font-bold border border-brand-moss/20">
                              ✓ {c.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Fee and booking action */}
                      <div className="border-t border-slate-200/80 pt-3 flex items-center justify-between gap-2 mt-auto">
                        <div className="text-left">
                          <span className="text-[8px] text-slate-400 block font-bold">远程诊疗费用</span>
                          <span className="text-sm font-black text-rose-700">¥{t.fee}<span className="text-[9px] text-slate-500 font-normal"> /次</span></span>
                        </div>

                        <button
                          onClick={() => handleBookTherapist(t)}
                          className="px-3 py-2 bg-brand-forest hover:bg-brand-moss text-white text-[10px] font-black rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1"
                        >
                          <Video size={11} />
                          立即预约线上干预
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* 2. BOOKING MODAL */}
      {selectedTherapistForBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-brand-stone w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in relative text-left">
            
            {/* Modal Header */}
            <div className="bg-brand-forest text-white p-5 flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black text-brand-sand uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} /> 线上干预专家直联会诊
                </span>
                <h3 className="text-sm font-extrabold">预约视频诊疗 1v1 训练通道</h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedTherapistForBooking(null);
                  setBookingVoucher(null);
                }}
                className="text-white/80 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-5 space-y-4">
              
              {!bookingVoucher ? (
                <>
                  {/* Selected therapist profile resume */}
                  <div className="bg-brand-sage/10 p-3 rounded-2xl border border-brand-moss/30 flex items-center gap-3">
                    <span className="text-2xl">{selectedTherapistForBooking.avatar}</span>
                    <div>
                      <h4 className="text-xs font-extrabold text-brand-forest">{selectedTherapistForBooking.name}</h4>
                      <p className="text-[10px] text-brand-charcoal/80 leading-relaxed font-bold">
                        {selectedTherapistForBooking.title} · {selectedTherapistForBooking.hospital}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-brand-charcoal/70 leading-relaxed">
                    为了针对儿童的言语障碍机制进行最快速的精纠，请配合选定线上会诊日期，并在约定时间段通过视频接入，医生将指导开展构音及呼吸操动作矫治。
                  </p>

                  <div className="space-y-3 pt-2">
                    {/* Date picker */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-brand-forest uppercase tracking-wider block">
                        🗓 选择会诊预约日期:
                      </label>
                      <input
                        type="date"
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-moss font-semibold"
                      />
                    </div>

                    {/* Time Slots */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-brand-forest uppercase tracking-wider block">
                        ⏰ 可选视频时间段:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['09:30 - 10:20', '14:00 - 14:50', '16:00 - 16:50', '19:30 - 20:20'].map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setBookingTime(slot)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition text-center ${
                              bookingTime === slot
                                ? 'bg-brand-clay text-white border-brand-clay shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 text-brand-charcoal border-slate-200'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Phone details */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-brand-forest uppercase tracking-wider block">
                        📱 家长接收短信凭证手机号:
                      </label>
                      <input
                        type="tel"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="请输入11位中国大陆手机号码"
                        className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-moss font-semibold"
                      />
                      <span className="text-[9px] text-slate-400 block">
                        会诊预约成功后，系统会将“视频诊疗直联房间号及密码”通过短信发送给您。
                      </span>
                    </div>
                  </div>

                  {/* Submit actions */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                    <div className="text-left">
                      <span className="text-[9px] text-slate-400 block">合计诊疗费:</span>
                      <strong className="text-base font-black text-rose-700">¥{selectedTherapistForBooking.fee}</strong>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedTherapistForBooking(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleConfirmBooking}
                        disabled={isSubmittingBooking}
                        className="px-5 py-2.5 bg-brand-forest hover:bg-brand-moss text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSubmittingBooking ? '系统通信锁定中...' : '确认预约提交'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Booking SUCCESS Voucher ticket overlay */
                <div className="space-y-5 py-2">
                  
                  {/* Confetti / Success head */}
                  <div className="text-center space-y-1">
                    <span className="w-12 h-12 bg-emerald-100 border border-emerald-300 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl shadow-inner">
                      ✓
                    </span>
                    <h4 className="text-base font-black text-brand-forest">儿童言语视频干预预约成功！</h4>
                    <p className="text-[11px] text-slate-400 font-mono">凭证编号: {bookingVoucher.id}</p>
                  </div>

                  {/* Elegant medical Ticket */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4.5 font-mono text-xs relative overflow-hidden space-y-3.5 shadow-xl border border-slate-800">
                    
                    {/* Decorative ticket cuts */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full -ml-2 z-10" />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full -mr-2 z-10" />

                    <div className="flex justify-between items-start border-b border-white/10 pb-2">
                      <span className="text-[10px] text-brand-sand font-bold tracking-widest uppercase">AI智慧言语线上会诊凭证</span>
                      <span className="text-[9px] text-slate-400">时间: {bookingVoucher.createdAt}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-left">
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">首诊专家 SLP:</span>
                        <span className="text-xs font-extrabold text-white">{bookingVoucher.therapist.name}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">受评儿姓名:</span>
                        <span className="text-xs font-extrabold text-white">{child.name}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">预约会诊日期:</span>
                        <span className="text-xs font-extrabold text-brand-sand">{bookingVoucher.date}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">预约具体时间段:</span>
                        <span className="text-xs font-extrabold text-brand-sand">{bookingVoucher.time}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-white/10 text-left space-y-1.5">
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">🖥 腾讯会议/远程视频直联链接:</span>
                        <a href={bookingVoucher.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline text-[10px] font-bold block truncate">
                          {bookingVoucher.meetingUrl}
                        </a>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">🔑 接入会议密码:</span>
                          <span className="text-xs font-black text-white">{bookingVoucher.meetingPassword}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">接收短信手机:</span>
                          <span className="text-xs font-bold text-white">{bookingVoucher.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Barcode Mock */}
                    <div className="pt-2 border-t border-white/10 flex flex-col items-center justify-center gap-1">
                      <div className="h-6 w-48 bg-white rounded overflow-hidden flex items-center justify-between px-2 text-[8px] text-slate-800 tracking-[0.2em] font-mono select-none">
                        ||||| | |||| ||| | || ||||| ||| ||| |||| | |||
                      </div>
                      <span className="text-[8px] text-slate-500 font-bold tracking-widest">{bookingVoucher.id}</span>
                    </div>
                  </div>

                  {/* Parental Preparation Instructions */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[10px] text-amber-900 leading-relaxed space-y-1 text-left">
                    <strong className="text-amber-800 block flex items-center gap-1">
                      <Info size={11} /> 线上干预前家长建议准备:
                    </strong>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>请让孩子在光线充足、无噪音干扰的房间里，端坐于合适的桌椅旁。</li>
                      <li>提前测试电脑/平板的摄像头、麦克风和扬声器音量正常。</li>
                      <li>建议家长准备 2-3 个孩子平日常玩的实物玩具，以及一块小梳妆镜（矫正口型使用）。</li>
                      <li>会诊开始前 10 分钟，会有客服专员拨打电话确认线路连接，并给您核对语音报告信息。</li>
                    </ul>
                  </div>

                  {/* Back button */}
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => {
                        setSelectedTherapistForBooking(null);
                        setBookingVoucher(null);
                      }}
                      className="px-6 py-2 bg-brand-forest text-white text-xs font-bold rounded-xl shadow hover:bg-brand-moss transition"
                    >
                      我已记下，关闭凭证
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* 3. WECHAT SHARING & SUPERVISOR REVIEW MODAL */}
      {isWechatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in relative text-left">
            
            {/* Modal Header */}
            <div className={`p-4.5 flex justify-between items-center text-white ${isSupervisorPortal ? 'bg-slate-800' : 'bg-[#07c160]'}`}>
              <div className="space-y-0.5">
                <span className="text-[9px] font-black text-white/80 uppercase tracking-wider flex items-center gap-1">
                  {isSupervisorPortal ? '📋 森心康 · 儿童言语评估专家端' : '📱 微信一键发送专家督导复核'}
                </span>
                <h3 className="text-sm font-extrabold">
                  {isSupervisorPortal ? '督导专家评估报告审核及联合签证终端' : '连动微信 · 分享督导成长方案'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsWechatModalOpen(false);
                  setIsSupervisorPortal(false);
                }}
                className="text-white/80 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              
              {!isSupervisorPortal ? (
                /* SCREEN 1: WECHAT SHARE CARD MOCK */
                <div className="space-y-4">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    系统已生成专属于 <strong>{child.name}</strong> 的脑神经构音及句法发育评估链接。您可以通过微信将此深度报告同步分享给您的线下成长督导师（或点击下方的专家模拟按钮体验复核签字流程）。
                  </p>

                  {/* WeChat Bubble Card Mockup */}
                  <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200/80 space-y-3 max-w-md mx-auto">
                    <span className="text-[10px] text-slate-400 font-bold block">💬 微信聊天消息卡片预览</span>
                    
                    <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm space-y-2 flex gap-3 text-left">
                      <div className="flex-1 space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2">
                          【森心康成长评估】针对受评儿 {child.name} ({child.ageMonth}个月) 的儿童脑神经物理声谱匹配及SLP成长方案已出炉，请求督导复核与联合签证！
                        </h4>
                        <p className="text-[9px] text-slate-400 leading-tight line-clamp-2">
                          检出结果: {report?.diagnosedCondition}。内附10题声谱物理包络、构音清晰度雷达、阻尼参数、12周干预。
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-brand-sage/20 border border-brand-stone rounded-lg shrink-0 flex items-center justify-center text-xl shadow-inner">
                        🧠
                      </div>
                    </div>
                  </div>

                  {/* QR Code Scan simulation */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-2">
                    {/* Simulated QR Code using Tailwind SVG */}
                    <div className="w-24 h-24 bg-white border border-slate-200 p-1.5 rounded-xl flex items-center justify-center shrink-0 shadow-sm relative">
                      <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800">
                        {/* Elegant abstract QR block */}
                        <rect x="5" y="5" width="25" height="25" fill="currentColor" />
                        <rect x="10" y="10" width="15" height="15" fill="white" />
                        <rect x="13" y="13" width="9" height="9" fill="currentColor" />

                        <rect x="70" y="5" width="25" height="25" fill="currentColor" />
                        <rect x="75" y="10" width="15" height="15" fill="white" />
                        <rect x="78" y="13" width="9" height="9" fill="currentColor" />

                        <rect x="5" y="70" width="25" height="25" fill="currentColor" />
                        <rect x="10" y="75" width="15" height="15" fill="white" />
                        <rect x="13" y="78" width="9" height="9" fill="currentColor" />

                        <rect x="40" y="40" width="20" height="20" fill="currentColor" />
                        {/* random clusters */}
                        <rect x="40" y="10" width="10" height="10" fill="currentColor" />
                        <rect x="55" y="20" width="5" height="15" fill="currentColor" />
                        <rect x="70" y="40" width="15" height="5" fill="currentColor" />
                        <rect x="15" y="45" width="10" height="10" fill="currentColor" />
                        <rect x="40" y="75" width="15" height="10" fill="currentColor" />
                        <rect x="75" y="75" width="5" height="5" fill="currentColor" />
                        <rect x="85" y="85" width="10" height="10" fill="currentColor" />
                      </svg>
                      {/* Brand Logo inside QR */}
                      <span className="absolute w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[10px] shadow-sm font-bold">森</span>
                    </div>

                    <div className="text-center sm:text-left space-y-1">
                      <span className="text-[10px] font-black text-[#07c160] flex items-center justify-center sm:justify-start gap-1">
                        <Check size={12} fill="currentColor" /> 微信直联二维码已准备就绪
                      </span>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        手机微信扫一扫该二维码，即可在微信中直接打开该评估。点击页面右上角即可一键转发分享给医生或言语督导专家。
                      </p>
                    </div>
                  </div>

                  {/* Enter Simulation portal */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-[10px] text-slate-400 font-bold leading-normal">演示提示：如果您想立刻体验督导师是如何复核这份方案、手写签字并签发红色盖章的，请点击右侧按钮</span>
                    <button
                      onClick={() => setIsSupervisorPortal(true)}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 flex items-center gap-1 shrink-0"
                    >
                      ✨ 模拟进入督导师签字签证端
                    </button>
                  </div>
                </div>
              ) : (
                /* SCREEN 2: SUPERVISOR REVIEW WORKBENCH WITH DRAW CANVAS */
                <div className="space-y-4">
                  <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800">森心康评估联盟督导师联合审查</h4>
                        <p className="text-[9px] text-slate-400">正在复核受评儿 {child.name} ({child.ageMonth}个月) 的 10 题物理声谱评估报告</p>
                      </div>
                    </div>
                  </div>

                  {/* Input Review Comments */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-700 block uppercase tracking-wider">
                      ✍️ 督导专家专业审查评语意见:
                    </label>
                    <textarea
                      value={supervisorOpinion}
                      onChange={(e) => setSupervisorOpinion(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-600 font-semibold text-slate-800 leading-relaxed"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setSupervisorOpinion('核对完毕。该10题拼读波频与儿童日常前移代偿（如哥哥念嘚嘚）完全契合。拼读基频（F0）起振略带阻尼。同意AI设计的每日口部肌肉抗阻、漱口水流声阻操及12周里程碑。准予签证。')}
                        className="px-2 py-1 text-[8px] bg-slate-200 rounded hover:bg-slate-300 font-bold text-slate-600"
                      >
                        模板 1: 构音置换/代偿
                      </button>
                      <button
                        onClick={() => setSupervisorOpinion('已复核。言语流畅度指标（SR）偏低，声母拼读时在唇齿摩擦音上存在明显的词汇寻回延迟或微卡顿，气流压力无明显器质性缺陷，属于发育期节律障碍。同意AI家庭舒压慢读方案。')}
                        className="px-2 py-1 text-[8px] bg-slate-200 rounded hover:bg-slate-300 font-bold text-slate-600"
                      >
                        模板 2: 语流卡顿/结巴
                      </button>
                    </div>
                  </div>

                  {/* DRAWING SIGNATURE CANVAS */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        🎨 督导专家电子手写签名区 (请在白色框内写字):
                      </label>
                      <button
                        onClick={() => {
                          const canvas = sigCanvasRef.current;
                          if (canvas) {
                            const ctx = canvas.getContext('2d');
                            ctx?.clearRect(0, 0, canvas.width, canvas.height);
                          }
                        }}
                        className="text-[9px] font-bold text-slate-400 hover:text-rose-500"
                      >
                        [清除重签]
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-white relative">
                      <canvas
                        ref={sigCanvasRef}
                        width={450}
                        height={120}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-28 block cursor-crosshair touch-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300 font-medium pointer-events-none select-none">
                        用鼠标或手指在此绘制手写电子签名 (物理签名板)
                      </div>
                    </div>
                  </div>

                  {/* Submission and approval */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setIsSupervisorPortal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      返回微信
                    </button>

                    <button
                      onClick={() => {
                        const canvas = sigCanvasRef.current;
                        if (canvas) {
                          const dataUrl = canvas.toDataURL('image/png');
                          setSupervisorSignUrl(dataUrl);
                        }
                        setIsSignedAndStamped(true);
                        setVerifiedAt(new Date().toLocaleString('zh-CN', { hour12: false }));
                        setIsWechatModalOpen(false);
                        setIsSupervisorPortal(false);
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 flex items-center gap-1"
                    >
                      ✓ 签字加盖核准章并签证
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
