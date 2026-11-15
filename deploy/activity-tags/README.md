# 活动标签汇入档

放在这里的 JSON 是后台「活动库 → 批量汇入」吃的格式（`{ "rows": [ … ] }`，规格 v2.1 附录 C）。
**不会自己生效**：要有人在正式站后台选这个档 → 试跑 → 看退回清单 → 确认汇入。

护栏：`test/activityTagsImport.test.ts` 拿活动库的 300 个编号真的跑一次 `planActivityImport`，
退回或忽略任何一栏都会失败；另外核对 17 支正好是有示范片的那 17 支、`targetMonth` 落在手册的适龄里。

## 2026-09-27-module1-videos.json —— 17 支示范片（全是模组一「身体动一动」）

**草稿，要物理治疗师看过再汇入。** `targetMonth` 与标签是依手册原文（练什么、怎么玩、怎么看出有进步）
与一般粗大动作发展里程碑估的，不是客户给的。

### 两个栏位怎么定

- **`targetMonth`**＝「一般发展的孩子做得到这个动作核心的月龄」（规格 v2 §7.1）。配对拿它去对
  「实足月龄往前取」的窗口：12–36 个月需留意往前 3–6 个月、需关注往前 6–12 个月；36–72 个月各加倍
  （`src/t2/activityMatch.ts` 的 `OFFSET`）。填得太高，落后的孩子永远配不到；太低，会一直配到太简单的。
- **`targets`**：模组一只属于「动作发展」（`DIM_MOD`），配对时只有 `mot.*` 会加分，所以每支至少一个。
  对照评估那一边：GM 的 P1 卧位与翻身、P2 坐姿、P3 爬行与站立 → `mot.postural`；P4 走跑跳 →
  `mot.locomotion`；P5 平衡与协调 → `mot.balance`（`src/t2/sectionTags.ts`）。**爬行算 `mot.postural`**，
  跟着工具的面向走。手册写明练到别的（自控、本体觉、前庭……）再加一个次要标签：现在配对不看，
  留着给以后模组对维度的表改了、或后台筛选用。

不动的栏位：`dimensions`（家长端打卡日历会显示，维持种子值 `MOT`）、`avoidIf`（留空；
例如翻滚对前庭过度敏感的孩子要不要回避，`sen.vestibular` 分不出是过敏还是寻求，交给治疗师定）、
手册文字、示范片网址。

| 编号 | 活动 | 手册适龄 | targetMonth | targets | 理由 |
|---|---|---|---|---|---|
| A001 | 我们来爬行 | 6个月–3岁 | 9 | mot.postural, mot.locomotion | 手膝爬约 8–10 个月；GM P3 |
| A002 | 钻山洞 | 1–5岁 | 15 | mot.postural, sen.body_awareness | 会爬之后钻低矮空间；「认识自己身体的大小」 |
| A003 | 滚来滚去 | 6个月–4岁 | 6 | mot.postural, sen.vestibular | 翻身约 4–6 个月；GM P1；滚动是前庭输入 |
| A004 | 学动物走路 | 2–8岁 | 30 | mot.locomotion, mot.postural | 双脚跳约 30 个月；熊走、螃蟹走要撑住身体 |
| A005 | 一二三木头人 | 2–8岁 | 42 | mot.balance, att.inhibition | 听口令定住、维持姿势；「说停就停」 |
| A006 | 红灯停绿灯行 | 2–6岁 | 30 | mot.locomotion, att.inhibition | 走—停切换；「听信号控制自己」 |
| A009 | 金鸡独立 | 3–8岁 | 36 | mot.balance | 单脚站 1–3 秒约 3 岁；GM P5 |
| A010 | 跨过障碍 | 1–6岁 | 20 | mot.balance, mot.locomotion | 跨低障碍、单脚支撑一下 |
| A011 | 推墙比赛 | 3–8岁 | 36 | mot.postural, sen.regulation | 全身出力；「让身体安定下来」 |
| A012 | 小推车 | 3–8岁 | 48 | mot.postural | 手撑走要手臂与核心力气，17 支里最难 |
| A013 | 搭小桥 | 2–8岁 | 30 | mot.postural | 臀桥，核心与躯干控制 |
| A014 | 超人飞 | 3–8岁 | 42 | mot.postural | 俯卧抬手脚撑住，背部力气 |
| A015 | 蹲下站起来 | 2–8岁 | 24 | mot.postural, mot.balance | 蹲—站转换；GM P3「站立」；不扶要平衡 |
| A016 | 追泡泡 | 1–6岁 | 18 | mot.locomotion, sen.visual | 跑、跳、蹲着拍；眼睛追视 |
| A017 | 跟着音乐动 | 1–8岁 | 18 | mot.balance, mot.locomotion | 跟节奏摆动、转圈；GM P5「协调」 |
| A018 | 爬楼梯练腿 | 1–8岁 | 24 | mot.locomotion, mot.balance | 扶着上下台阶约 2 岁 |
| A019 | 搬东西小帮手 | 2–8岁 | 24 | mot.postural, sen.body_awareness | 推拉重物；判断「搬不搬得动」 |

覆盖：`mot.postural` 10 支、`mot.locomotion` 7 支、`mot.balance` 6 支；**`mot.ball_skills`、`mot.fine_motor` 没有片**。

### 用正式的配对函式跑过的例子

只有动作发展被标记，其余维度都是没事；活动库＝300 支种子，只有这 17 支填了 `targetMonth`（与正式站现况相同）。

| 孩子 | 窗口 | 这一周 | 换着玩 |
|---|---|---|---|
| 12 个月、需留意、`mot.postural` | 6–9 | A001 我们来爬行、A003 滚来滚去 | — |
| 24 个月、需关注、`mot.locomotion` | 12–18 | A016 追泡泡、A017 跟着音乐动 | A002 |
| 30 个月、需留意、`mot.balance` | 24–27 | A015 蹲下站起来、A018 爬楼梯练腿 | A019 |
| 30 个月、需关注、`mot.postural` | 18–24 | A015 蹲下站起来、A019 搬东西小帮手 | A018、A010、A016、A017 |
| 48 个月、需关注、`mot.balance` | 24–36 | A009 金鸡独立、A015 蹲下站起来 | A018、A011、A004、A006、A013 |
| 60 个月、需留意、`mot.postural` | 48–54 | A012 小推车 | — |
| 84 个月、需留意、`mot.locomotion` | 60–72 | A012 小推车（窗口里没有，往前取最接近的） | — |

6 岁以上一律「往前取」：模组一最难的一支是 48 个月，要等更难的片或别的模组有片。

## 2026-11-07-videos.json —— 正式站有示范片的 94 支（推送看标签用，ADR-0015）

**草稿，要治疗师看过再汇入。** 客户 11/03 简报第 26 页：线上家庭训练每个维度都推同样几支片 —— 正式站开着
`TRAINING_SAMPLE_ONLY`，只照编号排有片的。开了 `TRAINING_PUSH_TAGS` 之后，推送看这份标签：贴过标签的活动
**看 `targets` 归哪个维度**（不看模组），月龄看 `targetMonth`；还没贴的照旧看模组群＋手册适龄。所以这份档汇入之前开关开着也排得动，
只是退回模组群。

哪 94 支：2026-11-07 `/var/www/sxk/media/activities/` 里的 mp4（`test/activityTagsImport.test.ts` 写死这份清单）。
模组一的 17 支与上面 09-27 那份同一组标签（A007、A008、A020 是新的），**`targetMonth` 换成手册适龄的中间**。

### 两个栏位怎么定

