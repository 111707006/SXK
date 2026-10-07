# Group 3 survey: attention / executive function / learning tools (2026-09-23 "完整版" kit)

Tools: SXK-AB, SXK-ATT, SNAP-IV, CHEXI, SXK-LDP, SXK-LDS.
Source dir: `...\scratchpad\kitfull\森心康评估工具包_完整版\网页版\` (copies at `...\scratchpad\g3\{ab,att,snap,chexi,ldp,lds}.html`).
Method: HTML read as text only (never executed). Old banks are `src\t2\toolkit\{sxk-ab,sxk-att,snap-iv,chexi,sxk-ldp,sxk-lds}.ts`. Item identity checks were done with regex extraction + string compare in Python (no JS run); the helper scripts are in `...\scratchpad\g3\*.py`.

Client hub file (`...SXK-HUB.html`, lines ~275–300) declares these age ranges (months), which are the "official" ones for the product:
| tool | hub minM–maxM | hub rater list | hub mins |
|---|---|---|---|
| SXK-AB | 36–192 | 家长, 教师 (page itself also has 青少年自评) | 15 |
| SXK-ATT | 48–180 | 家长, 教师 | 15 |
| SNAP-IV | 72–216 | 家长, 教师 | 10 |
| CHEXI | 48–156 | 家长, 教师 | 10 |
| SXK-LDP (labelled 小学版 in hub, but "一年级到高三皆可用") | 72–215 | 家长, 教师 | 25 |
| SXK-LDS (中学版) | 144–215 | 本人自评, 家长, 教师 | 30 |

The hub only displays `d.grade` / `d.score` / `d.note` as text and uses `d.name` (when it differs from the tool name) as "subject" (see `onMsg` in HUB). So the postMessage `grade` is a free-text label, not a number.

Common to all six: every HTML ends with a "说明与限制" disclaimer saying the grading bands are 森心康-internal descriptive bands, not norms, not diagnosis. None of the six has a clinician-only input that gates scoring.

---

# 1. SXK-AB 森心康注意力及行为观察量表 · 完整版 (id `sxkab`)

## 1.1 Title / version / age
- `<h1>` 森心康注意力及行为观察量表 `<small>SXK-AB 完整版</small>`; header text: "3～16 岁 · 家长版 48 题＋老师版 36 题＋青少年自评 30 题". Data header comment: `（SXK-AB-FULL）`; JSON export `tool:'SXK-AB-FULL', version:'1.0'`.
- Two `<script>` blocks: block 1 = data (`SECS,GROUPS,PQ,TQ,YQ,OPTS,YOPTS,IMPACT,IMPOPTS,SETTINGS,DUR,ONSET,CHANGES,CHECKS,LEVELS`, exposed on `window`), block 2 = logic/rendering/scoring/postMessage.
- Age enforcement: `start()` → `if(a.months<36||a.months>192){alert('超出适用范围（3～16 岁）');return;}` (hard block; 36–192 months inclusive = 3y0m through 16y0m). `showAge()` additionally prints "<36: 请改用 SXK-DEV" / ">192: 适用 16 岁以下". Age computed from DOB + test date (both required) with `calcAge()` (day borrow = 30).
- Self-report form hard gate: `if(S.sel.Y&&S.months<132){alert('青少年自评版适用 11 岁以上')}`.

## 1.2 Rater forms
`FORMS={P:家长版 (家长／主要照顾者), T:老师版 (班级老师), Y:青少年自评版 (孩子本人)}`.
- Any combination can be ticked (`selP` default checked). Rater name required for P and T (`raterP/raterT`), Y defaults to child's name.
- P: 6 sections × 8 = **48** items, T: 6 × 6 = **36**, Y: 6 × 5 = **30** (11 yr+). Each form has different wording (P = home/parent view, T = classroom wording, Y = first person "我…"). Y has its own option labels (`YOPTS`).
- Intro text differs: P and Y look back "最近六个月", T "最近三个月".
- **Cut points are NOT per-form**: the same `LEVELS` (and the same postMessage cuts) are applied to whichever form(s) are used; overall = max across forms.

## 1.3 Item structure
Sections (`SECS`, key / name / group):
| key | name | grp | P | T | Y |
|---|---|---|---|---|---|
| SU | 持续专注 | AT (注意力) | 8 | 6 | 5 |
| DI | 抗干扰 | AT | 8 | 6 | 5 |
| IM | 冲动控制 | HI (多动与冲动) | 8 | 6 | 5 |
| HY | 活动量 | HI | 8 | 6 | 5 |
| EF | 组织与执行 | EF | 8 | 6 | 5 |
| OD | 对立与情绪 | ER | 8 | 6 | 5 |
`GROUPS={AT:'注意力（持续专注＋抗干扰）',HI:'多动与冲动（冲动控制＋活动量）',EF:'组织与执行',ER:'对立与情绪'}`.

Age selection: item = `[text, minMonth?]`, default 36: `items(fid)` → `if(S.months>=(m||36)) out.push(...)`. (Y items have no min → shown from 36, but the Y form itself is gated to ≥132.) Items with min 30 exist (IM#1, HY#1,#2) but are unreachable since the tool floor is 36.
Parent item counts by age: 36–47 mo = **29** (SU5 DI3 IM7 HY7 EF0 OD7); 48–59 = **41** (7/6/7/8/5/8); ≥60 = **48**. Teacher: 29 at 36–47, 30 at 48–59, 35 at 60–71, 36 at ≥72. (EF section is empty at 36–47 mo: page prints "这个面向的项目评估年龄都在目前月龄之后，本次不出题。")
Typical for a parent at home: 29–48 items + 5 impact items.

## 1.4 Response options
- P and T: `OPTS=[['很少或没有',0],['偶尔',1],['经常',2],['总是',3]]`.
- Y: `YOPTS=[['几乎不会',0],['有时候',1],['常常',2],['几乎总是',3]]`.
- No N/A option for items (CSS `.dom.na` exists but unused). Every displayed item and every impact row must be answered before `nextForm()` lets you go on ("还有 N 题未作答").
- Higher = worse (0 = no concern, 3 = marked) — already in the 0–3 direction the engine wants. No reverse-scored items.

## 1.5 Non-item inputs (none are scored)
All of these are on page 2 ("场合与病程") or after items; "这一页不计入分数，但会明显影响报告的判读与建议".
- **SETTINGS** (required, multi): 家中 / 学校／幼儿园 / 其他场合（托管班、才艺班、亲戚家）. `multi = settings.length>=2` → text "跨场合出现／仅单一场合", flag box when only one. Does not change the level.
- **DUR** (required, single): `lt3 不到3个月 / m3to6 / gt6 超过6个月 / always 一直以来`. `lt3` triggers a flagbox + rec "暂缓评估".
- **ONSET** (optional): `lt4 4岁以前 / a4to6 / a7to12 / gt12 12岁以后 / 不确定`.
- **CHANGES** (optional multi): 转学换班换老师 / 搬家 / 家庭变故 / 睡眠不足或打鼾 / 课业量增加 / 屏幕时间增加. Text only.
- **CHECKS** (table; default 未做): 听力 / 视力 / 睡眠评估 / 情绪评估 / 学习能力或智力评估 / 语言能力评估 × {未做, 已做正常, 已做有异常}. "有异常" → text "请先处理这些问题，再解读本表结果"; 未做 → rec "先完成尚未做的排除检查". Parent can answer (what exams were done).
- **IMPACT** (required per form, 5 rows, 0–3: 没有影响/轻微/明显/严重): 学业或学习进度 / 同伴关系 / 家庭关系 / 自信心与情绪 / 安全. `impAff = max >= 2` → "已造成明显功能影响"; used in the 4 "key conditions" table and recommendation text ("决定要不要安排专业评估最重要的一条"). Not added to the % score and **does not move the level**. Parent can answer.
- 孩子的优势 (free text), 临床备注 (free text, optional), 转介来源, 评估者／编号 (optional), 主要担心 (optional).
- Required at page 1: name, DOB, test date.

## 1.6 Scoring (exact)
```
function stat(fid,li){let sum=0;li.forEach(x=>sum+=S.ans[fid][x.id]||0);const max=li.length*3;return {n:li.length,sum,max,pct:max?Math.round(sum/max*100):null};}
secStat(fid,s)  // per-section stat on items shown at this age
grpStat(fid,g)  // per-group (AT/HI/EF/ER)
formStat(fid)   // all shown items of the form
ovPct = mx(S.forms.map(k=>fs[k].pct))   // MAX across selected forms of whole-form %
```
- Percent of maximum, rounded to integer; item-count differences by age are absorbed by using the percentage.
- Per-section %, per-group %, "gAT = max over forms of AT-group %", etc. Section ordering in report: by `p` desc.
- Impact, settings, dur, onset etc. do **not** enter any percentage.

## 1.7 Grading
(a) **On-page report bands** (`LEVELS`, 3 levels, applied with `levelFor(p)=LEVELS.find(l=>p<=l.hi)`), best→worst:
| key | range (integer %) |
|---|---|
| 未见明显 | ≤33 |
| 部分表现需留意 | 34–50 |
| 建议专业评估 | 51–100 |
Used for the overall verdict (`ovPct`) and for each section (`levelFor(p)` tag in "逐面向说明"). Text printed: "分段 ≤33% 未见明显／34–50% 部分表现需留意／≥51% 建议专业评估". Heat-table colouring uses 33/50 as well.
Group-level pairs (gAT, gHI, gEF, gER) are shown as % only, but report logic compares with 33 and 50 (`gAT>33&&gHI>33`, `gER>50`).

(b) **postMessage payload** (4 levels, different cuts; end of `renderReport`):
```
const gr=ovPct<=33?'未见明显':ovPct<=50?'轻度':ovPct<=70?'中度':'重度';
window.parent.postMessage({sxkTool:1,id:'sxkab',name:'森心康注意力及行为观察量表（完整版）',grade:gr,score:ovPct,
  note:`${multi?'跨场合':'单一场合'}·注意力 ${gAT??'—'}%／多动冲动 ${gHI??'—'}%`},'*');
