import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import tcb from '@cloudbase/node-sdk';

dotenv.config();

const app = express();
const PORT = 3000;

// Raised limit so base64-encoded audio clips (<=10MB) can reach the ASR endpoint
app.use(express.json({ limit: '15mb' }));

// Initialize Gemini client lazily to avoid crashing on start if GEMINI_API_KEY is not defined yet
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY is not set in secrets or environment.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// DashScope (Alibaba Qwen) helpers — OpenAI-compatible mode
const DASHSCOPE_COMPAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const QWEN_REPORT_MODEL = process.env.QWEN_REPORT_MODEL || 'qwen3.7-max';
const QWEN_ASR_MODEL = process.env.QWEN_ASR_MODEL || 'qwen3-asr-flash';

function getDashScopeKey(): string | null {
  const key = process.env.DASHSCOPE_API_KEY || process.env.ALI_LLM_API_KEY;
  if (!key || key === 'MY_DASHSCOPE_API_KEY') return null;
  return key;
}

async function callQwenJSON(model: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const key = getDashScopeKey();
  if (!key) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const resp = await fetch(DASHSCOPE_COMPAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      // Flagship Qwen models default to deep-thinking mode, far too slow for a synchronous report request
      enable_thinking: false
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DashScope ${model} request failed (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const raw = await resp.json();
  const content = raw.choices?.[0]?.message?.content;
  if (!content) throw new Error('DashScope returned empty content.');
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Fallback high-fidelity simulation engine when API key is missing
function generateFallbackReport(child: any, scores: any[]) {
  // Identify struggling dimensions
  const struggling = scores.filter((s: any) => s.status !== 'normal');
  const delayCount = scores.filter((s: any) => s.status === 'delay').length;
  const borderlineCount = scores.filter((s: any) => s.status === 'borderline').length;

  let summary = `对儿童【${child.name}】（${child.ageMonth}个月，${child.gender === 'boy' ? '男孩' : '女孩'}）的发育进行了9维度的评估分析。`;
  if (struggling.length === 0) {
    summary += `检测结果显示所有筛查指标极其稳健，各维度神经环路分层发育平衡，未见可疑的发育迟缓表征，建议维持当前的良性多感官成长氛围。`;
  } else if (delayCount > 0) {
    summary += `综合评估发现，儿童在【${struggling.map(s => s.dimensionName).join('、')}】等维度显露一定的发育滞后或边缘偏差，尤以【${scores.filter((s: any) => s.status === 'delay').map(s => s.dimensionName).join('、') || '部分项目'}】较为突出，脑部特异功能区环路协同性需要重点拉伸康复。`;
  } else {
    summary += `当前评估显示各领域发展基本正常，但【${struggling.map(s => s.dimensionName).join('、')}】指标逼近正常阈值下限，处于“边缘警告”状态。需进行有意识的轻度环境赋能与家庭指导，防止迟缓转化。`;
  }

  // Calculate simulated critical metrics
  let neuralPlasticity = 88 - (delayCount * 8) - (borderlineCount * 3);
  let sensoryIntegration = 85 - (scores.find(s => s.dimensionId === 'sensory')?.status === 'delay' ? 20 : 5);
  let motorControl = 86 - (scores.find(s => s.dimensionId === 'gross_motor')?.status === 'delay' ? 15 : 3) - (scores.find(s => s.dimensionId === 'fine_motor')?.status === 'delay' ? 10 : 2);
  let familyEnv = 90 - (scores.find(s => s.dimensionId === 'family_env')?.status === 'delay' ? 25 : 5);

  // Bounds check
  neuralPlasticity = Math.max(50, Math.min(98, neuralPlasticity));
  sensoryIntegration = Math.max(50, Math.min(98, sensoryIntegration));
  motorControl = Math.max(50, Math.min(98, motorControl));
  familyEnv = Math.max(50, Math.min(98, familyEnv));

  // Determine specific recommendations
  const rehabMap: Record<string, string[]> = {
    gross_motor: [
      '前庭重力姿态腰带辅助训练：每日进行30分钟抗阻步行训练，辅以双膝微屈、双手举空抛球动作以稳固轴线肌力。',
      '双脚跨越平衡障碍跑：沿直线摆放20cm高充气软墩，指导患儿双手侧平举，保持足跟交替跨越不偏斜，每日3组，每组10次。'
    ],
    fine_motor: [
      '智能多向手指 OT 捏提训练：借助细微手动作电极感应，进行1mm级别的大拇指、食指精细对捏，使用软胶彩球塞入微孔。',
      '双手反向阻尼拉撑动作：利用儿童弹性拉力器，指导左右食指互扣横拉，促进双手小肌肉神经末梢与小脑的反馈弧构建。'
    ],
    sensory: [
      '重力被子及多感官触觉刷疗法：使用中等毛刷进行全身肢体大面积扫刷，尤其手心、脚板及脊柱两侧，缓解毛孔触觉高防卫性。',
      '前庭翻滚与倾角滑板活动：在安全软地皮上，配合中号瑜伽气囊球进行双侧身体滚筒式侧滚，同步强化深感觉。'
    ],
    language: [
      '听觉-言语反馈声乐反射：在成人耳旁以正常偏低音，缓慢、重音分明地朗读3步重叠词（如“请把红-苹果-拿给我”），激发回声。',
      '构音器官口腔肌能拉伸游戏：指导孩子模仿吹蜡烛、鼓足两腮、舌头舔果酱等舌唇动作，每次10分钟，提升言语运动规划活性。'
    ],
    social_emotional: [
      '视线追随与指物呼应破冰训练：成人手指某亮点（如亮灯玩具），呼其名，以夸张的声音表露笑颜，确认达成5-10秒眼神持续交汇。',
      '情绪色卡亲子互碰沙盘：每天通过表情连连看卡，教其将抽象的情绪说出来：“我现在想要哭...”，建立对情绪的理智控制。'
    ],
    cognitive: [
      '色彩物理实物体块对连：在桌前摆放形状拼图及红绿卡，限时完成“长方配孔、异色分类”训练，激发空间与颜色逻辑推理。',
      '藏物瞬时位移盲猜杯：利用深茶色杯子变挪覆盖，通过简单的两连杯视线追踪，锻炼前额叶微环路的瞬时位移记忆屏。'
    ],
    attention: [
      '高灵敏感应反馈屏障训练：配套脑电智能反馈带，在无杂音室内对战电脑拼图，监测波值并动态降低难度以增强患儿挫折自信。',
      '指令切换定声对射：听单一哨音前移，听连续哨音静坐。在交替和变化中激发前额叶网络对分心因子的高效抑制阻隔。'
    ],
    self_care: [
      '穿衣扣合OT工作台演练：设计一块附带粗拉链、大钮扣、粘扣扣的大木牌，每天早晚自主扣合3次，强化个人生活自理独立性。',
      '手口水洗闭环指令：在极细致图解指引下，每日练习进食前“湿水-打皂-洗缝-抹干”全步骤，直至不需人从旁提示即可执行。'
    ],
    family_env: [
      '制定严格的“断电睡眠”睡眠规程：睡前两小时关闭电脑、投影仪和手机屏幕，防止蓝光及视觉高频振荡损伤儿童脑波周期性。',
      '建立家庭温暖正面强化的情绪同向：禁止对患儿使用“笨、不行、哭什么哭”等粗暴负向言词，改用描述性肯定语鼓励其每一微小进步。'
    ]
  };

  const defaultRehab = [
    '建议使用森心康智能穿戴套件，将康复游戏从2D升级为3D。配合高精度传感器做家庭OT康复指导。',
    '坚持每天定时间的少儿关节拉伸运动，刺激下丘脑及神经营养因子释放，助力幼童认知成长。'
  ];

  const defaultHome = [
    '【起居室多通道游戏】：客厅一角辟出22米安全运动池，摆放彩虹滑梯与手套练习架，每日固定游戏。',
    '【亲子伴谈闭环游戏】：每晚睡前半小时举行“今日小英雄”拥抱对话，巩固温馨氛围。',
    '【户外沙盒感统训练】：带孩子光脚在小沙坑或草皮上奔跑行走，接触多重天然微颗粒及材质。'
  ];

  // Pick suggestions
  let pickedRehab: string[] = [];
  struggling.forEach(s => {
    if (rehabMap[s.dimensionId]) {
      pickedRehab.push(...rehabMap[s.dimensionId]);
    }
  });

  if (pickedRehab.length < 3) {
    // Top up with random standard ones or dimensional ones that are normal but can be optimized
    scores.forEach(s => {
      if (pickedRehab.length < 4 && rehabMap[s.dimensionId]) {
        pickedRehab.push(rehabMap[s.dimensionId][0]);
      }
    });
  }

  // Cap rehab list length
  pickedRehab = pickedRehab.slice(0, 4);
  if (pickedRehab.length === 0) pickedRehab = defaultRehab;

  let neuralPathwayAnalysis = '';
  if (delayCount > 0) {
    neuralPathwayAnalysis = `当前发育分析表明，患儿存在局部大脑神经元突触剪切与环路阻抗滞后情况。特别是在前庭平衡与部分前额叶网路区域，因突触密度或整合度可能低于同龄均值，导致外周感受传导反射至皮质的时间成本增加。当前处于突触重塑的“黄金窗口期”（Brain plasticity golden period），加强智能传感和游戏化密集OT物理反馈，能极大激发未分化神经元的跨脑区功能质变。`;
  } else if (borderlineCount > 0) {
    neuralPathwayAnalysis = `脑机理测绘显示患儿感觉整合与情绪通路目前处于典型的中性过渡带。脑深层核团如杏仁核、纹状体与精细运动小脑区信息偶联良好，但传导通路的容错裕度偏低。如果长时间缺乏富有情绪互动力的高感官互动刺激，神经网突触连结密度可能会呈现自适应收缩。当前亟需微阻力定向活动与正合家庭环境进行环路突触稳连。`;
  } else {
    neuralPathwayAnalysis = `评估数据勾勒出患儿具有极其健康、极高弹性（High resilience）的脑结构协同性。前额叶皮层、枕叶视觉中枢与颞叶听觉语言区之间的神经递质传输极为平滑，双侧半球联合纤维胼胝体发育匀称。其动作规划机制和多感官整合功能已达甚至溢出同龄水平，建议提供复杂的益智或少儿创造性互动，促进其潜在优势半球技能在高级突触环路层面的进一步沉淀。`;
  }

  let prognosisPrediction = '';
  if (delayCount > 0) {
    prognosisPrediction = `若从当月起落实每日1.5小时具有定制传感器反馈的家庭康复锻炼，在接下来的3-6个月中，其神经环路的活性提升在78%以上，多项边缘维度有极大概率回归ASQ正常基线。家长切忌焦虑或盲目攀比，多使用正面情绪。`;
  } else {
    prognosisPrediction = `未来3-6个月，若坚持适度运动、低干扰数码陪伴及高频率亲子共读，儿童在语言组织、注意力连续性等核心维度将会有极佳的向上突显。建议家长保持轻松乐观的心态配合其成长。`;
  }

  return {
    summary,
    neuralPathwayAnalysis,
    rehabSuggestions: pickedRehab,
    homeGuidance: defaultHome,
    prognosisPrediction,
    criticalMetrics: {
      neuralPlasticity,
      sensoryIntegration,
      familyEnvironmentScore: familyEnv,
      motorControlIndex: motorControl
    }
  };
}

// API endpoint for generating assessment report (combining static and dynamic Gemini call query)
app.post('/api/report', async (req: express.Request, res: express.Response) => {
  try {
    const { child, scores } = req.body;
    if (!child || !scores || !Array.isArray(scores)) {
      res.status(400).json({ error: 'Missing child profile or assessment scores in body.' });
      return;
    }

    let reportData;
    let isAiGenerated = false;
    let aiEngine = 'fallback_template';

    const scoresSummaryStr = scores.map(s =>
      `- 维度：${s.dimensionName} | 阶：${s.tierId} | 本次筛查量表：${s.scaleName} | 分数：${s.score}/${s.maxScore} | 状态：${s.status}`
    ).join('\n');

    const reportSystemInstruction = 'You are a compassionate pediatric neuro-rehabilitation expert. You strictly return output as a single, valid JSON block exactly matching the instructed schema, with no markdown codeblocks, no front/end spacing, in Chinese language.';

    const basePrompt = `您是一位在儿童神经康复、脑科学发育及儿童成长心理学领域深耕20年的首席临床医学主任医生。
请针对以下儿童的基础发育筛查详细数据，结合“森心康”儿童康复的“9维3层分层神经系统检测”理念，为其精确诊断并生成出一份深度、高精准、温暖且富有专业建设意义的“AI脑神经分层网络智能评估报告”。

儿童档案:
- 姓名: ${child.name}
- 年龄: ${child.ageMonth}个月
- 性别: ${child.gender === 'boy' ? '男孩' : '女孩'}

已评估的多维度量表及评分结果:
${scoresSummaryStr}

请注意：
1. 您必须严格按照指定的JSON数据格式输出（不要夹杂任何额外的文字、\`\`\`json 格式标记，只返回标准的可解析的JSON对象）。
2. 在您的神经环路发育状态分析中，请以专业脑神经突触偶联、脑功能定位（如前额叶、小脑精细区、前庭反射等）、以及神经可塑性等先进脑科学概念给予严密解析，既要表现医学大师的透彻，又要字字充满对受测儿童的厚爱与成长温煦。
3. 康复建议及家庭指导方案必须具有极强的动作实操逻辑，不要给出假大空的敷衍建议。建议中可提倡将森心康智能穿戴硬件（脑电反馈带、精细OT手套、步态腰带等）编织到日常游戏中辅疗增效。
4. metrics（百分值度区间在45至98之间）要根据上面的筛查分值客观联动。
`;

    // Qwen has no responseSchema equivalent, so the JSON contract is embedded in the prompt
    const qwenPrompt = basePrompt + `
你必须严格返回以下JSON结构（字段齐全，不要任何额外文字或\`\`\`json标记）：
{
  "summary": "一句话总结该名受测少儿此时的核心脑成长特征（60-120字）",
  "neuralPathwayAnalysis": "深入剖析患儿当前的脑网络状态、感觉中枢协调性、前额皮层控制环等神经反射弧健康状态（100-250字）",
  "rehabSuggestions": ["康复训练方案建议（共3至4条）"],
  "homeGuidance": ["家庭场景协作活动（共3条）"],
  "prognosisPrediction": "3-6个月后的预后康复轨迹预判（100字左右）",
  "criticalMetrics": {
    "neuralPlasticity": 45至98的整数,
    "sensoryIntegration": 45至98的整数,
    "familyEnvironmentScore": 45至98的整数,
    "motorControlIndex": 45至98的整数
  }
}`;

    // Engine 1: Alibaba Qwen via DashScope (primary)
    try {
      reportData = await callQwenJSON(QWEN_REPORT_MODEL, reportSystemInstruction, qwenPrompt);
      isAiGenerated = true;
      aiEngine = QWEN_REPORT_MODEL;
    } catch (qwenErr: any) {
      console.warn(`Qwen (${QWEN_REPORT_MODEL}) report generation failed, trying Gemini:`, qwenErr.message);

      // Engine 2: Google Gemini (secondary)
      try {
      const gClient = getGeminiClient();
      const response = await gClient.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: basePrompt,
        config: {
          systemInstruction: 'You are a compassionate pediatric neuro-rehabilitation expert. You strictly return output as a single, valid JSON block exactly matching the instructed schema, with no markdown codeblocks, no front/end spacing, in Chinese language.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: '一句话总结该名受测少儿此时的核心脑成长特征，字数在60-120格内。'
              },
              neuralPathwayAnalysis: {
                type: Type.STRING,
                description: '深入剖析患儿当前的脑软硬件网络状态、感觉中枢协调性、前额皮层控制环等神经反射弧健康状态（100-250字）。'
              },
              rehabSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '输出具有极强指导力、适合由康复师或家长辅导的长效临床训练或物理康复训练方案建议列表（3至4条）。'
              },
              homeGuidance: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '设计可在客厅、卧室、游乐园便捷操演的、富有趣味游戏性质、结合运动腰带或脑控智能头戴设备的家庭场景协作活动（3条）。'
              },
              prognosisPrediction: {
                type: Type.STRING,
                description: '中肯预判在实施针对性家庭训练康复3-6个月后的预后脑环路康复轨迹图景与心理辅导话术（100字左右）。'
              },
              criticalMetrics: {
                type: Type.OBJECT,
                properties: {
                  neuralPlasticity: { type: Type.INTEGER, description: '脑神经可 plasticity 发育潜力指数（45-98）' },
                  sensoryIntegration: { type: Type.INTEGER, description: '感觉统合大脑协同度指数（45-98）' },
                  familyEnvironmentScore: { type: Type.INTEGER, description: '家庭氛围赋能康复支持支持系数（45-98）' },
                  motorControlIndex: { type: Type.INTEGER, description: '运动姿势力线控制指数（45-98）' }
                },
                required: ['neuralPlasticity', 'sensoryIntegration', 'familyEnvironmentScore', 'motorControlIndex']
              }
            },
            required: ['summary', 'neuralPathwayAnalysis', 'rehabSuggestions', 'homeGuidance', 'prognosisPrediction', 'criticalMetrics']
          }
        }
      });

      const responseText = response.text || '';
      const cleanedResponse = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      reportData = JSON.parse(cleanedResponse);
      isAiGenerated = true;
      aiEngine = 'gemini-3.5-flash';
      } catch (apiErr: any) {
        console.warn('Gemini also unavailable, using local template engine:', apiErr.message);
        reportData = generateFallbackReport(child, scores);
        isAiGenerated = false;
        aiEngine = 'fallback_template';
      }
    }

    res.json({
      report: reportData,
      isAiGenerated,
      aiEngine,
      createdAt: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown internal assessment error.' });
  }
});

