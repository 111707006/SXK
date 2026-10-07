# R3 survey, group 2: SXK-ASQ3 / M-CHAT-R/F / SXK-VOC / SXK-ASB / SXK-ASR / SXK-QOL (2026-09-23 "完整版")

Source: `scratchpad\kitfull\森心康评估工具包_完整版\网页版\*.html` (read as text only; nothing executed).
Local ASCII-named copies used for reading: `scratchpad\r3-survey\src\{asq3,mchat,voc,asb,asr,qol}.html`.
Old versions compared: `C:\AI project\SXK-main\src\t2\toolkit\{sxk-asq,mchat-rf,sxk-voc,sxk-asb,sxk-asr}.ts`.

All six files have two `<script>` blocks. Block 1 is pure data (`const DOMAINS/SETS/...`, `Object.assign(window, {...})`), block 2 is the logic. Each file has exactly one `postMessage` call, inside `renderReport()`, wrapped in `try{ if(window.parent&&window.parent!==window){...} }catch(e){}`. Every payload has the shape `{sxkTool:1, id, name, grade, score, note}`.

## 0. Cross-tool summary (read this first)

| Tool | Who can fill at home | Age gate the page enforces | On-page levels (best to worst) | postMessage `grade` values | Natural 0-3 mapping |
|---|---|---|---|---|---|
| SXK-ASQ3 | Parent, fully | None enforced (warns only; set defaults to the 3-month set; dropdown can be overridden) | 4: 未见明显问题 / 轻微落后 / 中度落后 / 明显落后 (achievement % >=85 / 70 / 55 / <55), per domain and overall | 未见明显 / 轻度 / 中度 / 重度 (same 85/70/55 cuts on total %) | Direct: 0,1,2,3 per domain and overall |
| M-CHAT-R/F | Stage 1 parent only. Stage 2 is an interviewer flow | 16-30 mo is advisory only (warning, not blocked) | Stage 1: 低风险 0-2 / 中等风险 3-7 / 高风险 8-20; stage 2: 阴性 (fails 0-1) / 阳性 (fails >=2) | 未见明显 / 边缘 / 轻度 / 中度 / 重度 (five values; see 7b) | Stage 1 alone: 0-2 to 0, 3-7 to 1 or 2, 8-20 to 3. With stage 2: negative to 0 or 1, positive to 2 or 3 |
| SXK-VOC | Parent (A and C by checkbox; B word list by tap) | 8-42 mo (on corrected age) blocked in `start()` | 3: 发展中符合预期 / 部分项目待加强 / 建议进一步评估 | 未见明显 / 轻度 / 中度 (never 重度) | 3 levels only. 0,1,3 or 0,1,2 (see 7c) |
| SXK-ASB | Parent form (P) only. Teacher form (T) and therapist form (O) not at home | 18 mo to 15 y (180 mo) blocked in `start()`; T form blocked under 24 mo | 3: 未见明显 (<=22%) / 部分行为需留意 (<=40%) / 建议专业评估 (>40%); any regression forces level 3 | 未见明显 / 轻度 / 中度 / 重度 (cuts 22/40/60; regression forces 中度) | The postMessage 4-way scheme is the only one that yields 4 values |
| SXK-ASR | **No.** Therapist-observed, "不建议家长自行填写" | 24 mo to 15 y blocked in `start()` | 3: 未见明显 (<=20%) / 部分表现需留意 (<=38%) / 建议专业评估 (>38%); regression forces level 3 | 未见明显 / 轻度 / 中度 / 重度 (cuts 20/38/60; regression forces 中度) | Same as ASB, but needs a therapist |
| SXK-QOL | Parent form (P) at home; child self-report form (C) from age 5 | 24 to 227 mo (2-18 y) blocked in `start()` | 4: 未见明显 (0-28%) / 轻微 (29-36%) / 中度 (37-45%) / 明显 (>=46%). Higher % means worse | 未见明显 / 轻度 / 中度 / 重度 (same four levels); `score` is inverted (100 - distress%) | Direct: 0,1,2,3, but the dimension is quality of life, not a developmental domain |

Key points for the integration spec:
1. **Only ASQ3 and QOL have a native 4-level grade on the page.** VOC, ASB and ASR have 3 on-page levels. M-CHAT has 3 bands plus a binary stage-2 result.
2. **ASB and ASR have a hidden 4th cut at 60% that exists only in the postMessage payload**, not on the page. VOC's payload never emits 重度.
3. **The new ASQ3 is a different tool structure from the old one.** There are 21 age sets of 30 items, scored 10/5/0, whereas the old one was one 30-item set scored 2/1/0. The old items are almost exactly the new 30-month set (section 1, part 9).
4. **M-CHAT-R/F: the questions are identical** to the old tool (Simplified vs Traditional only). What is new is the full 20-flow stage-2 follow-up interview and the postMessage grade mapping.
5. **VOC: the 30 milestone items are identical to the old tool**, with identical start months. What is new is section B (362-word checklist) and section C (gestures or sentences). The grade cuts differ (old 85/70/55 four-tier vs new 80/60 on the A section).
6. **ASB: new = old 57 items plus 6 added items, with some rewording.** ASR is **restructured** from 15 items in 4 sections to 24 items in 5 domains, plus 8 observation activities.
7. **QOL is new.** The page's postMessage uses `id:'pedsql'` even though the disclaimer says it is not PedsQL.

---

## 1. SXK-ASQ3 森心康分龄发育综合评估 · 完整版

### 1. Title, version, age range
- `<h1>`: 森心康分龄发育综合评估, `<small>`: SXK-ASQ3 完整版. Internal tool id: `SXK-ASQ3-FULL`, export `version:'1.0'`. Header text: "3 个月 ～ 5 岁 6 个月 · 21 个月龄题组".
- Declared range: 2 months 16 days to 66 months (`SETS[0].lo=2.5`, `SETS[20].hi=66.05`).
- Enforcement: **soft only.** `pickSet(dec)` is `SETS.find(s=>dec>=s.lo&&dec<s.hi)||null`. If it returns null, `showAge()` only prints a warning notice. It does not block, and it does not update `#f_set`. `#f_set` is a `<select>` whose first option is the 3-month set and which the user can change manually ("必要时可手动改"). `start()` requires only name, dob, test date and rater, then reads `+$('f_set').value`. **An out-of-range child can therefore be scored against a wrong set.** An integration must enforce the age gate itself.
- Preterm correction: `calcAge()` computes `corr` only if `ga&&ga<37&&months<24`. It uses `totalDays=months*30+d-(40-ga)*7`. `useMonths()` returns the corrected months, used for set pick, overall questions and red-flag band.

### 2. Rater forms
- One form only. The `f_rel` dropdown (父亲/母亲/其他主要照顾者/幼儿园老师/治疗师/其他) is metadata and changes nothing in the items or scoring.
- A parent at home uses it as is.