```
Guarded by `window.parent&&window.parent!==window` and try/catch. Fields: `grade ∈ {未见明显, 轻度, 中度, 重度}`, `score = ovPct` (0–100), `note` string. `name` is a constant tool title (no child PII).

(c) Old `.ts` tiers (33 / 41 / 50 → 未见明显/轻微/中度/明显) match neither (a) nor (b) exactly: new (a) drops the 41/42 split, new (b) uses 50/70 instead of 41/50.

**Mapping to 0–3**: postMessage scheme is the natural 4-level one: 未见明显=0 (≤33), 轻度=1 (34–50), 中度=2 (51–70), 重度=3 (≥71). On-page report is only 3-level: 0 (≤33), 1 (34–50), 2/3 (≥51) — needs a decision. For "primary dimension": the page itself reports two groups (注意力 AT, 多动冲动 HI) as raw % only and never grades them separately (only `levelFor` per-section / overall); an engine can grade gAT / gHI with the same cuts.

## 1.8 Clinician / observation / materials / timing
Nothing needs a clinician. "与同龄孩子比较" is the standard. Looking-back windows: 6 months (P, Y) / 3 months (T). Many report recommendations mention 转介儿童精神科等 but are text only. EF/Org items need the child ≥48 mo; some school items ≥60/72 mo. Teacher and self forms assume the respective person exists (teacher form is hard to do at home; self-form needs ≥11 y).

## 1.9 Compare with old `sxk-ab.ts`
- **Same questions** for the parent form: all 48 old item texts are found verbatim in `PQ` (48/48), and `startMonth` is identical for all 48 (checked text+min month together).
- Section keys/names identical (SU/DI/IM/HY/EF/OD; 持续专注…对立与情绪), options identical (很少或没有/偶尔/经常/总是, 0–3), 8 items per section.
- New: teacher form (36), youth self-report (30), context page (SETTINGS/DUR/ONSET/CHANGES/CHECKS), 5-row IMPACT, 4-group roll-up.
- Old `preQuestions` was only SETTINGS (multi: home/school/other); new page also asks DUR/ONSET etc.
- **Different grading** (see 1.7c). Verdict: "same questions, different grading, plus two new forms".

## 1.10 Open questions
1. Which grading do we adopt — the 3-level on-page (33/50) or the 4-level postMessage (33/50/70)? They disagree on 51–70 (page: "建议专业评估" = worst level; postMessage: only 中度).
2. Group-level (AT vs HI) grading is not defined by the client; do we reuse the overall cuts?
3. The "at home" version: T and Y forms — do we expose them at all? Y has a hard 11-year gate.
4. Old `tiers` 41/42 split — where did it come from, can it be ignored?
5. Unreachable 30-month items (IM#1, HY#1–2) — no effect, just noise.
6. Impact (5 rows) and SETTINGS drive the report's "跨场合/明显影响" logic but never the grade; do we want these as modifiers?

---

# 2. SXK-ATT 森心康注意力及多动量表 · 完整版 (id `attn`)

## 2.1 Title / version / age
- `<h1>` 森心康注意力及多动量表 `SXK-ATT 完整版`; header "4～15 岁 · 家长版 48 题＋教师版 40 题 · 情境 × 类型"; JSON `tool:'SXK-ATT-FULL', version:'1.0'`.
- Two script blocks (data, then logic), same layout as AB.
- Age: `start()` → `if(a.months<48||a.months>180){alert('超出适用范围（4～15 岁）')}` (hard block, 48–180 months inclusive). `showAge()`: <48 → "改用 SXK-AB"; ≥72 mo = "学龄版", 48–71 = "学前版情境名称（集体活动、桌面任务），3 项学龄项目不出题" (the wording says 3 but the actual hidden count differs per form, see below).

## 2.2 Rater forms
`FORMS`: **P 家长版** (6 situations, 48 items) and **T 教师版** (5 situations, 40 items). No self-report. Either or both (`selP` default on, `selT`). Rater names required.
- P intro: 最近六个月；T intro: 最近三个月 (与同班同龄比较).
- The same item is not asked of both: each situation is assigned to forms (`forms:['P','T']` etc.). Shared situations (CL, HW, IP, SM) use identical wording for P and T (one text list); P-only: HM 居家, OU 户外与公共场所; T-only: CA 校园活动与转换.
- Same LEVELS for both forms (no per-form reference).

## 2.3 Item structure
Items are `[text, type, minMonth?]`, default min **48**. Types (`TYPES`): IN 专注与分心, HY 活动量, IM 冲动控制, EF 组织与计划, ER 情绪调节 (every item carries one type; this is a cross-cut besides the situation).
| situation key | name (≥72 mo) | preschool name (<72 mo, `pre`) | forms | items |
|---|---|---|---|---|
| CL | 课堂情境 | 集体活动情境（幼儿园） | P,T | 8 |
| HW | 作业情境 | 桌面任务情境（画画、拼图、描写） | P,T | 8 (1 item min 72) |
| HM | 居家情境 | – | P | 8 |
| IP | 人际情境 | – | P,T | 8 |
| SM | 自我管理 | – | P,T | 8 (1 item min 72) |
| OU | 户外与公共场所 | – | P | 8 |
| CA | 校园活动与转换 | – | T | 8 (1 item min 72) |
Counts shown: P = **46** at 48–71 mo, **48** at ≥72 mo; T = **37** at 48–71, **40** at ≥72.
`sitName(s)` swaps to `pre` names when `S.months<72`.

## 2.4 Response options
`OPTS=[['很少或没有',0],['偶尔',1],['经常',2],['总是',3]]` (all forms). Higher = worse. No reverse items.
**N/A**: parent form only, on situations CL and HW only: checkbox "这个情境无法观察" (`setNA`). A flagged situation is excluded entirely: `sitStat` returns null, `activeItems` skips it; sums **and denominators** exclude it; its items are not required; `formOverall` is computed only on active items. At least one situation must remain (`activeItems(fid).length===0` → "至少需要一个情境可以作答"). (Intro: "课堂与作业情境若没有直接看过，可以先向老师了解；真的无法回答，请勾「这个情境无法观察」".) This is the one tool in the group with an N/A concept for parents.

## 2.5 Non-item inputs
Page 2 "背景与病程" (not scored): **DUR** (required: lt3/m3to6/gt6/always, same labels as AB), **ONSET** (optional, same 4 + 不确定), **CHANGES** (6 checkboxes), **CHECKS** (6 rows × 未做/正常/异常), 优势 (text). **IMPACT** 5 rows × 0–3 per form (required per form; same wording as AB: 学业/同伴/家庭/自信心与情绪/安全). No SETTINGS question (cross-situation info comes from the item situations). Page 1 required: name, DOB, test date, rater name(s); 转介来源 / 评估者 / 主要担心 optional. A parent can answer all of these.
Effects: DUR=lt3 → warning + "暂缓评估"; impact ≥2 → `impAff` → text and recommendation (and postMessage note), not the grade.

## 2.6 Scoring (exact)
```
sitItems(s) = s.items.filter(months>=min)
sitStat(fid,s): null if NA or s not in form; sum over items, max=n*3, pct=Math.round(sum/max*100), hi=#items>=2
formOverall(fid): same over activeItems(fid)   // percent of max over all active items
typeStat(fid,ty), cellStat(fid,s,ty): % per type / per situation×type cell
comb(f)  = max over selected forms of f(form), ignoring null
ovPct = comb(k=>ov[k].pct);  situation score = comb(k=>sitStat(k,s).pct)
hot = situations with p>25;  nHot = hot.length;  rated = situations with a score
```
So overall = percent of maximum, taking the larger of P and T. Situation scores also use max across forms.

## 2.7 Grading
(a) **On-page `LEVELS`** (3 levels; `levelFor(p)` = first with `p<=hi`):
| key | range |
|---|---|
| 未见明显 | ≤25 |
| 部分情境需留意 | 26–42 |
| 建议专业评估 | 43–100 |
Applied to overall and to each situation ("逐情境说明"). Report text: "≤25% 未见明显／26–42% 需留意／≥43% 建议评估". `hot` = situations >25; "跨两个以上情境" criterion = `nHot>=2`; recommendations branch on nHot, `impAff`, and `lv===LEVELS[2]`.
(b) **postMessage**:
```
const g=ovPct<=25?'未见明显':ovPct<=42?'轻度':ovPct<=60?'中度':'重度';
postMessage({sxkTool:1,id:'attn',name:'森心康注意力及多动量表（完整版）',grade:g,score:ovPct,
  note:`${nHot}/${rated} 情境偏高·${DUR[dur]||''}${impAff?'·功能影响明显':''}`},'*')
