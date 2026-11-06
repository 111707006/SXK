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
