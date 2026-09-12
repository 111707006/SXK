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
│   ├── t2/
│   │   ├── toolkit/       # T2 题库：22 支工具的题目、选项、分段（脚本产出，勿手改）
│   │   ├── types.ts       # 规则引擎的型别（规格 v2 附录 A）
│   │   ├── toolSpecs.ts   # 工具登录表 22 笔：月龄窗口、计分族、喂哪个维度、固定 caveat
│   │   ├── findingTags.ts # 发现标签的受控词汇 57 个（★ 配活动／只进报告）
│   │   ├── caveats.ts     # caveat 的受控值 17 个
│   │   ├── sectionTags.ts # §5.9 的面向→标签、chexi 因素、气质向度、前置题
│   │   ├── itemTags.ts    # §5.9 的逐题标签表（asb／asr／adl／mchat 四支＋gm／asq／warn 几条）
│   │   ├── act300.ts      # 旧原型 300 支活动的名称与适龄原文（脚本产出，勿手改）
│   │   ├── activitySeed.ts # 活动库种子：模组＝ceil(编号/20)、适龄字串→月龄、附录 B.3 的维度初值
│   │   ├── entrance.ts    # T2 入口的纯函式：T1 成绩→九码、入口要不要出现、题量怎么讲（#56）
│   │   └── diagnosisOptions.ts # 诊断方向十选一的名称与问句；刻意不进家长用字扫描（理由见档头）
│   ├── db/
│   │   ├── mysql.ts       # 连线池与家长端资料层
│   │   └── activities.ts  # 一列 activities → Activity（后台与家长端共用，只认受控词汇里的标签）
│   └── utils/
│       ├── dateUtils.ts   # 日期工具函数
│       └── reportUtils.ts # 报告生成工具
├── NEWT2/                 # 客户 2026-09-08 评估工具包 zip 与 09-10 纸本版 zip（题库的来源）
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

# T2 题库：从工具包 zip 重新抽出 src/t2/toolkit/<id>.ts（--check 只比对不写）
npx tsx scripts/t2-extract-toolkit.ts
npx tsx scripts/t2-extract-toolkit.ts --check

# T2 题库对纸本版逐题比对，印出每支的差异
npx tsx scripts/t2-diff-paper.ts

# 活动库种子（#44）：从旧原型 files/sxk_t2_activities.js 抽 ACT300 → src/t2/act300.ts
npx tsx scripts/t2-extract-act300.ts --check