```
Fields: `grade ∈ {未见明显,轻度,中度,重度}`, `score=ovPct`. Constant `name`.
(c) Old `tiers` were 25/33/42 (未见明显/轻微/中度/明显); new (a) drops the 33 split, (b) replaces it with 60.
**Mapping to 0–3**: postMessage 4-level: 0 (≤25), 1 (26–42), 2 (43–60), 3 (≥61). On-page 3-level: 0, 1, then 2/3 merged (≥43).
"Primary dimension": there is no ATT-wide 'attention' sub-score except type IN (专注与分心; `typeStat`) and IM/HY; the grade is a whole-instrument overall %.

## 2.8 Clinician / observation / materials / timing
No clinician input. Classroom and homework situations may need teacher knowledge (explicit "无法观察" escape). Teacher form needs a teacher (not realistic at home). Look-back windows 6 mo (P) / 3 mo (T).

## 2.9 Compare with old `sxk-att.ts`
- **Different questions.** Old: 5 sections × 8 = 40 items (CL/HW/HM/IP/SM), single-form parent version. New: 7 situations, 56 distinct item texts (48 P + 40 T with 32 shared), each tagged with 5 types. Exact verbatim matches of old texts in new: **0 / 40**. Many are close paraphrases or expansions (e.g. old "写到一半跑去做别的" vs new "做到一半就跑去做别的事" ratio 0.80; "东西随手放找不到" → "东西随手放，常找不到" 0.89; "无法预估完成一件事要多久" → "无法预估一件事要花多久" 0.87; "计划好的事情做不到" → "计划好的事情做不到或忘记" 0.86; "挫折后很难重新开始" → "受挫后很难重新开始" 0.89; "别人说话时没在听" → "别人跟他说话时像没在听" 0.84), but others are new (e.g. old "抄写时频繁抬头", "难以察觉别人的反应", "情绪一来就失控" have no counterpart).
- Section keys: CL, HW, HM, IP, SM same; new adds OU (P) and CA (T). Names same for the shared five. Per-item startMonth: old CL 48/HW 60/HM 36/IP 36/SM 48 per section; new default 48 for everything, 72 for 3 items per form (HW#3, SM#1, CA#8).
- Old preQuestion = duration (same four values lt3m/3to6m/gt6m/always vs new lt3/m3to6/gt6/always); same labels.
- Same 4 options. Old tiers 25/33/42, new 25/42 (page) or 25/42/60 (postMessage).
- Verdict: **different questions** (same instrument family and options, rewritten/expanded items).

## 2.10 Open questions
1. Which 4-level cut set (postMessage 25/42/60) vs 3-level page (25/42)?
2. Is the 0/46 vs 0/40 verbatim mismatch intended (client rewrote), so stored old answers cannot be re-used?
3. P-form "无法观察" for CL/HW at home: does the engine treat it as "not assessed"?
4. Teacher-only CA and parent-only HM/OU: engine needs per-form item sets.
5. Whether to expose the type cross-cut (IN/HY/IM/EF/ER) as dimensions.

---

# 3. SNAP-IV 评量表 · 森心康院内实施 完整版 (id `snap4`)

## 3.1 Title / version / age
- `<h1>` SNAP-IV 评量表 `森心康院内实施 · 完整版`; header "6–18 岁 · 26 题 · 家长版＋教师版 · 背景与功能 · 疗效追踪"; JSON `tool:'SNAPIV-SXK-FULL', version:'1.0'`. Two script blocks (data then logic).
- Source banner: SNAP-IV by James M. Swanson; Chinese version by 高淑芬; "题目、题序、选项与计分方式依中文版原文照录，仅由繁体转为简体"; copyright statement: free for clinical/research/education; **"如需对外散布或用于商业／电子产品，须另行取得作者许可"** (relevant to a commercial app).
- Age: **no hard block**. `outRange(m){return m<72||m>=216;}`; out of range shows a warning "仍可填写，但报告不套用参考点". Out of range → `level()` returns `{k:'年龄超出范围，不套用参考点',lv:0}` for everything (so postMessage grade would read 未见明显 for a 5-year-old with a high score; hub range is 72–216).

## 3.2 Rater forms
P 家长版 and T 教师版, same 26 items (`Q`) for both. At least one required; rater names required. **Cut points differ per form** (`REF`):
```
const REF={P:{IA:[1.2,1.8],HI:[1.2,1.8],OD:[1.2,1.8],note:'家长评分高于 1.2 提高「需要关注」的机率；高于 1.8 提高「ADHD 诊断」的机率。'},
           T:{IA:[1.8,null],HI:[1.2,null],OD:[1.2,null],note:'教师评分的过动冲动高于 1.2、注意力不足高于 1.8，提高「需要关注」的机率；教师评分未建立提高诊断机率的参考点。'}};
