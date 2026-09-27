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
