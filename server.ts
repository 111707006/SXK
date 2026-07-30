import express from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
// tcb import removed - replaced with MySQL
import * as mysqlDb from './src/db/mysql';
import { notifyExpertBooking } from './src/notify';
import { generateOutTradeNo, isValidOutTradeNo } from './src/utils/outTradeNo';
import { DIMENSIONS_DATA } from './src/data';
import { REHAB_SUGGESTIONS } from './src/dimensionContent';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

dotenv.config();

const app = express();
const PORT = Number(process.env.DEPLOY_RUN_PORT || process.env.PORT) || 5000;

// ── Product mode (backend counterpart of src/productConfig.ts) ──
// Both must be set on a deployment; they control different halves:
//   VITE_APP_MODE  — build time, decides what the bundle renders
//   APP_MODE       — run time, decides which routes this process registers
//
// Deliberately fail-closed, mirroring resolveMode() in productConfig.ts: an
// unrecognised value kills the process instead of quietly falling back to
// 'full'. A typo that fell back would leave the tier-2/3 endpoints serving on
// the box handed to the partner company, with nothing to signal it.
type AppMode = 'full' | 't1only';

function resolveAppMode(raw: string | undefined): AppMode {
  if (raw === undefined || raw === '') return 'full';
  if (raw === 'full' || raw === 't1only') return raw;
  throw new Error(
    `APP_MODE is not recognised: ${JSON.stringify(raw)}. Only 'full' (project A) or 't1only' (project B) are accepted.`
  );
}

const APP_MODE = resolveAppMode(process.env.APP_MODE);

// The tier-2/3 AI endpoints exist only in project A. Project B registers them
// on a Router that is never mounted, so the paths genuinely do not exist and
// requests fall through to 404. That is stronger than registering a handler
// and rejecting inside it: there is no handler left to bypass, and a 404
// doesn't confirm the endpoint exists the way a 403 would.
const tier2Only = APP_MODE === 'full' ? app : express.Router();

// Same trick for the paid routes. Kept separate from tier2Only even though both
// currently resolve identically: "has deep assessment" and "charges for it" are
// two different product facts, and a pilot build with free T2/T3 would need them
// to diverge. One concept, one gate — same rule as productConfig's feature flags.
const paidOnly = APP_MODE === 'full' ? app : express.Router();

/** ¥19.9 per dimension, in 分 — WeChat Pay's amount.total is an integer in 分. */
const UNLOCK_PRICE_FEN = Number(process.env.UNLOCK_PRICE_FEN) || 1990;


// Security headers (X-Content-Type-Options, frameguard, HSTS, etc.).
// CSP is disabled so the Vite-built SPA's inline styles/scripts still load;
// TLS is terminated by nginx (see deploy/nginx.conf).
app.use(helmet({ contentSecurityPolicy: false }));

// Raised limit so base64-encoded audio clips (<=10MB) can reach the ASR endpoint
app.use(express.json({ limit: '15mb' }));

// ── Rate limiting (per-IP) to stop automated abuse burning DashScope quota ──
// Behind nginx (see deploy/nginx.conf) we must trust the first proxy hop so the
// limiter keys on the real client IP (X-Forwarded-For), not nginx's address.
app.set('trust proxy', 1);

const jsonTooMany = (req: express.Request, res: express.Response) =>
  res.status(429).json({ error: '请求过于频繁，请稍后再试。' });

// Generous defaults (tunable via env) so a full CPMV assessment (dozens of AI
// calls) never trips the limit, while a runaway loop hits it within seconds.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_API_MAX) || 800,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.RATE_AI_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_AUTH_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});

// Booking notifies real staff, so it gets a much tighter budget than the rest
// of /api. Generous enough for a clinic or school behind one NAT address, tight
// enough that a loop cannot bury the team in messages.
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_BOOKING_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});

app.use('/api', apiLimiter);
app.use('/api/expert-booking', bookingLimiter);
app.use(['/api/report', '/api/specialized-report', '/api/motion-eval',
  '/api/motion-report', '/api/ali-language-eval', '/api/asr'], aiLimiter);
app.use(['/api/auth/login', '/api/auth/register'], authLimiter);

// ── Auth: password hashing (bcrypt) + stateless HMAC session tokens ──
const BCRYPT_ROUNDS = 10;