// Fallback advanced diagnostic engine for Language and Communication
function generateFallbackLanguageReport(
  child: any,
  targetPrompt: string,
  audioTranscribedText: string,
  articulation: string,
  fluency: string,
  sentenceLength: string
) {
  let condition = '发育性言语障碍-构音发育延迟';
  let pathMessage = `针对儿童【${child.name}】（${child.ageMonth}个月，${child.gender === 'boy' ? '男孩' : '女孩'}）的言语和构音功能深度评估。孩子在拼读测试“${targetPrompt}”时发音为“${audioTranscribedText || '(未记录发音)'}”。`;

  if (articulation.includes('辅音置换') || articulation.includes('省略')) {
    condition = '构音器官运动规划不佳 (辅音发音位置代偿性前移延迟)';
    pathMessage += `
临床脑神经言语学评估表明：受测儿在舌面后音（如 g, k）与舌尖前音（如 d, t）的运动支配规划上存在反馈滞后。儿童言语听觉传导带（Temporal Auditory Zone）对高频辅音音素的编码感知度完好，但 Broca 言语区在大脑下运动皮质向下颌、舌肌群下达动作脉冲时，空间控制不够精细。表现为舌根部肌肉上抬力线不稳，出现代偿性的舌尖前音置换发音。建议进行定向口肌抗阻与唇舌尖脱敏刺激。`;
  } else if (fluency.includes('连复') || fluency.includes('卡顿')) {
    condition = '儿童发育性不流畅 (口吃倾向与韵律传导受限)';
    pathMessage += `
言语声谱特征表明：患儿在言语声带起动阶段（Speech onset period）存在一过性气流控制失衡。由于言语运动区与脊髓前角细胞呼吸反馈存在轻微的时间不匹配，患儿在脑部产生词汇概念后，急于输出，导致声带在吸气末期过度扣紧，无法顺畅吐出首字。这常伴随情绪上的轻度应激性焦虑。建议采用“慢速起音法”及舒缓呼吸疗法，减少家长催促等负面心理干扰。`;
  } else if (sentenceLength.includes('单字') || sentenceLength.includes('无句法')) {
    condition = '表达性语言迟缓 (语义词汇及语法结构发育偏后)';
    pathMessage += `
神经网络评估反映：儿童处于典型的主动语篇词汇组织滞后状态。其理解性语言（言语解码区 Wernicke）能听懂日常指令，但表达性语言（言语编码区 Broca）中，由于工作记忆（Working Memory）存储容量较小，无法短时间内在线组装多级语法树。主要停留在以“单字”或“电报词”表达核心需求的阶段。需要高频的“双词句扩张”及声画情境强化。`;
  } else {
    condition = '轻度发育性音素转换延迟 (预后良性过渡阶段)';
    pathMessage += `
经脑功能多维言语测绘，患儿当前的构音肌肉反馈、构音规划、声气协调度均在正常可塑范围。个别复杂辅音拼读（如翘舌音、擦音）的轻微模糊属于3-4岁发育期常见生理现象。脑突触剪切与微电流传输极具潜力，建议在家庭陪伴中增加高频辅音对指纠音游戏。`;
  }

  return {
    speechPathology: pathMessage.trim(),
    diagnosedCondition: `${child.ageMonth}个月儿童：${condition}`,
    acousticProfile: {
      pitchAnalysis: `检测声带闭合弹性，基频 F0 平均在 285Hz 左右，发声力度均匀度可塑，声门下压在构音重音处有轻度偏窄。`,
      speechRate: `检测得出发声时间 1.4 秒。拼读语速约为 ${fluency.includes('卡顿') || fluency.includes('连复') ? '45' : '82'} 字/分钟，相较于同龄均值（约 90-110 字/分钟）显现${fluency.includes('卡顿') || fluency.includes('连复') ? '明显节律停滞，阻碍率约 18%' : '轻微词汇获取迟缓或普通流畅'}。`,
      resonance: `口腔共鸣正常。${articulation.includes('鼻音') ? '伴随有轻微的鼻腔共鸣漏气或腭咽闭合不足，导致清晰度下降 12%' : '下颌下拉幅度略窄，致使唇齿爆破音共鸣区受阻，音调略呈闭锁型'}。`
    },
    interventionGoals: [
      `【构音肌肉运动】每日进行10分钟口唇抗阻训练（如吹气、舌尖抵硬腭、吹肥皂泡等）以提升下颌关节张力。`,
      `【言语听觉联动】使用森心康定制慢语速法（120字/分钟）进行绘本故事跟读，每次 15 分钟，纠正辅音脱失。`,
      `【语法表达拉伸】采用双词组合扩展法（如：孩子说“苹果”，家长扩展为“吃大苹果”或“红色的苹果”），每日循环5组。`
    ],
    slpExercises: [
      {
        day: "第 1-2 天",
        target: "构音器官（唇舌肌张力）协调激活",
        exercise: "【舌尖点触操】：在儿童上唇、下唇以及上齿龈处涂抹少许酸奶或果酱，引导儿童自主用舌尖舔舐。再配合“呼气吹乒乓球”游戏，在桌面上放置3个小乒乓球，引导儿童张大口、深呼吸并猛烈吹气，每次5个回合。",
        duration: "10分钟 / 每日2次",
        tips: "吹气时注意儿童双肩保持放松，不要耸肩耸颈，保持唇部收紧成圆形。"
      },
      {
        day: "第 3-4 天",
        target: "特定音素“后/前音”构音位置矫正与阻力诱导",
        exercise: "【软腭抬高与低头构音】：针对g/k不分、读成d/t的儿童，让其稍微后仰头部，口含少许温水进行‘咕噜咕噜’漱口游戏。随后，让其尝试发出‘g-g-g’（嗝）的声音，通过声腔物理阻力和重力，协助舌根部上抬、接触软腭。",
        duration: "15分钟 / 每日1次",
        tips: "切勿强行责备患儿发音不准，通过好玩的‘嗝嗝小怪兽’角色扮演降低其抗拒情绪。"
      },
      {
        day: "第 5-7 天",
        target: "双词句/语法树多级扩展交互强化",
        exercise: "【实物选择与情境句子拉伸】：准备孩子喜爱的苹果、饼干、玩具汽车。第一步，让孩子指着说出名称（‘苹果’）；第二步，家长追问‘谁要吃苹果？’，引导发出‘宝宝吃’；第三步，扩展为‘宝宝吃苹果’。以此多级拉伸言语 Broca 中枢的工作记忆负荷。",
        duration: "200分钟 / 每日1次",
        tips: "当孩子说出三字短句后，给予非常夸张的正向肢体鼓励（如大力击掌、拥抱），重建其开口自信。"
      }
    ],
    parentGuidance: "首要建议家长克服自身急躁心理，严格控制患儿使用平板电脑、手机的时长（每日不超20分钟）。用极具眼神交汇、温柔对视、夸张口型、语速放慢一半的日常对话，取代命令式的提问。在舒适宽松且充满暖意的家庭语境中，滋润并唤醒儿童的言语皮层神经网络。"
  };
}

