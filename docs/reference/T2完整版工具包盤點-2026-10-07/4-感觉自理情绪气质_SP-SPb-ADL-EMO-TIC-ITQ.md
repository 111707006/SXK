# Group 4 survey: SXK-SP, SXK-SPb, SXK-ADL, SXK-EMO, SXK-TIC, ITQ/TTS/BSQ (完整版 2026-09-23)

Source dir: `...\scratchpad\kitfull\森心康评估工具包_完整版\网页版\` (HTML read as text only, nothing executed).
Old predecessors: `C:\AI project\SXK-main\src\t2\toolkit\sxk-{spa,spb,adl,tempa,tempb}.ts`.
Client spec cross-check: `docs/reference/client-mockups/森心康_T2量表推荐规则规格书_v1.0-2026-10-06.md` §4 (31-tool table) and HUB file `森心康_评估工具总览_完整版_SXK-HUB.html`.

## 0. Cross-tool summary

| Tool | Page age gate (enforced how) | Client spec age | Items a parent answers | On-page bands | postMessage grade values | Old file vs new |
|---|---|---|---|---|---|---|
| SXK-SP | 24–191 months, 3 age bands pick the form; hard block outside | 24–59 | 63 (home form) | 3 levels (cut 28 / 45) | 4 strings (cut 28 / 45 / 65) | same item pool, rewritten (42/63 verbatim); sections 7 -> 9; grading different |
| SXK-SPb | 72–191 months hard block (label says 5–15 y; **60–71 months are rejected**) | 60–180 | 63 (home form H512 or H1215) | 3 levels (28 / 45) | 4 strings (28 / 45 / 65) | forms identical to SP's 4 school-age forms; vs old SPb only 19/63 verbatim |
| SXK-ADL | 18–180 months hard block (preterm correction <24 mo) | 18–180 | 9–62 depending on age | 3 levels (72 / 45) | 5 strings (72 / 60 / 45 / 30) | different questions (62 items / 7 domains vs 18 / 4), different option labels |
| SXK-EMO | 36–155 months, **warning only, not blocked** | 36–155 | 42 + 6 impact + duration + exclusions | symptom 4 bands (15/30/50), impact 3 bands (20/40), 2x2 matrix | matrix-cell text (4 strings + "资料不足") | NEW tool |
| SXK-TIC | "4 岁以上", **warning only** (whole years) | 48–215 | 15 ratings (+checklists) | 4 bands on 0–50 (13 / 26 / 38) | band name (4 strings) | NEW tool |
| ITQ/TTS/BSQ | per-scale month range, **warning only**; parent clicks one of 3 cards | 4–84 | 95 / 97 / 72 (+ "不适用") | per-dimension hi/mid/lo only, no overall grade | **no postMessage at all** | different questions, different scale (1–6/1–7 vs 0–5) |

Common facts:
- All five non-temperament pages call `window.parent.postMessage({sxkTool:1,id,name,grade,score,note},'*')` at the end of `renderReport()`/`render()`. Only iframe-embedded; targetOrigin `'*'`. HUB's `onMsg` just stores `grade/score/note` verbatim (no numeric level).
- No page emits a 0–3 value. Mapping to 0–3 is the engine's job; options per tool below.
- HUB TOOLS rows: `SXK-SP minM 24 maxM 180 rater 家长`; `SXK-SPb 60–180 家长/教师`; `SXK-ADL 18–180 家长/治疗师`; `SXK-TIC 48–215 治疗师/家长/本人自评`; `SXK-EMO 36–155 家长/教师`; `ITQ/TTS/BSQ 4–84 家长, nomsg:true`.
- Legacy ids in postMessage (old "中控台" names): SP `spm25`/`spm5`, SPb `spm5`, ADL `weefim`, EMO `emo`, TIC `tic`. Not the client's `SXK-*` codes.
- No page has a "third compressed scheme" in the old sense; HUB just relays. The third scheme in SP/SPb/ADL is the old `.ts` tier table (4 tiers), which differs from both new schemes.

---

## 1. SXK-SP 感觉处理记录量表 完整版

### 1. Identity, version, age gate
- `<title>`: 森心康感觉处理记录量表 · 完整版; `<h1>`: 森心康感觉处理记录量表 SXK-SP 完整版; header: "2～15 岁 · 三个年龄版本 · 家庭版＋园所学校版 · 离线单文件". JS comment: `SXK-SP-FULL`. JSON export `tool:'SXK-SP-FULL', version:'1.0'`. No other version string.
- Two `<script>` blocks: first = data (`SECS, OPTS, FORMS, IMPACT, LEVELS`, exported to `window`), second = logic.
- Age: `calcAge()` -> `months`. `bandForms(months)=FORMS.filter(f=>months>=f.ageMin&&months<f.ageMax)`. `start()` blocks with `alert('超出适用范围（2～15 岁）')` when no form matches. So accepted range is **24 <= months < 192**.
- Bands (note the labels are off by a year): 幼儿 "2～5 岁" = ageMin 24, ageMax 72 (i.e. 24–71 months, through 5y11m); 学龄 "5～12 岁" = 72–143; 青少年 "12～15 岁" = 144–191. A 5-year-old (60–71 months) gets the toddler form here.
- Client spec says SXK-SP = 24–59 and "SXK-SP 与 SXK-SPb 以 60 个月为界二选一"; HUB text says "未满 5 岁用这一份；五岁以上改用学龄版". The page does not implement the 60-month split (see SPb for the matching gap).

### 2. Rater forms (`FORMS`, 6 total)
| id | title | months | setting | rater |
|---|---|---|---|---|
| H25 | 幼儿家庭版 | 24–71 | home | 家长／主要照顾者 |
| S25 | 幼儿园所版 | 24–71 | school | 幼儿园／托育老师 |
| H512 | 学龄家庭版 | 72–143 | home | 家长 |
| S512 | 学龄学校版 | 72–143 | school | 班级老师 |
| H1215 | 青少年家庭版 | 144–191 | home | 家长（可与孩子一起填） |
| S1215 | 青少年学校版 | 144–191 | school | 班级老师／辅导老师 |
`f_who` select: `parent` (default) / `both` / `child` (school only). Wording differs per band and per setting (e.g. H25 "洗脸、剪指甲、剪头发特别抗拒" vs S25 "对洗手、擦脸、换衣服抗拒"). The parent engine only needs H25 / H512 / H1215.

### 3. Item structure
- 9 sections x 7 items = 63 per form: SO 社会参与, VI 视觉, AU 听觉, TA 触觉, OR 口腔与味嗅觉, PR 本体觉与身体意识, VE 前庭觉与平衡, PL 动作计划与想法, RG 调节与专注. No per-item start month, no age filtering inside a form. All 63 required (`nextForm()` blocks on missing).
- Each section has `what` (explanation) and `tips` (3 advice sentences) — advice text, do not ship to parents without wording scan.

### 4. Response options
`OPTS=[['很少或没有',0],['偶尔',1],['经常',2],['总是',3]]`. No N/A. Intro tells parent: "没观察过的情境勾「很少或没有」". Window: 最近三个月. Higher = more concern (direction already 0 = none).

### 5. Non-item inputs
- `IMPACT` (required per form: either `none` or >=1 of): adl 影响生活自理 / sch 影响入园／上学适应或团体活动参与 / soc 影响游戏、同伴互动或外出活动 / learn 影响课堂学习或作业完成. Not scored. Parent-answerable. Effect: only text (`impacted` -> "已影响日常参与", "建议安排作业治疗评估" bullet) and the postMessage `note`; it does **not** change the grade/level.
- Free text: name, sex, dob, date, raters, `f_ther` (评估者／编号), clinical note. Name/dob/date required.

### 6. Scoring (second script)
```js
function secScore(f,k){...sum+=v; if(v>=2)hi++ ... const max=f[k].length*3;
  return {sum,max,hi,pct:Math.round(sum/max*100)};}