```
Format `[关注参考点, 诊断参考点]`. Source stated: Bussing et al. (2008) likelihood-ratio reference points. The page explicitly refuses the ">= 2.0" cutoff and "Tentative 5% Cutoffs".

## 3.3 Item structure
`SECS`: **IA 注意力不足** items 1–9 (`dsm:true`), **HI 过动与冲动** items 10–18 (`dsm:true`), **OD 对立违抗** items 19–26 (8). Total 26. No age or grade selection of items; all 26 asked for every child; all required (`nextForm`: "还有 N 题未作答").
Typical parent load: 26 items + 3 required context answers (settings, duration, plus preset selects).

## 3.4 Response options
`OPTS=[['完全没有',0],['有一点点',1],['还算不少',2],['非常的多',3]]`; instruction `INSTR='请选择一个代码，最能表达在过去的一个星期中，您孩子的状况。'` (past **one week**). No N/A. Higher = worse.

## 3.5 Non-item inputs
- Page 1 required selects: **目的** `PURPOSE` (init 初次评估 / track 疗效追踪), **用药** `MED` (none 未服用 / on 服药中药效有作用 / off 服药中但评分主要在药效外 / stop 曾服用已停药) — defaulted, can't be blank. Only affect text/follow-up comparison: `on` → rec "分数反映的是服药中的表现"; follow-up shows warning if previous med differs. Not scored.
- Page 2 "背景与功能" (not part of SNAP-IV): **SETTINGS** (required, multi: 家中/学校/其他场合), **DUR** (required: `lt6` 不到6个月 / `gt6` 6个月以上 — note only two values, different from AB/ATT), **ONSET** (`lt12` 12岁以前 / `ge12` / `unk` — optional, no default), **IMPACT** 4 rows × 0–3 (学业或学习 / 同伴关系 / 家庭关系 / 自信心与情绪; **optional**, defaults to 0 in report), **CHECKS** 5 rows (听力/视力/睡眠/情绪/学习能力或智力).
- DSM threshold `thr = S.months>=204?5:6` symptom-count threshold; symptom = item ≥2 (`sx`). "任一方评为症状" count `comb(key)` across forms. Both are report-only (DSM count table) — they do not change the level.
- "疗效追踪" = load previous JSON (`prevFile`) to compare subscale means; report-only.

## 3.6 Scoring (exact)
```
function sub(ans,s){const v=s.ids.map(id=>ans[id]).filter(x=>x!==undefined);const sum=v.reduce((a,b)=>a+b,0);
  return {sum,ari:v.length?sum/v.length:null,sx:s.ids.filter(id=>(ans[id]??0)>=2).length,n:s.ids.length};}
function level(fid,key,ari){ if(outRange(S.months))return {k:'年龄超出范围，不套用参考点',hex:'#8a9a93',lv:0};
  const p=REF[fid][key];
  if(p[1]!==null&&ari>p[1])return {k:'高于诊断参考点',hex:'#c0392b',lv:2};
  if(ari>p[0])return {k:'高于关注参考点',hex:'#d97b28',lv:1};
  return {k:'低于参考点',hex:'#2f9e68',lv:0};}
```
- Score per subscale = **average rating per item (ARI, 0.00–3.00)** (`sum/answered`), plus symptom count (items ≥2). Strict ">" comparisons (ARI == 1.2 is still "低于参考点").
- No total score across subscales; no combination of P and T (each form graded separately with its own REF).

## 3.7 Grading
(a) **On-page** (per form × subscale): 低于参考点 (lv 0) / 高于关注参考点 (lv 1) / 高于诊断参考点 (lv 2, parent only). For P: ARI ≤1.2 → 0; >1.2 → 1; >1.8 → 2. For T: IA >1.8 → 1; HI >1.2 → 1; OD >1.2 → 1; **teacher can never reach lv 2**. `anyHi = any subscale lv>0` → recommendation "建议转介儿童精神科或发育行为专科".
(b) **postMessage**:
```
const mxv=Math.max(...S.forms.flatMap(k=>SECS.map(s=>R[k][s.key].ari)));
const lvm=Math.max(...S.forms.flatMap(k=>SECS.map(s=>R[k][s.key].lv.lv)));
postMessage({sxkTool:1,id:'snap4',name:'SNAP-IV 评量表（完整版）',grade:['未见明显','轻度','中度'][lvm],score:+mxv.toFixed(2),
  note:S.forms.map(k=>FN[k]+' '+SECS.map(s=>s.name+R[k][s.key].ari.toFixed(2)).join('/')).join('；')},'*');