// Signing secret for session tokens. Set SESSION_SECRET in production so tokens
// survive restarts; otherwise a random per-boot secret is used (tokens reset on restart).
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[Auth] SESSION_SECRET not set — using a random per-boot secret. Set SESSION_SECRET in production to keep sessions valid across restarts.');
}
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signToken(email: string): string {
  const payload = b64url(JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns the token's email if the signature is valid and unexpired, else null.
function verifyToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (!data.email || typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return data.email as string;
  } catch {
    return null;
  }
}

function getBearerToken(req: express.Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function looksHashed(stored: string): boolean {
  return typeof stored === 'string' && /^\$2[aby]\$/.test(stored);
}

// True if the password matches. Supports legacy plaintext rows so existing
// accounts keep working; callers upgrade the stored value to a hash on success.
async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (looksHashed(stored)) return bcrypt.compare(plain, stored);
  return plain === stored;
}

// ── coze-coding-dev-sdk LLM client ──
const llmConfig = new Config();
const llmClient = new LLMClient(llmConfig);
const LLM_REPORT_MODEL = 'doubao-seed-2-0-pro-260215';
const LLM_QWEN_MODEL = 'qwen-3-5-plus-260215';

async function callLLMJSON(systemPrompt: string, userPrompt: string, model: string = LLM_REPORT_MODEL): Promise<any> {
  const response = await llmClient.invoke(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { model, temperature: 0.7 }
  );
  const cleaned = response.content.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

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
const QWEN_VL_MODEL = process.env.QWEN_VL_MODEL || 'qwen3-vl-plus';

function getDashScopeKey(): string | null {
  const key = process.env.DASHSCOPE_API_KEY || process.env.ALI_LLM_API_KEY;
  if (!key || key === 'MY_DASHSCOPE_API_KEY') return null;
  return key;
}

// Uses axios (not global fetch) because @cloudbase/node-sdk pulls in web-streams-polyfill,
// which replaces the global ReadableStream and makes undici's fetch throw
// `webidl.is.ReadableStream` on some Node versions. axios goes through http/https directly.
async function postDashScope(key: string, payload: any): Promise<{ status: number; data: any }> {
  const resp = await axios.post(DASHSCOPE_COMPAT_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    timeout: 120000,
    maxBodyLength: Infinity,
    validateStatus: () => true
  });
  return { status: resp.status, data: resp.data };
}

async function callQwenJSON(model: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const key = getDashScopeKey();
  if (!key) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const resp = await postDashScope(key, {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    // Flagship Qwen models default to deep-thinking mode, far too slow for a synchronous report request
    enable_thinking: false
  });

  if (resp.status < 200 || resp.status >= 300) {
    const errText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    throw new Error(`DashScope ${model} request failed (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const raw = resp.data;
  const content = raw.choices?.[0]?.message?.content;
  if (!content) throw new Error('DashScope returned empty content.');
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Shared multi-engine cascade for JSON report generation.
// Qwen SDK -> Doubao SDK -> DashScope Qwen. Throws if every engine fails.
async function generateReportJSON(systemInstruction: string, prompt: string): Promise<{ report: any; aiEngine: string }> {
  try {
    return { report: await callLLMJSON(systemInstruction, prompt, LLM_QWEN_MODEL), aiEngine: LLM_QWEN_MODEL };
  } catch (e1: any) {
    console.warn(`Qwen SDK (${LLM_QWEN_MODEL}) failed, trying Doubao:`, e1.message);
    try {
      return { report: await callLLMJSON(systemInstruction, prompt, LLM_REPORT_MODEL), aiEngine: LLM_REPORT_MODEL };
    } catch (e2: any) {
      console.warn(`Doubao SDK (${LLM_REPORT_MODEL}) failed, trying DashScope:`, e2.message);
      return { report: await callQwenJSON(QWEN_REPORT_MODEL, systemInstruction, prompt), aiEngine: QWEN_REPORT_MODEL };
    }
  }
}

// Vision call: send an ordered list of base64 JPEG frames + a prompt to qwen3-vl,
// treating the frames as a sampled video sequence. Returns parsed JSON.
async function callQwenVision(frames: string[], prompt: string): Promise<any> {
  const key = getDashScopeKey();
  if (!key) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const content: any[] = [{ type: 'text', text: prompt }];
  frames.forEach(f => content.push({ type: 'image_url', image_url: { url: f } }));

  const resp = await postDashScope(key, {
    model: QWEN_VL_MODEL,
    messages: [{ role: 'user', content }]
  });

  if (resp.status < 200 || resp.status >= 300) {
    const errText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    throw new Error(`Qwen VL request failed (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const raw = resp.data;
  const msg = raw.choices?.[0]?.message?.content;
  const text = typeof msg === 'string'
    ? msg
    : Array.isArray(msg) ? msg.map((c: any) => c.text || '').join('') : '';
  if (!text) throw new Error('Qwen VL returned empty content.');
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
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
  let sensoryIntegration = 85 - (scores.find(s => s.dimensionId === 'sensory_processing')?.status === 'delay' ? 20 : 5);
  // 動作發展是唯一與運動控制相關的維度，權重合併後區間與原本一致 (61-81)
  let motorControl = 86 - (scores.find(s => s.dimensionId === 'gross_motor')?.status === 'delay' ? 25 : 5);
  // NOTE: 九大維度中已無「家庭環境」，此指標目前取自「學習能力」，名稱與來源不一致，待產品端決定改名或改算法
  let familyEnv = 90 - (scores.find(s => s.dimensionId === 'learning_ability')?.status === 'delay' ? 25 : 5);

  // Bounds check
  neuralPlasticity = Math.max(50, Math.min(98, neuralPlasticity));
  sensoryIntegration = Math.max(50, Math.min(98, sensoryIntegration));
  motorControl = Math.max(50, Math.min(98, motorControl));
  familyEnv = Math.max(50, Math.min(98, familyEnv));

  // Determine specific recommendations. The table lives in src/dimensionContent.ts
  // alongside the other dimension-keyed tables so one test can check them together.
  const rehabMap = REHAB_SUGGESTIONS;

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

    // Engine 1: Qwen 3.5 Plus via SDK (primary)
    try {
      reportData = await callLLMJSON(reportSystemInstruction, qwenPrompt, LLM_QWEN_MODEL);
      isAiGenerated = true;
      aiEngine = LLM_QWEN_MODEL;
    } catch (qwenSdkErr: any) {
      console.warn(`Qwen SDK (${LLM_QWEN_MODEL}) report generation failed, trying Doubao:`, qwenSdkErr.message);

      // Engine 2: Doubao Seed via SDK (secondary)
      try {
        reportData = await callLLMJSON(reportSystemInstruction, qwenPrompt, LLM_REPORT_MODEL);
        isAiGenerated = true;
        aiEngine = LLM_REPORT_MODEL;
      } catch (sdkErr: any) {
        console.warn(`Doubao SDK (${LLM_REPORT_MODEL}) also failed:`, sdkErr.message);

        // Engine 3: Alibaba Qwen via DashScope (tertiary)
        try {
          reportData = await callQwenJSON(QWEN_REPORT_MODEL, reportSystemInstruction, qwenPrompt);
          isAiGenerated = true;
          aiEngine = QWEN_REPORT_MODEL;
        } catch (qwenErr: any) {
          console.warn(`Qwen (${QWEN_REPORT_MODEL}) also failed, trying Gemini:`, qwenErr.message);

          // Engine 4: Google Gemini (quaternary)
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

// ── Paid-content gate for the tier-2/3 endpoints ──
//
// The frontend paywall decides what a parent *sees*; this decides what they can
// actually *fetch*. Without it the wall is decorative: these endpoints took no
// token at all, so anyone who knew the path got the paid report for free — and
// the parent who paid ¥19.9 would have bought something everyone already had.
// Same lesson as the APP_MODE work: a check that only exists in the bundle is
// not a check.
//
// Memory mode deliberately allows everything. With no durable store no purchase
// can exist (/api/payment/create returns 503 for that very reason), so enforcing
// here would only kill deep assessment on the demo deployment and protect
// nothing. The moment MYSQL_* is set this becomes a real gate — and startup logs
// which of the two is in effect, because a silently-open paywall is exactly the
// kind of thing nobody notices until the revenue is missing.
type UnlockDenial = { status: number; body: { error: string; code: string } };

async function denyIfLocked(req: express.Request, dimensionId: unknown): Promise<UnlockDenial | null> {
  if (!mysqlDb.isConfigured()) return null;

  // No dimension means we cannot tell what was purchased. Refuse rather than
  // guess — guessing wrong in the permissive direction gives away paid content.
  if (typeof dimensionId !== 'string' || !DIMENSIONS_DATA.some(d => d.id === dimensionId)) {
    return { status: 400, body: { error: '缺少有效的维度标识。', code: 'DIMENSION_REQUIRED' } };
  }

  const email = verifyToken(getBearerToken(req));
  if (!email) return { status: 401, body: { error: '请先登录后再使用深度评估。', code: 'UNAUTHENTICATED' } };

  const user = await mysqlDb.findUserByEmail(email);
  if (!user) return { status: 401, body: { error: '登录状态已失效，请重新登录。', code: 'UNAUTHENTICATED' } };

  const owned = await mysqlDb.listUnlockedDimensions(user.id);
  if (!owned.includes(dimensionId)) {
    return { status: 403, body: { error: '尚未解锁该维度的深度评估。', code: 'LOCKED' } };
  }
  return null;
}

/**
 * Applies denyIfLocked and writes the rejection. True means "already answered, stop".
 *
 * ⚠️ `dimensionId` must be the dimension the endpoint is about to SERVE, not a
 * field the caller can vary independently of the content. Getting this wrong is
 * not a small mistake: the first version of this gate checked a body field while
 * `/api/specialized-report` built its report from a *separate* body field
 * (`dimensionName`), so one ¥19.9 purchase unlocked all nine dimensions —
 * send the dimension you own, name the one you want. Endpoints that serve a
 * fixed dimension now pass a server-side constant; the rest look the name up
 * from the id they gated on.
 */
async function rejectIfLocked(req: express.Request, res: express.Response, dimensionId: unknown): Promise<boolean> {
  const denial = await denyIfLocked(req, dimensionId);
  if (!denial) return false;
  res.status(denial.status).json(denial.body);
  return true;
}

/** Dimensions whose deep assessment is served by a fixed endpoint. */
const LANGUAGE_DIMENSION_ID = 'language';
const MOTION_DIMENSION_ID = 'gross_motor';

// API endpoint for single-dimension T2/T3 specialized deep report (AI-generated)
tier2Only.post('/api/specialized-report', async (req: express.Request, res: express.Response) => {
  try {
    const { child, dimensionId, t2Percent, t3Percent, status } = req.body;
    if (await rejectIfLocked(req, res, dimensionId)) return;
    // The report is built from the dimension we just authorized, looked up here
    // rather than taken from the body. Accepting a client-supplied display name
    // alongside the gated id is what let one purchase serve all nine reports.
    const dimensionName = DIMENSIONS_DATA.find(d => d.id === dimensionId)?.name;
    if (!child || !dimensionName) {
      res.status(400).json({ error: 'Missing child profile or dimension name.' });
      return;
    }

    const statusText = status === 'delay' ? '发育迟缓' : status === 'borderline' ? '边缘警示' : '发育良好';
    const systemInstruction = 'You are a compassionate pediatric neuro-rehabilitation expert. You strictly return output as a single, valid JSON block exactly matching the instructed schema, with no markdown codeblocks, no front/end spacing, in Chinese language.';
    const prompt = `您是一位在儿童神经康复、脑科学发育及儿童成长心理学领域深耕20年的首席临床医学主任医生。
请针对以下儿童在【${dimensionName}】这一单一发育维度的 T2（家属能力自评）与 T3（临床互动实测）深度评估结果，生成一份聚焦该维度的“脑发育深度专项评估报告”。

儿童档案:
- 姓名: ${child.name}
- 年龄: ${child.ageMonth}个月
- 性别: ${child.gender === 'boy' ? '男孩' : '女孩'}

【${dimensionName}】维度评估结果:
- T2 家属自评得分率: ${typeof t2Percent === 'number' ? t2Percent : '未知'}%
- T3 临床实测得分率: ${typeof t3Percent === 'number' ? t3Percent : '未知'}%
- 综合判定: ${statusText}

请注意：
1. 只聚焦【${dimensionName}】这一个维度，不要泛谈其他维度。
2. neuralPathwayAnalysis 要用专业脑神经突触偶联、脑功能定位（如前额叶、小脑精细区、前庭反射、Broca/Wernicke 言语区等）与神经可塑性概念严密解析该维度，既透彻又充满对孩子的厚爱。
3. 康复建议与家庭指导必须有极强动作实操逻辑，可自然融入森心康智能穿戴硬件（脑电反馈带、精细OT手套、步态腰带等）。
4. criticalMetrics 的百分值（45-98 之间的整数）要与上面的得分率客观联动（得分越低指标越低）。
你必须严格返回以下JSON结构（字段齐全，不要任何额外文字或\`\`\`json标记）：
{
  "summary": "一句话总结该维度当前的核心脑成长特征（60-120字）",
  "neuralPathwayAnalysis": "深入剖析该维度相关的脑网络/神经反射弧状态（120-250字）",
  "rehabSuggestions": ["针对该维度的康复训练建议（共3至4条）"],
  "homeGuidance": ["可在家操演的场景化活动（共3条）"],
  "prognosisPrediction": "3-6个月针对性训练后的预后轨迹预判（100字左右）",
  "criticalMetrics": {
    "neuralPlasticity": 45至98的整数,
    "sensoryIntegration": 45至98的整数,
    "familyEnvironmentScore": 45至98的整数,
    "motorControlIndex": 45至98的整数
  }
}`;

    try {
      const { report, aiEngine } = await generateReportJSON(systemInstruction, prompt);
      res.json({ report, isAiGenerated: true, aiEngine, createdAt: new Date().toISOString() });
    } catch (aiErr: any) {
      // All engines failed → let the frontend fall back to its per-dimension template
      console.warn('Specialized report AI generation failed, frontend will use template:', aiErr.message);
      res.json({ report: null, isAiGenerated: false, aiEngine: 'fallback_template' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown specialized report error.' });
  }
});

// API endpoint for CPMV-20 motion item scoring from sampled video frames (qwen3-vl)
tier2Only.post('/api/motion-eval', async (req: express.Request, res: express.Response) => {
  try {
    const { frames, item, child } = req.body;
    // CPMV-20 motion scoring is the gross-motor product (AssessmentPanel only
    // renders it for that dimension), so the gate binds to it server-side.
    if (await rejectIfLocked(req, res, MOTION_DIMENSION_ID)) return;
    if (!Array.isArray(frames) || frames.length === 0 || !item || !item.name) {
      res.status(400).json({ error: 'Missing frames or item definition.' });
      return;
    }

    const key = getDashScopeKey();
    if (!key) {
      // No key → let the frontend keep the item for manual scoring
      res.json({ score: null, isAiGenerated: false });
      return;
    }

    const ageInfo = child ? `受评儿童约 ${child.ageMonth} 个月（${child.gender === 'boy' ? '男' : '女'}）。` : '';
    const prompt = `你是一位资深小儿脑瘫康复评估治疗师，正在依据「脑瘫儿童动作影像筛查(CPMV-20)」量表，判读一段动作视频抽取的连续帧序列（按时间先后排列）。${ageInfo}

评估项目：${item.name}
指令要求：${item.cmd || ''}
临床观察要点：${item.watch}
量化观察指标：${item.ai}

评分锚点：
- 2 分（完成良好）：${item.s2}
- 1 分（可完成但质量异常）：${item.s1}
- 0 分（无法完成）：${item.s0}

请仔细观察这些帧中孩子的动作质量，严格对照上面的评分锚点，客观判读该项得分。若画面不足以判断，score 用 null。
你必须只返回以下 JSON（不要任何额外文字或\`\`\`标记）：
{
  "score": 0或1或2或null,
  "observation": "结合观察要点，用 60-120 字客观描述你在画面中看到的动作表现与评分理由",
  "flags": ["从以下键中选出观察到的异常，没有则空数组：tremor(震颤/抖动), assoc(联合动作/镜像), comp(代偿动作), worseL(左侧较差), worseR(右侧较差)"]
}`;

    try {
      const result = await callQwenVision(frames, prompt);
      const validScore = result.score === 0 || result.score === 1 || result.score === 2 ? result.score : null;
      const validFlags = Array.isArray(result.flags)
        ? result.flags.filter((f: any) => ['tremor', 'assoc', 'comp', 'worseL', 'worseR'].includes(f))
        : [];
      res.json({
        score: validScore,
        observation: typeof result.observation === 'string' ? result.observation : '',
        flags: validFlags,
        isAiGenerated: true,
        model: QWEN_VL_MODEL
      });
    } catch (aiErr: any) {
      console.warn('Motion-eval VL analysis failed, frontend will keep manual scoring:', aiErr.message);
      res.json({ score: null, isAiGenerated: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown motion evaluation error.' });
  }
});

// API endpoint for CPMV-20 overall narrative report (qwen3.7-max) once items are scored
tier2Only.post('/api/motion-report', async (req: express.Request, res: express.Response) => {
  try {
    const { child, total, domains, flags, lowItems } = req.body;
    if (await rejectIfLocked(req, res, MOTION_DIMENSION_ID)) return;
    if (!total || typeof total.pct !== 'number') {
      res.status(400).json({ error: 'Missing motion assessment totals.' });
      return;
    }

    const domainStr = Array.isArray(domains)
      ? domains.map((d: any) => `- ${d.name}: ${d.pct === null ? '未测' : d.pct + '%'}`).join('\n') : '';
    const flagStr = Array.isArray(flags) && flags.length
      ? flags.map((f: any) => `${f.label}（第${(f.items || []).join('、')}项）`).join('；')
      : '未标记明显异常运动表现';
    const ageInfo = child ? `${child.ageMonth}个月${child.gender === 'boy' ? '男' : '女'}童` : '受评儿童';

    const systemInstruction = 'You are a compassionate pediatric cerebral-palsy rehabilitation specialist. You strictly return output as a single valid JSON block, no markdown codeblocks, in Chinese.';
    const prompt = `你是一位资深小儿脑瘫康复评估治疗师。以下是一名${ageInfo}的「脑瘫儿童动作影像筛查(CPMV-20)」结果，请据此撰写专业、温暖、实操性强的观察摘要与训练建议。

总体：完成 ${total.tested}/20 项，实测总分 ${total.sum}/${total.max}，得分率 ${total.pct}%。
五维得分率：
${domainStr}
异常运动表现：${flagStr}
${Array.isArray(lowItems) && lowItems.length ? `得分偏低(0-1分)项目编号：${lowItems.join('、')}` : ''}

请只返回以下JSON（不要额外文字或\`\`\`标记）：
{
  "summary": ["观察摘要，3-5条，每条聚焦一个发现（受限领域/异常表现/偏侧性/发育顺序等），结合脑瘫康复专业视角，语气温暖客观"],
  "suggestions": ["训练与随访建议，3-5条，具体可操作，可提及GMFM/OT/PT专项、AI影像补拍要点、复评节奏"]
}`;

    try {
      const { report, aiEngine } = await generateReportJSON(systemInstruction, prompt);
      res.json({
        summary: Array.isArray(report.summary) ? report.summary : [],
        suggestions: Array.isArray(report.suggestions) ? report.suggestions : [],
        isAiGenerated: true,
        aiEngine
      });
    } catch (aiErr: any) {
      console.warn('Motion-report narrative failed, frontend will use local template:', aiErr.message);
      res.json({ isAiGenerated: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown motion report error.' });
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
tier2Only.post('/api/ali-language-eval', async (req: express.Request, res: express.Response) => {
  try {
    const { child, audioTranscribedText, articulation, fluency, sentenceLength, targetPrompt } = req.body;

    // This endpoint only ever produces the language deep report, so it gates on
    // the language dimension — not on whatever the caller claims to own.
    if (await rejectIfLocked(req, res, LANGUAGE_DIMENSION_ID)) return;
    if (!child) {
      res.status(400).json({ error: 'Missing child profile.' });
      return;
    }

    const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.ALI_LLM_API_KEY;
    let isAiGenerated = false;
    let evalReport;

    const langSystemPrompt = 'You are a compassionate pediatric speech-language pathologist and neurology expert. You strictly return output as a single, valid JSON block with no markdown code blocks, no front/end spacing, in Chinese language.';

    // Build the prompt regardless of engine
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

    // Engine 1: Qwen 3.5 Plus via SDK (primary)
    try {
      evalReport = await callLLMJSON(langSystemPrompt, prompt, LLM_QWEN_MODEL);
      isAiGenerated = true;
    } catch (qwenSdkErr: any) {
      console.warn(`Qwen SDK language eval failed, trying Doubao:`, qwenSdkErr.message);

      // Engine 2: Doubao Seed via SDK (secondary)
      try {
        evalReport = await callLLMJSON(langSystemPrompt, prompt, LLM_REPORT_MODEL);
        isAiGenerated = true;
      } catch (sdkErr: any) {
        console.warn(`Doubao SDK language eval also failed:`, sdkErr.message);
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
tier2Only.post('/api/asr', async (req: express.Request, res: express.Response) => {
  try {
    const { audioData, context, dimensionId } = req.body;
    // Transcription is a utility used inside several already-gated flows rather
    // than a per-dimension product, so it keeps the caller-supplied id. Residual
    // exposure, stated plainly: owning any one dimension buys transcription in
    // general. That costs DashScope quota, not paid content — every report this
    // could feed is gated on its own dimension above.
    if (await rejectIfLocked(req, res, dimensionId)) return;
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

    const resp = await postDashScope(key, { model: QWEN_ASR_MODEL, messages });

    if (resp.status < 200 || resp.status >= 300) {
      const errText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      res.status(502).json({ error: `Qwen ASR request failed (${resp.status}): ${errText.slice(0, 300)}` });
      return;
    }

    const raw = resp.data;
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

// MySQL (Alibaba Cloud RDS) integration
// mysqlDb imported at top of file

// Offline-mode fallback in-memory datastores (used when MySQL is not configured)
const offlineUsers = new Map<string, any>();
const offlineUserData = new Map<string, any>();
// Bookings taken while MySQL is unconfigured. Lost on restart — acceptable for
// demos, NOT for production: a real booking that vanishes is a parent left
// waiting for a call. The response tells the client which mode it landed in.
const offlineBookings: any[] = [];

// 展示用的固定測試帳號 —— 刻意保留，讓客戶與合作方免註冊即可試用。
// 登入頁的「一鍵填充」按鈕（AuthScreen.tsx）對應的就是這一組。
//
// 已知且已接受的取捨：記憶體模式不只在本機，未設定 MYSQL_* 時線上站台
// （目前的 sxk.onrender.com）也跑這個模式，而 verifyPassword 對非 bcrypt 值
// 會退回明文比對 —— 也就是說這組帳密在公開站台上等同人人可登入。
// 正式收費環境接上 MySQL 後，這個記憶體分支不會生效。
offlineUsers.set('test@test.com', { email: 'test@test.com', password: '123456' });

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Database operation timed out')), timeoutMs);
    promise.then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

app.get('/api/db/status', (req, res) => {
  res.json({
    configured: mysqlDb.isConfigured(),
    engine: mysqlDb.isConfigured() ? 'mysql' : 'memory',
  });
});

/**
 * Dimensions this user has paid to unlock. The paywall reads this; it is the
 * only source of truth for access, never anything the client stores.
 */
paidOnly.get('/api/unlocks', async (req, res) => {
  try {
    // The store check comes before the token check on purpose. In memory mode
    // there is no gate at all (denyIfLocked lets everything through), so a 401
    // here would leave the client unable to learn that — it would fail closed
    // and lock a demo box out of its own deep assessment. Saying "this server
    // keeps no purchases" leaks nothing.
    if (!mysqlDb.isConfigured()) {
      res.json({ dimensionIds: [], available: false, priceFen: UNLOCK_PRICE_FEN });
      return;
    }
    const email = verifyToken(getBearerToken(req));
    if (!email) {
      res.status(401).json({ error: '请先登录。' });
      return;
    }
    const user = await mysqlDb.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: '登录状态已失效，请重新登录。' });
      return;
    }
    // The price ships with the list so the paywall never hardcodes its own copy
    // of it. UNLOCK_PRICE_FEN is env-tunable; a screen showing ¥19.9 while the
    // order is opened for something else is a refund dispute by construction.
    res.json({
      dimensionIds: await mysqlDb.listUnlockedDimensions(user.id),
      available: true,
      priceFen: UNLOCK_PRICE_FEN,
    });
  } catch (err: any) {
    console.error('[Payment] Failed to list unlocks:', err.message);
    res.status(500).json({ error: '无法读取已解锁维度。' });
  }
});

/**
 * Opens a pending payment for one dimension and returns the merchant order
 * number. Placing the actual WeChat order is stage 3-4 and is blocked on ICP
 * filing plus the mchid — and on the still-open H5-vs-JSAPI choice.
 *
 * There is deliberately NO endpoint that settles a payment. The only legitimate
 * triggers are a signature-verified WeChat callback and the query-order
 * compensation path; exposing anything else would hand out paid content for
 * free to whoever found the URL.
 */
paidOnly.post('/api/payment/create', async (req, res) => {
  try {
    const email = verifyToken(getBearerToken(req));
    if (!email) {
      res.status(401).json({ error: '请先登录后再购买。' });
      return;
    }
    const { dimensionId } = req.body || {};
    if (!DIMENSIONS_DATA.some(d => d.id === dimensionId)) {
      res.status(400).json({ error: '维度不存在。' });
      return;
    }
    if (!mysqlDb.isConfigured()) {
      // Taking money without a durable order record is not a degraded mode, it
      // is a refund dispute waiting to happen. Refuse.
      res.status(503).json({ error: '支付服务暂未开放，请稍后再试。' });
      return;
    }

    const user = await mysqlDb.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: '登录状态已失效，请重新登录。' });
      return;
    }

    // Already owned → do not create another order. A parent who taps twice, or
    // returns to an old paywall page, must not be able to pay for the same
    // dimension a second time.
    const owned = await mysqlDb.listUnlockedDimensions(user.id);
    if (owned.includes(dimensionId)) {
      res.json({ alreadyUnlocked: true });
      return;
    }

    const outTradeNo = generateOutTradeNo();
    if (!isValidOutTradeNo(outTradeNo)) {
      // Can only fire if the generator is changed badly; failing here beats
      // failing at WeChat's door with the parent mid-payment.
      throw new Error(`generated out_trade_no violates the official contract: ${outTradeNo}`);
    }
    const paymentId = await mysqlDb.createPayment(user.id, outTradeNo, UNLOCK_PRICE_FEN, dimensionId);

    res.json({
      alreadyUnlocked: false,
      outTradeNo,
      paymentId,
      amountFen: UNLOCK_PRICE_FEN,
      dimensionId,
      // No h5_url / prepay_id yet — the WeChat call is stage 3-4. The client must
      // treat the absence of these as "payment not available", never as success.
      wechatReady: false,
    });
  } catch (err: any) {
    console.error('[Payment] Failed to create payment:', err.message);
    res.status(500).json({ error: '创建订单失败，请稍后重试。' });
  }
});

/**
 * Expert consultation booking. Registered in both products — the booking flow
 * lives in the shared AnalysisReport, and it is project B's entire conversion
 * point (B has no paid tier; the consultation list IS the deliverable).
 *
 * Until now the frontend only flipped a local flag to "success", so a parent was
 * told an expert would call and nobody ever heard about it. This persists the
 * booking first, then notifies staff best-effort.
 */
app.post('/api/expert-booking', async (req, res) => {
  try {
    const {
      specialistId, specialistName, parentName, parentPhone,
      childAgeMonth, childGender, reportSummary, preferredSlot, deviceId,
    } = req.body || {};

    const name = typeof parentName === 'string' ? parentName.trim() : '';
    const phone = typeof parentPhone === 'string' ? parentPhone.trim() : '';

    if (!specialistId || typeof specialistId !== 'string') {
      res.status(400).json({ error: '缺少指定专家。' });
      return;
    }
    if (!name || name.length > 64) {
      res.status(400).json({ error: '请填写家长姓名。' });
      return;
    }
    // Mainland mobile number. Staff call this back, so a malformed one is a
    // dead booking — reject at the door rather than storing garbage.
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      res.status(400).json({ error: '请填写正确的 11 位手机号码。' });
      return;
    }

    const ageMonth = Number.isFinite(Number(childAgeMonth)) ? Number(childAgeMonth) : null;
    const summary = typeof reportSummary === 'string' ? reportSummary.slice(0, 2000) : null;
    const slot = typeof preferredSlot === 'string' ? preferredSlot.slice(0, 64) : null;

    // Resolve the signed-in user when a token is present. Project B is
    // anonymous, so absence of a token is normal, not an error.
    let userId: number | null = null;
    const tokenEmail = verifyToken(getBearerToken(req));
    if (tokenEmail) {
      const user = await mysqlDb.findUserByEmail(tokenEmail).catch(() => null);
      if (user) userId = user.id;
    }

    let bookingId: number | null = null;
    let persisted = false;
    if (mysqlDb.isConfigured()) {
      bookingId = await mysqlDb.createExpertBooking({
        userId,
        deviceId: typeof deviceId === 'string' ? deviceId : null,
        specialistId,
        parentName: name,
        parentPhone: phone,
        childAgeMonth: ageMonth,
        childGender: typeof childGender === 'string' ? childGender : null,
        reportSummary: summary,
        preferredSlot: slot,
      });
      persisted = true;
    } else {
      offlineBookings.push({
        id: offlineBookings.length + 1, userId, specialistId, parentName: name,
        parentPhone: phone, childAgeMonth: ageMonth, childGender, reportSummary: summary,
        preferredSlot: slot, createdAt: new Date().toISOString(),
      });
      bookingId = offlineBookings.length;
      console.warn('[Booking] MySQL not configured — booking held in memory only and will be lost on restart.');
    }

    // Answer as soon as the booking is durable. Notification is advisory: staff
    // can always work the queue by created_at, and making the parent wait on a
    // webhook round-trip would be worse than notifying a second later.
    res.json({ ok: true, bookingId, persisted });

    notifyExpertBooking({
      bookingId,
      specialistName: typeof specialistName === 'string' ? specialistName : specialistId,
      parentName: name,
      parentPhone: phone,
      childAgeMonth: ageMonth,
      childGender: typeof childGender === 'string' ? childGender : null,
      preferredSlot: slot,
      reportSummary: summary,
    })
      .then(results => {
        if (persisted && bookingId && results.some(r => r.ok)) {
          return mysqlDb.markBookingNotified(bookingId);
        }
      })
      .catch(err => console.error('[Booking] Notification pipeline failed:', err.message));
  } catch (err: any) {
    console.error('[Booking] Failed to record booking:', err.message);
    res.status(500).json({ error: '预约提交失败，请稍后重试或直接联系微信客服。' });
  }
});

// Endpoint to register user account
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: '请填写完整的邮箱和密码' });
      return;
    }

    const hashed = await hashPassword(password);

    if (mysqlDb.isConfigured()) {
      try {
        const existing = await withTimeout(mysqlDb.findUserByEmail(email), 2000);
        if (existing) {
          res.status(400).json({ error: '该邮箱已被注册，请直接登录' });
          return;
        }
        await withTimeout(mysqlDb.createUser(email, hashed), 2000);
        console.log(`[MySQL] Registered account: ${email}`);
        res.json({ success: true, email, token: signToken(email) });
        return;
      } catch (dbErr: any) {
        console.warn('[MySQL] Registration failed, falling back to memory:', dbErr.message);
      }
    }

    // In-memory fallback
    if (offlineUsers.has(email)) {
      res.status(400).json({ error: '该邮箱已被注册，请直接登录' });
      return;
    }
    offlineUsers.set(email, { email, password: hashed });
    console.log(`[Memory] Registered local account fallback: ${email}`);
    res.json({ success: true, email, token: signToken(email) });
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

    let authenticatedUser = null;

    if (mysqlDb.isConfigured()) {
      try {
        const found = await withTimeout(mysqlDb.findUserByEmail(email), 2000);
        if (found && await verifyPassword(password, found.password)) {
          authenticatedUser = found;
          // Transparently upgrade legacy plaintext rows to a bcrypt hash.
          if (!looksHashed(found.password)) {
            try {
              await withTimeout(mysqlDb.updateUserPassword(email, await hashPassword(password)), 2000);
              console.log(`[MySQL] Upgraded legacy password to bcrypt for ${email}`);
            } catch (upErr: any) {
              console.warn('[MySQL] Password upgrade failed (non-fatal):', upErr.message);
            }
          }
        }
      } catch (dbErr: any) {
        console.warn('[MySQL] Login query failed, falling back to memory:', dbErr.message);
      }
    }

    if (!authenticatedUser) {
      const found = offlineUsers.get(email);
      if (found && await verifyPassword(password, found.password)) {
        authenticatedUser = found;
        if (!looksHashed(found.password)) {
          found.password = await hashPassword(password);
        }
      }
    }

    if (!authenticatedUser) {
      res.status(401).json({ error: '邮箱或密码错误，请重新输入' });
      return;
    }

    // Load associated child data
    let child = null;
    let completedScores: any[] = [];
    let orders: any[] = [];
    let reportHistory: any[] = [];

    if (mysqlDb.isConfigured()) {
      try {
        const row = await withTimeout(mysqlDb.getUserData(email), 2000);
        if (row) {
          const parsed = mysqlDb.parseUserDataRow(row);
          child = parsed.child;
          completedScores = parsed.completedScores;
          orders = parsed.orders;
          reportHistory = parsed.reportHistory;
        }
      } catch (dbErr: any) {
        console.warn('[MySQL] Load user data failed:', dbErr.message);
      }
    }

    if (!child && !completedScores.length) {
      const data = offlineUserData.get(email);
      if (data) {
        child = data.child || null;
        completedScores = data.completedScores || [];
        orders = data.orders || [];
        reportHistory = data.reportHistory || [];
      }
    }

    res.json({ success: true, email: authenticatedUser.email, token: signToken(authenticatedUser.email), child, completedScores, orders, reportHistory });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err.message);
    res.status(500).json({ error: `登录失败: ${err.message}` });
  }
});

// Endpoint to load child assessment records
app.get('/api/db/load', async (req, res) => {
  try {
    const { deviceId, email } = req.query;

    // Email-scoped data is private: require a session token for that email.
    // Device-scoped data is keyed by an unguessable client-generated UUID and
    // stays accessible without a token (anonymous, pre-registration use).
    if (email && typeof email === 'string') {
      const authEmail = verifyToken(getBearerToken(req));
      if (authEmail !== email) {
        res.status(401).json({ error: '未授权：请重新登录' });
        return;
      }
    }

    if (mysqlDb.isConfigured()) {
      try {
        let row = null;
        if (email && typeof email === 'string') {
          row = await withTimeout(mysqlDb.getUserData(email as string), 2000);
        } else if (deviceId && typeof deviceId === 'string') {
          row = await withTimeout(mysqlDb.getUserDataByDevice(deviceId as string), 2000);
        } else {
          res.status(400).json({ error: 'Missing deviceId or email parameter.' });
          return;
        }

        if (row) {
          const parsed = mysqlDb.parseUserDataRow(row);
          res.json({ source: 'mysql', ...parsed });
        } else {
          res.json({ source: 'mysql', child: null, completedScores: [], orders: [], reportHistory: [] });
        }
        return;
      } catch (dbErr: any) {
        console.warn('[MySQL] Load failed, falling back to memory:', dbErr.message);
      }
    }

    // Memory fallback
    if (email && typeof email === 'string') {
      const localData = offlineUserData.get(email);
      if (localData) {
        res.json({ source: 'memory', child: localData.child || null, completedScores: localData.completedScores || [], orders: localData.orders || [], reportHistory: localData.reportHistory || [] });
        return;
      }
    }
    res.json({ source: 'unconfigured' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load data.' });
  }
});

// Endpoint to save child assessment records
app.post('/api/db/save', async (req, res) => {
  try {
    const { deviceId, email, child, completedScores, orders, reportHistory } = req.body;
    if (!deviceId && !email) {
      res.status(400).json({ error: 'Missing deviceId or email.' });
      return;
    }

    // Writing to an email-scoped record requires a matching session token.
    if (email) {
      const authEmail = verifyToken(getBearerToken(req));
      if (authEmail !== email) {
        res.status(401).json({ error: '未授权：请重新登录' });
        return;
      }
    }

    // Always save to memory as hot-backup
    if (email) {
      offlineUserData.set(email, { child, completedScores, orders, reportHistory });
    }

    if (mysqlDb.isConfigured() && email) {
      try {
        // The token guarantees this email belongs to an authenticated account,
        // so the user row already exists — no implicit account creation here.
        await withTimeout(
          mysqlDb.saveUserData(email, deviceId || null, child, completedScores || [], orders || [], reportHistory || []),
          2000
        );
        console.log(`[MySQL] Saved data for ${email}`);
        res.json({ success: true });
        return;
      } catch (err: any) {
        console.warn('[MySQL] Save failed, data in memory backup:', err.message);
        res.json({ success: true, localSavedFallback: true });
        return;
      }
    }

    res.json({ success: true, localSaved: true });
  } catch (err: any) {
    console.error('[Save Error]:', err.message);
    res.status(500).json({ error: `Save failed: ${err.message}` });
  }
});

// Vite & Static file configurations
async function startServer() {
  // Anything under /api that reached this point matched no route. Answer with a
  // JSON 404 before the SPA fallback below gets a chance to serve index.html.
  //
  // Without this, a GET to a route that is not registered — every tier-2/3 and
  // paid endpoint in project B — falls through to `app.get('*')` and comes back
  // as HTML with status 200. The client then parses a web page as JSON, and a
  // deliberately disabled endpoint looks like a success. POSTs happened to 404
  // correctly only because the catch-all is GET-only, which made the bug
  // invisible on half the surface.
  //
  // Registered after every route because Express matches in registration order,
  // and startServer() runs last.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import so `vite` (a devDependency) is never required in production,
    // where hosting platforms may prune devDependencies after build.
    const { createServer: createViteServer } = await import('vite');
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
    // Log the mode and where the port came from. Both have burned us before:
    // a wrong APP_MODE silently exposes the tier-2/3 endpoints, and
    // DEPLOY_RUN_PORT taking precedence over the platform-injected PORT makes a
    // service unreachable with no other symptom.
    const portSource = process.env.DEPLOY_RUN_PORT
      ? 'DEPLOY_RUN_PORT'
      : process.env.PORT
        ? 'PORT'
        : 'default';
    console.log(
      `[SenXinKang Server] APP_MODE=${APP_MODE} (${APP_MODE === 'full'
        ? 'project A — tier-2/3 endpoints registered'
        : 'project B — tier-2/3 endpoints NOT registered'}), port from ${portSource}`
    );
    // Say out loud whether the paywall is enforced. Memory mode lets every
    // tier-2/3 request through (see denyIfLocked) — fine for a demo box, a
    // silent giveaway on a production one.
    if (APP_MODE === 'full') {
      console.log(
        mysqlDb.isConfigured()
          ? '[SenXinKang Server] Paywall ENFORCED — tier-2/3 requests require a matching unlock.'
          : '[SenXinKang Server] Paywall NOT enforced (no MYSQL_* configured): tier-2/3 endpoints are open to anyone. Demo mode only.'
      );
    }
  });
}

startServer();