function formScore(f){let sum=0,max=0,hi=0;SECS.forEach(s=>{...});return {sum,max,hi,pct:Math.round(sum/max*100)};}
```
Section pct = round(sum/21*100); form pct = round(sum/189*100). "关切率".
Headline: `ms=formScore(main)` where `main = H||T` (home first); level: `ml=levelFor(Math.max(...forms.map(x=>formScore(x).pct)))`.
Per-section "结果": `levelFor(Math.max(home pct, school pct))`.

### 7. Grading
(a) On-page report bands (`LEVELS`, best -> worst), cut points inclusive on integer pct:
- 0–28 `未见明显`
- 29–45 `部分面向需留意`
- 46–100 `建议作业治疗评估`
(b) postMessage:
```js
const p=Math.max(...forms.map(x=>formScore(x).pct));
const g=p<=28?'未见明显':p<=45?'轻度':p<=65?'中度':'重度';
window.parent.postMessage({sxkTool:1,id:a&&a.months<72?'spm25':'spm5',name:'森心康感觉处理记录量表（完整版）',grade:g,score:p,note:(impacted?'已影响参与·':'未影响参与·')+worst.slice(0,2).map(x=>x.s.name+key(x)+'%').join('／')},'*');
```
Grades: 未见明显 (0–28) / 轻度 (29–45) / 中度 (46–65) / 重度 (66–100). `score` = max form pct 0–100.
(c) Old `.ts` `tiers` (4): 未见明显 0–28, 轻微 29–36, 中度 37–45, 明显 46–100.
Mapping to 0–3: the only 4-level schemes with natural 0..3 are (b) and (c), and they disagree above 28 (b: 45/65 vs c: 36/45). Client appendix does not say which. Proposal: use (b) since it is the new file's own, from `score`, but this is a **client decision** (open question 1).
Primary dimension for SP per client: 感觉处理 (SEN). Grade is for the whole 63-item form.

### 8. Clinician / observation / safety
Nothing requires a clinician, materials or timing. No safety items. Disclaimer text: do not say "感觉统合失调", no diagnosis; recommends hearing/vision check before OT; OR high -> rule out swallowing/oral-motor issues.

### 9. Compare with old `sxk-spa.ts` (SXK-SPa, 2–5 y)
- Old: 7 sections TA 12, VE 12, PR 11, AU 10, VI 10, OR 10, RG 10 = 75 items, all `startMonth:24`; one `impact` pre-question (none / adl / group / play); 4 tiers.
- New H25: 9 sections x 7 = 63. Added sections SO, PL. Section names changed (前庭觉 -> 前庭觉与平衡, 本体觉 -> 本体觉与身体意识, 口腔与进食 -> 口腔与味嗅觉).
- Verbatim match (script count): **42 of 63** new H25 items appear character-identical in old SPa; 33 old items are gone or merged. Spot checks (identical): "被轻轻碰到会过度反应（躲开、生气、哭）", "讨厌某些衣物材质、标签或袜子接缝", "不喜欢手弄脏（沙、颜料、黏土、胶水）", "洗脸、剪指甲、剪头发特别抗拒", "特别怕高、怕脚离地（溜滑梯、荡秋千）", "坐车、坐电梯容易不舒服或抗拒", "头往后仰或倒立时特别恐惧", "非常爱旋转、跳动而不觉得晕", "经常撞到人或家具", "动作显得笨拙、不协调", "喜欢咬、啃、推重物", "对突然的声音（吸尘器、烘手机）过度反应". Modified/merged: old TA9 "很喜欢用力挤压、被紧紧抱住" + TA10 "不停触摸经过的东西" -> one new item "很喜欢用力挤压、被紧紧抱住，或不停触摸经过的东西"; old VE9 "平衡动作明显比同龄吃力" + VE12 "跑步时容易跌倒" merged. Dropped: "赤脚踩草地、沙滩会抗拒", "洗澡水温稍有变化就抗议", "转圈后不会晕眩", "拿易碎物品常弄坏".
- Options identical (0–3, same labels). Verdict: **same question pool, rewritten and condensed (not the same question list), different sections, different grading** (old 4 tiers 28/36/45; new 3 on-page + 4 postMessage).
- Item keys differ (old `TA..RG` 1..12, new `SO..RG` 1..7) so stored-answer compatibility is none.

### 10. Open questions
1. Which 0–3 cut table: postMessage (28/45/65) vs old ts (28/36/45) vs on-page 3-level (28/45)?
2. Boundary mismatch: client "SP 24–59 / SPb 60–180" vs page "H25 24–71, H512 72–143". What does a 60–71 month child get? (SPb page refuses them; SP page serves H25.)
3. Page labels 5～12 for months 72–143 and 2～5 for 24–71 (6th birthday boundary, not 5th).
4. Impact answers are collected but never change the level; does the engine use them (e.g. to escalate)?
5. Section advice text (`tips`, `what`) not wording-scanned.

---

## 2. SXK-SPb 感觉处理记录量表（五岁以上）学龄完整版

### 1. Identity
- `<title>`: 森心康感觉处理记录量表（五岁以上）· 学龄完整版; `<h1>`: 森心康感觉处理记录量表（五岁以上）SXK-SPb 学龄完整版; header "5～15 岁 · 家庭版＋主课堂版＋六份学校环境表". JSON `tool:'SXK-SPb-FULL', version:'1.0'`. Two scripts (data, logic).
- Age gate: same `bandForms` with H512 ageMin 72, H1215 144–192. `start()`: `if(!bandForms(a.months).length){alert('超出适用范围（5～15 岁）');return;}`. **Accepted 72 <= months < 192.** Months 60–71 (the 5-year-olds the label promises) are rejected with the misleading text "未满 5 岁请改用 SXK-SP 完整版的幼儿版本" in `showAge()`. Client spec says 60–180; page also accepts 181–191.

### 2. Rater forms
Four main forms **identical, item for item, to SP's H512 / S512 / H1215 / S1215** (script-verified: all four 63-item lists equal):
- 学龄家庭版 H512 (72–143, 家长), 学龄主课堂版 S512 (班级老师), 青少年家庭版 H1215 (144–191), 青少年主课堂版 S1215.
- Plus `ENV` six school-environment forms of 12 items each, filled by that environment's staff (not parents): E_ART 美术课 (美术老师), E_MUS 音乐课, E_PE 体育课, E_REC 课间活动 (导护／带班老师), E_CAF 餐厅／用餐 (午餐带班老师／餐厅人员), E_BUS 校车／接送 (随车人员). Each env item is `[sectionKey, text]`, ages 5～15 (`ageMin:60, ageMax:192` in `allForms()`), no IMPACT block. User multi-selects forms (`S.sel.home`, `S.sel.cls`, `S.sel.env[id]`). For a parent flow only the home form applies.

### 3–4. Items and options
Same as SP: 9 sections x 7, 0–3 same labels, no N/A, all required. Env forms: 12 items, same 0–3 options.

### 5. Non-item inputs
`IMPACT` identical to SP (required for non-env forms, not scored). `S.raters[envId]` env rater name. `f_grade` 年级／班级. Nothing else.

### 6. Scoring
Same functions as SP plus
```js
function envScore(f){... max=f.items.length*3; return {sum,max,hi,pct:Math.round(sum/max*100)}}
const allPct=mainForms.map(x=>formScore(x).pct).concat(E.map(envScore).map(x=>x.pct));
const ml=levelFor(Math.max(...allPct));
```
`envAgg` sums env items per section for display only (unanswered env items are counted as 0: `S.ans[e.id]['e'+i]||0`).

### 7. Grading
(a) Same `LEVELS` (28 / 45), same 3 names. (b) postMessage:
```js
const p=Math.max(...allPct);const g=p<=28?'未见明显':p<=45?'轻度':p<=65?'中度':'重度';
postMessage({sxkTool:1,id:'spm5',name:'森心康感觉处理记录量表（学龄完整版）',grade:g,score:p,note:...})
```
Same 4 strings / cuts as SP; note `p` includes env forms and school forms if selected (max across everything), so for parent-only the value is the home form pct. (c) old ts 4 tiers 28/36/45.

### 8. Clinician / safety
None. Same disclaimers as SP.

### 9. Compare with old `sxk-spb.ts` (五岁以上, startMonth 60)
- Old: 7 sections, 75 items (TA12 VE12 PR11 AU10 VI10 OR10 RG10), 4 tiers, 1 impact pre-question.
- New: **19 of 63** H512 items (17 of 63 H1215) verbatim in old. Spot-check identical: "对疼痛反应特别大或特别小", "头往后仰或倒立时特别恐惧", "非常爱旋转、跳动而不觉得晕", "经常动来动去、无法安静坐着", "经常撞到人或家具", "动作显得笨拙、不协调", "喜欢咬、啃、推重物", "对强光或阳光特别不适", "尝试新食物非常困难", "刷牙特别抗拒", "活动一多就明显亢奋、停不下来", "一天中状态起伏很大". Modified: old "写字或拿东西力道控制不好（太用力或太轻）" -> "写字或用工具时力道控制不好（太用力或太轻）"; "看书或抄写时容易跳行" -> "看书或写作业时容易跳行、漏字"; "同时有多种刺激时会崩溃" -> "...崩溃或关机".
- Verdict: **different question list (same theme/origin), different grading; startMonth 60 vs page 72.** Fewer verbatim overlaps than SP.

### 10. Open questions
1. 60–71 months: page rejects, client spec assigns to SPb. Needs a form (H512 text is school-age: "写字", "作业") or fall back to SP H25.
2. Parent form for 144–180 months is "家长（可与孩子一起填）"; self-report not a separate rater.
3. Env forms and teacher forms exist for school staff; probably out of scope for home use.

---

## 3. SXK-ADL 生活自理功能量表 完整版

### 1. Identity and age
- `<title>` 森心康生活自理功能量表 · 完整版; header "18 个月～15 岁 · 七大领域 62 项 · 七级协助类型". JSON `SXK-ADL-FULL` v1.0. Two scripts.
- `calcAge()` returns `months`, `corr` and `use`. Preterm correction: `if(ga&&ga<37&&months<24){...corr={months:Math.max(0,Math.floor(days/30))}}` where `days=months*30+d-(40-ga)*7`; `use = corr ? corr.months : months`. `start()`: `if(a.use<18||a.use>180) alert('超出适用范围（18 个月～15 岁）')`. So **18 <= use <= 180** (matches client 18–180). `f_rater` (评估者) is required, `f_ga` optional.

### 2. Rater
No form variants; single wording. Header fields: 评估者 * (治疗师姓名), 评估者专业 (OT/PT/ST/心理/医师/其他), 施测方式 `f_method` obs／int／both (default 观察＋访谈), 访谈对象, 评估情境 (院内／家中／幼儿园学校／多情境综合), 主要诊断, 发病日期. Written for a therapist; the items themselves ("看大人做了什么") are answerable by a parent. Client says rater 家长／治疗师.

### 3. Item structure (62 items, 7 domains, `SECS` with `items:[text, startMonthAtWhichChildCanDoWithLittleHelp, modeType?]`)
EA 进食与餐桌 10, GR 清洁与梳洗 8, DR 穿脱衣物 10, TO 如厕与括约肌 8, MO 转位与移动 10, CO 沟通 6, SC 社会认知与安全 10.
Age selection: `allItems(M)` includes item only when `M>=m` (start month); items not yet reached are not shown or scored. Item start months span 12–120 (an item with m=12 and m=15 exist but are below the 18-month floor). Typical counts a parent answers (script count): 18 mo 9, 24 mo 13, 30 mo 22, 36 mo 30, 42 mo 36, 48 mo 45, 60 mo 54, 72 mo 58, 84 mo 60, 108 mo 61, >=120 mo 62. Some domains have 0 items at young ages (reported as 未评).

### 4. Response options (7 levels, **7 = best**, i.e. inverse of the other tools)
`OPTS=[[7,'完全自己做'],[6,'自己做但需条件'],[5,'需要口头引导或看着'],[4,'需要起头或收尾'],[3,'需要一起做'],[2,'大人做为主'],[1,'完全由大人做']]` with full definitions (e.g. 6 "自己做得到，但需要辅具、改装环境，或比同龄明显久"; 5 "大人在旁看着、提醒或一步一步说，但不用动手碰他"). Observation rule printed: 大人有没有动手 -> 没动手 5 以上; 动了手看位置. "依孩子平常的实际表现评，不是最好的那一次". **No N/A**; all age-eligible items required (`next1()`).

### 5. Non-item inputs
- `rel[id]` ("与目前病况／障碍有关？" 是／否（与年龄或经验有关）) and `why[id]` free text: appear only for score <7, **optional**, do not affect score; the 是 answers drive the 「病况」 chip and a report sentence. This is a judgement a clinician makes; a parent can answer but it is not needed.
- `MODES` (per item with a mode type, optional select): `loc` 步行／轮椅／爬行／混合 (50 m walk, outdoor uneven ground, school route), `und` 听觉／视觉（图卡／手势）／两者 (2 comprehension items), `exp` 口语／非口语（图卡／手势／沟通板）／两者 (4 expression items). Not scored.
- `AIDS` 12 checkboxes (加粗或弯柄餐具, 防滑碗盘／吸盘碗, 有把手或防漏的杯子, 穿衣辅助, 洗澡椅或防滑垫, 如厕扶手／踏脚凳, 助行器／拐杖, 轮椅或推车, AFO, 沟通图卡／沟通板／软件, 视觉作息表, 计时器). Plus `f_env` and `f_goal` ("家长最想先改善的三件事") textareas. Not scored; parent-answerable. 6-point items are listed against aids in the report.
- Prior-record comparison (`prev` JSON) is an offline feature; irrelevant.

### 6. Scoring
```js
function overall(ans,its){... got+=ans[x.id]||0; n=its.length; return {n,got,max:n*7,pct:n?Math.round((got-n)/(n*6)*100):0};}
function secStat(s,...){... pct: its.length?Math.round((got-its.length)/(its.length*6)*100):null}
```
独立率 = (sum - n) / (6n) x 100 (all 1s = 0%, all 7s = 100%). Section pct same formula; section tag only if `st.n>=2` ("题数偏少，仅供参考" otherwise). `weak` = sections with pct<45 and n>=2. Items <=4 and `M>=x.m+24` are flagged "已超过常见开始年龄两年以上".

### 7. Grading
(a) on-page `LEVELS` (overall and each section, `levelFor(p)=LEVELS.find(l=>p>=l.min)`), best -> worst:
- >=72 `独立性良好`; 45–71 `部分活动需协助`; 0–44 `多数活动需协助`.
(b) postMessage:
```js
const g=ov.pct>=72?'未见明显':ov.pct>=60?'边缘':ov.pct>=45?'轻度':ov.pct>=30?'中度':'重度';
postMessage({sxkTool:1,id:'weefim',name:'森心康生活自理功能量表（完整版）',grade:g,score:ov.pct,note:rated.slice(0,2).map(x=>x.s.name+x.st.pct+'%').join('／')},'*')
```
5 strings: 未见明显 >=72, 边缘 60–71, 轻度 45–59, 中度 30–44, 重度 <30. `score` = overall independence 0–100 (**higher = better**).
(c) old `.ts` 4 tiers: 独立性良好 >=72, 少数活动需协助 58–71, 部分活动需协助 45–57, 多数活动需协助 0–44.
Mapping to 0–3 needs inversion plus a choice: (c) maps cleanly (0 >=72, 1 58–71, 2 45–57, 3 <45) but its 58 cut matches neither new scheme; (b) has 5 levels (collapse e.g. 边缘 into 0 or 1); (a) has 3. Client appendix does not resolve it. ADL's client primary dimension: 生活自理与适应.

### 8. Clinician/observation
Items are observation of everyday behaviour (no materials, no timing). Requires "评估者" field (therapist name) and is worded for interview/observation; a parent can answer. No safety triggers. Mobility item "平地行走或移动约 50 米" is a recall item here.

### 9. Compare with old `sxk-adl.ts`
- Old: 4 sections SC 自我照顾 6, SP 括约肌控制 2, MO 移动与转位 4, CC 沟通与认知 6 = **18 items**, startMonth 15–42, 4 tiers, `minItems:2`, 7 options with shorter definitions (old 6 = "需要有人在旁… 或需要辅具、需要比同龄久"; new 6 = "自己做但需条件").
- Script check: **0 of 18** old item texts occur verbatim in the 62 new. Concepts map with many same start months but new items are finer: old "平地行走或移动 50 公尺" (18) ~ new "在平地行走或移动约 50 米" (18); old "上下楼梯" (30) ~ "上下楼梯（可扶扶手）" (30); old "膀胱控制（白天不尿湿）" (30) ~ "白天膀胱控制（不尿湿）" (30); old "与人互动（打招呼、轮流、合作）" (24) ~ "与人互动（打招呼、轮流、一起玩）" (24); old "注意力维持在一件事上" (30) ~ "把注意力维持在一件事上直到完成" (30); old "记住并完成交代的事" (36) ~ "记住并完成交代的一件事" (36); old "洗澡" (42) ~ "洗澡时擦洗身体各部位" (54); old "进食（把食物送进嘴里并咽下）" (15) split into "用手拿食物吃" 12 / "用汤匙把食物送进嘴里" 18 / etc.
- Verdict: **different questions (62 vs 18), different sections, different tier set; same 1–7 option idea (relabelled 6)**. Stored old answers are not reusable.

### 10. Open questions
1. 5-level postMessage vs 4-tier old vs 3-level on-page: which to convert to 0–3 (and where 58 vs 60 lands).
2. Direction inverted (7 best); engine must invert.
3. Age-eligible subset varies by age (9–62 items); engine's item-count/time estimate (client 20 min) must be per-age.
4. "评估者 *" required field; for a parent flow we supply a placeholder? And "与病况有关" prompts are clinician-style but optional.
5. Report text names "WeeFIM®" in disclaimers; do not echo.

---

## 4. SXK-EMO 儿童情绪与焦虑筛查量表 完整版 (NEW)

### 1. Identity
- `<title>` 森心康儿童情绪与焦虑筛查量表 · 完整版 SXK-EMO; `<h1>` 森心康儿童情绪与焦虑筛查量表 · 完整版, small "SXK-EMO 完整版 ｜ 七个面向 42 题 ＋ 功能影响 6 项 ｜ 症状与功能影响分开计分，以判读矩阵解读". JSON `tool:"SXK-EMO-F", ver:1`. **One** `<script>`, `"use strict"`, `var` declarations, no `window` export.
- Parser note: data arrays `FORMS, FREQ, DIMS, IMP, IMPA, DUR, SYMB, IMPB, SAFETY, FLAGS, CTX` are plain literals. The concatenation with `+` occurs in `DEVAGE[].txt`, `MATRIX[].txt`, `SAFETY_TXT`, and `EXCL[].note` (strings split across lines). `EXCL` is an array of object literals except for those `note` fields.
- Age: header says 3 岁 0 个月 – 12 岁 11 个月. `refreshAge()` only sets a notice: `mo<36` warn ("本表适用 3 岁 0 个月以上"), `mo>155` warn ("已超出本表适用范围（至 12 岁 11 个月）"). `start()` checks only that dob/date yield an age; **not blocked**. Matches client 36–155.

### 2. Rater forms
`FORMS=[{k:"p",n:"家长版"},{k:"t",n:"教师／治疗师版"}]` (teacher/therapist must see the child >=2x/week for >=1 month). **Same 42 items for both**; the form only labels the report and the comparison note. Selection is required (`start()` alert). Parent form = `p`. Filler's own fields: 填表人 * (name/relationship), 就读班级, 协助填表的专业人员 (optional).

### 3. Item structure
7 dimensions x 6 = 42 items (`DIMS`): E1 分离焦虑, E2 广泛焦虑与担忧, E3 社交焦虑与退缩, E4 特定恐惧, E5 身体化与惊恐样反应, E6 强迫倾向与固着, E7 情绪调节与易怒. No age filtering of items: all 42 for everyone 36–155 months. Sample items: E1.1 "与主要照顾者分开时，出现明显的紧张、哭闹或抗拒"; E4.3 "害怕高处"; E5.1 "在压力情境前出现肚子痛或头痛，就医检查找不到原因"; E7.3 "生气时出现攻击性行为（摔东西、推打、咬人）"; E7.5 "紧张时出现重复性的身体动作（咬指甲、拔头发、抠皮肤）".
Plus `IMP` 6 function-impact items: i1 上学与学习, i2 同伴交往, i3 家庭生活, i4 睡眠, i5 饮食, i6 活动参与.

### 4. Options
- Symptom (`FREQ`, last month): 0 几乎没有 (本月完全没有，或只出现一两次) / 1 偶尔 (每月数次) / 2 经常 (每周数次) / 3 几乎每天; plus **"未观察到" = -1** (excluded from denominator, explicitly "不是几乎没有").
- Impact (`IMPA`): 0 完全没有影响 / 1 轻微 / 2 明显 / 3 严重; plus **"不适用" = -1** (excluded).
- Unanswered (`undefined`) items are also ignored by the maths; `finish()` allows generating the report after a `confirm()` (needs >=1 answered symptom item).

### 5. Non-item inputs
- `DUR` (required, `start()` alert if null): 0 少于两周, 1 两周至一个月, 2 一至三个月, 3 三至六个月, 4 超过六个月. **Not in the score or grade.** Only report text: `S.dur===0 && v.hiS` -> "不宜直接转介或下任何结论…两到四周后重测"; `>=2` shows warn style. Parent-answerable.
- `EXCL` (7 dropdowns, "必填" but `start()` only confirms): event 近期重大生活事件, sleep 睡眠状况, health 身体健康与疼痛, med 用药, family 家庭压力与照顾者状态, school 校园适应与同伴关系, know 填表人对孩子的了解程度. Each has `bad` option list; any `bad` or blank -> report says "本次结果不能直接用来推论孩子的情绪状态". No effect on grade or postMessage. Parent-answerable but `family` is a self-assessment of caregiver stress.
- `CTX` (5 dropdowns): edu 目前就学, live 主要照顾者, tx 目前接受的疗育, hist 病史／家族史, purp 筛查目的. Descriptive.
- `FLAGS` (8 checkboxes, p0 page, no effect on scores): school 拒学, regress 明显退化, mute 在特定场合完全不说话, panic 突发强烈身体反应, low 持续情绪低落或失去兴趣, withdraw 退出同侪, eat 食欲或体重改变, acute 上述任一项两周内急速恶化. Shown as a red "需要特别注意的情形" box "不论分数高低都应处理"; extra advice for school/acute/low/mute.
- `SAFETY` (Part 3, "**由专业人员填写 · 不计分**"): s1 孩子曾表达不想活下去、想消失，或说过类似的话; s2 孩子曾出现伤害自己身体的行为; s3 孩子透露，或工作人员发现，孩子可能正遭受伤害或不当对待. Any tick -> top-of-report red alarm "安全筛检：已勾选 N 项 — 优先于本报告的所有分数" with `SAFETY_TXT`. Parent flow: these are clinician-only by page design; see section 8.
- `DEVAGE` age commentary (2–3 y, 4–5 y, 6–8 y, 9+): text only; plus a notice when `mo<72` and E1 or E4 pct >=30 ("请务必以持续时间与功能影响为主要判读依据").

### 6. Scoring
```js
function dimStat(d){... tested++;sum+=v; if(v>=2)high.push ... pct:tested>0?Math.round(sum/(tested*3)*100):null}
function symStat(){... pct:tested>0?Math.round(sum/(tested*3)*100):null}   // over all 42, only tested items
function impStat(){... same over IMP, max 3 each}
```
Denominator = tested (answered, not -1) items x 3. No minimum-answered rule per dimension or overall. Dimension pct shown; "经常以上" count = items >=2.

### 7. Grading
(a) On-page bands:
- Symptom (`SYMB`, `symBand(p)` first match with `p>=min`): >=50 `症状表现密集`; 30–49 `症状表现中等`; 15–29 `症状表现轻微`; <15 `症状表现少`.
- Impact (`IMPB`): >=40 `功能影响明显`; 20–39 `功能影响中等`; <20 `功能影响轻微`.
- **Decision matrix** (`verdict()`): `hiS = s.pct>=30`, `hiI = m.pct>=20`; `MATRIX` cell:
  - !hiS,!hiI: `目前未见明显情绪困扰`
  - hiS,!hiI: `有症状，但尚未影响日常功能`
  - !hiS,hiI: `症状分散，但功能影响明显` ("这个组合最值得警觉")
  - hiS,hiI: `症状密集且已影响日常功能` ("建议安排儿童心理或儿童精神科的专业评估")
  - Naming quirk: cell says "症状密集" at >=30% although the `SYMB` band named 密集 starts at 50%.
  - `verdict()` returns null (grade "资料不足") if symptom pct or impact pct is null (impact needs >=1 tested impact item).
  Page states "本表不给单一总分".
(b) postMessage:
```js
window.parent.postMessage({sxkTool:1,id:"emo",name:val("f_name"),grade:(v?v.cell.key:"资料不足"),
  score:(s.pct==null?0:s.pct),note:"SXK-EMO 完整版 症状 "+(s.pct==null?"—":s.pct+"%")+"／影响 "+(m.pct==null?"—":m.pct+"%")},"*")
