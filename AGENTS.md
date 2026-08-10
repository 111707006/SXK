# AGENTS.md - 森心康儿童发育评估系统

## 项目概览

森心康（SenXinKang）是一个儿童发育评估系统，基于"9维3层分层神经系统检测"理念，提供儿童发育筛查、AI评估报告生成、康复建议及智能穿戴设备商城功能。

## 技术栈

- **前端**: React 19 + TypeScript 5 + Vite 6 + Tailwind CSS 4
- **后端**: Express 4 + tsx (开发模式)
- **UI 库**: Lucide React (图标) + Motion (动画)
- **AI 集成**: Google Gemini API + 阿里通义千问 (DashScope)
- **数据库**: 腾讯云 CloudBase (可选，未配置时降级为本地内存存储)
- **构建**: esbuild (服务端打包) + Vite (前端打包)

## 目录结构

```
.
├── server.ts              # Express 服务端 (API + 静态文件服务)
├── vite.config.ts         # Vite 配置
├── index.html             # 入口 HTML
├── src/
│   ├── main.tsx           # React 入口
│   ├── App.tsx            # 主应用组件 (路由/状态管理)
│   ├── types.ts           # TypeScript 类型定义
│   ├── data.ts            # 维度配置数据 (9维度3层级)
│   ├── t1Data.ts          # T1筛查数据
│   ├── index.css          # 全局样式 (Tailwind)
│   ├── components/        # React 组件
│   │   ├── AuthScreen.tsx           # 登录/注册
│   │   ├── ChildProfileForm.tsx     # 儿童档案表单
│   │   ├── DimensionGrid.tsx        # 维度网格展示
│   │   ├── AssessmentPanel.tsx      # 评估面板
│   │   ├── T1Screening.tsx          # T1筛查
│   │   ├── AnalysisReport.tsx       # 分析报告
│   │   ├── SpecializedReportView.tsx # 专项报告视图
│   │   ├── LanguageSpecialAssessment.tsx # 语言专项评估
│   │   ├── ReportCharts.tsx         # 报告图表
│   │   ├── WearablesMall.tsx        # 穿戴设备商城
│   │   └── EditProfileModal.tsx     # 编辑档案弹窗
│   └── utils/
│       ├── dateUtils.ts   # 日期工具函数
│       └── reportUtils.ts # 报告生成工具
└── assets/                # 静态资源
```

## 构建与运行命令

```bash
# 安装依赖
pnpm install

# 开发模式 (Vite HMR + Express)
pnpm run dev        # tsx server.ts

# 生产构建
pnpm run build      # vite build + esbuild server.ts

# 生产启动
pnpm run start      # node dist/server.cjs

# 类型检查
pnpm run lint       # tsc --noEmit
```

## API 接口清单

| 路径 | 方法 | 功能 | 必需参数 |
|------|------|------|----------|
| `/api/report` | POST | AI 评估报告生成 | `child`, `scores[]` |
| `/api/ali-language-eval` | POST | 语言专项评估 | `audioData`, `context` |
| `/api/asr` | POST | 语音识别 | `audioData` |
| `/api/db/status` | GET | 数据库状态 | 无 |
| `/api/auth/sms/request` | POST | 索取登录验证码 | `phone`, `companySlug`（选填） |
| `/api/auth/sms/verify` | POST | 核对验证码并登录 | `phone`, `code`, `companySlug`（选填） |
| `/api/db/load` | GET | 加载用户数据 | 已登录：`Authorization: Bearer <token>`；未登录：`deviceId` (query) |
| `/api/db/save` | POST | 保存用户数据 | `deviceId`, `child`, `completedScores`, `orders`, `reportHistory`（身分取自 token） |

> 同步端点以**使用者 id** 识别家长，那个 id 装在 session token 里。请求 body 或 query
> 里的 `email` / `userId` 一律不被采信 —— 客户端送上来的识别键不是身分。资料层
> （`src/db/mysql.ts`）同样只认使用者 id，护栏见 `test/userIdKey.structure.test.ts`。