### 3. Item structure
- `DOMAINS` (5): `cm` 沟通, `gm` 粗大动作, `fm` 精细动作, `ps` 解决问题, `so` 个人社交. Each has 6 items per set, so **30 items per set**.
- `SETS` has 21 age sets, selected by age (not per item): id = label months: 3, 4, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36, 42, 48, 54, 60. Ranges (months, `[lo,hi)`): 3:[2.5,3.5) 4:[3.5,5) 6:[5,7) 8:[7,8.5) 9:[8.5,9.5) 10:[9.5,11) 12:[11,13) 14:[13,15) 16:[15,17) 18:[17,19) 20:[19,21) 22:[21,23) 24:[23,25.5) 27:[25.5,28.5) 30:[28.5,31.5) 33:[31.5,34.5) 36:[34.5,39) 42:[39,45) 48:[45,51) 54:[51,57) 60:[57,66.05).
- There is **no basal/ceiling and no per-item start month.** Items within a set run easy to hard.
- Typical item count: **30 at every age** (12 mo: set 12; 36 mo: set 36; 60 mo: set 60), plus:
  - `OVERALL` (9 yes/no questions, `hear, see, move, walk, talk, feed, regress, family, worry`), filtered by `!o.min || um>=o.min` (move >=3 mo, walk >=15 mo, talk >=18 mo). At 12 mo: 7 questions (hear, see, move, feed, regress, family, worry). At 36 and 60 mo: 9.
  - `RED_BANDS` flag checklist: 7-8 checkboxes for the child's band (5 bands: 3-6 mo [7 flags], 7-12 mo [7], 13-24 mo [8], 25-42 mo [8], 43-66 mo [8]; band lookup uses corrected months).
- Sets 27 and 30 share 5 of 6 `ps` items and 5 of 6 `so` items (near-duplicates).

### 4. Response options
- Items (`buildItems`): `[[10,'已经会'],[5,'偶尔会'],[0,'还不会']]`. No N/A. Every item is mandatory (`finish()` blocks if any `S.ans` is undefined).
- OVERALL: `yes`/`no` (是/否) plus an optional free-text note. Each question has `warn:'no'` or `warn:'yes'`, the answer that counts as a concern.
- Flags: unchecked/checked boxes.

### 5. Non-item inputs
| Input | What it asks | Affects grade? | Parent can answer? |
|---|---|---|---|
| `OVERALL` (9 yes/no) | hearing, vision, symmetry of limbs, heel-walking, intelligibility, feeding, regression, family history, worry | No effect on the % or the level. Feeds `refer` flag if answer equals `warn` AND id in `['hear','see','regress','move']` | Yes |
| `RED_BANDS` flags | age-banded warning signs ("有就勾"), first item in every band is 能力倒退 | Any ticked flag sets `refer` (recommend referral) regardless of % | Yes |
| `f_ga` | gestational weeks | Corrects age (<24 mo) | Yes |
| `f_note` | clinical note | No | n/a |

### 6. Scoring
```js
function domScore(k){let got=0,n=0;for(let i=0;i<6;i++){const v=S.ans[k+i];if(v!==undefined){got+=v;n++;}}return {got,n,max:60,pct:Math.round(got/60*100)};}
// renderReport:
const tot=st.reduce((x,y)=>x+y.sc.got,0), totPct=Math.round(tot/300*100), tl=levelFor(totPct);
```
- Domain: sum of the 6 item scores (0-60), `pct = round(got/60*100)`.
- Overall: sum over 5 domains (0-300), `totPct = round(tot/300*100)`.
- No age-norm lookup. Percent achievement only.

### 7. Grading
(a) On-page bands (`LEVELS`, best to worst, applied by `levelFor(p)` = `LEVELS.find(l=>p>=l.min)`):
- 未见明显问题 `min:85`
- 轻微落后 `min:70`
- 中度落后 `min:55`
- 明显落后 `min:0`
Applied to each domain's pct and to the total pct. Footer text "≥85% / 70–84% / 55–69% / <55%".

(b) postMessage payload (verbatim):
```js
const g=totPct>=85?'未见明显':totPct>=70?'轻度':totPct>=55?'中度':'重度';
window.parent.postMessage({sxkTool:1,id:'asq3',name:'森心康分龄发育综合评估（完整版）',grade:g,score:totPct,note:`${s.label}题组／`+worst.slice(0,2).map(x=>x.d.name+x.sc.pct+'%').join('／')},'*');
```
- `grade` in {未见明显, 轻度, 中度, 重度}; `score` = total pct 0-100; `note` e.g. "30 个月题组／沟通62%／解决问题70%" (two worst domains). **Only the overall grade is sent, not per-domain grades.** Per-domain levels exist only in the on-page table.

(c) Other scheme: `refer` flag (adds "建议转介评估" to the verdict):
```js
const refer=flagged.length>0||ovWarn.some(o=>['hear','see','regress','move'].includes(o.id))||st.some(x=>x.sc.pct<55);
```
It is not part of the postMessage grade. The 0-3 mapping is direct: 未见明显=0, 轻微=1, 中度=2, 明显=3, per domain and overall. The domain keys match the five existing dimensions (cm/gm/fm/ps/so), so a per-domain grade can be computed from the stored answers even though the payload carries only the overall.

### 8. Clinician / observation / materials
Nothing required. Items are written for the parent's recall of everyday behaviour ("依孩子平常、自发的表现勾选"). No materials, no timing. Several items imply the child did something specific (draw a diamond, skip) which a parent may only be able to judge by asking the child to try. Not a hard requirement.

### 9. Comparison with old `sxk-asq.ts`
- Old: id `sxk-asq`, title 森心康三岁综合筛查量表, 5 sections `CO/GM/FM/PS/PE` (name 个人社会) x 6 items = 30 items, `startMonth` 30/33/36, options `2/1/0` (labels identical), tiers 85/70/55 (identical cuts, identical names).
- New: 5 domains `cm/gm/fm/ps/so` (name 个人社交), 21 sets x 30 items, options **10/5/0**.
- Item overlap (checked all 30): old GM (6/6), FM (6/6), PS (6/6), PE (6/6) are word-for-word the new **30-month set** (`SETS` id 30). Old CO: 3 of 6 are identical to the 30-month set (会说三到四个词的句子, 能依两步骤指令行动, 会用「我」称呼自己), 1 is a slightly different wording of it (能说出刚发生的事 vs 会说出刚发生的事（简单的）), and 2 are not in the 30-month set (会问「这是什么」 is in the 27-month set; 别人大致听得懂他说的话 is in the 33-month set).
- So the old tool was effectively the 30-month page with the `startMonth` labels 30/33/36 sprinkled on. The new 36-month and 42-month sets are different items.
- **Verdict: same question structure and same grading logic and cut points, but a different item bank (21 sets vs 1), different score scale (x5).** If the engine stores raw 0-2 item scores, the new data are 0/5/10; the percentage is unaffected. The tier names and cuts are identical, so a percent-based grade is directly comparable. Item-level comparison across sets is not possible.

### 10. Open questions
- Which set should the engine serve for a 36-42 month child (36: [34.5,39), 42: [39,45))? The old tool's content is closest to the 30-month set.
- No age gate in the page: engine must enforce 2.5-66 months.
- Preterm correction (<24 mo) uses 30-day months and weeks-of-gestation only; confirm engine will reuse its own correction.
- `OVERALL`/`RED_BANDS` are not in the payload. Decide whether any of them (regression, hearing) should lift the grade like `refer` does on the page.

---

## 2. M-CHAT-R/F 改良版婴幼儿自闭症筛查表（附后续问题修订版）简体版 · 完整版

### 1. Title, version, age range
- `<h1>`: 改良版婴幼儿自闭症筛查表（附后续问题修订版）, `<small>`: M-CHAT-R/F™ 简体版 · 完整版. Tool id `MCHAT-RF-SXK-FULL`, version `'1.0'`. Header: "16–30 个月 · 第一阶段 20 题＋第二阶段 20 份完整流程图".
- Source credit on page: © 2009 Robins, Fein & Barton; Chinese translation 俞励恒 and 李健豹; converted Traditional to Simplified by OpenCC; "本档仅供森心康院内使用；如需对外散布或用于商业／电子产品，须另行取得作者许可". **This is a licence flag for the product.**
- Age check: `showAge()` shows a warning if months <16 or >30 ("此月龄不在验证范围内；仍可记录，但结果不宜用于判定风险"). **Not blocked.** `start()` has no range check. `renderReport()` shows `out` notice only.