- **`targets`**：照手册「练什么」与脚本「怎么看出有进步」对到 ★ 标签（`src/t2/findingTags.ts` 的 `ACTIVITY_TAGS`），1–3 个。
  第一个是主要练的；后面的会让这支片**也推给那个维度**（例：A005 一二三木头人带 `att.inhibition`，注意力判红黄时也会推它）。
  标签决定推给谁，所以只贴明确练到的；只是顺带用到的不贴。
- **`targetMonth`**＝手册适龄区间的中间（往下取整）：「2–8岁」→ 60、「1–5岁」→ 36、「6个月–3岁」→ 21。
  ⚠️ 宽的区间（2–8 岁、全龄）中间偏大：推送的窗口是从实足月龄**往前**取的，偏大的片多半落在窗口外，靠「放宽」依距离排进来。
  治疗师要调的主要是这一栏；09-27 那份是照发展里程碑估的（A001 9、A004 30……），可以对照。

### 片子本身的问题（客户 10/21 传错的，标签照手册内容贴）

A004 片子不对题；A006 与 A007 是同一个档；A035 放的是 A061 的片；A141、A142 只有 640 宽。

### 每个维度有几支（一支可以算进好几个维度）

| 维度 | 支数 | 说明 |
|---|---|---|
| 动作 mot | 53 | 模组一、二、四、五 |
| 情绪 emo | 21 | 模组十、十一；A150 |
| 语言 lang | 16 | 模组七、八 |
| 感觉处理 sen | 16 | 前庭、本体、触觉、视觉、调节 |
| 社交 soc | 12 | 模组七、十；A141、A142 |
| 学习 learn | 6 | 运笔 5 支＋A210 |
| 注意力 att | 5 | A005、A006、A125、A129、A139 |
| 认知 cog | 4 | A086、A090、A145、A146 |
| 日常生活 adl | 4 | A020、A070、A071、A075 |

**注意力、认知、日常生活、学习的片太少**：判红时一期要 18 支，三个月里后面几周会出现「准备中」。

### 用正式的推送函式跑过的例子

活动库＝300 支种子，这 94 支套上本档、其余没有片（不会被推）。`planPeriod({ tagged: true })`，没写的维度都是没事。

| 孩子 | 第 1 周 | 第 5 周 | 36 格里准备中 | 换着玩 |
|---|---|---|---|---|
| 24 个月、LANG 需关注 | LANG A121 叫名字回头、MOT A001 我们来爬行、COG A145 摸摸说说 | LANG A134 选一个、MOT A062 撕纸大王、COG A090 画出形状 | 9 | — |
| 30 个月、MOT 需留意、SOC 需关注 | SOC A121 叫名字回头、MOT A003 滚来滚去、SOC A124 来来去去玩一玩 | SOC A182 照镜子做表情、MOT A070 倒来倒去、SOC A193 绘本里的心情 | 6 | — |
| 48 个月、EMO 需关注、ATT 需留意 | EMO A150 我不要、ATT A125 听声音找东西、EMO A184 帮心情说名字 | EMO A186 我生气了、ATT 准备中、EMO A187 我难过了 | 8 | — |
| 60 个月、LEARN 需留意、ADL 需留意 | LEARN A084 画直线、ADL A075 扣扣子拉拉链、LEARN A085 画圈圈 | 全部准备中 | 26 | — |
| 36 个月、COG 需关注 | COG A145 摸摸说说、LANG A128 一步指令、MOT A002 钻山洞 | COG 准备中、LANG A134 选一个、MOT A071 舀一舀 | 14 | — |

（只有一个维度被标记时，名额上限一半，另一半由 `PUSH_ORDER` 前面没事的维度补，所以会出现 MOT、COG。）
换着玩只列窗口内的；`targetMonth` 是一个点、月窗口只有两三个月宽，几乎都是空的 —— 11/03 第 25 页本来就把按维度分的换着玩拿掉了。