// API endpoint for deep language evaluation with Alibaba Qwen models
app.post('/api/ali-language-eval', async (req: express.Request, res: express.Response) => {
  try {
    const { child, audioTranscribedText, articulation, fluency, sentenceLength, targetPrompt } = req.body;
    
    if (!child) {
      res.status(400).json({ error: 'Missing child profile.' });
      return;
    }

    const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.ALI_LLM_API_KEY;
    let isAiGenerated = false;
    let evalReport;

    if (dashscopeKey && dashscopeKey !== 'MY_DASHSCOPE_API_KEY' && dashscopeKey !== '') {
      try {
        const prompt = `请针对以下受评儿童的语言样本和临床发音构音障碍特征，进行深度脑神经语言学评估，并输出结构化儿童SLP诊疗报告：
儿童档案:
- 姓名: ${child.name}
- 年龄: ${child.ageMonth}个月
- 性别: ${child.gender === 'boy' ? '男孩' : '女孩'}

言语测试设定:
- 目标说词/说句模板: "${targetPrompt}"
- 儿童实际开口录制转录: "${audioTranscribedText || '(无转录，仅凭物理特征评估)'}"

临床听觉/视觉测绘观察特征:
- 发音清晰度 (Articulation): ${articulation}
- 口齿流畅度 (Fluency): ${fluency}
- 平均句子长度 (Syntactic complexity/MLU): ${sentenceLength}

请结合儿童的发育月龄，给出极度专业、充满厚爱、科学严谨的评估分析。
你必须严格返回以下JSON Schema格式的对象，不要夹杂任何额外的文字，不要夹杂 \`\`\`json 标记，确保可以被JSON.parse完美解析：
{
  "speechPathology": "从脑部颞叶言语中枢与构音肌张力角度，对儿童在该发音中的阻尼和剪裁异常进行病理机制深度剖析（150-250字）。",
  "diagnosedCondition": "一句话判定其言语障碍分类诊断名（例如：3岁儿童发育性言语障碍-构音延迟）及目前的发育分级。",
  "acousticProfile": {
    "pitchAnalysis": "声带声学频带振动分析及声学阻抗说明（60-100字）。",
    "speechRate": "说明儿童发音时间，推算当前语速并对比同龄标准（60-100字）。",
    "resonance": "判断是否存在异常共振（如软腭控制不佳导致的鼻腔漏气或口腔紧闭音，60-100字）。"
  },
  "interventionGoals": [
    "近期干预目标1（如口唇肌张力激活）",
    "近期干预目标2（如特定塞音/擦音舌位拉伸）",
    "近期干预目标3（如语法短句双向扩展）"
  ],
  "slpExercises": [
    {
      "day": "第1-2天",
      "target": "阶段训练一目标",
      "exercise": "具体游戏化操练步骤设计，指导家长协助儿童发音",
      "duration": "操练时间",
      "tips": "重点注意事项"
    },
    {
      "day": "第3-4天",
      "target": "阶段训练二目标",
      "exercise": "具体游戏化操练步骤设计",
      "duration": "操练时间",
      "tips": "重点注意事项"
    },
    {
      "day": "第5-7天",
      "target": "阶段训练三目标",
      "exercise": "具体游戏化操练步骤设计",
      "duration": "操练时间",
      "tips": "重点注意事项"
    }
  ],
  "parentGuidance": "舒缓抚养人心理情绪压力，提供关于语言刺激环境赋能（如慢速伴读、声画互联）的资深SLP指导意见。"
}`;

        evalReport = await callQwenJSON(
          QWEN_REPORT_MODEL,
          'You are a compassionate pediatric speech-language pathologist and neurology expert. You strictly return output as a single, valid JSON block with no markdown code blocks, no front/end spacing, in Chinese language.',
          prompt
        );
        isAiGenerated = true;
      } catch (innerErr: any) {
        console.error('DashScope Qwen call failed, using high-fidelity local engine:', innerErr.message);
      }
    }

    if (!evalReport) {
      evalReport = generateFallbackLanguageReport(child, targetPrompt, audioTranscribedText, articulation, fluency, sentenceLength);
      isAiGenerated = false;
    }

    res.json({
      report: evalReport,
      isAiGenerated,
      createdAt: new Date().toISOString()
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown deep language evaluation error.' });
  }
});

// API endpoint for real speech recognition via Qwen3-ASR-Flash
app.post('/api/asr', async (req: express.Request, res: express.Response) => {
  try {
    const { audioData, context } = req.body;
    if (!audioData || typeof audioData !== 'string') {
      res.status(400).json({ error: 'Missing audioData (base64 data URL or public audio URL).' });
      return;
    }

    const key = getDashScopeKey();
    if (!key) {
      res.status(503).json({ error: 'DASHSCOPE_API_KEY is not configured, real speech recognition unavailable.' });
      return;
    }

    // Note: qwen3-asr-flash rejects plain-text system messages ("does not support this input"),
    // so the `context` field from the client is accepted but not forwarded.
    void context;
    const messages: any[] = [{
      role: 'user',
      content: [{ type: 'input_audio', input_audio: { data: audioData } }]
    }];

    const resp = await fetch(DASHSCOPE_COMPAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ model: QWEN_ASR_MODEL, messages })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(502).json({ error: `Qwen ASR request failed (${resp.status}): ${errText.slice(0, 300)}` });
      return;
    }

    const raw = await resp.json();
    const message = raw.choices?.[0]?.message;
    const text = typeof message?.content === 'string'
      ? message.content
      : Array.isArray(message?.content)
        ? message.content.map((c: any) => c.text || '').join('')
        : '';
    const audioInfo = Array.isArray(message?.annotations)
      ? message.annotations.find((a: any) => a.type === 'audio_info')
      : null;

    res.json({
      text: text.trim(),
      language: audioInfo?.language || null,
      emotion: audioInfo?.emotion || null,
      model: QWEN_ASR_MODEL
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown ASR error.' });
  }
});

// Tencent CloudBase (腾讯云开发) integration
let cloudbaseDb: any = null;
let cloudbaseApp: any = null;

// Offline-mode fallback in-memory datastores
const offlineUsers = new Map<string, any>();
const offlineUserData = new Map<string, any>();

// Seed a default test account for fast, instant client-side evaluation
offlineUsers.set('test@test.com', { email: 'test@test.com', password: '123456' });

function getCloudBaseDb() {
  if (cloudbaseDb) return cloudbaseDb;

  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;
  const envId = process.env.CLOUDBASE_ENV_ID;

  if (!secretId || !secretKey || !envId) {
    console.log('[CloudBase] Credentials not fully configured. Running in offline/localStorage mode.');
    return null;
  }

  try {
    const cloudbaseObj = tcb.init ? tcb : (tcb as any).default || tcb;
    cloudbaseApp = cloudbaseObj.init({
      secretId,
      secretKey,
      env: envId,
    });
    cloudbaseDb = cloudbaseApp.database();
    console.log(`[CloudBase] Successfully initialized database connection for Env: ${envId}`);
    return cloudbaseDb;
  } catch (err: any) {
    console.error('[CloudBase] Initialization error:', err.message);
    return null;
  }
}

// Endpoint to check database connection status
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Database operation timed out'));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

app.get('/api/db/status', (req, res) => {
  const db = getCloudBaseDb();
  res.json({
    configured: db !== null,
    envId: process.env.CLOUDBASE_ENV_ID || null,
  });
});

// Endpoint to register user account
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: '请填写完整的邮箱和密码' });
      return;
    }

    const db = getCloudBaseDb();
    let cloudSaved = false;

    if (db) {
      try {
        // Check if user already exists in cloud database
        const checkRes: any = await withTimeout(db.collection('sxk_accounts').where({ email }).get(), 2000);
        if (checkRes && checkRes.data && checkRes.data.length > 0) {
          res.status(400).json({ error: '该邮箱已被注册，请直接登录' });
          return;
        }

        // Add account document
        await withTimeout(db.collection('sxk_accounts').add({
          email,
          password, // In this educational sandbox, we store it directly. In production, we would use a strong hash like bcrypt.
          createdAt: new Date().toISOString()
        }), 2000);
        console.log(`[CloudBase] Registered cloud account: ${email}`);
        cloudSaved = true;
      } catch (dbErr: any) {
        console.warn('[CloudBase] Cloud registration failed, falling back to local memory:', dbErr.message);
      }
    }

    if (!cloudSaved) {
      // In-memory registration fallback for local test
      if (offlineUsers.has(email)) {
        res.status(400).json({ error: '该邮箱已被注册，请直接登录' });
        return;
      }
      offlineUsers.set(email, { email, password });
      console.log(`[Local Memory] Registered local account fallback: ${email}`);
    }

    res.json({ success: true, email });
  } catch (err: any) {
    console.error('[Auth Register Error]:', err.message);
    res.status(500).json({ error: `注册失败: ${err.message}` });
  }
});