```
`grade` = one of the 4 matrix strings or `资料不足`; `score` = symptom pct 0–100 (impact only inside `note` text). Note `name` here is the child's name (other tools send tool name).
(c) The saved JSON `collect()` also has `sym`, `imp`, `dims` (per-dimension pct) usable as raw data.
Mapping to 0–3 (engine's job): candidates (i) symptom band 4 levels -> 0..3 with cut points 15/30/50; (ii) the matrix cell -> 4 cells, but ordering of "症状少+影响大" vs "症状多+影响小" is a clinical choice; (iii) symptom band, escalated one level when impact pct >=20. Client primary dimension: 情绪与行为. This is a client decision (open Q1).

### 8. Safety / referral / clinician content
- Safety (3 items) is the only clinician-gated piece. Page text when ticked (`SAFETY_TXT`): 请立即停止例行的筛查与解读流程; 当日由医师或心理师进行面谈评估; 依机构的通报与危机处理规定办理并记录; 家长离开前须完成安全说明与紧急联络方式确认; 不要承诺保密. Written for institution staff, not parents.
- Red-flag box (`FLAGS`) is parent-visible text; `low` ("持续的情绪低落或对原本喜欢的事失去兴趣") -> "不属于焦虑筛查涵盖的范围，须另行评估"; `school`/`acute` -> "近期就医", "数周内介入".
- Client spec: P0 safety from T1 triggers "SXK-EMO 照推，入口加一句「建议在专业人员陪同下填写」" (spec §P0, line ~112 of the v3 spec file); exact wording by client pending.
- Fill instruction: "填答时请不要与孩子一起看题目; 若孩子在场请另安排时间".
- No clinician needed for the 42+6 items; no materials; no timing beyond the last-month window.

### 9. Old file
No predecessor in `src/t2/toolkit/`. Not comparable. (Client lists it as new.)

### 10. Open questions
1. 0–3 mapping: symptom band, matrix, or combination (see 7).
2. Parent flow for the three clinician-only safety items (s1 self-harm talk, s2 self-harm behaviour, s3 abuse): ask the parent anyway with parent-safe wording, drop them, or route to the T1 P0 mechanism? Page itself says "不宜只靠家长填答".
3. DUR / EXCL / FLAGS do not change the grade: should durations <2 weeks suppress a grade (page says "不宜依本次结果推论长期状态")?
4. "资料不足" case and the unanswered-item path (parent can skip with a confirm) need an engine rule.
5. Texts contain terms like 焦虑症, 强迫症, 精神科, 拒学 in report copy (not items): do not reuse without wording scan.

---

## 5. SXK-TIC 抽动严重程度评估量表 完整版 (NEW)

### 1. Identity
- `<title>` 森心康抽动严重程度评估量表 · 完整版 SXK-TIC; `<h1>` 森心康抽动严重程度评估量表 · 完整版, small "SXK-TIC 完整版 ｜ 4 岁以上 ｜ 运动＋发声各五维度 ｜ 临床评定＋家长报告＋本人自评". JSON `tool:"SXK-TIC-F", ver:1`. One `<script>`, `var`, no `window` export. Data literals are plain (no `+` concatenation in the data region).
- Age: `calcAge()` returns **whole years**; `refreshAge()` `y<4` -> warn "本表适用 4 岁以上", else ok (and `y>=11` suggests the self version). `start()` does not block. Client spec 48–215 months; page has no upper limit.

### 2. Rater forms (`FORMS`)
- `c` 临床评定版: 医师或治疗师依会谈、观察与家长陈述综合评定; **"疗效判定与疗程决策请以本版为准"**.
- `p` 家长报告版: 主要照顾者依孩子最近一周在家中与学校的表现填写 (page says "家中与放松时的抽动通常比诊间多，这一版常是最接近真实的"; also "维度评分需要临床判断" appears in the single-source warning).
- `s` 本人自评版: 本人填写，建议 11 岁以上; the only source for 前驱冲动 and 情绪负担.
- **Items and anchors are the same across the three forms** (one `KEYS` list, `S.ans.{c,p,s}`); a report can be generated from any one of them. `mainForm()`: `c` if any `c` answer, else `p`, else `s`; headline/grade use only the main form. If several are filled the report shows a comparison table and a note when severities differ by >=8.
- `start()` requires 评估人员 * (医师／治疗师姓名). Nothing in the logic marks any individual item clinician-only; clinician-only is the `c` form as a whole (and evaluator fields like 病历号).
- A started form must be fully completed (`finish()` blocks incomplete forms with alert; "若不打算填这一份，请先清空本份评分").

### 3. Item structure per form (15 required ratings)
- `SECS`: M 运动型抽动 and V 发声型抽动, each 5 dimensions rated 0–5: n 数量, f 频率, i 强度, c 复杂度, x 对当下活动（沟通）的干扰. 10 items.
- `IMPACT` 4 items rated 0–5: school 学习与课堂, family 家庭生活, peer 同伴与社交, self 情绪与自我看法.
- `URGE` 1 item rated 0–5: 前驱冲动（做之前的那股感觉）.
- Each rating has a 6-entry anchor list `a[0..5]`, e.g. M.n: 完全没有 / 只有一种 / 两到四种 / 五种以上，但彼此独立 / 五种以上，其中有成串出现的 / 多种且有两串以上固定顺序的动作; M.f: 完全没有 / 一周只有几次 / 每天都有，但中间空档很长 / 每天多次，清醒时约半数时间没有 / 清醒时大部分时间都在出现 / 几乎不间断，空档只有几分钟. M.i level 5 "极强，会造成疼痛、瘀伤或身体损伤"; V.c level 5 "长串语句、仪式化的发声，或社交上难以处理的内容".
- `INV` checklist (described, not scored; "最近一周出现过的形式"): ms 简单运动型 12, mc 复杂运动型 10, vs 简单发声型 8, vc 复杂发声型 7 = 37 checkable items + "其他形式" text. Clinician-ish content (e.g. "必须「做完才舒服」的仪式化动作", "不由自主说出不适当的字词") but parent-checkable. The page says the checklist is "下一页「数量」维度的依据" but there is no code linking them.
- Typical parent load: 15 ratings + checklist + context fields.

### 4. Response options
All ratings: integer 0–5 with item-specific anchors; no N/A; no reverse items. 0 = none. Window: **最近一周**; "诊间没看到不等于没有".

### 5. Non-item inputs
- `URGE`: part of the 15 ratings but "不计入任何分数". Effect: report card "前驱冲动与行为治疗的适用性" (u>=3 -> HRT/行为治疗优先; 1–2 觉察训练; 0 卫教).
- `EXCL` (6 dropdowns, p0, "必填" but only a confirm): onset 起病方式, med 近期用药与物质, neuro 神经科病史, supp 可否短暂自主压抑, state 最近一周的压力与状态, obs 本次评分的资料来源. Any `bad` or blank -> "本次结果不能用来推论症状性质" notice and notes (e.g. 突然爆发 -> 需医师鉴别感染后神经精神症候群). No effect on grade/postMessage. Items such as supp and obs are clinician-style judgements.
- `FLAGS` (9 checkboxes): harm 抽动造成自我伤害或已有瘀伤破皮, neck 颈部剧烈抽动伴疼痛、麻木或手部无力, breath 影响呼吸、吞咽或进食, sudden 数天内突然爆发／感染后骤然出现, school 已请假、拒学或休学, mood 情绪低落、绝望或自伤念头, bully 在学校遭受嘲弄、排挤或霸凌, pain 抽动后持续肌肉疼痛, newmed 开始或调整药物后明显改变. Red "需要优先处理的情形" box, **independent of score**: "自伤性抽动、影响呼吸或吞咽、颈部剧烈抽动伴疼痛或手部无力属于不能等待的状况，请尽快就医". `mood` flag -> "心理专业介入应优先于抽动本身".
- `COMORB` (8 checkboxes): adhd, ocd, anx, mood, sleep, learn, rage, sens (short descriptions). Descriptive; report suggests further assessment; ADHD/OCD get extra paragraphs. Parent-answerable.
- `CTX` (7 dropdowns): onsetage, dur (病程长度), course, dx 已有诊断 (incl. 图雷特综合征), tx, fam, school_know. Descriptive.
- `EFFECT` (减分率): needs a **previous record JSON** (`S.prev`), irrelevant for first-time home use. `drop=(1-sev/pSev)*100`: >=95 完全缓解, >=66 显著改善, >=33 部分改善, >=0 改善有限, else 症状加重. Mentioned for completeness.

### 6. Scoring
```js
function sevScore(fk){return secScore(fk,"M").got+secScore(fk,"V").got}   // 0–50
function impScore(fk){... sum of 4 I_ items}                                // 0–20
function totScore(fk){return sevScore(fk)+impScore(fk)}                     // 0–70
```
No weighting; urge excluded; impact excluded from severity (but contributes to `tot`, shown only as 合计／70). Constants `SEV_MAX=50, IMP_MAX=20`.

### 7. Grading
(a) On-page `LEVELS` / `band(sev)` (sev = M + V, 0–50), best -> worst:
- 0–12 `极轻或缓解`; 13–25 `轻度`; 26–37 `中度`; 38–50 `重度`.
Impact: no bands; text rules `imp>=12 && sev<26` ("生活影响明显偏大"), `sev>=26 && imp<=6`, `imp>=8` (学校沟通).
(b) postMessage:
```js
window.parent.postMessage({sxkTool:1,id:"tic",name:val("f_name"),grade:bd.key,score:sev,note:"SXK-TIC 完整版 严重度 "+sev+"/50，生活影响 "+imp+"/20"},"*")
```
`grade` = the 4 band names above; `score` = severity 0–50 (not %).
(c) EFFECT scheme (change from previous record) — not applicable to a single visit.
Mapping to 0–3: natural and unambiguous: 极轻或缓解 -> 0, 轻度 -> 1, 中度 -> 2, 重度 -> 3 (cuts 13 / 26 / 38 on the 0–50 sum). Client primary dimension 情绪与行为; client also uses the T1 tic tag to force TIC for >=48 months.
- Possible engine escalation: `FLAGS` harm/neck/breath/sudden are page-level "不能等待"; they do not alter the band.

### 8. Clinician / observation / safety
- The `c` form is clinician-only by design; `p` and `s` are possible for lay raters but the page notes dimension ratings "需要临床判断" and that a parent-only record is limited ("补一份临床评定版，疗效判定应以该版为准"). Requires 评估人员 name in `start()`.
- Observation needs: 最近一周整体，家中影片建议; no materials.
- Safety/referral: red flags above; the report text "自伤性抽动…请尽快就医，不必等到下次回诊"; mood flag; sudden onset -> physician differential (PANDAS-like; the page does not name it in the flag, the `EXCL.onset` note says 感染后神经精神症候群).
- Disclaimer: scores not convertible to YGTSS; not diagnostic.

### 9. Old file
None. New tool.

### 10. Open questions
1. Which form does the parent flow use: `p` only? (then `c` evaluator name must be filled with a placeholder; `mainForm()` falls to `p`.)
2. Confirm 0–3 mapping 13/26/38; and whether `FLAGS` (harm/neck/breath/sudden) should bypass the grade as a referral.
3. Parent can't reliably do 复杂度/数量 anchors without a clinician? (page says it "需要临床判断").
4. Age gate: 48 months by client; page = 4 whole years and no cap (client 215 months).
5. Report copy names 图雷特综合征, 抽动症, 药物; do not reuse without wording scan.

---

## 6. ITQ / TTS / BSQ 婴幼儿气质评估问卷 (one HTML, three scales)

### 1. Identity and age picking
- `<title>` 森心康 婴幼儿气质评估; `<h1>` 森心康 婴幼儿气质评估; header small "院内施行版 · 离线单文件 · 4个月～7岁". No version string (export `tool:'森心康婴幼儿气质评估'`). Two scripts: first = data (`DIMS, DIM_DESC, SCALES, TYPES, TIPS`), second = logic. **No `postMessage` anywhere** (grep count 0; HUB flag `nomsg:true`; client spec: "目前不会自动回传结果，需治疗师手动登录").
- Scales: `SCALES.ITQ` 婴儿气质评估问卷 `ageMin:4, ageMax:8` (months, label 4～8个月), 95 items, 6-point; `SCALES.TTS` 幼儿气质评估问卷 `12–36` (1～3岁), 97 items, 6-point; `SCALES.BSQ` 儿童气质评估问卷 `36–84` (3～7岁), 72 items, 7-point.
- Selection: **the user clicks one of three cards** (`d.onclick=()=>{S.scale=c;...}`). Age is only advisory: `checkAge()` warns if `m<s.ageMin||m>s.ageMax` and offers a "改用" button for the first scale whose range contains the month (`Object.values(SCALES).find(x=>m>=x.ageMin&&m<=x.ageMax)`, so month 36 -> TTS first). **Gaps/overlaps:** 9–11 months matches no scale ("目前三份量表都不适用，若仍要施测，报告将注明超出适用年龄"); 36 months matches both TTS and BSQ; >84 months out. Out-of-range results are still produced with "结果仅供参考".
- Required: child name and sex (norms by sex), dob, fill date (`startFill()`).

### 2. Rater
Single rater: 主要照顾者 (parent). Fields 填写者 / 评估者 are free text. No forms.

### 3. Item structure and counts
Items are numbered 1..N across the entire scale (no sections on screen), 12 per page (`PER=12`), with `key[dimension]=[[itemNo, forward?],...]` giving the 9 temperament dimensions: 活动量, 规律性, 趋避性, 适应度, 反应强度, 情绪本质, 坚持度, 注意力分散度, 反应阈.
- ITQ items per dim (a=activity ...): 13, 12, 11, 11, 10, 10, 8, 10, 10 = **95**.
- TTS: 11, 11, 11, 9, 10, 11, 13, 10, 11 = **97**.
- BSQ: 8 x 9 = **72**.
All items shown to everyone using that scale; no start months. Parent answers 95 / 97 / 72 items (client says ~20 min).

### 4. Options
- ITQ & TTS (`points:6`): 1 从不, 2 很少, 3 偶尔, 4 有时, 5 常常, 6 总是. BSQ (`points:7`): 1 从不, 2 非常少, 3 偶尔有一次, 4 有时, 5 时常, 6 经常是, 7 总是.
- Plus **"不适用／无此经验" (`'NA'`)** on every item; counted as "answered" for the page gate, excluded from the mean (`if(v===undefined||v==='NA'){na++;continue;}`). All-NA dimension -> `mean:null` -> tag "未作答". Page advice "某向度作答题数少于该向度题数的一半时，结果不可靠" is text only, not enforced.
- Reverse items: `fwd?v:(s.points+1-v)`.
- Reference windows: TTS intro "最近四～六个星期"; ITQ/BSQ no window.

### 5. Non-item inputs
None scored. Only context fields (名字, sex, dob, date, informant, therapist, id). `TYPES` (3 prototype types) and `TIPS` (per-dimension advice) are fixed text.

### 6. Scoring
```js
for(const dim of DIMS){let sum=0,n=0,na=0;for(const [q,fwd] of s.key[dim]){const v=S.ans[q];if(v===undefined||v==='NA'){na++;continue;}sum+=fwd?v:(s.points+1-v);n++;}
  const mean=n?sum/n:null; ...
  const nm=s.norms&&s.norms[S.f.sex]&&s.norms[S.f.sex][dim];
  if(mean!==null){if(nm){z=(mean-nm[0])/nm[1];band=z>1?'hi':z<-1?'lo':'mid';}
                  else{const mid=(1+s.points)/2;band=mean>=mid+1?'hi':mean<=mid-1?'lo':'mid';}}
```
Per-dimension mean (1..points); with norms: z vs sex-specific Taiwan mean/SD (ITQ and BSQ have `norms`; TTS `norms:null`); without norms: mean >= mid+1 (TTS 4.5) hi, <= mid-1 (2.5) lo. No overall score.

### 7. "Grading" / output (no 0–3, no overall grade)
(a) Per dimension `band` hi/mid/lo, labelled with the pole names. **Pole direction differs by scale** (`poles`, high end second): ITQ/TTS: 活动量 小→大, 规律性 有规律→无规律, 趋避性 接近→退缩, 适应度 高→低, 反应强度 微弱→激烈, 情绪本质 正向→负向, 坚持度 高→低, 注意力分散度 易分散→不易分散, 反应阈 高→低. BSQ: 活动量 小→大, 规律性 无规律→有规律, 趋避性 退缩→接受, 适应度 低→高, 反应强度 微弱→激烈, 情绪本质 负向→正向, 坚持度 小→大, 注意力分散度 不易分散→易分散, 反应阈 低→高. So "hi" does not mean the same thing across scales.
(b) A-factor block ("养育难易相关的五个向度": 规律性, 趋避性, 适应度, 反应强度, 情绪本质): `aFactorHigh` says which end is the 难养 side (ITQ/TTS: all five high-end; BSQ: only 反应强度 high-end, the other four low-end). Output = list of 偏「难养」方向 / 偏「好养」方向 / 中等 dims. The page explicitly says: "原文未提供五种养育类型…正式判定标准，本系统不自动分型". `TYPES`: 乐天型 / 磨娘精型（难养型） / 慢吞吞型 with prevalence text, reference only.
So the tool's output is: 9 dimension means + hi/mid/lo band (+ z for ITQ/BSQ) + A-factor 难养/好养 lists; **no temperament type, no overall grade, no postMessage**. Client spec also lists no primary dimension (主维度 "—", secondary 情绪与行为, 感觉处理).
(c) Old `.ts` tempa/tempb: per-dimension `|mean-2.5|` tiers 0.42 / 1.0 (两端之间 / 稍偏 / 明显偏); v2 spec §5.9: `dev>=1.0` yields finding tags (emo.activity_high, emo.regularity_low, emo.slow_to_warm, emo.adaptability_low, emo.intensity_high, emo.mood_negative, att.inattention, sen.threshold_low; `learn.task_persistence` for low 坚持度). The new page's per-dim hi/lo with sex norms could feed the same kind of tags, but the pole directions must be normalised per scale first.

### 8. Clinician / observation / safety
No clinician-only parts, no materials, no timing, no safety/referral triggers. Text of TIPS/TYPES uses labels such as 难养, 磨娘精型, 乐天型, "最好带" — judgemental for parent-facing use.

### 9. Compare with old `sxk-tempa.ts` / `sxk-tempb.ts`
- Old: 9 dimensions D1–D9 x 8 = 72 items each (tempa 1–3 y, tempb 3–7 y), 6-point 0–5 "非常符合…非常不符合", no reverse items, `startMonth null`, no norms; items like "整天动来动去，很少安静下来", "每天吃饭时间差很多".
- New: Carey & McDevitt (徐澄清 1988 中文化) item pools: ITQ 95, TTS 97, BSQ 72, frequency scales 1–6/1–7 with reverse keys and N/A, Taiwan norms (ITQ, BSQ), age 4–84.
- Script check: **0 of 72 + 0 of 72** old item texts appear in the new 264 items. Spot checks (new): ITQ "清醒时，可乖乖地让你剪指甲。", "每天在相同的时间想要吃奶（时间相差在一小时以内）。"; TTS "每天晚上想睡觉的时间差不多都固定（变动在半小时内）。", "他能安静地让别人替他穿衣服。"; BSQ "洗澡时，把水泼得到处都是，玩得很活泼。", "每天定时大便。".
- Verdict: **different questions, different scale, different grading, different age bands (4–8 / 12–36 / 36–84 months vs old 12–36 / 36–84)**. Also new TTS "向度归类由森心康依题意整理" (not the original scoring key; `keyNote`), and ITQ has two misprinted items resolved by the editor (81/84 and 44/68).

### 10. Open questions
1. What does the engine use as temperament output (client: "—" primary dimension)? Options: per-dimension band tags; A-factor count; none. Needs client decision plus per-scale pole normalisation.
2. Gap 9–11 months and overlap at 36 months (TTS vs BSQ): rule to pick the scale automatically from age (page leaves it to the user).
3. No postMessage: results can only be captured by reading page state or re-implementing the scoring (96/97/72 keys are in the file; norms for ITQ/BSQ included).
4. Norm use needs child sex (required on the page).
5. Copyright/provenance: items are from Carey & McDevitt / 徐澄清 (Taiwan) and are not 森心康-authored (unlike the other tools); note the page itself cites sources.
6. TTS has no norms: its bands are descriptive (mid +/- 1), not comparable to ITQ/BSQ.