| 编号 | 活动 | 模组 | 手册适龄 | targetMonth | targets | 理由 |
|---|---|---|---|---|---|---|
| A001 | 我们来爬行 | 1 | 6个月–3岁 | 21 | mot.postural, mot.locomotion | 手脚交替爬行 |
| A002 | 钻山洞 | 1 | 1–5岁 | 36 | mot.postural, sen.body_awareness | 低矮空间爬行；「认识自己身体的大小」 |
| A003 | 滚来滚去 | 1 | 6个月–4岁 | 27 | mot.postural, sen.vestibular | 翻身与旋转控制；滚动是前庭输入 |
| A004 | 学动物走路 | 1 | 2–8岁 | 60 | mot.locomotion, mot.postural | 动物走法；熊走、螃蟹走要撑住身体（⚠️ 客户说片子不对题） |
| A005 | 一二三木头人 | 1 | 2–8岁 | 60 | mot.balance, att.inhibition | 「说停就停」的自我控制，也练平衡 |
| A006 | 红灯停绿灯行 | 1 | 2–6岁 | 48 | mot.locomotion, att.inhibition | 听信号控制动作（⚠️ 片子与 A007 同一个档） |
| A007 | 走直线 | 1 | 2–8岁 | 60 | mot.balance | 走直线，平衡与方向控制 |
| A008 | 跳过小河 | 1 | 2–8岁 | 60 | mot.locomotion | 双脚跳与落地缓冲 |
| A009 | 金鸡独立 | 1 | 3–8岁 | 66 | mot.balance | 单脚站 |
| A010 | 跨过障碍 | 1 | 1–6岁 | 42 | mot.balance, mot.locomotion | 抬脚跨越、单脚站稳 |
| A011 | 推墙比赛 | 1 | 3–8岁 | 66 | mot.postural, sen.regulation | 全身出力；「让身体安定下来」 |
| A012 | 小推车 | 1 | 3–8岁 | 66 | mot.postural | 手臂与肚子的力气 |
| A013 | 搭小桥 | 1 | 2–8岁 | 60 | mot.postural | 臀桥，屁股与背部力气 |
| A014 | 超人飞 | 1 | 3–8岁 | 66 | mot.postural | 俯卧抬起，背部力气 |
| A015 | 蹲下站起来 | 1 | 2–8岁 | 60 | mot.postural, mot.balance | 蹲站转换，腿的力气 |
| A016 | 追泡泡 | 1 | 1–6岁 | 42 | mot.locomotion, sen.visual | 追着跑跳拍打；眼睛追视 |
| A017 | 跟着音乐动 | 1 | 1–8岁 | 54 | mot.balance, mot.locomotion | 跟节奏活动全身 |
| A018 | 爬楼梯练腿 | 1 | 1–8岁 | 54 | mot.locomotion, mot.balance | 上下楼梯 |
| A019 | 搬东西小帮手 | 1 | 2–8岁 | 60 | mot.postural, sen.body_awareness | 搬推拉重物；判断搬不搬得动 |
| A020 | 每天动一动 | 1 | 全龄 | 90 | mot.locomotion, adl.routines | 「把身体活动变成每天的习惯」 |
| A021 | 走在软软的路上 | 2 | 2–8岁 | 60 | mot.balance, sen.body_awareness | 不稳的表面上走，脚踝自动调整 |
| A022 | 踩石头过河 | 2 | 2–8岁 | 60 | mot.balance | 精准落脚、单脚站稳 |
| A023 | 脚跟接脚尖 | 2 | 4–8岁 | 72 | mot.balance | 最窄支撑面的平衡 |
| A024 | 转圈再站好 | 2 | 4–8岁 | 72 | mot.balance, sen.vestibular | 转晕之后站稳 |
| A025 | 被推不倒翁 | 2 | 3–8岁 | 66 | mot.balance, mot.postural | 被推还站得住、保护反应 |
| A026 | 端东西走路 | 2 | 3–8岁 | 66 | mot.balance | 端东西稳定行走 |
| A027 | 左手摸右脚 | 2 | 3–8岁 | 66 | mot.balance, sen.body_awareness | 手脚交叉过中线 |
| A035 | 拍气球不落地 | 2 | 2–8岁 | 60 | mot.ball_skills, sen.visual | 持续手眼协调（⚠️ 片子放的是 A061 的） |
| A061 | 捏捏面团 | 4 | 1–8岁 | 54 | mot.fine_motor, sen.tactile | 捏揉压，手指力气；触觉输入 |
| A062 | 撕纸大王 | 4 | 1–5岁 | 36 | mot.fine_motor | 双手配合撕纸 |
| A063 | 夹夹子 | 4 | 2–8岁 | 60 | mot.fine_motor | 手指捏的力气（握笔同一组肌肉） |
| A064 | 夹豆子 | 4 | 3–8岁 | 66 | mot.fine_motor | 用工具夹小东西，手眼配合 |
| A065 | 串珠珠 | 4 | 2–8岁 | 60 | mot.fine_motor | 双手配合串珠 |
| A066 | 拧瓶盖 | 4 | 2–6岁 | 48 | mot.fine_motor | 手腕转动、双手配合 |
| A067 | 揉纸球投篮 | 4 | 2–8岁 | 60 | mot.fine_motor | 单手揉纸球，手掌小肌肉 |
| A068 | 剪刀初体验 | 4 | 3–8岁 | 66 | mot.fine_motor | 用剪刀 |
| A069 | 贴贴纸 | 4 | 1–6岁 | 42 | mot.fine_motor | 撕贴纸 |
| A070 | 倒来倒去 | 4 | 1–5岁 | 36 | mot.fine_motor, adl.feeding | 手腕控制；「自己倒水的前身」 |
| A071 | 舀一舀 | 4 | 1–5岁 | 36 | mot.fine_motor, adl.feeding | 握汤匙舀；「直接连到自己吃饭」 |
| A072 | 手指点点画 | 4 | 1–5岁 | 36 | mot.fine_motor, sen.tactile | 指尖的控制和感觉 |
| A075 | 扣扣子拉拉链 | 4 | 2–6岁 | 48 | mot.fine_motor, adl.dressing | 扣扣子拉拉链；「自己穿衣的关键」 |
| A076 | 穿洞洞板 | 4 | 2–6岁 | 48 | mot.fine_motor | 穿线，手眼配合 |
| A077 | 两只手一起玩 | 4 | 1–6岁 | 42 | mot.fine_motor | 双手分工 |
| A078 | 揉搓小饼干 | 4 | 2–8岁 | 60 | mot.fine_motor | 做点心的一整套手部动作 |
| A079 | 手指操 | 4 | 2–8岁 | 60 | mot.fine_motor | 手指分开活动 |
| A080 | 小手总动员 | 4 | 2–8岁 | 60 | mot.fine_motor | 小手模组串一轮 |
| A081 | 墙上大涂鸦 | 5 | 1–5岁 | 36 | mot.fine_motor | 站着在墙上画，手臂稳定 |
| A083 | 手指画沙盘 | 5 | 1–6岁 | 42 | mot.fine_motor, sen.tactile | 手指在沙上画 |
| A084 | 画直线 | 5 | 2–6岁 | 48 | mot.fine_motor, learn.writing | 横线竖线，最基本的线条控制 |
| A085 | 画圈圈 | 5 | 2–6岁 | 48 | mot.fine_motor, learn.writing | 画圆，字和图形的基础 |
| A086 | 走迷宫 | 5 | 3–8岁 | 66 | mot.fine_motor, learn.writing, cog.problem_solving | 笔在通道里走；看路线、找出口 |
| A089 | 涂色不出界 | 5 | 3–8岁 | 66 | mot.fine_motor, learn.writing | 框里涂色，控制力道与范围 |
| A090 | 画出形状 | 5 | 3–8岁 | 66 | mot.fine_motor, learn.writing, cog.concepts | 画基本图形；「写字的前置能力」 |
| A121 | 叫名字回头 | 7 | 6个月–3岁 | 21 | soc.eye_contact, lang.comprehension | 听到名字转头看（`soc.response_to_name` 只进报告，不能贴） |
| A122 | 看我指的地方 | 7 | 1–4岁 | 30 | soc.joint_attention | 顺着手指看过去 |
| A123 | 拿给你看 | 7 | 1–4岁 | 30 | soc.joint_attention, soc.social_initiation | 主动拿东西给大人看 |
| A124 | 来来去去玩一玩 | 7 | 6个月–3岁 | 21 | soc.emotion_reciprocity, lang.pragmatics | 「你一次、我一次」，对话雏形 |
| A125 | 听声音找东西 | 7 | 1–5岁 | 36 | sen.auditory, att.inattention | 循声找声源，听觉定位与专注 |
| A128 | 一步指令 | 7 | 1–4岁 | 30 | lang.comprehension | 听懂一步指令 |
| A129 | 两步指令 | 7 | 2–6岁 | 48 | lang.comprehension, att.working_memory | 记住并完成两步 |
| A132 | 指认图卡 | 7 | 1–5岁 | 36 | lang.comprehension, lang.vocabulary_size | 听词指图 |
| A134 | 选一个 | 7 | 1–5岁 | 36 | lang.comprehension, lang.expression | 二选一，理解并表达意愿 |
| A136 | 你说我做 | 7 | 2–8岁 | 60 | lang.expression, lang.pragmatics | 孩子当发号施令的人 |
| A137 | 没听懂就问 | 7 | 3–8岁 | 66 | lang.pragmatics | 听不懂会问 |
| A139 | 专心听三样 | 7 | 3–8岁 | 66 | att.working_memory, att.inattention | 记住并复述一串，听觉记忆 |
| A141 | 学声音 | 8 | 6个月–3岁 | 21 | lang.articulation, soc.imitation | 模仿声音 |
| A142 | 边玩边说 | 8 | 1–5岁 | 36 | lang.vocabulary_size, soc.joint_attention | 玩的时候输入词汇；抬头看你指的 |
| A145 | 摸摸说说 | 8 | 2–6岁 | 48 | lang.vocabulary_size, cog.concepts | 形容词：大小、软硬、冷热 |
| A146 | 颜色形状说一说 | 8 | 2–6岁 | 48 | lang.vocabulary_size, cog.concepts | 颜色形状的词，分类概念 |
| A147 | 两个词接起来 | 8 | 1–4岁 | 30 | lang.expression | 两个词接起来 |
| A148 | 谁在做什么 | 8 | 2–6岁 | 48 | lang.expression | 「谁＋做什么」 |
| A149 | 我要什么 | 8 | 1–5岁 | 36 | lang.expression, lang.pragmatics | 用说的表达需求 |
| A150 | 我不要 | 8 | 1–5岁 | 36 | lang.expression, emo.regulation | 用说的拒绝，替代尖叫 |
| A182 | 照镜子做表情 | 10 | 2–6岁 | 48 | emo.regulation, soc.imitation | 照镜子模仿表情 |
| A183 | 猜猜我的心情 | 10 | 3–8岁 | 66 | soc.emotion_reciprocity, emo.regulation | 看真人表情猜情绪 |
| A184 | 帮心情说名字 | 10 | 1–6岁 | 42 | emo.regulation | 大人帮孩子的情绪命名 |
| A185 | 我觉得开心 | 10 | 2–6岁 | 48 | emo.regulation | 说出开心 |
| A186 | 我生气了 | 10 | 2–8岁 | 60 | emo.regulation | 生气时说出来，替代动手 |
| A187 | 我难过了 | 10 | 2–8岁 | 60 | emo.regulation | 难过时说出来 |
| A188 | 我害怕 | 10 | 2–8岁 | 60 | emo.regulation | 害怕时说出来、找大人 |
| A192 | 什么事让我不开心 | 10 | 3–8岁 | 66 | emo.regulation | 平静时聊什么让他不开心 |
| A193 | 绘本里的心情 | 10 | 2–8岁 | 60 | emo.regulation, soc.emotion_reciprocity | 故事里认情绪 |
| A194 | 他现在开心吗 | 10 | 3–8岁 | 66 | soc.emotion_reciprocity, emo.regulation | 留意别人的心情 |
| A195 | 他为什么难过 | 10 | 4–8岁 | 72 | soc.emotion_reciprocity, emo.regulation | 想别人情绪的原因 |
| A197 | 安慰的话 | 10 | 3–8岁 | 66 | soc.emotion_reciprocity | 安慰别人 |
| A198 | 心情打卡 | 10 | 3–8岁 | 66 | emo.regulation | 每天记录心情 |
| A199 | 情绪都是正常的 | 10 | 3–8岁 | 66 | emo.regulation | 情绪没有对错 |
| A202 | 我的平静角 | 11 | 2–8岁 | 60 | emo.regulation, sen.regulation | 自己冷静下来的地方 |
| A203 | 抱抱充电 | 11 | 1–8岁 | 54 | emo.regulation, sen.regulation | 拥抱平复情绪（深压） |
| A205 | 用力气发泄 | 11 | 3–8岁 | 66 | emo.regulation, sen.regulation | 安全地把力气发出来 |
| A206 | 画出我的心情 | 11 | 3–8岁 | 66 | emo.regulation | 用画画表达情绪 |
| A207 | 换个好玩的 | 11 | 2–6岁 | 48 | emo.regulation | 转移注意力度过情绪 |
| A209 | 计划变了没关系 | 11 | 3–8岁 | 66 | emo.regulation | 接受计划改变 |
| A210 | 太难了先切小 | 11 | 3–8岁 | 66 | emo.regulation, learn.task_persistence | 太难就拆小；不放弃 |