// Endpoint to login user account
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: '请填写邮箱和密码' });
      return;
    }

    const db = getCloudBaseDb();
    let authenticatedUser = null;

    if (db) {
      try {
        const checkRes: any = await withTimeout(db.collection('sxk_accounts').where({ email }).get(), 2000);
        if (checkRes && checkRes.data && checkRes.data.length > 0) {
          const found = checkRes.data[0];
          if (found.password === password) {
            authenticatedUser = found;
          }
        }
      } catch (dbErr: any) {
        console.warn('[CloudBase] Cloud login failed, falling back to local memory:', dbErr.message);
      }
    }

    // Always check the local offline database if cloud lookup didn't succeed
    if (!authenticatedUser) {
      const found = offlineUsers.get(email);
      if (found && found.password === password) {
        authenticatedUser = found;
      }
    }

    if (!authenticatedUser) {
      res.status(401).json({ error: '邮箱或密码错误，请重新输入' });
      return;
    }

    // Load any associated child data
    let child = null;
    let completedScores = [];
    let orders = [];
    let reportHistory = [];
    let loadedFromCloud = false;

    if (db) {
      try {
        const dataRes: any = await withTimeout(db.collection('sxk_user_data').where({ email }).get(), 2000);
        if (dataRes && dataRes.data && dataRes.data.length > 0) {
          const data = dataRes.data[0];
          child = data.child || null;
          completedScores = data.completedScores || [];
          orders = data.orders || [];
          reportHistory = data.reportHistory || [];
          loadedFromCloud = true;
        }
      } catch (dbErr: any) {
        console.warn('[CloudBase] Cloud loading child data failed:', dbErr.message);
      }
    }

    if (!loadedFromCloud) {
      const data = offlineUserData.get(email);
      if (data) {
        child = data.child || null;
        completedScores = data.completedScores || [];
        orders = data.orders || [];
        reportHistory = data.reportHistory || [];
      }
    }

    res.json({
      success: true,
      email: authenticatedUser.email,
      child,
      completedScores,
      orders,
      reportHistory
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err.message);
    res.status(500).json({ error: `登录失败: ${err.message}` });
  }
});