```
`grade ∈ {未见明显 (lvm 0), 轻度 (1), 中度 (2)}` — there is no 重度 level; `score` = maximum ARI over all subscales **including OD** and all forms (0–3 scale, 2 decimals). Note this includes 对立违抗, so an OD-only elevation still gives "轻度/中度".
(c) Old `.ts`: single `tiers` with 低于参考点 (<1.2), 高于关注参考点 (1.2–1.8), 高于诊断参考点 (>1.8) — i.e. parent REF only, no per-form distinction.
**Mapping to 0–3**: 0 = 低于参考点; 1 = 高于关注参考点; 2 = 高于诊断参考点 (parent form only). A "3" has no equivalent anywhere on the page; if the engine needs 3, the team must define it (e.g. both IA and HI above the diagnostic reference, or ARI ≥ some threshold) — not in client material. For the "attention" dimension, recommend using only IA and HI (not OD) from the parent form (REF P: 1.2/1.8); at home this is parent-only so lv max is 2.

## 3.8 Clinician / observation / materials / timing
No clinician input required, but the page says the 背景与功能 page is "由评估者与家长共同确认". Rating period is **the past 1 week** (shorter than the others). Teacher form can't realistically be done by the parent. Copyright caveat: free for clinical/research/education only; commercial/electronic distribution needs author's permission.

## 3.9 Compare with old `snap-iv.ts`
- **Same questions**: 26/26 item texts identical after normalising full-width `（）` → ASCII `()` (21 exact, the other 5 differ only in parentheses: items 3, 4, 6, 7, 18). Section keys IA/HI/OD, names 注意力不足/过动与冲动/对立违抗 and item→section mapping identical (1–9, 10–18, 19–26).
- Options: old 完全没有/有一点点/**蛮多的/非常多**; new 完全没有/有一点点/**还算不少/非常的多** (values 0–3 same).
- Old: no per-form refs (one `tiers` with 1.2/1.8); new: REF by form (teacher IA 1.8, HI/OD 1.2, no teacher diagnostic ref).
- New: P and T both available, background page, DSM counts, follow-up compare.
- Verdict: **same questions (wording of two option labels changed), different grading structure (per-form reference points)**.

## 3.10 Open questions
1. 3-level on-page vs no level 3: how should the engine's 3 be derived?
2. Include OD in the "primary dimension"? The postMessage does; the DSM mapping (IA/HI) does not.
3. Out-of-range ages: page grades everything "未见明显" but only because refs are suppressed — engine must respect the 6–18 limit itself.
4. Licensing: "须另行取得作者许可" for commercial electronic products; does the client hold it?
5. Past-week window: acceptable in a once-off app flow? Re-test cadence?

---

# 4. CHEXI 儿童执行功能量表 · 完整版 (id `chexi`)

## 4.1 Title / version / age
- `<h1>` CHEXI 儿童执行功能量表 · 完整版 `含官方完整计分表 ｜ 4–12 岁 ｜ 24 题 ｜ 家长版＋教师版`; JSON `tool:"CHEXI-SXK-F", ver:1`. **One** `<script>` block.
- Source: Thorell & Nyberg (2008), Chinese version Siu, A. F. Y.; free at www.chexi.se for researchers and clinicians; cut values from Catale, Meulemans & Thorell (2015) (8–11 yr sample). Footer: "如需对外散布或用于商业／电子产品，请先确认 www.chexi.se 所载的使用条款".
- Age: `refreshAge()` only shows a notice: `a.months<48||a.months>155` → "不在原量表的验证范围内，分界数值与对照表都不适用" (still can continue; `start()` has no age check). Report prints a warning box when out of range. Hub range: 48–156.

## 4.2 Rater forms
`FORMS`: **p 家长版**, **t 教师版**; tabs let one fill both; either alone is enough (`anyFilled`). **Same 24 items, same cut points for both** (no per-form reference). Rater name: not asked; instead `评估人员 *` (therapist/assessor) is a required field.
Which form drives the grade: `main = forms[0].k` = first filled form, parent first. With both filled, the factor bands/total band come from the parent form only; the teacher gets its own score table + comparison but not a graded headline and **not in postMessage**.

## 4.3 Item structure
24 items in original order (ITEMS 1–24), each with a subscale `sub`:
| sub | name | item ids | n | range (1–5 each) |
|---|---|---|---|---|
| wm | 工作记忆 | 1,3,6,7,9,19,21,23,24 | 9 | 9–45 |
| pl | 计划力 | 12,14,17,20 | 4 | 4–20 |
| rg | 调节力 | 2,4,8,11,15 | 5 | 5–25 |
| ib | 抑制力 | 5,10,13,16,18,22 | 6 | 6–30 |
Two factors (`FACTORS`): **F1 "工作记忆" = wm+pl (13 items, 13–65)**, **F2 "抑制力" = rg+ib (11 items, 11–55)**. No age/grade filtering: always 24 items per form; all must be answered for any form that has at least one answer ("还有 N 题未作答").

## 4.4 Response options
`OPTS`: 1 完全不正确 / 2 不正确 / 3 部分正确 / 4 正确 / 5 完全正确. **1–5 scale; higher = more difficulty** ("分数越高代表困难越多"). No N/A. Total range 24–120. (Engine must subtract 1 per item if it wants 0-based.)

## 4.5 Non-item inputs (森心康补充, none scored)
- `CTX` (optional selects): 睡眠 (充足规律/偶尔不足/经常不足或入睡困难), 每天屏幕时间 (4 options), 目前用药 (未用药/正在用药/曾用药已停), 已有诊断 (无/ADHD/学习障碍/孤独症谱系障碍/其他), 目前接受的疗育 (7 options), 填写时孩子近期状态 (与平常差不多/近期特别辛苦/近期比平常好). Only trigger notice boxes (poor sleep, atypical state, on medication).
- `SITU` 7 daily situations (早上出门, 课堂上课, 写作业, 收拾与保管物品, 转换活动, 团体与同伴, 情绪起伏后) × `SITULV` 4 levels (没有影响 / 偶尔要提醒 / 经常需要大人介入 / 几乎每天都出状况). Optional, text only ("最需要处理的情境" = the two highest levels). Parent can answer.
- Goals (3 free text) and 给家长与老师的交代 (plan text) — clinician-oriented planning fields; optional.
- Required on page 1: child name, DOB, test date, **评估人员**.
- 评估目的, 转介来源, 就读年级 optional; previous-record loading for comparison.

## 4.6 Scoring (exact)
```
subSum(fk,k) = sum of raw 1–5 over the items of subscale k
subMean = Math.round(subSum/n*100)/100       // chart/report only
facSum(fk,f) = sum of subSum of f.subs
total(fk)   = sum of all 24 items (24–120)
```
Plain raw sums; no standardisation. Missing answers count as 0 in sums, but `finish()` blocks incomplete forms so sums are always complete.

## 4.7 Grading
(a) **On-page bands** — two schemes, both "原计分表照录":
1. **Factor bands** (`FACTORS[].cut`, first `min` the sum reaches, best→worst):
   - F1 工作记忆 (wm+pl): 正常范围 0–28, 少部分问题 29–34, 明显问题 ≥35.
   - F2 抑制力 (rg+ib): 正常范围 0–32, 少部分问题 33–39, 明显问题 ≥40.
   (Page text: "因素「工作记忆」29 分以上为少部分问题、35 分以上为明显问题；因素「抑制力」33 分以上为少部分问题、40 分以上为明显问题 … 一个分界数值的例子 … 并非普遍适用的常模".)
2. **Total-score table** (`PRTAB`, last row whose `raw <= total`): raw→PP/PR→class:
   34→PP5 (PR 5) 正常范围; 40→10 (11) 正常; 43→20 (20) 正常; 45→30 (29) 正常; 47→40 (43) 正常; 48→50 (49) 正常; 50→60 (59) 正常; 52→70 (70) 需要注意; 55→80 (81) 需要注意; 58→90 (90) 需要注意; 73→100 (>99) 明显问题. Below 34 = "低于对照表，落在正常范围". So 正常范围 = ≤51, 需要注意 = 52–72, 明显问题 = ≥73.
Both apply the same way to the teacher scores (`scoreTable(fk)` for each filled form), although the source sample is not described as teacher-rated.
Subscale-level: no bands; only single-item means for charts. Item-level: items ≥4 listed as "评为正确以上的题目".
(b) **postMessage**:
```
var f1=facSum(main,FACTORS[0]),f2=facSum(main,FACTORS[1]);
window.parent.postMessage({sxkTool:1,id:"chexi",name:val("f_name"),
 grade:facBand(FACTORS[0],f1).key+"／"+facBand(FACTORS[1],f2).key,score:t0,
 note:"CHEXI 完整版　工作记忆 "+f1+"／抑制力 "+f2+"　总分 "+t0},"*");