> **手机号是家长端唯一的登入入口**（#27）。电子邮件注册与登入、登录页的「一键
> 填充」展示帐号、以及密码验证的明文退路都已经移除；既有邮箱家长的资料列一列
> 都没删，但**不提供认领路径**（取舍见 `docs/adr/0002-...`）。护栏测试：
> `test/emailLoginRemoved.http.test.ts`。
>
> 纯验证码登入没有独立的「注册」动作：第一次验证成功即建立帐号，归属在那一刻
> 写入，此后不变。帐号是以**（归属，手机号）**这一组去找的，不是手机号本身 ——
> 同一支手机号在两家合作公司是**两位家长**（见 `docs/adr/0002-...`）。这条路径
> **没有记忆体模式**：资料库写不进去就明确失败，不发 token。因此**没有资料库的
> 部署（`/api/db/status` 回 `engine: memory`）家长根本登不进来**，只剩未登入的
> 装置模式 —— 那是 #25 就选定的取舍，不是这次的退步。
>
> 短信通道是可抽换的一层（`src/sms.ts`），预设阿里云。`ALI_SMS_*` 未设齐时
> `/api/auth/sms/request` 回 503「短信通道尚未开放」，**不会假装送出成功**。
> 相关测试：`test/smsLogin.http.test.ts`、`test/smsSender.test.ts`。
>
> ⚠️ 手机号栏位、验证码表与归属合并唯一索引由
> `deploy/migrations/2026-08-10-phone-login.sql` 建立，**必须先于新版程式码部署**。

## 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DEPLOY_RUN_PORT` | 服务监听端口 | 是 (沙箱自动注入) |
| `GEMINI_API_KEY` | Google Gemini API 密钥 | 否 (未配置时使用本地模板) |
| `DASHSCOPE_API_KEY` | 阿里通义千问 API 密钥 | 否 (未配置时降级) |
| `CLOUDBASE_SECRET_ID` | 腾讯云 CloudBase Secret ID | 否 (未配置时使用本地存储) |
| `CLOUDBASE_SECRET_KEY` | 腾讯云 CloudBase Secret Key | 否 |
| `CLOUDBASE_ENV_ID` | 腾讯云 CloudBase 环境 ID | 否 |
| `ALI_SMS_ACCESS_KEY_ID` | 阿里云短信 AccessKey ID | **手机号登入必需** |
| `ALI_SMS_ACCESS_KEY_SECRET` | 阿里云短信 AccessKey Secret | **手机号登入必需** |
| `ALI_SMS_SIGN_NAME` | 已审核的短信签名 | **手机号登入必需** |
| `ALI_SMS_TEMPLATE_CODE` | 已审核的验证码范本（须含 `${code}` 变数） | **手机号登入必需** |
| `SMS_PROVIDER` | `aliyun`（预设）或 `console`（本机开发，只印不送） | 否 |

> 上面四项 `ALI_SMS_*` 少任何一项，家长就登不进来 —— 通道会明确回报「尚未开放」，
> 不会退回任何一种「看起来送出去了」的模式。

## 代码规范

- 使用 TypeScript 严格模式
- React 19，不需要 `import React from 'react'`
- Tailwind CSS 4 使用 `@theme` 指令定义设计令牌
- 品牌色系： moss/forest/clay/cream/stone 等自然色调
- 字体：Plus Jakarta Sans (正文) + Playfair Display (标题) + JetBrains Mono (代码)

## Agent skills

### Issue tracker

议题追踪在 GitHub Issues（`111707006/SXK`），使用 `gh` CLI 操作。见 `docs/agents/issue-tracker.md`。

### Triage labels

沿用五个标准分诊标签，标签字串与角色同名。见 `docs/agents/triage-labels.md`。

### Domain docs

单一 context：根目录 `CONTEXT.md` 为词汇表，架构决定记于 `docs/adr/`。见 `docs/agents/domain.md`。