## 2026-11-16-videos.json —— 正式站有示范片的 207 支（取代 11-07 那份）

**草稿，治疗师看过可以再调；使用者 2026-11-16 要求先照脚本贴上、把 T1 → T2 → 推送跑通。**
2026-11-16 正式站 `/var/www/sxk/media/activities/` 有 207 支 mp4，活动库里贴过标签的只有 1 支，
而且 `.env` 还是 `TRAINING_SAMPLE_ONLY=1`（不看能力、月龄，照编号排有片的）。

- **`targets`**：11-07 那 94 支原样沿用；新增的 113 支照手册「练什么」对到 ★ 标签，1–2 个，第一个是主要练的。
- **`targetMonth`**：模组一那 17 支用 09-27 照发展里程碑估的值；其余 ＝ 手册适龄下限 ＋ 区间的 15%（往下取整）：
  「2–8岁」→ 34、「3–8岁」→ 45、「1–5岁」→ 19。11-07 用区间中间（2–8 岁 → 60）偏大：推送窗口是从实足月龄往前取的，
  片子几乎都落在窗口外。手册适龄的下限才接近「一般发展的孩子开始做得到」的月龄（规格 v2 §7.1）。
- 片子本身的问题没变：A004 不对题；A006＝A007、A035＝A061 是同一个档（sha256 相同）；A141、A142 只有 640 宽。

用正式的 `planPeriod` 跑 8 个月龄（18–84）× 22 种判定 ＝ 176 份、6336 格：

| 活动库 | 排到不属于那个能力的片 | 准备中 | 靠放宽排进来的平均差几个月 |
|---|---|---|---|
| 现况（`TRAINING_SAMPLE_ONLY`，没标签） | 4576（72%） | 0 | — |
| 标签模式、`targetMonth` 用区间中间 | 0 | 197 | 18.3 |
| 标签模式、本档 | 0 | 200（3%，40 份计划里有） | 11.6 |

每个维度有几支（一支可以算进好几个）：动作 82、语言 46、情绪 34、感觉处理 33、社交 31、日常生活 23、注意力 20、认知 15、学习 10。
认知与学习判红时后面几周仍会出现「准备中」。