```
`grade` is a **composite string** "<F1 band>／<F2 band>" (each ∈ {正常范围, 少部分问题, 明显问题}); `score` = total (24–120); **`name` = the child's name (PII)**, not the tool name; no `window.parent!==window` guard (inside try). The total-score PR class (需要注意 etc.) is **not** sent.
(c) Old `.ts` tiers 相对较低 ≤33 / 中等 34–66 / 相对偏高 ≥67 (percentile-style) exist in neither scheme above.
**Mapping to 0–3**: both bands are 3-level (正常=0, 少部分问题/需要注意=1 or 2, 明显问题=3). Since the real-world scheme has only 3 levels, the 0–3 conversion needs a decision (suggest 0 / 1 / 3 or 0 / 2 / 3). Natural rule for engine: grade each factor, take the worse of F1 and F2 (the postMessage string has to be split on "／").

## 4.8 Clinician / observation / materials / timing
No clinician input; "评估人员" is just a required text. Instruction: answer for the child's usual behaviour ("平常"), no timeframe. Free to use for clinicians/researchers per author; commercial use needs checking terms. CHEXI is a rating scale only.

## 4.9 Compare with old `chexi.ts`
- **Same questions**: all 24 items present with identical `sourceNo`→subscale membership (wm 9, pl 4, ib 6, rg 5; same item ids). Old text is **Traditional** (`難以記住…`), new is **Simplified**; after OpenCC t2s conversion, 15 items are byte-identical, 6 more differ only in whitespace/ASCII-vs-full-width parentheses/slash (items 9, 12, 14, 18, 10, 22), 2 differ only by the `著/着` conversion quirk (items 7, 24), and 1 genuinely differs by one character: item 4 old "給予獎勵" vs new "给与奖励".
- Options identical (1–5, same labels). Old section order wm/pl/ib/rg, new data order wm/pl/rg/ib. Old section names 工作记忆/计划力/抑制力/调节力 — same.
- Grading: old `tiers` 33/66-style (相对较低/中等/相对偏高) vs new factor bands + total PRTAB: different.
- Verdict: **same questions (simplified script), different grading**.

## 4.10 Open questions
1. Which of the two on-page schemes feeds the engine (factor bands vs total-score table)? They disagree in granularity (factor-level 3 classes vs total-level 3 classes with different names: 少部分问题 vs 需要注意).
2. 3→4 level conversion.
3. Teacher-rated vs parent-rated: the cut-offs come from a single sample; page itself says "不自行加设任何切分值" and defers to a professional — a no-clinician product is using cut-offs the author says need professional validation.
4. postMessage sends the child's name; do not forward.
5. Commercial-use terms of www.chexi.se.
6. 评估人员 required text — what do we put for a parent self-run?

---

# 5. SXK-LDP 森心康学习障碍量表 · 完整版 (id `ldp`)

## 5.1 Title / version / age
- `<h1>` 森心康学习障碍量表 · 完整版 `SXK-LDP 完整版 ｜ 一年级–高三 ｜ 七面向 80 题 ｜ 家长版＋教师版`; JSON `tool:"SXK-LDP-F", ver:1`; one `<script>`.
- **Selection is by grade, not age**: `GRADES=["一年级","二年级","三年级","四年级","五年级","六年级","初一","初二","初三","高一","高二","高三"]`, `gradeNum()` 1–12. DOB is optional and only shown (实足年龄), never validated. Required: name, test date, grade, **评估人员**. No age limit in code. Hub: 72–215 months, labelled 小学版 though the file covers grade 1–12 (the hub description says "一年级到高三皆可用").
- Engine consequence: an age→grade mapping must be supplied by the integrator.

## 5.2 Rater forms
`FORMS`: **p 家长版** (最近三个月在家中与写作业时的表现), **t 教师版** (课堂与作业). **Same 80 items for both, same cut points**. Either alone suffices; both → combined = mean.

## 5.3 Item structure
Items: `{t, g (min grade), x? (max grade)}`. Global item number `no` is cumulative over all 80 (stable across grades), so answers are keyed by fixed number. `inGrade(it,g)=g>=it.g&&(!it.x||g<=it.x)`.
| key | name | total items |
|---|---|---|
| RD | 识字与朗读流畅 | 12 |
| RC | 阅读理解 | 10 |
| WR | 书写与抄写 | 12 |
| WE | 书面表达与组织 | 11 |
| MA | 数学与数感 | 12 |
| LG | 口语与语言处理 | 11 |
| AT | 注意力、记忆与学习组织 | 12 |
Min-grade distribution: g1 = 35 items (4 with a max grade x=4 or 5: RD#1 "认读拼音…" x4, MA#1 "数数不稳…" x4, LG#3 "分辨相近的音" x5, LG#6 "背儿歌" x5), g2 = 15, g3 = 15, g4 = 5, g5 = 2, g7 = 4.
Items applicable by grade: 一年级 **39**, 二 54, 三 69, 四 74, 五 74, 六 72, 初一–高三 **76** (per-section counts in each grade computed; e.g. 一年级: RD8 RC2 WR7 WE0 MA6 LG9 AT7). Parent answers 39–76 items; a section can be empty (WE at grade 1).

## 5.4 Response options
`OPTS`: 从未 0 (没有出现) / 偶尔 1 (每月一两次) / 经常 2 (每周好几次) / 总是 3 (几乎每天). Frequency-anchored (3-month look-back). Higher = worse. No N/A; instruction: "若某题的情境还没遇过（例如尚未学到的内容），请勾「从未」" (scored 0, biasing the % downward). Every applicable item of a started form must be answered.

## 5.5 Non-item inputs
- **ACAD** (optional selects): 语文表现 / 数学表现 (前段/中段/后段/明显落后), 每天写作业时间, 目前课后协助, 学校已做过的调整; 目前最困扰的学习问题 (text). Text only.
- **EXCL** (7 selects, "必填" but soft: `start()` only `confirm`s if blank): 视力, 听力, 就学连续性, 教学语言与家庭语言, 整体发展, 情绪与重大生活事件, 读写教学机会; each has a `bad` option list (e.g. 视力 "检查·未通过／未矫正", "超过一年未检查", "从未检查"). `bads`/`blanks` → warning "本次结果不能用来推论成因" and per-factor notes; **does not change the %/band**. Parent can answer most (medical-exam history).
- **DX** (8 checkboxes: ADHD, 语言障碍／语言发育迟缓, 孤独症谱系障碍, 智力障碍／边缘智力, 感觉统合失调, 癫痫…, 情绪或行为障碍, 其他) — "影响解读，不影响计分".
- **FLAGS** (8 red flags): 家族史, 学前语言迟缓史, 已留级, 拒学, 情绪困扰, 能力退步, 视力或听力尚未确认, 已针对读写加强但没进步. Any ticked → red alarm box "与分数高低无关"; recommendation text for `emo`/`ref`. Not scored.
- Required: 学生姓名, 施测日期, 年级, **评估人员** (a therapist field; parent run must fill something).
- 就读学校, 评估目的, 转介来源, 性别, 出生日期 optional.

## 5.6 Scoring (exact)
```
domPct(fk,key): its = ITEMS in section; ansd = answered; Math.round(sum/(ansd.length*3)*100)   // null if none answered
totPct(fk):     same over all answered applicable items
combinedDom(key): mean of domPct over forms that have any answer, Math.round
combinedTot():    mean of totPct over forms with any answer, Math.round     // "困难指数"
```
So: percent of maximum ("困难指数"), P and T averaged (not max). A section with zero applicable items has `pct` null.

## 5.7 Grading
(a) **On-page `LEVELS`** (4 levels, `band(p)`: first with `p>=min`), best→worst:
| key | % |
|---|---|
| 未见明显 | <17 (0–16) |
| 轻微 | 17–33 |
| 中等 | 34–49 |
| 显著 | ≥50 |
(page text "17% 以下 未见明显　17–33% 轻微　34–49% 中等　50% 以上 显著"). Applied to the overall `combinedTot()` and per-section `combinedDom`. Section notes, "型态分析" (RD vs RC gap ≥15, language vs writing, AT vs others) are descriptive.
(b) **postMessage**:
```
window.parent.postMessage({sxkTool:1,id:"ldp",name:val("f_name"),grade:bd.key,score:tot,note:"SXK-LDP 完整版 整体困难指数 "+tot+"%"},"*")
```
`grade ∈ {未见明显, 轻微, 中等, 显著}` = same as (a) overall; `score = combined %`; **`name` = child's name**; same grade string as page. Only overall, not per-section.
(c) Old `.ts`: raw-score tiers on 30 items (total ≤9 / 10–19 / 20–29 / ≥30; section ≤4 / 5–8 / 9–12 / ≥13) vs the new %-based. Not comparable.
**Mapping to 0–3**: direct, 4 levels: 未见明显=0, 轻微=1, 中等=2, 显著=3. Per-section bands exist (same cuts) so per-dimension grading is possible, e.g. RD/RC/WR/WE/MA/LG/AT map to reading/writing/math/language/attention.

## 5.8 Clinician / observation / materials / timing
Teacher form needs a teacher; school-based items need teacher view if the parent can't see. 3-month look-back. EXCL needs awareness of vision/hearing tests (parent can answer from records). No materials. 评估人员 text required (clinician-oriented).

## 5.9 Compare with old `sxk-ldp.ts`
- **Different structure, mostly overlapping questions**: old = 5 sections × 6 = 30 items (read/math/write/attn/lang; "小学版"), no grade filter. New = 7 sections, 80 items, grade-filtered, 12 grades.
- Old items found verbatim in new: **27 / 30**; 2 near-identical (old "认读拼音时容易出错，掌握得不牢" → "认读拼音容易出错，掌握得不牢"; old "阅读时容易漏字、跳行…" → "朗读时漏字、跳行…"); 1 reworded (old "口头说得清楚，写出来的作业却差很多" → new WE#1 "书写作业的水平比口头表达差很多").
- Old sections read → new RD+RC, write → WR (+WE), math → MA, attn → AT, lang → LG; new adds WE and splits read.
- Options identical (从未/偶尔/经常/总是 0–3). Old had no grade gate.
- Old tiers raw (9/19/29), new % (17/34/50).
- Verdict: **old 30 items ⊂ new 80 (27 exact); grading different; much more content; grade-gated.**

## 5.10 Open questions
1. Age→grade mapping rule (country school entry age, grade skipping/repeating).
2. Section vs overall grading — which feeds which dimension? AT section duplicates attention content.
3. Averaging P and T hides disagreement; at home only P exists.
4. Items for grade 1 "尚未学到的内容请勾从未" → floor bias.
5. The hub labels LDP as 小学版 but the file has full grade 1–12; duplicates LDS for 初中+.
6. Required 评估人员 field.
7. EXCL answers are not used in scoring — should "bad" exclusions cap or annotate the grade?

---

# 6. SXK-LDS 森心康学习障碍量表 · 中学完整版 (id `lds`)

## 6.1 Title / version / age
- `<h1>` 森心康学习障碍量表 · 中学完整版 `SXK-LDS 完整版 ｜ 初一–高三 ｜ 七面向 84 题 ｜ 学生自陈＋家长＋教师`; JSON `tool:"SXK-LDS-F", ver:1`; one `<script>`.
- Grade select limited to `GRADES=["初一","初二","初三","高一","高二","高三"]`, `GNUM={初一:7,…,高三:12}`. No age check. Hub: 144–215 months (12–17y11m). Required: name, test date, grade, 评估人员.

## 6.2 Rater forms
`FORMS`: **s 学生自陈版** (default `cur:"s"`; "请想想下面每一句，是不是在说你自己最近三个月的情况"), **p 家长版**, **t 教师版**. All three use **identical item text** (neutral-subject statements), identical options, identical cut points. Any subset (≥1). "中学阶段学生自陈是必要的一环".
Combination: `combinedTot()` = mean of `totPct` over all filled forms (student, parent and teacher weighted equally). Extra: `otherTot()` = mean of P and T only; compared with student in "学生自己怎么看": difference ≥15 points → note.

## 6.3 Item structure
| key | name | items |
|---|---|---|
| RD | 识字与阅读流畅 | 12 |
| RC | 阅读理解与学科阅读 | 12 |
| WR | 书写与抄写速度 | 12 |
| WE | 书面表达与作文组织 | 12 |
| MA | 数学与数量推理 | 12 |
| LG | 语言处理与外语学习 | 12 |
| EF | 学习组织、时间管理与考试策略 | 12 |
`g` (min grade): 74 items at g7 (初一), 7 at g8, 3 at g10 → applicable by grade: 初一 **74**, 初二/初三 **81**, 高一–高三 **84**. No max-grade (`x`) usage. Cumulative item numbering `no` as in LDP.
(Note LDS section 7 is **EF 学习组织** replacing LDP's AT; `LG` includes foreign-language.)

## 6.4 Response options
Same as LDP: 从未/偶尔/经常/总是 = 0/1/2/3 with frequency glosses (每月一两次 / 每周好几次 / 几乎每天), 3-month look-back. No N/A; no "未学过请勾从未" sentence in LDS. Higher = worse.

## 6.5 Non-item inputs
- **ACAD** (7): 语文/数学/英语表现, 每天写作业时间, 课后协助, 学校已做调整, 升学方向; text 目前最困扰的学习问题.
- **EXCL** (**8** selects — adds 睡眠 and 学习机会 vs LDP's 7; "读写教学机会" renamed 学习机会): 视力, 听力, 就学连续性, 教学语言与家庭语言, 整体发展, 情绪与重大生活事件, 睡眠, 学习机会. Same soft-required/`bad` logic; not scored.
- **DX** (8; includes 学习障碍／读写困难（已鉴定）, 焦虑或抑郁, 睡眠障碍) – not scored.
- **FLAGS** (9): fam, early (小学阶段就有读写吃力记录), lang, hold, ref, emo, drop (成绩明显下滑), fail, **exam** (面临升学考试, shows extra text about 考试调整需要正式鉴定报告). Not scored.
- 评估目的 includes "申请考试调整的佐证", "升学／转衔评估"; 转介来源 includes "学生自己提出".

## 6.6 Scoring (exact)
Same functions as LDP (`domPct`, `totPct`, `combinedDom`, `combinedTot`), `Math.round(sum/(n*3)*100)`; combined = mean of forms. `otherTot` extra.

## 6.7 Grading
(a) Same `LEVELS` as LDP: 未见明显 <17, 轻微 17–33, 中等 34–49, 显著 ≥50 (text differs slightly). (b) postMessage:
`postMessage({sxkTool:1,id:"lds",name:val("f_name"),grade:bd.key,score:tot,note:"SXK-LDS 中学完整版 整体困难指数 "+tot+"%"},"*")` — grade ∈ the four band names, score = mean % across forms, name = child's name. (c) Old `.ts` raw tiers (9/19/29 total; 4/8/12 section) differ.
**Mapping to 0–3**: direct 4-level (0/1/2/3), identical to LDP.

## 6.8 Clinician / observation / materials / timing
Student self-report needs a teenager who reads independently; teacher form needs a teacher; the self-form is described as essential. Else same as LDP (3-month look-back, exclusion info from records). 评估人员 required.

## 6.9 Compare with old `sxk-lds.ts`
- **Different questions**: old 30 items (5 sections read/math/write/attn/lang × 6, "国高中版"); new 84 items (7 sections). Verbatim matches **0 / 30**; closest paraphrases: "读得慢，考试常常来不及看完题目" ↔ "阅读速度明显比同学慢，考试常读不完题目" (ratio 0.59), "课堂上讨论得很好，写出来的作业却差很多" ↔ "口头说得清楚，写出来差很多" (0.50), "很难开始动手写作业，习惯拖到最后" ↔ "开始写作业困难，一再拖延" (0.50), "写字慢，课堂上的板书抄不完" ↔ "书写速度慢，考试写不完" (0.42), "老师口头交代的事情或课堂重点记不住" ↔ "记不住口头交代的事情" (0.52). Same themes, rewritten.
- New: student self-report form, grade-gated items, 8 exclusion factors, flags, three-source comparisons.
- Options same; tiers raw vs %.
- Verdict: **different questions** (same instrument concept), different grading.

## 6.10 Open questions
1. Age→grade mapping (LDS only 初一–高三; hub says ≥144 months).
2. Do we expose the student self-report and with what overlap/weighting? Mean across forms gives a 1:1:1 average.
3. LDP vs LDS: which one for grade 7–12 (both are valid, with different items: LDP 76 vs LDS 74–84)?
4. 8 exclusion factors incl. 睡眠 — can drive a "pause/annotate" rather than a grade.
5. postMessage includes child name.

---

# Cross-tool cheat sheet for the engine

| tool | form(s) | items typical | age/grade gate | combine | best 4-level source | levels (best→worst) | notes |
|---|---|---|---|---|---|---|---|
| SXK-AB | P, T, Y (≥11y) | P 29/41/48 (36–47/48–59/≥60 mo) | 36–192 mo hard | max across forms of whole-form % | postMessage: ≤33 / 34–50 / 51–70 / ≥71 | 未见明显 / 轻度 / 中度 / 重度 | page itself has only 3 levels (33/50) |
| SXK-ATT | P, T | P 46/48, T 37/40 | 48–180 mo hard | max across forms | postMessage ≤25 / 26–42 / 43–60 / ≥61 | 未见明显 / 轻度 / 中度 / 重度 | page has 3 levels (25/42); P-only N/A for CL/HW |
| SNAP-IV | P, T | 26 | 72–215 flagged, not blocked | none (each form separate) | ARI vs per-form REF | 低于参考点 (0) / 高于关注参考点 (1) / 高于诊断参考点 (2, P only) | no level 3; postMessage 未见明显/轻度/中度; includes OD; past 1 week; license caveat |
| CHEXI | p, t | 24 | 48–155 notice only | first filled form (parent) | factor sums F1 (29/35) F2 (33/40); total table 52/73 | 正常范围 / 少部分问题 (需要注意) / 明显问题 | 1–5 scale; postMessage grade = "F1band／F2band" string; name PII; license caveat |
| SXK-LDP | p, t | 39–76 by grade | grade 1–12, no age check | mean of forms | page=postMessage: <17 / 17–33 / 34–49 / ≥50 | 未见明显 / 轻微 / 中等 / 显著 | per-section bands possible; 评估人员 required; name PII |
| SXK-LDS | s, p, t | 74–84 by grade | 初一–高三, no age check | mean of forms | same as LDP | same | 8 exclusion factors; name PII |

Old-vs-new verdicts: AB = same questions (48/48), different grading, +T/Y forms; ATT = different questions (0/40 verbatim); SNAP-IV = same questions (26/26 modulo full/half-width parens; 2 option labels changed), per-form refs new; CHEXI = same questions (24/24, Traditional→Simplified, 1 char variant), different grading; LDP = 30 old items inside 80 new ones (27 verbatim), different structure and grading; LDS = different questions (0/30 verbatim), different grading.

Cross-cutting caveats found:
- postMessage in CHEXI, LDP, LDS sends `name: <child's name>`; AB/ATT/SNAP send constant tool names.
- `grade` strings are free text; "轻度/中度/重度" (AB, ATT) vs "轻微/中等/显著" (LDP/LDS) vs "少部分问题/明显问题" (CHEXI) are different vocabularies.
- Four of six declare "评估人员/评估者" fields (CHEXI, LDP, LDS required; AB, ATT optional "评估者／编号"; SNAP optional) — wording presumes a clinician.
- SNAP-IV and CHEXI copyright/terms limit commercial electronic distribution without author permission.