### 2. Rater forms
One form, "填表家长". Stage 1 is written for the parent. Stage 2 is a structured interview run by an interviewer ("访问者"). The page has a `施测人员` field.

### 3. Item structure
- Stage 1: `Q` has 20 items `{id, risk:'yes'|'no', t}`. No age gating, no sets, always 20.
- Stage 2: `FU` has 20 flowcharts keyed "1".."20", each `{start, nodes:{...}}`. A flow is only run for stage-1 items answered with the risk answer, only when stage 1 total is 3-7.
- Risk-direction: `risk:'yes'` for items 2, 5, 12 (answering 是 is the risk). All other items risk = 否 (`ALGO` text: "除了第 2、5 和 12 题外，所有问题回答为「否」表示具有自闭症谱系障碍的风险").

### 4. Response options
- Stage 1: 是/否 only, stored `'yes'`/`'no'`. No N/A. All 20 required (`score1()` blocks).
- Stage 2 node types: `ask` (named option buttons that route to next node), `ex` (checklist of example behaviours, each answered with labels such as 是/否 or 会/不会 or 有/没有; routed by counts), `r` (result `pass`/`fail`).
- Routing modes for `ex` nodes: default (`onlyPass/onlyFail/both/none`), `countFail2` (item 12: 2 or more "是" among negative-reaction triggers goes to next, otherwise pass), `countPass` (items 14 and 15: >=2 yes = pass; exactly 1 = item 14 asks more / item 15 fails; 0 = fail).

### 5. Non-item inputs
| Input | What it asks | Affects grade? | Parent alone? |
|---|---|---|---|
| `f_concern` (shown on the result screen) | "医护人员或家长是否对儿童患上自闭症谱系障碍有担心？" 否/是 | Does not change stage-1 total or stage-2 result. **Changes `refer`** (always refer if 是) and the postMessage grade for low-risk children (`'边缘'`) | Yes |
| Stage-2 flows | Follow-up interview for each risk item | Yes: 2+ fails = positive | Mostly no, see 8 |
| `f_doc`, `f_org`, `f_rel` | metadata | No | n/a |

### 6. Scoring
```js
function isRisk(q,v){return v===undefined?false:(q.risk==='yes'?v==='yes':v==='no');}
function risky(){return Q.filter(q=>isRisk(q,S.a[q.id]));}
function total(){return risky().length;}
function bandOf(n){return BANDS.find(b=>n>=b.lo&&n<=b.hi)||BANDS[2];}
function score1(){ ... if(b.k==='中等风险'){S.stage2=true; ... buildFU();go(2);} else {S.stage2=false;S.fu={};renderReport();go(3);} }
function fuFails(){return risky().filter(q=>S.fu[q.id]&&S.fu[q.id].res==='fail').length;}
// renderReport
const nf=fuFails(), done=S.stage2&&rs.every(q=>S.fu[q.id]&&S.fu[q.id].res); const pos=S.stage2&&done?nf>=2:null;
```
- Stage 1 score = number of risk answers, 0-20.
- Stage 2 only if stage-1 band is 中等风险 (3-7). Stage-2 positive = `nf>=2` where nf = number of risk items whose flow ended at `fail`. Score 8+ skips stage 2 ("可以跳过后续问题，立即转介").

### 7. Grading
(a) On-page `BANDS` (best to worst): 低风险 0-2, 中等风险 3-7, 高风险 8-20. Plus the stage-2 verdict: 阴性 (nf 0-1) / 阳性 (nf>=2). Text for 低风险: "假若儿童小于 24 个月，需在他/她两岁的时候再次筛查" (rescreen at 2 y if <24 mo).

(b) postMessage payload (verbatim):
```js
const g=pos===true?'中度':b.k==='高风险'?'重度':b.k==='中等风险'?(pos===false?'未见明显':'轻度'):(concern?'边缘':'未见明显');
window.parent.postMessage({sxkTool:1,id:'mchat',name:'M-CHAT-R/F 婴幼儿自闭症筛查（完整版）',grade:g,score:n,note:`第一阶段 ${n} 分（${b.k}）`+(S.stage2&&done?`／后续不达标 ${nf} 项 → ${nf>=2?'阳性':'阴性'}`:'')+(concern?'／有临床担心':'')},'*');
```
- Possible `grade` values: 中度 (stage-2 positive), 重度 (stage-1 >=8), 未见明显 (medium + stage-2 negative, or low risk without concern), 轻度 (medium risk, stage 2 not completed), 边缘 (low risk but concern = 是). `score` = stage-1 total (0-20).
- **Oddity: a stage-2-positive child gets 中度 but a stage-1 >=8 child (no follow-up) gets 重度.** `边缘` is a grade value not used by any of the other five tools. In the payload `pos===true` is checked first, so a child who scored 3-7 and was positive is 中度, never 重度.
- **If a parent at home cannot run stage 2, a medium-risk child gets `轻度` (not completed), which is not the same as a confirmed positive.**