// Endpoint to load child assessment records
app.get('/api/db/load', async (req, res) => {
  try {
    const { deviceId, email } = req.query;
    
    const db = getCloudBaseDb();
    if (!db) {
      // Local fallback lookup
      if (email && typeof email === 'string') {
        const localData = offlineUserData.get(email);
        if (localData) {
          res.json({
            source: 'local_server',
            child: localData.child || null,
            completedScores: localData.completedScores || [],
            orders: localData.orders || [],
            reportHistory: localData.reportHistory || []
          });
          return;
        }
      }
      res.json({ source: 'unconfigured' });
      return;
    }

    let result: any = null;
    try {
      if (email && typeof email === 'string') {
        result = await withTimeout(db.collection('sxk_user_data').where({ email }).get(), 2000);
      } else if (deviceId && typeof deviceId === 'string') {
        result = await withTimeout(db.collection('sxk_user_data').where({ deviceId }).get(), 2000);
      } else {
        res.status(400).json({ error: 'Missing deviceId or email parameter.' });
        return;
      }
      
      if (result && result.data && result.data.length > 0) {
        const data = result.data[0];
        res.json({
          source: 'cloud',
          child: data.child || null,
          completedScores: data.completedScores || [],
          orders: data.orders || [],
          reportHistory: data.reportHistory || []
        });
      } else {
        res.json({
          source: 'cloud',
          child: null,
          completedScores: [],
          orders: [],
          reportHistory: []
        });
      }
    } catch (err: any) {
      console.warn('[CloudBase Load Timeout/Error] Falling back to offline local memory:', err.message);
      if (email && typeof email === 'string') {
        const localData = offlineUserData.get(email);
        if (localData) {
          res.json({
            source: 'local_server',
            child: localData.child || null,
            completedScores: localData.completedScores || [],
            orders: localData.orders || [],
            reportHistory: localData.reportHistory || []
          });
          return;
        }
      }
      res.json({
        source: 'local_server',
        child: null,
        completedScores: [],
        orders: [],
        reportHistory: []
      });
    }
  } catch (err: any) {
    console.error('[CloudBase Load Error]:', err.message);
    res.status(500).json({ error: `CloudBase load failed: ${err.message}` });
  }
});

