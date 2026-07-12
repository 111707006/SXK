# 森心康（SenXinKang）儿童发展评估平台

基于「9 维 3 层」评估理念的儿童发展筛查演示系统：家长在线完成分层量表评估，由 AI 大模型生成发育评估报告与家庭康复指导方案，并附带康复辅助设备商城原型。

> ⚠️ **免责声明**：本项目为技术演示（Demo），评估内容与 AI 生成报告**不构成医疗诊断或医疗建议**。任何关于儿童发育的疑虑，请咨询专业医疗机构。

## 功能总览

| 模块 | 说明 |
|---|---|
| 儿童档案 | 登记姓名、出生日期、性别，按月龄自动匹配题组 |
| T1 综合筛查 | 9 个发展维度的基础问卷筛查，自动标记「正常 / 边缘 / 迟缓」 |
| T2 / T3 专项评估 | 针对预警维度的能力自评与深度互动评估 |
| AI 综合报告 | 由通义千问 `qwen3.7-max` 生成评估摘要、康复建议、家庭指导与预后预测 |
| 语言专项评估 | 儿童朗读录音经 `qwen3-asr-flash` **真实语音识别**，结合构音特征由 AI 生成 SLP（言语治疗）报告 |
| 康复设备商城 | 商品展示、模拟下单支付、模拟物流跟踪（**沙盒演示，非真实交易**） |

### 9 个评估维度

动作发展 · 精细动作 · 感觉处理 · 语言沟通 · 社交情绪 · 认知发展 · 注意力 · 生活自理 · 家庭环境

## 技术架构

```
浏览器（React 19 SPA，状态存 localStorage）
   │
   ├─ GET  /                      ← Express 静态托管 / Vite 开发中间件
   ├─ POST /api/report            ← 综合评估报告
   ├─ POST /api/ali-language-eval ← 语言专项 SLP 报告
   └─ POST /api/asr               ← 语音识别（base64 或音频 URL）
              │
              └─ 阿里云 DashScope（OpenAI 兼容模式）
                   ├─ qwen3.7-max      报告生成（主引擎）
                   ├─ qwen3-asr-flash  语音识别
                   ├─ Gemini           报告生成（备用引擎，可选）
                   └─ 本地模板引擎      离线兜底（响应中 isAiGenerated=false 如实标示）
```

- **前端**：React 19 · Vite 6 · Tailwind CSS 4 · lucide-react
- **后端**：Express（TypeScript，`server.ts` 单文件），职责为保管 API 密钥、代理 LLM 调用、托管前端
- **AI 降级策略**：Qwen → Gemini → 本地模板三级级联，接口始终可用；响应中的 `aiEngine` 与 `isAiGenerated` 字段标明报告真实来源

## 快速开始

**环境要求**：Node.js 18+

```bash
# 1. 安装依赖
npm install

# 2. 配置密钥（复制模板后填入真实值）
cp .env.example .env

# 3. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DASHSCOPE_API_KEY` | 建议 | 阿里云百炼 API Key，启用真实 AI 报告与语音识别；缺省时走本地模板引擎 |
| `GEMINI_API_KEY` | 可选 | Google Gemini 备用报告引擎（中国大陆境内不可直连） |
| `QWEN_REPORT_MODEL` | 可选 | 报告模型，默认 `qwen3.7-max`（可改 `qwen3.7-plus` 降低成本） |
| `QWEN_ASR_MODEL` | 可选 | 语音识别模型，默认 `qwen3-asr-flash` |

> 🔐 `.env` 已被 `.gitignore` 排除，请勿以任何方式将密钥提交进仓库。建议在阿里云控制台为密钥设置每月消费上限。

### 常用命令

```bash
npm run dev     # 开发模式（Vite 热更新 + Express，同一端口）
npm run build   # 打包前端与后端产物到 dist/
npm run start   # 生产模式运行（node dist/server.cjs）
npm run lint    # TypeScript 类型检查
```

## API 说明

### `POST /api/report` — 综合评估报告

请求：`{ child: { name, ageMonth, gender }, scores: DimensionScore[] }`
响应：`{ report, isAiGenerated, aiEngine, createdAt }`

### `POST /api/ali-language-eval` — 语言专项 SLP 报告

请求：`{ child, targetPrompt, audioTranscribedText, articulation, fluency, sentenceLength }`
响应：`{ report, isAiGenerated, createdAt }`

### `POST /api/asr` — 语音识别

请求：`{ audioData }`（base64 Data URL 或公网音频 URL，≤10MB）
响应：`{ text, language, emotion, model }`

## 项目结构

```
├─ server.ts                 # Express 后端：LLM 代理 + 静态托管
├─ src/
│  ├─ App.tsx                # 主应用与视图状态机
│  ├─ data.ts                # 9 维 × 3 层量表题库、商品数据
│  ├─ t1Data.ts              # T1 综合筛查题组（按月龄分档）
│  ├─ types.ts               # 全局类型定义
│  ├─ components/            # 评估面板、报告视图、语言专项、商城等
│  └─ utils/                 # 报告模板、日期工具
└─ .env.example              # 环境变量模板
```

## 当前限制（Demo 边界）

- 数据仅存于浏览器 localStorage：单设备、单儿童档案，清除缓存即丢失
- 商城支付与物流为**沙盒模拟**，不产生真实交易
- API 端点暂无鉴权与限流，公开部署前须补充
- 量表题目为演示用途自编内容，未经临床信效度验证，亦未获 ASQ/Bayley 等原量表授权