# 活动库种子 → 迁移档 deploy/migrations/2026-09-11-activities.sql 标记之间的 INSERT
npx tsx scripts/t2-activity-seed-sql.ts --check
```

> 活动库（ADR-0005）的 300 支种子是**算**出来的，不是手抄的：`act300.ts` 由脚本抽自旧原型，
> `activitySeed.ts` 算出模组、月龄区间与维度初值，迁移档里的 INSERT 由种子印出。三层都有
> 护栏：`test/activitySeed.test.ts` 重跑脚本、重印 SQL、比对 `deploy/schema.sql` 与迁移档的
> CREATE TABLE 一字不差。**种子全部 `target_month = NULL`**，没填的活动配不到（规格 v2 §7.4），
> 由内容团队在后台补（#62）。活动库不吃 `company_id`，列在 `test/adminScope.structure.test.ts`
> 的 `GLOBAL_TABLES`。

> `src/t2/toolkit/` 里的 22 份是脚本从 `NEWT2/森心康评估工具包_20260908.zip` 抽出来的常数，
> **不要手改** —— `test/toolkit.structure.test.ts` 会重跑脚本比对。工具包的 HTML 一行都不执行：
> 只取 `<script>` 开头的纯资料宣告在沙箱求值，分段函式用正则读（`scripts/t2/literals.ts`、`scripts/t2/kit.ts`）。
> 同一支 HTML 里有三套分级，常数只抄报告那一套（＝纸本「分数解读」），规格 v2 附录 D 第一栏。

> `src/t2/` 其余几档是**手写的资料表**（#42）：`toolSpecs.ts` 的分段与前置题直接转出题库那一份，
> 不另抄一次；`findingTags.ts`／`caveats.ts` 是受控词汇，量表规则表与活动库两边贴的必须是同一组字。
> 护栏测试：`test/t2ToolSpecs.structure.test.ts`（登录表逐格对规格 §3／附录 F）、
> `test/t2FindingTags.test.ts`（每个标签至少一个来源、每个维度的标签数）、
> `test/t2ItemTags.test.ts`（逐题表的题号在该面向范围内）。

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
| `/api/report-link` | POST | 取得该份报告的扫码连结与二维码 | `reportId`；`Authorization: Bearer <token>` |
| `/r/:token` | GET | 扫码后打开的报告页（**公开，不需登入**） | 无 |
| `/api/expert-booking` | POST | 送出专家预约（四种服务共用） | `specialistId`, `parentName`, `parentPhone`；`serviceType` 选填 |
| `/api/t2/plan` | GET | T2 题量预估：依这位家长的孩子与最新筛查算 `planT2()`，附 `t1Flags`／`diagnosisDirection`／`entrance` | `Authorization: Bearer <token>`；`diagnosis` (query) 选填，带了就盖过存的 |
| `/api/t2/diagnosis` | PUT | 存入口选的诊断方向（十选一或 null）；#59 生成报告时读它 | `diagnosis`；`Authorization: Bearer <token>` |
| `/api/t2/tool-results` | POST | 交一支工具的答案；**伺服器算分**（`scoreTool`），窗口外／缺答／多题／值域外 400 且不落表；每次交卷一笔不覆盖。回 `{id, createdAt, result, bands}` | `toolId`, `assessedAgeMonth`, `rater`, `pre`, `answers`；`Authorization: Bearer <token>` |
| `/api/t2/tool-results` | GET | 这位家长每支工具**最新且完整**的一笔，各附该支对它喂的维度的 band（加测提示用） | `Authorization: Bearer <token>` |

> T2 入口的两支（#56）**只在专案 A 注册**（`tier2Only`，B 是 404），而且在 T2 付费闸门的
> 白名单上（`server.ts` 的 `T2_OPEN_PATHS`）：付费墙要在付费前显示题量，诊断方向会改题量。
> 仍要登入。`/api/t2/*` 底下其余路径预设都在闸门后面（403 `LOCKED`）—— 交卷的两支（#57）就在后面。
> ⚠️ `t2_intake` 表由 `deploy/migrations/2026-09-12-t2-intake.sql` 建立、`t2_tool_results` 表由
> `deploy/migrations/2026-09-12-t2-tool-results.sql` 建立，**都必须先于新版程式码部署**。

> 四种咨询（#21）：`serviceType` 是 `online_consult`／`online_training`／
> `offline_training`／`offline_consult` 之一，定义在 `src/utils/serviceTypes.ts`。
> **不带这一栏 = 线上咨询说明**（既有行为，旧版前端不送它）；**带了但认不得就回 400**，
> 不悄悄落回预设 —— 那会让家长约的线下训练变成一笔线上咨询，而画面上看不出来。
> 线下的地点不进系统，由客服接手安排（见 CONTEXT.md「服務類型」）。

> 扫码带走的报告连结（#22）**永久有效且没有撤回手段** —— 二维码被拍到就等于那份
> 报告永久公开。此取舍由产品端在规格阶段选定，不是遗漏；剩下的防线是 token 猜不到
> （32 位元组乱数，见 `src/utils/reportLink.ts`）。二维码里那串网址的来源由
> `PUBLIC_BASE_URL` 决定，没设定就用请求本身的来源。

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
| `SMS_IP_DAILY_MAX` | 同一来源每日索取上限（预设 50）。按号码算的上限（10）挡不住换号码，这是按来源算的那一半；来源是收敛过的键（IPv6 截到 /64）。**设成 0 即停止发送**，遭滥用时最快的一道闸门 | 否 |

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