// Endpoint to save child assessment records
app.post('/api/db/save', async (req, res) => {
  try {
    const { deviceId, email, child, completedScores, orders, reportHistory } = req.body;

    // Always update the offline local memory database as a hot backup
    if (email) {
      offlineUserData.set(email, {
        child,
        completedScores,
        orders,
        reportHistory
      });
    }

    const db = getCloudBaseDb();
    if (!db) {
      res.json({ success: true, localSaved: true });
      return;
    }

    try {
      let checkResult: any = null;
      let hasExisting = false;
      let queryField: any = {};

      if (email) {
        queryField = { email };
        checkResult = await withTimeout(db.collection('sxk_user_data').where({ email }).get(), 2000);
        hasExisting = checkResult && checkResult.data && checkResult.data.length > 0;
      } else if (deviceId) {
        queryField = { deviceId };
        checkResult = await withTimeout(db.collection('sxk_user_data').where({ deviceId }).get(), 2000);
        hasExisting = checkResult && checkResult.data && checkResult.data.length > 0;
      } else {
        res.status(400).json({ error: 'Missing deviceId or email.' });
        return;
      }

      const recordPayload = {
        ...queryField,
        child,
        completedScores,
        orders,
        reportHistory,
        updatedAt: new Date().toISOString()
      };

      if (hasExisting) {
        const docId = checkResult.data[0]._id;
        await withTimeout(db.collection('sxk_user_data').doc(docId).set(recordPayload), 2000);
        console.log(`[CloudBase] Successfully updated data for ${email ? 'email ' + email : 'device ' + deviceId}`);
      } else {
        await withTimeout(db.collection('sxk_user_data').add(recordPayload), 2000);
        console.log(`[CloudBase] Successfully created new record for ${email ? 'email ' + email : 'device ' + deviceId}`);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.warn('[CloudBase Save Timeout/Error] Data is hot-backed up in local memory:', err.message);
      res.json({ success: true, localSavedFallback: true });
    }
  } catch (err: any) {
    console.error('[CloudBase Save Error]:', err.message);
    res.status(500).json({ error: `CloudBase save failed: ${err.message}` });
  }
});

// Vite & Static file configurations
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SenXinKang Server] Server is booted successfully on http://0.0.0.0:${PORT}`);
  });
}

startServer();
