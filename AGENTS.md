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
| `/api/auth/register` | POST | 用户注册 | `email`, `password` |
| `/api/auth/login` | POST | 用户登录 | `email`, `password` |
| `/api/db/load` | GET | 加载用户数据 | `deviceId` 或 `email` (query) |
| `/api/db/save` | POST | 保存用户数据 | `deviceId`, `email`, `child`, `completedScores`, `orders`, `reportHistory` |

## 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DEPLOY_RUN_PORT` | 服务监听端口 | 是 (沙箱自动注入) |
| `GEMINI_API_KEY` | Google Gemini API 密钥 | 否 (未配置时使用本地模板) |
| `DASHSCOPE_API_KEY` | 阿里通义千问 API 密钥 | 否 (未配置时降级) |
| `CLOUDBASE_SECRET_ID` | 腾讯云 CloudBase Secret ID | 否 (未配置时使用本地存储) |
| `CLOUDBASE_SECRET_KEY` | 腾讯云 CloudBase Secret Key | 否 |
| `CLOUDBASE_ENV_ID` | 腾讯云 CloudBase 环境 ID | 否 |

## 代码规范

- 使用 TypeScript 严格模式
- React 19，不需要 `import React from 'react'`
- Tailwind CSS 4 使用 `@theme` 指令定义设计令牌
- 品牌色系： moss/forest/clay/cream/stone 等自然色调
- 字体：Plus Jakarta Sans (正文) + Playfair Display (标题) + JetBrains Mono (代码)