(c) Natural 0-3 map: stage-1 only: 0-2 to 0, 3-7 to 1 (or 2 if a conservative stance is wanted when stage 2 can't run), 8-20 to 3. With stage 2: negative to 0 (page text says no action, rescreen later), positive to 2 (or 3, since the guidance is "强烈建议尽快转介"). `concern=是` is an override to "referral regardless of score".

### 8. Clinician / interviewer
- Stage 1 is fine for a parent alone.
- Stage 2 is explicitly an interview ("访问者", `FU_INSTR`: "根据流程图来询问问题，直到得出「达标」或「不达标」的结论... 家长在访问中回答问题时可能会答「可能」。当家长答「可能」，就问最经常是「是」还是「否」... 回答中有出现「其他」的可能，访问者必须以他/她的判断来决定"). Specifically:
  - Five flows have a `judge` node that asks the **interviewer** to decide pass/fail when the parent answered 否 to both sides: items **1, 10, 11, 12, 16**.
  - Item 18 node n2 is "访问者判断" of whether the parent's example proves comprehension without gestures.
  - Many `ex` lists include "其他（请描述）" free-text example options (items 3, 5, 9, 15, 17, 20, among others) that need judgement.
  - Items 2, 18-n3, and some `ask` nodes record answers that **do not affect pass/fail** (e.g. item 2 hearing-test questions, item 18 n3 where both answers go to fail).
- A parent could self-answer the `ask` and `ex` questions, but the `judge` nodes and the "其他" nodes would need either a parent-facing rewording or a default rule.

### 9. Comparison with old `mchat-rf.ts`
- Old: Traditional Chinese, `options` yes/no, 20 items with the same `riskAnswer` (no for all, yes for 2, 5, 12), tiers 低風險 0-2 / 中等風險 3-7 / 高風險 8-20, one pre-question `concern` (醫護人員或家長是否對兒童患上自閉症譜系障礙有擔心？). **No stage-2 content in the old file.**
- Spot-checked all 20 item texts (old Traditional vs new Simplified). All 20 are the same sentences character-for-character apart from script conversion (e.g. 指著/指着, 吸塵機/吸尘机, 傢俱/家具, 搖來搖去/摇来摇去, 蹦跳). **Hong Kong wording is kept** in both: 子女, 毛公仔, 小食, 洋娃娃, 匙羹 (stage 2). The "毯" in item 18 (把毯拿给我) was converted without being localised. A mainland-China parent may find 子女/毛公仔/小食/匙羹 unfamiliar.
- **Verdict: same questions (identical wording), same bands. New content = the 20 stage-2 flows, which were not captured by the old extractor, and the postMessage grade mapping.**

### 10. Open questions
- Licence: the page states it is for 森心康院内使用 only and requires author permission for "电子产品". Needs a business decision before embedding in a parent app.
- Stage 2 without an interviewer: decide the default for `judge` nodes and "其他" nodes, or skip stage 2 and output "中等风险, 需后续访谈".
- What grade should "concern = 是" give if the score is 0-2? The page's payload uses `边缘`; the engine has no equivalent.
- The page does not block <16 or >30 months. Engine should (the page says the result is not valid there).

---

## 3. SXK-VOC 森心康 0–3 词汇量检核表 · 完整版

### 1. Title, version, age range
- `<h1>`: 森心康 0–3 词汇量检核表, `<small>`: SXK-VOC 完整版. Tool id `SXK-VOC-FULL`, `version:'1.0'`. Header: "8～42 个月 · 里程碑＋词汇清单＋手势／句子".
- Enforced in `start()`: `if(a.use<8||a.use>42){alert('超出适用范围（8～42 个月）');return;}`, where `a.use` is the **corrected** months (preterm <37 wk and <24 mo: `days=months*30+d-(40-ga)*7`, `use=Math.floor(days/30)`).

### 2. Rater forms
One form, parent ("填表人／与孩子关系"). The `f_lang` dropdown (只有普通话 / 普通话＋方言 / 普通话＋外语) changes nothing in scoring; it adds a report remark ("请把各语言会说的词合并计算").

### 3. Item structure
Three parts:
- **A 语言里程碑** (`MILE`, 3 sections x 10 items = 30): `V1` 理解词汇, `V2` 表达词汇, `V3` 词类广度. Each item is `[text, startMonth]`. An item is asked only if `S.months>=m` (`aItems()`); sections whose items all start later show "本次不检核".
  Start months — V1: 8,10,10,15,15,15,18,18,18,20. V2: 9,14,16,17,18,21,24,24,30,33. V3: 14,18,18,20,20,20,26,30,30,30.
  Typical A item counts (corrected months): **12 mo: 4** (V1: 3, V2: 1, V3: 0). 18 mo: 17. 24 mo: 24. **36 mo: 30.** 60 mo: out of range.
- **B 森心康词汇清单** (`VOCAB`): 20 categories, **362 words** (I counted: snd 12, ani 24, veh 10, toy 12, food 30, clo 14, body 20, home 16, obj 26, out 18, ppl 18, soc 18, verb 50, adj 32, time 10, loc 12, num 10, pro 10, q 12, part 8; no word appears twice). Each category has `type`: `n` nouns (12 cats), `v` verbs (1), `a` adjectives (1), `f` function words (6). Shown to all ages.
- **C**: under 18 months (`S.months<18`): `GEST`, 18 gesture/communication behaviours (checkboxes). 18 months or older: `GRAM`, 12 phrase/sentence items, each `[text, startMonth]` (18, 20, 22, 26, 26, 26, 26, 30, 33, 33, 33, 33), asked only if `months>=startMonth`; plus 3 free-text "最长的三句话".
- So at 12 mo a parent answers: 4 A items + 362-word list + 18 gestures. At 36 mo: 30 A items + 362 words + 12 grammar items + 3 sentences. The 362-word list is the longest part and **is not mandatory** (a word not tapped is "not known").

### 4. Response options
- A items: `[[2,'已经会'],[1,'偶尔会'],[0,'还不会']]`. No N/A. All applicable items required (`nextA()` blocks).
- B words: tap cycle: 0 (none) to 1 (听懂) to 2 (会说) back to none (`cyc`: `nv=(v+1)%3`). "会说的词一定算听懂".
- B extras: free text, one word per line, counted as spoken.
- C gestures: checkbox true/false. C grammar: `1` 会 / `0` 还不会 (both required where applicable, `finish()` blocks when age >=18).

### 5. Non-item inputs
| Input | What it is | Affects grade? | Parent alone? |
|---|---|---|---|
| Word list B | 听懂/会说 per word | **Yes**: total spoken words `t.s` drives the flags | Yes |
| `extra` words | extra spoken words | Yes (added to `t.s` and `t.u`) | Yes |
| `GEST` count (<18 mo) | number of gestures ticked | Yes: flag if `g<6&&M>=12` | Yes |
| `GRAM[0]` (two-word combos, >=18 mo) | `two` | Yes: flag if M>=24 and not yet | Yes |
| Sentence samples | `mlu()` max length | Yes: flag if M>=30 and longest <3 words | Yes (parent recalls) |
| `f_lang`, `f_ga` | background | No (ga corrects age) | Yes |

### 6. Scoring
```js
function secA(s){const li=aItems().filter(x=>x.s===s);let got=0,n=0;li.forEach(x=>{if(S.m[x.id]!==undefined){got+=S.m[x.id];n++;}});return {n:li.length,got,max:li.length*2,pct:li.length?Math.round(got/(li.length*2)*100):null};}
// renderReport
let got=0;its.forEach(x=>got+=S.m[x.id]||0);const aPct=its.length?Math.round(got/(its.length*2)*100):0;const aLv=levelFor(aPct);
function totals(){... u (list+extra), s (list+extra) ...}
```
- A-section achievement = `got / (applicable items x 2)` as a percent. Per milestone section (V1/V2/V3) a pct too, but sections with <3 items are flagged "题数偏少仅供参考".
- Word counts `t.u` (understood, includes spoken) and `t.s` (spoken). Not converted into a standard score or percentile; the `REF` table is display only.

### 7. Grading
(a) On-page `LEVELS` (best to worst): 发展中符合预期 `min:80`, 部分项目待加强 `min:60`, 建议进一步评估 `min:0`. **Final level is not just the A percent.** Verbatim:
```js
const flags=[]; // 6 conditional flags:
if(M>=24&&t.s<50)flags.push('24 个月以上表达词汇少于 50 个');
if(M>=24&&two===false)flags.push('24 个月以上还不会把两个词组起来');
if(M>=18&&M<24&&t.s<10)flags.push('18～23 个月表达词汇少于 10 个');
if(M<18&&g!==null&&g<6&&M>=12)flags.push('12 个月以上手势与沟通行为少于 6 项');
if(secA(MILE[0]).pct!==null&&secA(MILE[0]).pct<60)flags.push('理解词汇里程碑达成率偏低 ...');
if(M>=30&&ml&&ml.max<3)flags.push('30 个月以上最长句子不到三个词');
const level=flags.length>=2||aPct<60?LEVELS[2]:flags.length===1||aPct<80?LEVELS[1]:LEVELS[0];
```
(b) postMessage (verbatim):
```js
const gr=level===LEVELS[0]?'未见明显':level===LEVELS[1]?'轻度':'中度';
window.parent.postMessage({sxkTool:1,id:'vocab',name:'森心康 0–3 词汇量检核表（完整版）',grade:gr,score:aPct,note:`表达 ${t.s} 词／理解 ${t.u} 词／里程碑 ${aPct}%`},'*');
```
- Values: 未见明显 / 轻度 / 中度 only. **Never 重度.** `score` is the A-section percent, **not** the thing that determined the grade (flags also do). Word counts only reach the engine inside `note`, as text.

(c) Other: `REF` literature reference points at 12/15/18/24/30/36 months (understood and spoken counts), explicitly "不是本表的常模，也不是切分值". No numbers come from it.

Natural 0-3 map: three levels give 0 / 1 / 2 (the top is "建议进一步评估" which is also the payload's `中度`). If the engine needs 3 to mean "markedly concerning", the page never says so. A late talker at >=24 mo with <50 spoken words and no two-word combos has 2 flags so is at the top level. A possible rule is to use 3 when `flags>=2` and `aPct<60` (both), but that is an engine choice not in the source.

### 8. Clinician / observation / materials
Nothing. Parent only. The word list is long (362 taps); it is a recall task, not an observation.

### 9. Comparison with old `sxk-voc.ts`
- Old: `V1/V2/V3`, 10 items each, `startMonth` as in the new file, options `2/1/0`, tiers **85/70/55** (未见明显问题 / 轻微落后 / 中度落后 / 明显落后), no pre-questions.
- Spot check: all 30 items identical text and identical start months (e.g. V1 听到自己的名字有反应 8, V2 会说五十个以上的词 24, V3 会说数字或数量词 30, V2 会说三个词的句子 33, V1 听得懂家中常见地点 20, V3 会说方位词（上面、里面） 30, V2 会用声音表达需求 9, V3 会说动作词 20, V1 能指认身体部位 18, V3 会说日常用品的名称 18, V2 会说第一个有意义的词 14).
- **Verdict: same questions for the A part (all 30). Different grading** (old 4 tiers at 85/70/55; new 3 levels at 80/60 plus flag logic). **New parts**: B word list (362 words), C gestures/phrases. The old extractor captured only A.
- The age range was 8-42 months of the new page; the old file recorded no explicit gate beyond start months.

### 10. Open questions
- Which of the new parts should the engine take? If only A, the new level logic (flags) is unavailable. If B/C, then ~400 more taps per child on a phone. Decide whether to ask a short word-count question instead.
- `S.months` for A items uses corrected months (floor); the engine's own age rule may differ.
- The payload never sends 重度; ok if the dimension is capped at 2, but then a 24-month child with 5 words gets the same grade as one with 45.
- Multilingual homes: the page tells the parent to merge words across languages.

---

## 4. SXK-ASB 森心康自闭行为量表 · 完整版

### 1. Title, version, age range
- `<h1>`: 森心康自闭行为量表, `<small>`: SXK-ASB 完整版. Tool id `SXK-ASB-FULL`, `version:'1.0'`. Header: "18 个月～15 岁 · 家长版 63 题＋老师版 30 题＋治疗师观察 13 项". (The code comment on line 120 says 家长版 61 题; the real count is **63**, which matches the header.)
- Enforced in `start()`: `if(a.months<18||a.months>180){alert('超出适用范围（18 个月～15 岁）');return;}` and `if(S.months<24&&S.sel.T){alert('未满 24 个月不做老师版...')}`. `showAge()` for <18 mo says "请改用预警征象筛查（SXK-WARN）".
- No preterm correction.

### 2. Rater forms (`FORMS`)
- `P` 家长版: 0-3 frequency, items from `PQ`. **This is the one for a parent at home.**
- `T` 老师版: 0-3 frequency, 30 items from `TQ`; for >=24 mo, in daycare/school.
- `O` 治疗师直接观察: 13 items from `OBS`, 0-2, requires a therapist interacting 20-30 min.
- A session picks any of the three with `sel` checkboxes, each needing a rater name. At least one required.

### 3. Item structure (P form; 5 sections, 63 items, each `[text, core, minMonth=18 default]`)
- Sections (`SECS`): `SE` 感觉反应 (12), `RE` 人际关系 (17), `BO` 身体与动作 (11), `LA` 语言沟通 (12), `SH` 自理与适应 (11).
- Per-item minimum month: `items(fid)` keeps an item if `S.months>=(m||18)`. Items with later minimums: RE (24: 对同龄的孩子没有兴趣, 不玩假装游戏; 30: 不会主动分享有趣的事; 36: 很难与同龄孩子建立关系, 对表情或语气的变化不敏感), LA (24: 很少主动开口说话; 30: 声调平板, 你我他混用, 说的内容与情境无关, 反复问同样的问题, 常自言自语或重复广告台词; 36: 对话无法维持来回; 48: 听不懂比喻或玩笑, 用词过于正式或特别), SH (36: 如厕训练明显困难, 学习穿脱衣物明显困难, 对某个主题的兴趣特别强烈、狭窄).
- **P-form item count by age** (I counted from the arrays): 18 mo: 46. 24 mo: 49. **36 mo: 61.** 48-60 mo: **63** (all). 12 mo: not usable (<18).
- T form: 30 items fixed (SE 6, RE 7, BO 5, LA 6, SH 6), no age gating. O form: 13 items.
- Core-facet tag per item: `A` 社会沟通与互动, `B` 局限重复行为与感觉, `O` 相关表现. Within P (full 63): A=24, B=29, O=10. These do not map to the five sections.

### 4. Response options
- P and T: `OPTS=[['很少或没有',0],['偶尔',1],['经常',2],['总是',3]]`. No N/A. All applicable items required (`nextForm()` blocks).
- O: `OBSOPTS=[['符合年龄预期',0],['有些不同',1],['明显不同',2]]`. No N/A.

### 5. Non-item inputs
| Input | Asks | Affects grade? | Parent alone? |
|---|---|---|---|
| `REGRESS` (4 checkboxes: 语言, 社交, 游戏, 自理) plus "没有出现倒退" | regression of skills; **mandatory** (`next1()` blocks until one is chosen) | **Yes: any regression forces level 3 (建议专业评估) and payload grade 中度**; "这一题不计入分数" | Yes |
| `f_regwhen` | when/how it happened | No | Yes |
| `CHECKS` (6: 听力检查, 视力检查, 发育评估, 语言评估, 遗传或代谢检查, 脑电图) with 3 states: 未做 / 已做，正常 / 已做，有异常 | previous tests | No effect on score; changes recommendation text (听力 未做 triggers the hearing advice) | Yes (parent knows) |
| `COMORB` (8 checkboxes: 睡眠问题, 进食问题, 肠胃问题, 抽搐或疑似癫痫, 多动或注意力问题, 明显焦虑或恐惧, 攻击行为, 自伤行为) | co-occurring issues | No (report text only) | Yes |
| `f_fam` (没有/有/不确定), `f_strength`, `f_school`, `f_ref`, `f_concern` | background | No | Yes |
| `obsctx` | observation setting | No | n/a (O form) |

### 6. Scoring
```js
function stat(fid,li){const mx=FORMS[fid].max;let sum=0;li.forEach(x=>sum+=S.ans[fid][x.id]||0);const max=li.length*mx;return {n:li.length,sum,max,pct:max?Math.round(sum/max*100):null,hi:...};}
function secStat(fid,s){...}  function formStat(fid){return stat(fid,items(fid));}  function coreStat(fid,c){...}
function mx(arr){...Math.max(...)}   // max of non-null
// renderReport
const qPct=mx(qForms().map(k=>fs[k].pct)); const oPct=S.sel.O?fs.O.pct:null;
let lv=levelFor(mx([qPct,oPct])); if(reg.length)lv=LEVELS[2];
```
- Per section and per form: `pct = round(sum / (n x max) x 100)` where max = 3 for P/T, 2 for O. "关切程度" (degree of concern) is the label.
- Overall = the **highest** pct among the filled forms (P, T and O). A parent-only session gives the P-form pct.
- A and B core percents: `cA`, `cB` = max over forms of the core pct. `bothCore = cA>22 && cB>22`.

### 7. Grading
(a) On-page `LEVELS` (`levelFor(p)` = `LEVELS.find(l=>p<=l.hi)`), best to worst:
- 未见明显 `hi:22`
- 部分行为需留意 `hi:40`
- 建议专业评估 `hi:100`
Section-level colouring thresholds are the same 22/40. Footer says "≤22% / 23–40% / ≥41%".

(b) postMessage (verbatim):
```js
const sc=mx([qPct,oPct]);const g=reg.length?'中度':sc<=22?'未见明显':sc<=40?'轻度':sc<=60?'中度':'重度';
window.parent.postMessage({sxkTool:1,id:'sxkasb',name:'森心康自闭行为量表（完整版）',grade:g,score:sc,note:(reg.length?'有能力倒退·':'')+`A ${cA??'—'}%／B ${cB??'—'}%`},'*');
```
- `grade` in {未见明显, 轻度, 中度, 重度}; `score` = overall % (0-100). **Regression forces 中度 even when % <= 22, and also caps the payload at 中度 for children who would otherwise be 重度 (reg takes precedence, `reg.length?'中度':...`).** The 60% cut exists only here (not on the page).

(c) Other: the A/B core split (>22% on both gives the "优先转诊" message). Not in the payload except inside `note`.

Natural 0-3 map: the postMessage 4-way mapping is the only 4-level one: <=22 to 0, 23-40 to 1, 41-60 to 2, >60 to 3. On-page 3 levels would be 0 / 1 / 2-or-3. Regression: page treats as top level (3 on-page); payload gives only 中度, so a regression-only child would be 2 under payload mapping and 3 under page mapping. **Decide which.**

### 8. Clinician / observation / materials
- P form: none. A parent can fill it. Instruction: "依孩子最近三个月的实际表现，按行为出现的频率作答，... 并与同年龄的孩子比较".
- T form needs a teacher; O form needs a trained therapist, a 20-30 min structured/free-play interaction, with the child present (observation prompts like "在他专心玩时从侧后方叫名字 2–3 次").
- The report text explicitly says not to tell parents any diagnostic conclusion.

### 9. Comparison with old `sxk-asb.ts`
- Old: sections SE (12), RE (12), BO (11), LA (12), SH (10) = **57 items**, no `startMonth`, options 0-3 with identical labels, tiers 未见明显 0-22, 轻微 23-31, 中度 32-40, 明显 41-100 (four tiers), pre-question `regression` with 3 options (none/language/social).
- New P form: **63 items** (SE 12, RE 17, BO 11, LA 12, SH 11), 4-option regression (语言/社交/游戏/自理), per-item min months, core tags A/B/O, plus T and O forms.
- Spot check (>10 items): 对声音过度反应或完全无反应 (old) vs 对声音过度反应或完全没有反应 (new); 对疼痛反应异常 vs 对疼痛的反应异常（过强或几乎没有）; 喜欢闻或舔非食物的东西 vs 喜欢闻或舔不是食物的东西; 对食物质地极度挑剔 vs 对食物的质地极度挑剔; 对呼唤没有反应 vs 叫他的名字没有反应; 不会主动分享有趣的事 vs 不会主动分享有趣的事 (same text, now min 30); 把大人当工具使用（拉手去拿） vs 把大人当工具使用（拉大人的手去拿东西）; 踮脚走路 vs 踮着脚尖走路; 动作协调明显笨拙 same; 重复问同样的问题 vs 反复问同样的问题; 情绪爆发强烈且难安抚 vs 情绪爆发强烈，而且很难安抚; 进食种类极度受限 same; 出现自伤行为 same. **Same intent, lightly reworded.**
- Added in new P: RE +5 (不会用手指指东西给你看, 你指着远处的东西时他不会顺着看过去, 不会把东西拿过来给你看, 对同龄的孩子没有兴趣, 不玩假装游戏) and SH +1 (对某个主题的兴趣特别强烈、狭窄). 57 + 6 = 63.
- **Verdict: same questions (re-worded) plus 6 new items; different grading** (4 old tiers vs 3 on-page levels vs 4 payload levels; cut 31 gone, cut 60 introduced only in the payload). Because wording is not identical, stored old answers cannot be reused item-for-item without a mapping.

### 10. Open questions
- 63 vs 57 items: which does the engine use? Items with a min month of 36 or 48 mean a parent of a 60-month-old sees all 63, which is long on a phone.
- Regression: page = top level; payload = 中度. Which should the engine follow?
- The page says an `O` form and `T` form exist; with no clinician, only P is usable, so the "overall = max of forms" logic collapses to P alone.
- ASB overlaps with M-CHAT for 16-30 months; the page itself recommends M-CHAT-R at that age ("此月龄另建议由专业人员施测 M-CHAT-R").
- Comment/header mismatch: line 120 says 61, header says 63, real count 63.

---

## 5. SXK-ASR 森心康社交沟通行为量表 · 完整版

### 1. Title, version, age range
- `<h1>`: 森心康社交沟通行为量表, `<small>`: SXK-ASR 完整版. Tool id `SXK-ASR-FULL`, `version:'1.0'`. Header: "24 个月～15 岁 · 治疗师结构化观察 · 8 项观察活动＋5 领域 24 项评定".
- Enforced in `start()`: `if(a.months<24||a.months>180){alert('超出适用范围（24 个月～15 岁）');return;}`. `f_lang` (目前语言程度) is required.

### 2. Rater forms
**One form: therapist.** The page says "本表由受过训练的治疗师在约 30–45 分钟的结构化观察后评定，不建议家长自行填写". `f_disc` lists 言语治疗/作业治疗/临床心理/发育行为医师/其他. **A parent at home cannot use this tool as designed.** Only section C (家长访谈补充) is answerable by a parent.

### 3. Item structure
- `A` 观察活动 (`ACTS`): 8 activities (自由游戏, 呼名, 共同注意, 提出要求, 轮流游戏, 假装游戏, 图书共读, 结束与转换), each a checkbox "完成" plus a short note. **Not scored.**
- `B` 行为评定 (`SECS`, 5 domains, 24 items; each `[text, core, [anchor0..anchor3]]` with four behavioural anchors):
  - `SA` 社会互动 (core A): 6 items.
  - `CM` 沟通 (core A, but item cores are mixed): 6 items: 语言的量与结构 (O), 语言的社交用途 (A), 仿说与刻板用语 (B), 手势与表情 (A), 对话来回与回应提问 (A), 理解他人的话语 (O).
  - `PL` 游戏与想象 (core A): 3 items.
  - `RB` 重复行为与兴趣 (core B): 5 items.
  - `ER` 情绪与调节 (core O): 4 items.
  - Core split over the 24 items: A=12, B=6, O=6.
- 整体临床印象 (`GI`, 4 anchors, not scored, but required).
- No age gating of items: all 24 are asked at any age (age is only a range gate). The anchors say "依年龄与语言程度判断".
- Items at 24 / 36 / 60 mo: 24 each (12 mo: not allowed).

### 4. Response options
- `OPTS=[['与年龄相符',0],['轻度不同',1],['中度不同',2],['明显不同',3]]` with a custom 4-sentence anchor per item. Every item also has an extra label **不适用／未能观察（不计分）** stored as `'na'`.
- N/A scoring: `stat()` takes only `typeof S.ans[x.id]==='number'`. N/A items are removed from numerator and denominator (`max = sc.length*3`). If more than 12 of the 24 are N/A (`ITEMS.filter(x=>S.ans[x.id]==='na').length>12`), `finish()` refuses ("结果无法解读，请延长或重新安排观察").
- If a whole domain is N/A it shows "全部不适用" and `pct` is null.

### 5. Non-item inputs
| Input | What it asks | Affects grade? | Parent alone? |
|---|---|---|---|
| `REGRESS` (4 checkboxes) plus "没有出现倒退" (mandatory in `next1()`) | skill regression, from the parent | **Yes: forces `LEVELS[2]`** and payload `中度` | Yes (an interview question) |
| `CHECKS` (4: 听力检查, 视力检查, 发育评估, 语言评估; 未做/正常/异常) | tests done | No (affects recommendation text only) | Yes |
| `f_cons` (今天表现跟平常在家比：差不多/今天比平常好/今天比平常差) | parent's view | No grade effect; adds a "可信度提醒" bullet | Yes |
| `f_home` | home behaviours not seen today | No | Yes |
| `f_state` (平常/疲倦/身体不适/明显不配合), `f_lang`, `f_mins`, `f_who` | observation context | No grade effect; produce reliability notes (`rel`) | Therapist |
| `ACTS` | 8 observation activities done? | No (reliability note only) | Therapist, with toys |
| `GI` 整体临床印象 | overall impression | **Not in the score** ("不计入分数"); shown on report | Therapist |

### 6. Scoring
```js
function stat(li){const sc=li.filter(x=>typeof S.ans[x.id]==='number');let sum=0;sc.forEach(x=>sum+=S.ans[x.id]);return {n:sc.length,na:li.length-sc.length,sum,max:sc.length*3,pct:sc.length?Math.round(sum/(sc.length*3)*100):null};}
function overall(){return stat(ITEMS);}   function coreStat(c){...}   function secStat(s){...}
```
- Domain pct = scored sum / (scored items x 3). Overall pct = the same over all 24. Core A and core B pct likewise. GI and activities do not enter any sum.

### 7. Grading
(a) On-page `LEVELS` (`levelFor(p)=LEVELS.find(l=>p<=l.hi)`), best to worst: 未见明显 `hi:20`, 部分表现需留意 `hi:38`, 建议专业评估 `hi:100`. Regression forces the top level. Footer: "≤20% / 21–38% / ≥39%". (An all-N/A overall `pct` of null compares as 0, so it would land at 未见明显, though `finish()` blocks that case.)

(b) postMessage (verbatim):
```js
const g=reg.length?'中度':ov.pct<=20?'未见明显':ov.pct<=38?'轻度':ov.pct<=60?'中度':'重度';
window.parent.postMessage({sxkTool:1,id:'sxkasr',name:'森心康社交沟通行为量表（完整版）',grade:g,score:ov.pct,note:(reg.length?'有能力倒退·':'')+`A ${cA.pct??'—'}%／B ${cB.pct??'—'}%`},'*');
```
- Same pattern as ASB, with cuts 20/38/60. The 60% cut exists only in the payload; regression caps at 中度.

(c) Other: cA/cB >20 triggers the "两大核心面向都偏高" message (not in payload except `note`).
Natural 0-3 map: payload scheme: <=20 to 0; 21-38 to 1; 39-60 to 2; >60 to 3.

### 8. Clinician / observation / materials
Fully clinician-based. Needs: toys (cars, blocks, dolls, tableware, books), a hidden/closed-container desirable item, bubbles or a ball, picture book; 30-45 minutes of structured play; the rater judges eye contact, joint attention, name response, imitation, pretend play, transitions. Parent cannot do this at home. A parent could contribute section C only.

### 9. Comparison with old `sxk-asr.ts`
- Old: **15 items in 4 sections**: `SC` 社交与沟通 (5: 与人的关系, 模仿能力, 情绪反应, 语言沟通, 非语言沟通), `SN` 感觉反应 (3: 视觉, 听觉, 味嗅触觉), `BH` 行为与适应 (4: 身体运用, 物品运用, 对改变的适应, 活动量水平), `GN` 情绪与整体 (3: 紧张与恐惧, 能力发展的均匀度, 整体印象). Four anchors per item, 0-3, tiers 未见明显 0-20, 轻微 21-29, 中度 30-38, 明显 39-100. Pre-question regression with 3 options.
- New: **24 items in 5 domains** (SA, CM, PL, RB, ER) with 6 observation activities more and an N/A option and GI.
- Spot check of wording: old 对改变的适应 anchors "换活动或换环境时能顺利转换 / 需要预告或多一点时间才能转换 / 对改变明显抗拒，转换时容易情绪起伏 / 常规被打断即强烈崩溃，难以恢复" vs new 固执于常规与抗拒改变 "能顺利接受活动或环境的改变 / 需要预告或较长时间转换 / 对改变明显抗拒，转换时情绪起伏 / 常规被打断即强烈崩溃，难以恢复" (reworded). Old 模仿能力 "会自发模仿动作与说话，与年龄相当 / 简单动作能模仿，复杂一点的需要提示 / 要反复示范并给予协助才模仿得出来 / 极少模仿他人的动作或声音" vs new 模仿（动作与声音） "会自发模仿动作与声音 / 简单动作能模仿，复杂的需要提示 / 需反复示范与协助才模仿 / 几乎不模仿". Old 活动量水平 anchors 0-3 equal new 活动量与参与度 anchors 0-3 in meaning, reworded. Old 与人的关系 corresponds loosely to new 对他人接近的反应.
- Items in the old tool with **no counterpart** in the new: 视觉反应, 听觉反应, 味嗅触觉反应 (new has only the combined 感觉寻求或回避), 能力发展的均匀度, 整体印象 (partly the new GI).
- New items with no old counterpart: 眼神的社交使用, 主动发起互动, 共同注意, 分享乐趣, 与同伴或陌生人的互动, 语言的社交用途, 仿说与刻板用语, 对话来回, 理解他人的话语, 玩具功能性操作, 假装与想象游戏, 狭窄或强烈的兴趣, 情绪表达与情境相称, 被安抚与自我平复.
- **Verdict: different questions (restructured and expanded; same concept, rewritten anchors).** Grade cuts: old 4 tiers 20/29/38, new 3 levels 20/38 plus payload 60. The 20 and 38 cuts are the same; the old 29 cut is gone.

### 10. Open questions
- A parent cannot fill this tool. If the engine wants an ASR-based score, a clinician flow is needed, or the parent-answerable part is only regression and checks.
- N/A handling must be kept if the item bank is ported: the denominator shrinks.
- Regression: page forces the top level; payload caps at 中度. Same ambiguity as ASB.
- The old tool's sensory items are absent. If the engine used old ASR sensory items for another dimension, they need a new source.

---

## 6. SXK-QOL 森心康儿童生活质量量表 · 完整版 (new tool, no old version)

### 1. Title, version, age range
- `<h1>`: 森心康儿童生活质量量表, `<small>`: SXK-QOL 完整版. Tool id `SXK-QOL-FULL`, `version:'1.0'`. Header: "2～18 岁 · 四个年龄版本 · 家长版＋儿童自评版".
- Range: 24 months to under 228 months. `bandForms(months)` = forms with `months>=ageMin&&months<ageMax`; `start()` alerts "超出适用范围（2～18 岁）" if none. Preterm correction: none. Age in months is computed without day carry (a child just under a birthday counts as the lower month).
- The disclaimer says "不等同于 PedsQL", but the postMessage uses `id:'pedsql'`.

### 2. Rater forms (`FORMS`, 7 forms)
| id | Title | Ages (months) | Rater | Options |
|---|---|---|---|---|
| `P24` | 幼儿家长版 | 2-4 y [24,60) | parent | `OPTS4` |
| `P57` | 学龄前家长版 | 5-7 y [60,96) | parent | `OPTS4` |
| `C57` | 学龄前儿童自评版 | 5-7 y [60,96) | child (read aloud by an adult) | `OPTS3` |
| `P812` | 学龄家长版 | 8-12 y [96,156) | parent | `OPTS4` |
| `C812` | 学龄儿童自评版 | 8-12 y | child | `OPTS4` |
| `P1318` | 青少年家长版 | 13-18 y [156,228) | parent | `OPTS4` |
| `C1318` | 青少年自评版 | 13-18 y | child | `OPTS4` |
- Which forms run is picked by `f_who`: 家长版 (default), 家长版＋儿童自评版, 只填儿童自评版. Under 5 y there is no child form (the page falls back to the parent form). Item wording is age-specific: same 5 domains but the text is rewritten per age band and per rater (child forms are first person "我…").
- A parent at home: the `P…` form for their child's age.

### 3. Item structure
- 5 domains (`SECS`): `PH` 体力与身体不适, `EM` 情绪与心情, `PE` 同伴与友谊, `SC` 园所与学校生活 (gated), `FM` 家庭与日常参与.
- Per form: PH 6, EM 6, PE 6, SC 6, FM 5 = **29 items** (every one of the 7 forms has the same split; I counted P24, P57, C57, P812, C812, P1318, C1318). With `f_school='no'`, SC is skipped (`activeSecs()` = `SECS.filter(s=>!s.gate||S.f.school==='yes')`): **23 items**.
- Typical counts: 12 mo: not usable. **36 mo: 29 (or 23 not in school) on `P24`. 60 mo: 29 (or 23) on `P57`; +29 on `C57` if the child form is also chosen.**
- No per-item start month, no basal/ceiling. The form is chosen by age band only.

### 4. Response options
- `OPTS4=[['很少或没有',0],['偶尔',1],['经常',2],['总是',3]]` (parent forms and child forms 8+).
- `OPTS3=[['没有',0],['有时候',1.5],['常常',3]]` (child form 5-7 y only; note 1.5).
- No N/A. All applicable items required (`nextForm()` blocks). Time frame: "最近一个月".
- **Direction: higher = more distress = worse** (these are problem-frequency items).

### 5. Non-item inputs
| Input | What it is | Affects grade? | Parent alone? |
|---|---|---|---|
| `f_school` (是/否 enrolled) | gates the SC domain | Yes: removes 6 items from numerator and denominator | Yes |
| `f_who` | which forms | Yes (which forms are scored) | Yes |
| `f_rater`, `f_ther` | names | No | n/a |
There are no regression, OVERALL, checks or observation inputs.

### 6. Scoring
```js
function secScore(f,k){... sum of answered values; const max=f[k].length*3; return {sum,n,max,pct:max?Math.round(sum/max*100):0};}
function formScore(f){const secs=activeSecs();let sum=0,max=0;secs.forEach(s=>{const st=secScore(f,s.key);sum+=st.sum;max+=st.max;});return {sum,max,pct:max?Math.round(sum/max*100):0};}
// renderReport
const main=P||C; const ms=formScore(main), ml=levelFor(ms.pct);
const key=x=>Math.max(x.p?x.p.pct:0,x.c?x.c.pct:0);   // domain result = the higher of parent/child
```
- Domain "困扰率" = sum / (items x 3). Total = sum / (all active items x 3), on the **parent form if present, else the child form** (`main`). When both are filled the total is the parent's, and the child's total is shown separately; **per-domain level uses the higher (worse) of parent and child**. A 15-point parent/child gap is flagged "差距大".
- The OPTS3 maximum is 3, so 常常 = 3 fits the same /3 denominator.

### 7. Grading
(a) On-page `LEVELS` (`levelFor(p)=LEVELS.find(l=>p>=l.lo&&p<=l.hi)`): 未见明显 0-28, 轻微 29-36, 中度 37-45, 明显 46-100. Domain results use the same cuts via `key(x)`. Each level also has `FREQ` (a recommended treatment frequency: 轻微 "居家与作息调整为主，暂不需排课", 中度 "建议每周 1–2 次，为期 3 个月后复评", 明显 "建议每周 2 次，为期 3 个月后复评"), `CONSEQ`, `PLAN` text per domain.

(b) postMessage (verbatim):
```js
const g=ml.key==='未见明显'?'未见明显':ml.key==='轻微'?'轻度':ml.key==='中度'?'中度':'重度';
window.parent.postMessage({sxkTool:1,id:'pedsql',name:'森心康儿童生活质量量表（完整版）',grade:g,score:100-ms.pct,note:`${main.title}／`+worst.slice(0,2).map(x=>x.s.name+key(x)+'%').join('／')},'*');
```
- `grade` in {未见明显, 轻度, 中度, 重度} from the **total** level only; `score = 100 - distress%` (higher = better; **inverted** compared with the other tools). The two worst domains and their % are text inside `note`.
- `id:'pedsql'`: the message id suggests a mapping to a PedsQL slot in the parent dashboard (the central console), which conflicts with the page's own disclaimer.

(c) Natural 0-3 map: direct (0,1,2,3). Domain-level grades exist on the page only; the payload sends only the total. The five domains are about daily functioning (physical, emotional, peer, school, family participation), not the nine neurodevelopmental dimensions, so the engine needs to decide which dimension (if any) QOL feeds; it could feed several or act as a modifier.

### 8. Clinician / observation / materials
Nothing. Parent only for the parent forms. The 5-7 y child form is read to the child by an adult with optional expression cards.

### 9. Comparison
No old version exists.

### 10. Open questions
- Which dimension does QOL feed? The page defines no mapping to the engine's dimensions.
- Total vs worst-domain: the page's total uses the parent form only, but the domain levels use the max of both forms.
- The `f_school` gate: engine needs an enrolled yes/no or an age rule (default "yes" even for a 24-month child).
- `score` direction is inverted (100 - distress%).
- Different child versions: the engine must pick by age; items differ per band so scores are not comparable across bands.
- `FREQ` suggests a service frequency by level, which is clinical advice the parent app may not want to show.

---

## 7. Hidden grading schemes summary

| Tool | (a) on-page | (b) postMessage cuts | (c) other |
|---|---|---|---|
| ASQ3 | 85/70/55 (4 levels, per domain and overall) | same 85/70/55 on total, names 未见明显/轻度/中度/重度 | `refer` flag (flags, hearing/vision/regress/move "warn" answers, any domain <55) not in payload |
| M-CHAT | 0-2 / 3-7 / 8-20, then stage-2 >=2 fails | 5 values incl. 边缘; stage-2 positive = 中度, stage 1 >=8 = 重度 | concern=是 forces referral |
| VOC | A-section 80/60 plus 6 flag rules (3 levels) | same 3 levels mapped to 未见明显/轻度/中度; never 重度 | `REF` literature table (display only) |
| ASB | 22/40 (3 levels); regression forces top | 22/40/60 (4 values); regression caps at 中度 | A/B core >22% rule |
| ASR | 20/38 (3 levels); regression forces top | 20/38/60 (4 values); regression caps at 中度 | A/B core >20% rule |
| QOL | 28/36/45 (4 levels) | same 4 levels mapped to 未见明显/轻度/中度/重度; `score` inverted | `FREQ`, parent vs child gap >=15 |

Footnote: "not used for the 0-3 engine unless noted" applies to everything in the (c) column.