| 编号 | 活动 | 模组 | 手册适龄 | targetMonth | targets | 手册「练什么」 |
|---|---|---|---|---|---|---|
| A001 | 我们来爬行 | 1 | 6个月–3岁 | 9 | mot.postural, mot.locomotion | 练手脚交替的爬行动作，是走路和协调的基础。 |
| A002 | 钻山洞 | 1 | 1–5岁 | 15 | mot.postural, sen.body_awareness | 在低矮空间中爬行，认识自己身体的大小。 |
| A003 | 滚来滚去 | 1 | 6个月–4岁 | 6 | mot.postural, sen.vestibular | 练翻身与身体的旋转控制。 |
| A004 | 学动物走路 | 1 | 2–8岁 | 30 | mot.locomotion, mot.postural | 用各种动物走法活动全身，练力量和协调。 |
| A005 | 一二三木头人 | 1 | 2–8岁 | 42 | mot.balance, att.inhibition | 练「说停就停」的自我控制，也练平衡。 |
| A006 | 红灯停绿灯行 | 1 | 2–6岁 | 30 | mot.locomotion, att.inhibition | 听信号控制自己的动作，练反应与自控。 |
| A007 | 走直线 | 1 | 2–8岁 | 34 | mot.balance | 练平衡和方向控制。 |
| A008 | 跳过小河 | 1 | 2–8岁 | 34 | mot.locomotion | 练双脚跳和落地的缓冲。 |
| A009 | 金鸡独立 | 1 | 3–8岁 | 36 | mot.balance | 练单脚站的平衡能力。 |
| A010 | 跨过障碍 | 1 | 1–6岁 | 20 | mot.balance, mot.locomotion | 练抬脚跨越和单脚站稳的能力。 |
| A011 | 推墙比赛 | 1 | 3–8岁 | 36 | mot.postural, sen.regulation | 用力气推东西，全身出力也让身体安定下来。 |
| A012 | 小推车 | 1 | 3–8岁 | 48 | mot.postural | 练手臂和肚子的力气。 |
| A013 | 搭小桥 | 1 | 2–8岁 | 30 | mot.postural | 练屁股和背部的力气，让坐姿站姿更挺。 |
| A014 | 超人飞 | 1 | 3–8岁 | 42 | mot.postural | 练背部的力气，让身体挺得起来。 |
| A015 | 蹲下站起来 | 1 | 2–8岁 | 24 | mot.postural, mot.balance | 练腿的力气，也是收玩具的好方法。 |
| A016 | 追泡泡 | 1 | 1–6岁 | 18 | mot.locomotion, sen.visual | 追着泡泡跑跳拍打，练全身活动和眼睛追视。 |
| A017 | 跟着音乐动 | 1 | 1–8岁 | 18 | mot.balance, mot.locomotion | 跟着节奏活动全身，让运动变成享受。 |
| A018 | 爬楼梯练腿 | 1 | 1–8岁 | 24 | mot.locomotion, mot.balance | 练腿的力气和上下楼梯的能力。 |
| A019 | 搬东西小帮手 | 1 | 2–8岁 | 24 | mot.postural, sen.body_awareness | 搬、推、拉重一点的东西，练全身力气。 |
| A020 | 每天动一动 | 1 | 全龄 | 27 | mot.locomotion, adl.routines | 把身体活动变成每天的习惯。 |
| A021 | 走在软软的路上 | 2 | 2–8岁 | 34 | mot.balance, sen.body_awareness | 在不稳的表面上走路，练脚踝和身体的自动调整。 |
| A022 | 踩石头过河 | 2 | 2–8岁 | 34 | mot.balance | 练精准的落脚控制和单脚站稳。 |
| A023 | 脚跟接脚尖 | 2 | 4–8岁 | 55 | mot.balance | 练最窄的支撑面平衡，像走钢丝一样。 |
| A024 | 转圈再站好 | 2 | 4–8岁 | 55 | mot.balance, sen.vestibular | 转晕之后还能站稳，练身体的恢复能力。 |
| A025 | 被推不倒翁 | 2 | 3–8岁 | 45 | mot.balance, mot.postural | 被轻轻推还能站稳，练跌倒前的自我保护反应。 |
| A026 | 端东西走路 | 2 | 3–8岁 | 45 | mot.balance | 端着东西不掉，练稳定的行走。 |
| A027 | 左手摸右脚 | 2 | 3–8岁 | 45 | mot.balance, sen.body_awareness | 手脚交叉过身体中线，练左右脑的配合。 |
| A029 | 拍手拍腿 | 2 | 2–8岁 | 34 | mot.balance | 跟着节奏做动作，练双手配合和节奏感。 |
| A030 | 一手拍头一手揉肚 | 2 | 4–8岁 | 55 | mot.balance | 两只手做不一样的事，练高阶的协调。 |
| A031 | 滚球来回 | 2 | 1–5岁 | 19 | mot.ball_skills, mot.postural | 练接和推的基本球感，也练坐姿平衡。 |
| A032 | 接住抛过来的球 | 2 | 3–8岁 | 45 | mot.ball_skills | 练手眼协调和接球的时间判断。 |
| A033 | 丢球进篮子 | 2 | 2–8岁 | 34 | mot.ball_skills | 练投掷的准确度和力度控制。 |
| A034 | 踢球进门 | 2 | 2–8岁 | 34 | mot.ball_skills, mot.balance | 练踢球的准确度，也练单脚站稳。 |
| A035 | 拍气球不落地 | 2 | 2–8岁 | 34 | mot.ball_skills, sen.visual | 练持续的手眼协调和反应。 |
| A036 | 绕过瓶子跑 | 2 | 3–8岁 | 45 | mot.locomotion, mot.balance | 练跑动中改变方向的能力。 |
| A039 | 骑滑步车 | 2 | 2–6岁 | 31 | mot.balance, mot.locomotion | 练平衡和用脚蹬地前进。 |
| A040 | 平衡小挑战 | 2 | 3–8岁 | 45 | mot.balance | 把这个模组的活动串起来玩，看看进步了多少。 |
| A041 | 推箱子搬家 | 3 | 2–8岁 | 34 | mot.postural, sen.body_awareness | 推重一点的东西，全身出力，也让情绪安定下来。 |
| A042 | 拔河比赛 | 3 | 3–8岁 | 45 | mot.postural, sen.body_awareness | 练手臂和背部的拉力。 |
| A043 | 拖着走 | 3 | 3–8岁 | 45 | mot.postural, sen.body_awareness | 练拉的力气，和推的动作正好互补。 |
| A044 | 提袋子走 | 3 | 3–8岁 | 45 | mot.postural, sen.body_awareness | 练握力和身体不歪的稳定。 |
| A045 | 靠墙推起来 | 3 | 4–8岁 | 55 | mot.postural, sen.body_awareness | 练手臂往前推的力气（伏地挺身的简单版）。 |
| A046 | 抱球蹲一蹲 | 3 | 3–8岁 | 45 | mot.postural | 练腿的力气，抱着东西还能增加难度。 |
| A047 | 举高高传球 | 3 | 3–8岁 | 45 | mot.postural | 练肩膀的力气。 |
| A048 | 熊爬走一段 | 3 | 3–8岁 | 45 | mot.postural, mot.locomotion | 手脚着地、膝盖离地往前走，练手臂和肚子。 |
| A049 | 青蛙跳 | 3 | 3–8岁 | 45 | mot.locomotion | 蹲着往前跳，练腿的爆发力。 |
| A050 | 擦桌子擦窗 | 3 | 3–8岁 | 45 | mot.postural, adl.routines | 用擦的动作练手臂力气，顺便做家务。 |
| A051 | 拖地小帮手 | 3 | 4–8岁 | 55 | mot.postural, adl.routines | 用推拉的动作练全身力气。 |
| A052 | 搬积木盖房 | 3 | 2–8岁 | 34 | mot.postural | 一边搬一边盖，力气和创造力一起练。 |
| A053 | 跳绳练一练 | 3 | 5–8岁 | 65 | mot.locomotion, mot.balance | 练手脚配合和体力。 |
| A055 | 体能小闯关 | 3 | 4–8岁 | 55 | mot.locomotion | 几个动作轮流做，练全身也练耐力。 |
| A056 | 户外走一走 | 3 | 2–8岁 | 34 | mot.locomotion | 每天出门走一段，累积体力。 |
| A057 | 公园玩到饱 | 3 | 2–8岁 | 34 | mot.locomotion, sen.vestibular | 爬、攀、荡、滑，全身能力一次练齐。 |
| A059 | 运动后放松 | 3 | 4–8岁 | 55 | sen.regulation, sen.body_awareness | 学会运动后的缓和，隔天不酸痛。 |
| A060 | 听身体的声音 | 3 | 4–8岁 | 55 | sen.body_awareness | 学会分辨累了、喘了、痛了，懂得保护自己。 |
| A061 | 捏捏面团 | 4 | 1–8岁 | 24 | mot.fine_motor, sen.tactile | 用手捏、揉、压，练手指的力气。 |
| A062 | 撕纸大王 | 4 | 1–5岁 | 19 | mot.fine_motor | 双手配合撕纸，练两只手一起工作。 |
| A063 | 夹夹子 | 4 | 2–8岁 | 34 | mot.fine_motor | 练手指捏的力气（和握笔用的是同一组肌肉）。 |
| A064 | 夹豆子 | 4 | 3–8岁 | 45 | mot.fine_motor | 用工具把小东西夹到另一个碗，练手眼配合和手指控制。 |
| A065 | 串珠珠 | 4 | 2–8岁 | 34 | mot.fine_motor | 两只手配合把东西串起来，练精准和耐心。 |
| A066 | 拧瓶盖 | 4 | 2–6岁 | 31 | mot.fine_motor | 练手腕转动和两只手配合。 |
| A067 | 揉纸球投篮 | 4 | 2–8岁 | 34 | mot.fine_motor | 单手把纸揉成球，练手掌里的小肌肉。 |
| A068 | 剪刀初体验 | 4 | 3–8岁 | 45 | mot.fine_motor | 学会用剪刀，是重要的工具使用能力。 |
| A069 | 贴贴纸 | 4 | 1–6岁 | 21 | mot.fine_motor | 撕下贴纸再贴上去，练手指的精细动作。 |
| A070 | 倒来倒去 | 4 | 1–5岁 | 19 | mot.fine_motor, adl.feeding | 练手腕控制和两手配合，是自己倒水的前身。 |
| A071 | 舀一舀 | 4 | 1–5岁 | 19 | mot.fine_motor, adl.feeding | 练握汤匙和舀的动作，直接连到自己吃饭。 |
| A072 | 手指点点画 | 4 | 1–5岁 | 19 | mot.fine_motor, sen.tactile | 用手指作画，练指尖的控制和感觉。 |
| A075 | 扣扣子拉拉链 | 4 | 2–6岁 | 31 | mot.fine_motor, adl.dressing | 练两只手配合，也是自己穿衣的关键。 |
| A076 | 穿洞洞板 | 4 | 2–6岁 | 31 | mot.fine_motor | 把线穿过洞，练手眼配合和精准。 |
| A077 | 两只手一起玩 | 4 | 1–6岁 | 21 | mot.fine_motor | 一只手固定、一只手操作，练双手分工。 |
| A078 | 揉搓小饼干 | 4 | 2–8岁 | 34 | mot.fine_motor | 在做点心的过程中练一整套手部动作。 |
| A079 | 手指操 | 4 | 2–8岁 | 34 | mot.fine_motor | 活动每一根手指，为写字画画热身。 |
| A080 | 小手总动员 | 4 | 2–8岁 | 34 | mot.fine_motor | 把这个模组的活动串起来玩一轮。 |
| A081 | 墙上大涂鸦 | 5 | 1–5岁 | 19 | mot.fine_motor | 站着在墙上画，练手臂的稳定（比坐着画更基础）。 |
| A083 | 手指画沙盘 | 5 | 1–6岁 | 21 | mot.fine_motor, sen.tactile | 用手指在沙上画，先感觉线条再用笔画。 |
| A084 | 画直线 | 5 | 2–6岁 | 31 | mot.fine_motor, learn.writing | 练最基本的线条控制（横线、竖线）。 |
| A085 | 画圈圈 | 5 | 2–6岁 | 31 | mot.fine_motor, learn.writing | 练画圆的控制，是很多字和图形的基础。 |
| A086 | 走迷宫 | 5 | 3–8岁 | 45 | mot.fine_motor, learn.writing, cog.problem_solving | 控制笔在通道里走，练精准的运笔。 |
| A089 | 涂色不出界 | 5 | 3–8岁 | 45 | mot.fine_motor, learn.writing | 在框框里涂色，练控制力道和范围。 |
| A090 | 画出形状 | 5 | 3–8岁 | 45 | mot.fine_motor, learn.writing, cog.concepts | 练画基本图形（圆、方、三角），是写字的前置能力。 |
| A091 | 找一找在哪里 | 5 | 2–8岁 | 34 | cog.visual_attention, sen.visual | 在复杂的画面中找出指定的东西，练视觉搜寻。 |
| A092 | 找不同 | 5 | 3–8岁 | 45 | cog.visual_attention, sen.visual | 比对两张图找差异，练视觉分辨。 |
| A093 | 配对找一样 | 5 | 1–6岁 | 21 | cog.concepts, sen.visual | 把一样的东西配成对，是视觉辨别的基础。 |
| A094 | 少了什么 | 5 | 3–8岁 | 45 | att.working_memory, cog.visual_attention | 记住看过的东西，练视觉记忆。 |
| A096 | 拼图挑战 | 5 | 2–8岁 | 34 | cog.problem_solving, sen.visual | 练视觉分析、空间概念和耐心。 |
| A097 | 影子配对 | 5 | 3–8岁 | 45 | cog.visual_attention, sen.visual | 从轮廓认出东西，练形状辨认。 |
| A098 | 写自己的名字 | 5 | 4–8岁 | 55 | learn.writing, mot.fine_motor | 从最有意义的字开始学写——自己的名字。 |
| A099 | 写字前的准备 | 5 | 4–8岁 | 55 | learn.writing, mot.postural | 把写字的环境和姿势调对，让孩子写得久也写得好。 |
| A101 | 自己拿汤匙吃 | 6 | 1–4岁 | 17 | adl.feeding | 学会用汤匙自己吃饭。 |
| A102 | 用杯子喝水 | 6 | 1–3岁 | 15 | adl.feeding | 学会用一般杯子喝水，练手部控制和吞咽。 |
| A104 | 自己脱衣服 | 6 | 1–4岁 | 17 | adl.dressing | 从最容易的「脱」开始学穿脱（脱比穿简单）。 |
| A105 | 自己穿衣服 | 6 | 2–6岁 | 31 | adl.dressing | 学会自己穿上衣和裤子。 |
| A106 | 自己穿鞋 | 6 | 2–6岁 | 31 | adl.dressing | 学会分左右、自己穿上鞋。 |
| A107 | 自己洗手 | 6 | 1–6岁 | 21 | adl.hygiene | 学会完整的洗手流程。 |
| A108 | 自己刷牙 | 6 | 2–8岁 | 34 | adl.hygiene | 学会刷牙的动作与流程。 |
| A109 | 自己洗澡 | 6 | 3–8岁 | 45 | adl.hygiene, sen.body_awareness | 学会洗自己的身体，练身体部位认识与动作范围。 |
| A110 | 收玩具回家 | 6 | 1–8岁 | 24 | adl.routines | 学会把东西放回固定的地方。 |
| A111 | 自己背书包 | 6 | 3–8岁 | 45 | adl.routines, att.organization | 学会准备自己的东西，练组织能力。 |
| A112 | 摆餐具 | 6 | 2–8岁 | 34 | adl.routines | 帮忙摆餐桌，练分配与生活参与。 |
| A113 | 折衣服 | 6 | 3–8岁 | 45 | adl.dressing, mot.fine_motor | 练双手配合和对称概念。 |
| A114 | 擦自己的桌子 | 6 | 2–8岁 | 34 | adl.routines | 负责自己的空间，练手臂动作与责任感。 |
| A116 | 一起做点心 | 6 | 2–8岁 | 34 | adl.routines, mot.fine_motor | 参与做食物的过程，练手部动作与步骤概念。 |
| A117 | 睡前流程图 | 6 | 2–8岁 | 34 | adl.routines | 照着固定流程完成睡前的事，练自我管理。 |
| A118 | 早上的准备 | 6 | 3–8岁 | 45 | adl.routines, att.organization | 照流程完成出门前的准备，练时间概念与效率。 |
| A119 | 我是小帮手 | 6 | 2–8岁 | 34 | adl.routines | 每天有一件固定负责的事，建立责任感。 |
| A121 | 叫名字回头 | 7 | 6个月–3岁 | 10 | soc.eye_contact, lang.comprehension | 听到自己的名字会转头看，是社交回应的第一步。 |
| A122 | 看我指的地方 | 7 | 1–4岁 | 17 | soc.joint_attention | 顺着大人的手指看过去，练「一起注意同一件事」。 |
| A123 | 拿给你看 | 7 | 1–4岁 | 17 | soc.joint_attention, soc.social_initiation | 孩子主动把东西拿给你看，是很珍贵的沟通动机。 |
| A124 | 来来去去玩一玩 | 7 | 6个月–3岁 | 10 | soc.emotion_reciprocity, lang.pragmatics | 体验「你一次、我一次」的来回，是对话的雏形。 |
| A125 | 听声音找东西 | 7 | 1–5岁 | 19 | sen.auditory, att.inattention | 循着声音找出声源，练听觉的定位与专注。 |
| A126 | 这是什么声音 | 7 | 2–6岁 | 31 | sen.auditory, lang.comprehension | 分辨不同的声音，练听觉辨别。 |
| A127 | 听到就拍手 | 7 | 2–6岁 | 31 | att.inattention, lang.comprehension | 听到指定的词就做动作，练听觉专注。 |
| A128 | 一步指令 | 7 | 1–4岁 | 17 | lang.comprehension | 听懂并完成一个动作的指令。 |
| A129 | 两步指令 | 7 | 2–6岁 | 31 | lang.comprehension, att.working_memory | 记住并完成两个连续的动作。 |
| A130 | 听指令寻宝 | 7 | 3–8岁 | 45 | lang.comprehension, cog.concepts | 听方位指令找东西，练理解位置词。 |
| A132 | 指认图卡 | 7 | 1–5岁 | 19 | lang.comprehension, lang.vocabulary_size | 听到词能指出对的图，是理解词汇的表现。 |
| A133 | 听故事指图 | 7 | 2–6岁 | 31 | lang.comprehension | 听故事时能找出对应的画面，练听觉理解。 |
| A134 | 选一个 | 7 | 1–5岁 | 19 | lang.comprehension, lang.expression | 从两个选项中选，练理解和表达意愿。 |
| A135 | 等一等再给 | 7 | 1–4岁 | 17 | lang.expression, soc.social_initiation | 制造机会让他主动表达需求。 |
| A136 | 你说我做 | 7 | 2–8岁 | 34 | lang.expression, lang.pragmatics | 角色互换，孩子当发号施令的人。 |
| A137 | 没听懂就问 | 7 | 3–8岁 | 45 | lang.pragmatics | 听不懂的时候会问「什么意思」，是重要的沟通能力。 |
| A139 | 专心听三样 | 7 | 3–8岁 | 45 | att.working_memory, att.inattention | 记住并复述听到的一串东西，练听觉记忆。 |
| A140 | 听懂大综合 | 7 | 2–8岁 | 34 | lang.comprehension | 把这个模组的能力串起来玩一轮。 |
| A141 | 学声音 | 8 | 6个月–3岁 | 10 | lang.articulation, soc.imitation | 模仿声音是说话的第一步。 |
| A142 | 边玩边说 | 8 | 1–5岁 | 19 | lang.vocabulary_size, soc.joint_attention | 在玩的时候自然输入词汇，是最有效的方式。 |
| A144 | 动作词大集合 | 8 | 1–6岁 | 21 | lang.vocabulary_size, lang.expression | 学会动词，句子才组得起来。 |
| A145 | 摸摸说说 | 8 | 2–6岁 | 31 | lang.vocabulary_size, cog.concepts | 学形容词（大小、软硬、冷热、粗滑）。 |
| A146 | 颜色形状说一说 | 8 | 2–6岁 | 31 | lang.vocabulary_size, cog.concepts | 学颜色和形状的词，也练分类概念。 |
| A147 | 两个词接起来 | 8 | 1–4岁 | 17 | lang.expression | 从单词进步到两个词的组合。 |
| A148 | 谁在做什么 | 8 | 2–6岁 | 31 | lang.expression | 说出「谁＋做什么」的完整句。 |
| A149 | 我要什么 | 8 | 1–5岁 | 19 | lang.expression, lang.pragmatics | 学会用说的表达需求，减少哭闹。 |
| A150 | 我不要 | 8 | 1–5岁 | 19 | lang.expression, emo.regulation | 学会用说的拒绝，替代尖叫和赖皮。 |
| A151 | 帮帮我 | 8 | 2–6岁 | 31 | lang.expression, emo.regulation | 学会求助，把挫折转成沟通。 |
| A152 | 这是谁的 | 8 | 2–6岁 | 31 | lang.expression | 学会「我的、你的、他的」，练所有格。 |
| A155 | 说说反义词 | 8 | 3–8岁 | 45 | lang.vocabulary_size, cog.concepts | 学成对的概念词，词汇量成倍增加。 |
| A157 | 因为所以 | 8 | 3–8岁 | 45 | lang.expression, cog.problem_solving | 学会说原因，回答「为什么」。 |
| A158 | 跟着念儿歌 | 8 | 1–6岁 | 21 | lang.vocabulary_size, lang.articulation | 在重复的韵文中自然吸收词汇和句型。 |
| A159 | 小小采访 | 8 | 3–8岁 | 45 | lang.expression, lang.pragmatics | 在问答中练表达，也练回答问题。 |
| A161 | 有问有答 | 9 | 2–6岁 | 31 | lang.pragmatics | 别人问就回答，把「接话」变成习惯。 |
| A162 | 你呢 | 9 | 3–8岁 | 45 | lang.pragmatics, soc.social_initiation | 答完会反问对方，让对话变成双向。 |
| A163 | 多说一句 | 9 | 3–8岁 | 45 | lang.pragmatics | 回答后再加一句，让话题接得下去。 |
| A165 | 接住话题 | 9 | 3–8岁 | 45 | lang.pragmatics | 顺着对方说的内容回应，不跳到别的事。 |
| A166 | 我在听哦 | 9 | 3–8岁 | 45 | lang.pragmatics, soc.eye_contact | 学会用点头、嗯嗯、看着对方表示在听。 |
| A169 | 复述小故事 | 9 | 3–8岁 | 45 | lang.expression, att.working_memory | 听完故事用自己的话讲一遍，练记忆和组织。 |
| A170 | 接下来会怎样 | 9 | 3–8岁 | 45 | lang.expression, cog.problem_solving | 猜故事接下来的发展，练推理和想象。 |
| A171 | 编一个结尾 | 9 | 4–8岁 | 55 | lang.expression | 自己想出故事的结尾，练想象和组织。 |
| A172 | 描述给你猜 | 9 | 3–8岁 | 45 | lang.expression | 说清楚一样东西的特征，让别人猜出来。 |
| A173 | 我说你画 | 9 | 4–8岁 | 55 | lang.expression | 用话把图形描述清楚，练精确的表达。 |
| A174 | 电话聊聊天 | 9 | 4–8岁 | 55 | lang.pragmatics | 只靠声音沟通，练听清楚和说清楚。 |
| A175 | 角色扮演对话 | 9 | 3–8岁 | 45 | lang.pragmatics, soc.pretend_play | 在扮演中练完整的多轮对话。 |
| A176 | 没听懂我再说一次 | 9 | 3–8岁 | 45 | lang.pragmatics | 别人没听懂时，换个说法再说一次。 |
| A177 | 话题百宝箱 | 9 | 4–8岁 | 55 | lang.pragmatics, soc.social_initiation | 准备一些「可以聊什么」的话题，没话说时有得拿。 |
| A179 | 睡前分享时间 | 9 | 3–8岁 | 45 | lang.expression, lang.pragmatics | 每天固定的分享时间，让说话变成习惯。 |
| A182 | 照镜子做表情 | 10 | 2–6岁 | 31 | emo.regulation, soc.imitation | 用自己的脸做出表情，把感受和表情连起来。 |
| A183 | 猜猜我的心情 | 10 | 3–8岁 | 45 | soc.emotion_reciprocity, emo.regulation | 看真人的表情猜情绪，比看图卡更接近真实。 |
| A184 | 帮心情说名字 | 10 | 1–6岁 | 21 | emo.regulation | 孩子有情绪时，大人帮他命名。 |
| A185 | 我觉得开心 | 10 | 2–6岁 | 31 | emo.regulation | 从最容易的正面情绪开始，学会说出感受。 |
| A186 | 我生气了 | 10 | 2–8岁 | 34 | emo.regulation | 生气时能说出来，是替代打人摔东西的第一句话。 |
| A187 | 我难过了 | 10 | 2–8岁 | 34 | emo.regulation | 难过时能说出来，用语言替代只会哭。 |
| A188 | 我害怕 | 10 | 2–8岁 | 34 | emo.regulation | 害怕时会说出来、会找大人，是重要的自我保护。 |
| A192 | 什么事让我不开心 | 10 | 3–8岁 | 45 | emo.regulation | 在平静时聊聊什么会让他生气难过。 |
| A193 | 绘本里的心情 | 10 | 2–8岁 | 34 | emo.regulation, soc.emotion_reciprocity | 在故事里认情绪，是最安全的情绪课。 |
| A194 | 他现在开心吗 | 10 | 3–8岁 | 45 | soc.emotion_reciprocity, emo.regulation | 养成留意别人心情的习惯。 |
| A195 | 他为什么难过 | 10 | 4–8岁 | 55 | soc.emotion_reciprocity, emo.regulation | 想想别人情绪背后的原因。 |
| A197 | 安慰的话 | 10 | 3–8岁 | 45 | soc.emotion_reciprocity | 学几句安慰人的话。 |
| A198 | 心情打卡 | 10 | 3–8岁 | 45 | emo.regulation | 每天记录心情，养成觉察的习惯。 |
| A199 | 情绪都是正常的 | 10 | 3–8岁 | 45 | emo.regulation | 建立一个重要的观念：情绪没有对错。 |
| A202 | 我的平静角 | 11 | 2–8岁 | 34 | emo.regulation, sen.regulation | 设一个可以自己冷静下来的地方。 |
| A203 | 抱抱充电 | 11 | 1–8岁 | 24 | emo.regulation, sen.regulation | 用拥抱平复情绪，也补充安全感。 |
| A205 | 用力气发泄 | 11 | 3–8岁 | 45 | emo.regulation, sen.regulation | 用安全的方式把力气发出来。 |
| A206 | 画出我的心情 | 11 | 3–8岁 | 45 | emo.regulation | 用画画把说不出来的情绪表达出来。 |
| A207 | 换个好玩的 | 11 | 2–6岁 | 31 | emo.regulation | 用转移注意力度过情绪，但不是忽略他的感受。 |
| A209 | 计划变了没关系 | 11 | 3–8岁 | 45 | emo.regulation | 练习接受变化，不因为「跟说好的不一样」就崩溃。 |
| A210 | 太难了先切小 | 11 | 3–8岁 | 45 | emo.regulation, learn.task_persistence | 遇到太难的事，学会拆成小块一块块做。 |
| A211 | 再试一次 | 11 | 2–8岁 | 34 | emo.regulation, learn.task_persistence | 失败了愿意再试，是最重要的学习态度。 |
| A212 | 帮帮我不丢脸 | 11 | 2–8岁 | 34 | emo.regulation | 卡住的时候会求助，不是硬撑也不是崩溃。 |
| A213 | 我做到了 | 11 | 2–8岁 | 34 | emo.regulation | 体验成就感，累积「我可以」的自信。 |
| A214 | 我的成就小本本 | 11 | 3–8岁 | 45 | emo.regulation | 把做到的事记下来，让进步看得见。 |
| A215 | 有输有赢才是游戏 | 11 | 3–8岁 | 45 | emo.regulation | 玩之前先建立心理准备：谁都可能输。 |
| A216 | 输了的三步 | 11 | 3–8岁 | 45 | emo.regulation | 输了有固定的三步可以走，不会瘫在原地。 |
| A217 | 输了也拍拍手 | 11 | 4–8岁 | 55 | emo.regulation | 输了还能恭喜对方，是很高级的能力。 |
| A218 | 快炸了先暂停 | 11 | 4–8岁 | 55 | emo.regulation | 觉察自己快爆了，主动喊停。 |
| A219 | 爸妈也会生气 | 11 | 3–8岁 | 45 | emo.regulation | 大人示范怎么处理自己的情绪。 |
| A220 | 我的情绪工具箱 | 11 | 3–8岁 | 45 | emo.regulation | 整理出属于自己的几招平静方法。 |
| A221 | 你好和再见 | 12 | 1–8岁 | 24 | soc.social_initiation | 学会最基本的社交开关：打招呼和道别。 |
| A222 | 我叫什么名字 | 12 | 2–8岁 | 34 | soc.social_initiation, lang.expression | 会说出自己的名字，是自我介绍的第一句。 |
| A223 | 先看看他们在玩什么 | 12 | 3–8岁 | 45 | soc.social_initiation | 加入游戏的第一步：先观察。 |
| A224 | 我可以一起玩吗 | 12 | 3–8岁 | 45 | soc.social_initiation | 学会加入游戏的黄金句。 |
| A225 | 人家说不行怎么办 | 12 | 3–8岁 | 45 | soc.social_initiation, emo.regulation | 被拒绝时有办法应对，不会崩溃。 |
| A226 | 在旁边玩一样的 | 12 | 2–8岁 | 34 | soc.imitation, soc.social_initiation | 不用开口也能加入的方法。 |
| A227 | 轮到你轮到我 | 12 | 1–6岁 | 21 | soc.emotion_reciprocity | 练最基本的轮流。 |
| A228 | 沙漏换人玩 | 12 | 2–8岁 | 34 | soc.emotion_reciprocity, att.inhibition | 用计时器公平地轮流。 |
| A229 | 分你一半 | 12 | 2–8岁 | 34 | soc.emotion_reciprocity | 从分食物开始学分享。 |
| A230 | 借我玩一下好吗 | 12 | 2–8岁 | 34 | soc.emotion_reciprocity, lang.pragmatics | 想要别人的东西时用问的，替代直接抢。 |
| A231 | 给了会回来 | 12 | 1–5岁 | 19 | soc.emotion_reciprocity | 建立分享的信任：给出去不等于失去。 |
| A232 | 一起抬起来 | 12 | 2–8岁 | 34 | soc.emotion_reciprocity | 两个人合力做一件事，体验合作。 |
| A233 | 一起搭一座塔 | 12 | 2–8岁 | 34 | soc.emotion_reciprocity | 两个人轮流盖同一个作品。 |
| A234 | 一起玩桌游 | 12 | 3–8岁 | 45 | soc.emotion_reciprocity, emo.regulation | 在规则游戏里练轮流、守规则、面对输赢。 |
| A243 | 什么不见了 | 13 | 3–8岁 | 45 | att.working_memory, cog.visual_attention | 记住环境的样子，发现变化。 |
| A246 | 藏起来找出来 | 13 | 2–8岁 | 34 | att.working_memory | 记住东西藏在哪里，练空间记忆。 |
| A247 | 一二三木头人 | 13 | 2–8岁 | 34 | att.inhibition, att.impulsivity | 说停就停，练冲动控制。 |
| A250 | 专心听声音 | 13 | 3–8岁 | 45 | att.inattention, sen.auditory | 安静下来专注听，练听觉专注。 |
| A252 | 数一数有几个 | 13 | 3–8岁 | 45 | att.inattention, learn.number | 专心数完不重复不遗漏，练持续专注。 |
| A256 | 整理桌面再开始 | 13 | 4–8岁 | 55 | att.organization | 减少干扰，帮专注力一把。 |
| A257 | 动一动再来 | 13 | 3–8岁 | 45 | att.inattention, sen.regulation | 用身体活动帮助恢复专注。 |
| A258 | 一次做一件 | 13 | 3–8岁 | 45 | att.inattention, att.organization | 学会一次专心做一件事，做完再做下一件。 |
| A260 | 专心记忆大挑战 | 13 | 3–8岁 | 45 | att.working_memory, att.inattention | 把这个模组的能力串起来玩一轮。 |
