# v3 客戶文件 ↔ 實作 需求追溯矩陣

> 2026-10-08 由背景 agent 逐條比對產出、主線核對後修正（期末檢核區、邊界聲明兩條當場補上；列印、需排除、Python 參考實作改判）。
> 計數為人工估計（±3），以各列狀態為準。

分支 `t2-v3`，`v3-start..HEAD` 共 63 個 commit，HEAD `d5c22a4`。日期 2026-10-08。
狀態圖例：✅ 已實作　⚠️ 實作但為暫採（待問表編號）　🔀 刻意偏離（ADR／規格）　⏸ 延後　❌ 未實作　? 無法驗證
**開關**：`T2_RECOMMEND_V3`、`TRAINING_PUSH_V3` 預設皆關（`server.ts:165,171`；`assertV3Switches` 要求兩者同開）。下表「✅」指程式碼與測試存在，不代表正式站已打開。
**執行期預設**：`ONE_TOOL_PER_DIMENSION = true`（`src/t2/recommend/parentPlan.ts:194`）→ 家長端實際走 ADR-0011 的每維一份模式。引擎本身的客規逐格行為（`recommend()` 預設選項）仍完整保留並有測試，下表以「引擎 ✅／執行期 🔀」分開標。

縮寫：REC＝推薦規格書 v1.0；PUSH＝推送規則說明書；KIT＝完整版工具包（我方 `t2-v3-toolkit-full-edition.md`）。
測試檔皆在 `test/`。

---

## 一、REC：T2 量表推薦規則規格書

### §0 一頁看懂／§1–§2 範圍與原則

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§0-出3to5 | 每人推薦 3–5 份 T2 | `engine.ts` `MIN_TOOLS/MAX_TOOLS`、步驟 9/11 | `t2RecommendProperties.test.ts`（V3） | 引擎 ✅／執行期 🔀（ADR-0011、R-35：每維一份不套份數上限）；R-13 暫採 |
| REC-§0-90分鐘 | 家長端合計 ≤90 分、可分兩次 | `engine.ts` 步驟 12、`session` 欄 | `t2RecommendProperties.test.ts`（V8） | 引擎 ✅／執行期 🔀（R-35 不套時間上限，仍建議分 2 次） |
| REC-§0-不推薦 | T1 全未見明顯且無診斷 → NO_T2、3–6 月複篩 | `engine.ts` 步驟 5；`parentPlan.ts` `NO_T2_TEXT` | `t2RecommendCases.test.ts`（案例 9）、`t2ParentPlan.test.ts`、`t2PlanV3.http.test.ts` | ✅ |
| REC-§0-6步流程 | 引擎 6 步（整理→安全→排隊→必選→覆蓋→上限排序） | `src/t2/recommend/engine.ts` `recommend()` | 同下各步 | ✅ |
| REC-§1-T1等級 | 8–7/6–5/4–3/2–0 → 0–3；紅旗「還不能」至少中度 | `input.ts` `levelOf` | `t2RecommendInput.test.ts`（「等級與月齡」） | ✅ |
| REC-§1-適用年齡 | T1 12–191 月；<12 月直接 ASQ3+GM+PLC | `engine.ts` `bandOf`（<12 照 A 算）；<12 月專案無 T1 | `t2RecommendProperties.test.ts`（V13 邊界） | ⚠️ 181–191 月仍用 E 段題（R-5）；<12 月「直接推 ASQ3+GM+PLC」? 未找到專門實作 |
| REC-§2-安全先於一切等 9 條原則 | 見各步驟 | engine | 見各步驟 | ✅（原則 5 一維一主量表→見 ADR-0011） |

### §3 輸入資料

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§3-ageM矯正 | 早產（孕週<37）且<24 月用矯正月齡 | `input.ts` `correctedAgeMonth` | `t2RecommendInput.test.ts`（V12） | ⚠️ 孕週欄新增選填，沒填＝足月（R-4） |
| REC-§3-band | A 12–23／B 24–47／C 48–71／D 72–119／E 120–191 | `engine.ts` `bandOf`；`input.ts` 用 `getT1AgeBand` | `t2RecommendProperties.test.ts`（V13）、`ageBandDrift.structure`（worklog） | ✅ |
| REC-§3-levels/scores/rfdims/items | T1 等級、分數、紅旗維度、逐題 | `input.ts` `buildRecommendInput`；T1 存逐題（worklog R1b `ef72559`） | `t2RecommendInput.test.ts`、`childExtraFields.test.ts`（「T1 交卷存逐題作答」） | ✅；舊 T1 無逐題→`itemsMissing`（R-11）⚠️ |
| REC-§3-dx | 診斷 0–2 個（T1 基本資料新欄） | 型別/輸入 `input.ts`、引擎 `dx` | `t2RecommendInput.test.ts`、`childExtraFields.test.ts` | 引擎 ✅／執行期 🔀（ADR-0011：診斷那題拿掉、`runRecommendation` 清空 diagnoses） |
| REC-§3-school | 是否上園/學校 → 教師版可用 | `input.ts`、`engine.ts` 步驟 1 | `t2RecommendProperties.test.ts`（V4） | ✅ |
| REC-§3-done | 近 3 個月已做的不重推 | `parentPlan.ts` `runRecommendation`（`doneCodes`，90 天） | `t2ParentPlan.test.ts`（「rec 排除近 90 天做過的」）、`t2PlanV3.http.test.ts`、`t2RecommendProperties.test.ts`（V7） | ⚠️ 90 天算法為 R-29 暫採；舊題庫不算（R-24） |
| REC-§3-extraTags(TIC) | 家長勾「有抽動」→ TIC 標籤 | `input.ts` `hasTics` | `childExtraFields.test.ts`、`t2RecommendInput.test.ts` | ✅（標籤）；必選 TIC 量表→見 REC-§9.2-step7 |
| REC-§3-hearingChecked | 聽力檢查是/否/不知道 → 前置提示 | `input.ts`、`engine.ts` 步驟 4 | `t2RecommendInput.test.ts` | ✅ |
| REC-§3-T1新增4欄 | T1 頁新增 診斷/上學/抽動/聽力 | `src/components/ChildProfileForm.tsx` 補充資料區（worklog `ef72559`）；`childFieldsCopy.ts` | `childExtraFields.test.ts` | ✅（診斷欄已 🔀 拿掉） |

### §4 量表庫、§5 缺口

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§4-31份量表 | 31 份（24 T2＋7 T3）含月齡/填寫人/分鐘/主次維度/組 | `src/t2/recommend/config.ts`（由 `scripts/t2-extract-recommend-config.ts` 從 docx 抽出） | `t2RecommendConfig.test.ts`（重跑逐位元一致；31 份） | ✅ |
| REC-§4-備註SP/SPb | SP 24–59、SPb 60+ 二選一；LDS≥12 歲優先 LDP | `engine.ts` `preferenceOf`；`groupMax` | `t2RecommendProperties.test.ts`（V13 量表切換） | ✅ |
| REC-§5-可用表 | 九維 × 5 年齡段哪些問卷可用 | `preferenceOf` + `usable()` 月齡/填寫人 | `t2RecommendGolden.test.ts`（30 格） | ✅ |
| REC-§5-缺口8項 | 缺口與替代規則（ATT<36、SEN<24、EMO<36/>155、LEARN<72、COG>84、MOT>84、LANG>144、ADL>180） | `engine.ts` 步驟 8 `gaps/gapDims`；替代走 `preferenceOf` 次序 | `t2RecommendGolden.test.ts`（notes）、`t2RecommendProperties.test.ts`（gapDims） | ⚠️ 缺口句為引擎通用句（「改為治療師當面評估」），非 §5 表逐項句；§11 的 30 格皆對上。ATT<36/SEN<24 氣質替代未逐項驗? |

### §6 優先級

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§6-P0 | 安全題／動作紅旗→提示非量表；安全同觸發 SXK-EMO | `engine.ts` 步驟 4 alerts；步驟 7 R3 | `t2RecommendProperties.test.ts`（V9）、`t2RecommendCases.test.ts`（案例 6、7） | 提示 ✅（字句為中性暫採 R-3）；R3 加 EMO：引擎 ✅／執行期 🔀（ADR-0011 改提示＋預約） |
| REC-§6-P1 | 紅旗題維度、社交警訊且社交≥輕度 → 主量表＋第二份 | `engine.ts` `tierOf`、步驟 9 | `t2RecommendCases.test.ts` | 引擎 ✅／第二份執行期 🔀（ADR-0011）；R-14 紅旗標記以 T1 題庫為準 ⚠️ |
| REC-§6-P2 | 診斷核心維度 | `tierOf` | `t2RecommendGolden.test.ts` | 引擎 ✅／執行期 🔀（診斷不進推薦） |
| REC-§6-P3/P4/P5 | T1 中度以上／輕度／診斷相關鑑別 | `tierOf` | golden＋cases | P3/P4 ✅；P5 引擎 ✅／執行期 🔀（無診斷） |
| REC-§6-基線 | 有中度以上或有診斷→加 SXK-QOL（≥24 月） | 步驟 10 | `t2RecommendGolden.test.ts` | 引擎 ✅／執行期 🔀（ADR-0011 不加基線） |
| REC-§6-同級排序 | 先比 T1 等級再依年齡段發展重點（5 段 × 9 維） | `engine.ts` `AGE_ORDER`、步驟 5 排序鍵 | golden＋cases | ✅ |

### §7 診斷檔案

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§7-六診斷 | 核心/相關/鑑別/必選量表（LDADHD/ASD/GDD/CP/EMO/LANG） | `config.ts` `dx`；`engine.ts` 步驟 7 | `t2RecommendConfig.test.ts`（必選量表都在庫）、`t2RecommendGolden.test.ts` | 引擎 ✅／執行期 🔀（ADR-0011） |
| REC-§7-兩診斷並存 | 核心取聯集、必選依主診斷先放、總數≤5 | 引擎 `profiles` | ?（golden 只測單診斷） | 引擎 ✅? 無專測／執行期 🔀 |
| REC-§7-診斷失效 | 低於適用月齡自動失效並提示（LDADHD/EMO 36） | `engine.ts` 步驟 3 `DX_AGE` alert | `t2RecommendGolden.test.ts`（LDADHD A 組 notes） | 引擎 ✅／執行期 🔀 |
| REC-§7-需排除 | 「需同時排除」欄（聽力、睡眠…） | 無（客規僅描述；僅聽力前置有實作） | — | 🔀 診斷檔案在家長端執行期關閉（ADR-0011）；聽力前置仍做（PREREQ 提示） |

### §8 T1 關鍵題（22 條）＋兩條補充

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§8-22條 | 22 條關鍵題（組/維度/題序/條件/標籤） | `config.ts` `keyItems`；`engine.ts` `scanKeyItems` | `t2RecommendInput.test.ts`（「客規 §8 關鍵題 ↔ 我們的 T1 題目」：22 列一一對應、題文逐字） | ✅ |
| REC-§8-社交警訊效果 | 社交升 P1；16–30 月必選 M-CHAT；首選 M-CHAT→ASB→SOC | `tierOf`、步驟 7 R1、`preferenceOf` | `t2RecommendCases.test.ts`（案例 1） | 引擎 ✅／M-CHAT 必選與首選順序執行期 🔀（ADR-0011 改提示＋預約，`socialSignalItems`） |
| REC-§8-無口語 | 語言首選 PLC→VOC；先做聽力檢查 | `preferenceOf` LANG、alerts PREREQ | `t2RecommendGolden.test.ts`（LANG A/B） | ✅ |
| REC-§8-構音/叙事/書寫/學障T3預告 | ARTIC→ART、NARR→NAR、WRITE→SMA、LD_SIG→WISC | `engine.ts` `t3Preview` | golden（T3 欄）、`t2RecommendCases.test.ts` | 引擎 ✅／執行期 🔀（T3 不回、不出：rec 規格 §4、使用者 10/07） |
| REC-§8-語用/閱讀 | 只記錄（PRAG/READ） | `scanKeyItems` 加標籤 | `t2RecommendInput.test.ts` | ✅ |
| REC-§8-安全 | E 組情緒第 4 題=2 → P0 安全＋SXK-EMO | `tags.has('SAFETY')` | `t2RecommendProperties.test.ts`（V9） | 同 REC-§6-P0 |
| REC-§8-補充A組注意力紅旗=社交紅旗 | 紅旗連動；任何年齡社交紅旗→警訊標籤 | `engine.ts` 步驟 2 | `t2RecommendCases.test.ts`（案例 1）；R-14 | ✅（R-14 ⚠️） |
| REC-§8-TIC | 勾抽動→TIC 標籤；≥48 月必選 SXK-TIC | 步驟 7 R4 | `t2RecommendOnePerDimension.test.ts` | 引擎 ✅／必選執行期 🔀（ADR-0011，改 `TIC_NOTICE_TEXT` 提示＋預約） |

### §9 推薦算法（步驟 1–14）、§9.1 首選順序、§9.3 組上限、§9.4 參數

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§9.1-首選順序 | 9 維首選量表表（含條件列） | `engine.ts` `preferenceOf` | golden 30 格＋`t2RecommendProperties.test.ts`（V13 切點） | ✅ |
| REC-§9.2-step1 | 準備：band、可用填寫人（P＋T if 上學≥36＋S if ≥132） | 步驟 1 | V4/V5 | ✅ |
| REC-§9.2-step2 | 標籤掃描＋extraTags | 步驟 2 | `t2RecommendInput.test.ts` | ✅ |
| REC-§9.2-step3 | 診斷過濾 | 步驟 3 | golden | 引擎 ✅／執行期 🔀 |
| REC-§9.2-step4 | P0 提示（安全/醫療/聽力） | 步驟 4 | V9、案例 6/7 | ✅（字句 R-3 ⚠️）；`parentPlan.ts` 另出家長版字句 |
| REC-§9.2-step5 | 維度排隊、NO_T2 | 步驟 5 | cases 9、V10 | ✅ |
| REC-§9.2-step6 | 全面落後（中度以上≥5）→ BROAD 上限 2、先放 ASQ3/ADP | 步驟 6、7 R5 | `t2RecommendCases.test.ts`（案例 8） | ✅（R5 執行期保留） |
| REC-§9.2-step7 | 規則必選 R1/R3/R4/R5＋診斷必選 | 步驟 7 | cases 1/6/7/8 | R5 ✅；R1/R3/R4/診斷必選 引擎 ✅／執行期 🔀（ADR-0011） |
| REC-§9.2-step8 | 覆蓋：依排隊取首選、記理由、缺口 | 步驟 8 | golden＋cases | ✅ |
| REC-§9.2-step9 | 深度：目標份數、第二份 | 步驟 9 | golden＋cases（案例 5 SNAP-IV＋ATT） | 引擎 ✅／執行期 🔀（ADR-0011，R-33：被標記維度只一份） |
| REC-§9.2-step10 | 生活質量基線 QOL | 步驟 10 | golden | 引擎 ✅／執行期 🔀（ADR-0011） |
| REC-§9.2-step11 | 補足 QOL→ASQ3→ADP→ADL | 步驟 11 `FILL` | golden | 引擎 ✅／執行期 🔀（ADR-0011） |
| REC-§9.2-step12 | 時間上限、移除優先序 | 步驟 12 `DROP_ORDER` | V8、cases 8（移除 SXK-AB） | 引擎 ✅／執行期 🔀（R-35） |
| REC-§9.2-step13 | T3 預告規則 | `t3Preview` | golden（T3 欄） | 引擎 ✅／API 與畫面 🔀（不出 T3） |
| REC-§9.2-step14 | 輸出排序、前兩份第一次其餘第二次 | `OUTPUT_ORDER`、`session` | `t2RecommendCases.test.ts`（「前兩份是第一次填寫」） | ✅ |
| REC-§9.3-組上限 | LANGG/SOCG(ASD 3)/ATTG=2、BROAD 1(全面落後 2)、其餘 1 | `groupMax`；`config.ts` `groupMax` | `t2RecommendProperties.test.ts`（V6） | ✅ |
| REC-§9.4-參數 | MIN/MAX、90、45、5、36、132、3 月、DX_MIN_AGE 放後台可調 | 常數寫死於 `engine.ts`/`config.ts` | — | ⚠️ 先寫死，後台不做（R-6） |
| REC-§10-偽碼 | `usable()` 判斷與偽碼一致 | `engine.ts` `usable` | golden＋properties | ✅ |
| REC-§10-Python參考實作 | 客戶稱附 150 行 Python 參考實作可逐案對照 | 無（客戶沒給，規格 §3 說要跟客戶要） | — | — 客戶未提供；以客規 30 格標準表＋10 個案例逐格對照代替（`t2RecommendGolden`、`t2RecommendCases`） |

### §11 標準推薦表（30 格）

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§11-LDADHD ×5 | A–E 各一格 | `recommend()` 預設模式 | `t2RecommendGolden.test.ts`（fixture `test/fixtures/t2RecommendCells.json`，30 格逐字轉錄） | ✅（引擎層） |
| REC-§11-ASD ×5 | 同上 | 同上 | 同上 | ✅（引擎層） |
| REC-§11-GDD ×5 | 同上 | 同上 | 同上 | ✅（引擎層） |
| REC-§11-CP ×5 | 同上 | 同上 | 同上 | ✅（引擎層） |
| REC-§11-EMO ×5 | 同上 | 同上 | 同上 | ✅（引擎層） |
| REC-§11-LANG ×5 | 同上 | 同上 | 同上 | ✅（引擎層）；執行期因 ADR-0011 輸出不同（診斷不進），驗收基準只對引擎預設模式 |

### §12 十個示例案例

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§12-案例1 | 1歲10月無診斷、社交警訊→M-CHAT 首位 | `recommend()` | `t2RecommendCases.test.ts`、`t2RecommendInput.test.ts`（案例 1 作答） | ✅（R-14：客規紅旗維度寫法與 T1 題庫不同，引擎吃客規給的） |
| REC-§12-案例2 | 3歲語言發展障礙、只會單詞 | 同上 | `t2RecommendCases.test.ts` | ✅ |
| REC-§12-案例3 | 4歲6月語言明顯＋社交中度 | 同上 | 同上 | ✅ |
| REC-§12-案例4 | 5歲疑似自閉、感覺敏感 | 同上 | 同上 | ✅ |
| REC-§12-案例5 | 8歲 LD＋ADHD、識字紅旗 | 同上 | 同上 | ✅ |
| REC-§12-案例6 | 3歲4月腦癱、P0 醫療 | 同上 | 同上 | ✅ |
| REC-§12-案例7 | 13歲情緒障礙、P0 安全 | 同上 | 同上 | ✅ |
| REC-§12-案例8 | 5歲全面落後模式、時間上限移除 AB | 同上 | 同上 | ✅ |
| REC-§12-案例9 | 7歲全正常→NO_T2 | 同上 | 同上（獨立 `it`） | ✅ |
| REC-§12-案例10 | 4歲未上園、注意力情緒中度 | 同上 | 同上 | ✅ |

### §13 輸出格式與畫面

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-§13.1-JSON | 輸出 `engine/version/input/status/alerts/dimQueue/tools/t3/gaps/parentMinutes/overrides` | `types.ts` `Recommendation`（有 status/alerts/dimQueue/tools/t3/gaps/gapDims/removed/parentMinutes/tags；無 engine/version/input/overrides） | `t2RecommendProperties.test.ts` | ⚠️ 欄位形狀改寫（多 `gapDims/removed/tags`），`overrides` 永遠不存在（rec 規格 §4） |
| REC-§13.2-家長文案 | 標題、每份（針對維度/理由/填寫人/分鐘）、合計、分 2 次、缺口、NO_T2 | `parentPlan.ts` `parentPlanV3`、`reasonOf`；`src/components/T2EntranceV3.tsx` | `t2ParentPlan.test.ts`（用字掃描＋形狀）、`t2PlanV3.http.test.ts`、`t2EntranceCopy.structure.test.ts` | ⚠️ 「落后」換 `statusWording`（R-8）；T3 句不出 |
| REC-§13.3-治療師後台 | 增刪量表、刪必選填原因、`overrides`、一鍵加回、再評估帶出上次清單 | 無 | — | 🔀 不做（rec 規格 §4：T2 無治療師；`overrides` 永遠 `[]`） |

### §14 驗收清單 V1–V13

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| REC-V1 | 10 案例完全一致 | engine | `t2RecommendCases.test.ts` | ✅（引擎層） |
| REC-V2 | 30 格完全一致 | engine | `t2RecommendGolden.test.ts` | ✅（引擎層） |
| REC-V3 | 份數 3–5、年齡在範圍內 | engine | `t2RecommendProperties.test.ts` | ⚠️ 只驗做得到的範圍（R-13） |
| REC-V4 | 未上學不出教師限定量表 | engine | `t2RecommendProperties.test.ts` | ✅ |
| REC-V5 | ageM<132 不出本人限定量表 | engine | 同上 | ✅ |
| REC-V6 | 同組上限 | engine | 同上 | ✅ |
| REC-V7 | done 不再出現 | engine | 同上 | ✅ |
| REC-V8 | 家長端 ≤90 分 | engine | 同上 | 引擎 ✅／執行期 🔀（R-35） |
| REC-V9 | 安全題 alerts 第一條＋EMO 必出 | engine | 同上 | 提示 ✅／EMO 必出 引擎 ✅、執行期 🔀（改提示） |
| REC-V10 | 全正常且 NONE → NO_T2 | engine | 同上 | ✅ |
| REC-V11 | 有診斷但全正常仍 ≥3 份 | engine | 同上 | 引擎 ✅（R-13 驗「至少 3」）／執行期 🔀（診斷不進） |
| REC-V12 | 早產 30 週實足 20 月→約 18 月 | `correctedAgeMonth` | `t2RecommendInput.test.ts` | ✅ |
| REC-V13 | 邊界月齡 23/24…155/156 | engine | `t2RecommendProperties.test.ts`（V13 兩條：年齡段、量表切換） | ✅（35/36、59/60、143/144、155/156 是否皆列? 測試標題只列 23/24、47/48、71/72、119/120 與 SP/LDP/ASQ3 切點 → 部分 ?） |

### §15 待確認事項 6 題

| ID | 需求 | 狀態 |
|---|---|---|
| REC-§15-1 ASR 填寫人 | ⚠️ 暫依總表視為 T2（R-9、R-17） |
| REC-§15-2 ADP 主維度 | ⚠️ 暫依 COG（R-9） |
| REC-§15-3 15–18 歲範圍 | ⚠️ 暫依（R-9、R-5） |
| REC-§15-4 缺口補量表 | ⏸ 客戶端事務（R-9） |
| REC-§15-5 ITQ/TTS/BSQ 回傳 | ⚠️ 我方自算向度、不出 0–3（R-23） |
| REC-§15-6 價格與套餐 | ⏸ `PAYWALL_FREE`（rec 規格 §5；R-9） |

---

## 二、PUSH：評估結果→訓練活動 推送規則說明

核心：`src/t2/trainingPush.ts`（純函式）、`src/t2/trainingPeriodService.ts`（一期生命週期）、`src/t2/pushCopy.ts`（字）、`src/t2/activityMatch.ts`（`DIM_MOD`、`OFFSET`，沿用）、`src/db/t2TrainingPeriods.ts`（資料層）、`src/components/training/PlanScreen.tsx`（畫面）。全部在 `TRAINING_PUSH_V3` 後面。

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| PUSH-零-五關順序 | 五道關卡先序後齡後挑 | `planPeriod`（`trainingPush.ts:373`） | `t2TrainingPeriod.test.ts` | ✅ |
| PUSH-一-三色 | 紅/橙/綠：T2 分級 0→綠、1–2→橙、3→紅 | `dimensionColors`、`COLOR_OF_BAND` | `t2TrainingPush.test.ts`（「第一關：顏色」） | ✅（P01） |
| PUSH-一-T1推定 | 沒做量表：≥88 綠、56–87 橙、<56 紅；卡片標「T1 推定」 | `colorFromT1Score`；`pushCopy.ts` `SOURCE_LABEL` | `t2TrainingPush.test.ts`、`t2WeeklyPlanV3.http.test.ts`、`t2PushCopy.test.ts` | ⚠️ 7 分(87.5)取橙（P-3） |
| PUSH-二-固定順序 | 語言→動作→認知→注意力→感覺→學習→社交→情緒→日常 | `PUSH_ORDER`、`sortByPush` | `t2TrainingPush.test.ts`（「第二關：順序」含原文例子） | ✅（P02） |
| PUSH-二-顏色大於順序 | 紅一定排綠前 | `sortByPush` | 同上 | ✅ |
| PUSH-三-四年齡段偏移表 | 4 段 × 3 色偏移 | `activityMatch.ts` `OFFSET`、`ageKeyOf`；`periodWindow` | `t2ActivityMatch.test.ts`（「OFFSET 與 §7.2 逐格相同」）、`t2TrainingPeriod.test.ts`（4 岁三例） | ✅（P03） |
| PUSH-三-偏移取值 | 「減 12 到 24 月」→ 窗 [m−24, m−12] | `periodWindow` | `t2TrainingPeriod.test.ts` | ✅ |
| PUSH-三-下限0 | 窗口最低 0 | `periodWindow` | `t2TrainingPeriod.test.ts`（「窗口最低到 0」） | ✅ |
| PUSH-三-窗口放寬 | 窗內沒有→放寬月齡，仍限該能力模組 | `candidatesFor`（放寬層） | `t2TrainingPeriod.test.ts`（「窗口內的全部排在放寬的前面」「不跨模組群」） | ⚠️ 放寬方向（距離近、同距離先往下）為暫採 P-1（P07） |
| PUSH-四-能力模組表 | 9 能力 → 模組（動作 1–5…日常 3/5/6/9/12/15） | `activityMatch.ts` `DIM_MOD` | `t2ActivityMatch.test.ts`（「維度 → 模組 §7.2 重抄一次」） | ✅（P04） |
| PUSH-四-模組編號 | 模組 N＝(N−1)×20+1..N×20 | `moduleNoOf`（activitySeed） | `activityTagsImport.test.ts`/seed 測試? | ✅? 未逐條驗 |
| PUSH-五-編號由小到大 | 窗內依編號升序 | `candidatesFor` | `t2TrainingPeriod.test.ts`（「語言红 24–36 … 按编号排」） | ✅（P05）；已退場標籤/targetMonth/avoidIf（客戶規則不看標籤） |
| PUSH-五-不重複 | 一期內活動不重複 | `planPeriod` | `t2TrainingPeriod.test.ts`（「一期之內不重複」、窮舉 0–216 月） | ✅（P06） |
| PUSH-五-跨月重新從最小開始 | 每月新窗口內編號最小開始 | `planPeriod` | `t2TrainingPeriod.test.ts`（「同一能力、同一個月…」） | ✅ |
| PUSH-五-為什麼給卡 | 每張卡印編號、模組、窗口 | `SlotReason`、`pushReason` | `t2PushCopy.test.ts`、`t2TrainingPeriodService.test.ts` | ✅（P14） |
| PUSH-六-權重 | 紅3橙2綠1 | `COLOR_WEIGHT` | `t2TrainingPush.test.ts`（名額） | ✅ |
| PUSH-六-參與者 | 所有紅橙；全綠取前三 | `participants` | `t2TrainingPush.test.ts`（「九個全綠→前三」） | ⚠️ 對規格 §4.3 的詮釋（P09 取代 10/06「全 clear 都配」） |
| PUSH-六-比例四捨五入校正12 | 12 名額按權重分、校正 | `monthlyQuotas` | `t2TrainingPush.test.ts`（4/4/2/2 例子、3^9 窮舉） | ✅（P08） |
| PUSH-六-下限1 | 參與者至少 1 | `monthlyQuotas` | 同上（窮舉） | ✅ |
| PUSH-六-上限6 | 單一能力 ≤6 | `monthlyQuotas` | 同上 | ⚠️ 只有 1–2 個能力時與「固定 12」矛盾，補下一能力當綠（P-2） |
| PUSH-六-交錯 | 同一週盡量≥2 能力 | `interleave`（平滑加權輪詢） | `t2TrainingPush.test.ts`（「交錯排列」） | ✅（P10） |
| PUSH-七-1週3個 | 取窗下緣最小編號 3 個、全簡單版 | 無 | — | 🔀 只做 3 個月（規格 §5.1：到院當天場景不存在） |
| PUSH-七-1個月12個 | 4週×3；第1–2週簡單、第3–4週標準 | 無（以 3 個月 12 週取代） | — | 🔀 同上（§5.1） |
| PUSH-七-3個月36個 | 12週×3、三段、窗口逐月上移 | `planPeriod`、`monthWindows`、`t2_training_periods` | `t2TrainingPeriod.test.ts`（24–36→24–28/28–32/32–36）、`t2TrainingPeriodStore.test.ts` | ✅（P11） |
| PUSH-七-三月做法 | 第1月簡單、第2月標準、第3月難一點 | `variantFor`；`pushCopy.ts` `VARIANT_LABEL` | `t2TrainingPeriod.test.ts`（「三個月的做法」） | ✅（P12） |
| PUSH-八-進步良好 | ≥80% 窗口上移一檔、難度跳「難一點」、每週 3 | `adjustmentFromCompletion`、`planPeriod`(good) | `t2TrainingPeriod.test.ts`、`t2TrainingPeriodService.test.ts` | ⚠️ 無治療師，改自動判（P-4）；完成率定義見規格 §5.2（P13） |
| PUSH-八-穩定 | 50–79% 窗不動、只換活動內容 | `planPeriod`(stable，避開上期 36 支) | `t2TrainingPeriod.test.ts`（「稳定」） | ⚠️ 同上 P-4 |
| PUSH-八-執行困難 | <50% 窗下移一檔、每週 2、全簡單 | `planPeriod`(hard)、`MONTHLY_QUOTA_HARD=8` | `t2TrainingPeriod.test.ts`、`t2WeeklyPlanV3.http.test.ts`（第 13 週→每週 2） | ⚠️ P-4、P-9、P-12 |
| PUSH-八-移一檔定義 | 顏色調一格重算窗口，不改評估結論 | `shiftColor`；`planPeriod` `windowColor` | `t2TrainingPush.test.ts`（「移一檔」）、`t2TrainingPeriod.test.ts`（「移一檔只動窗口」） | ⚠️ 參與者/名額不隨移檔變動為我方詮釋 |
| PUSH-八-三個月後重評 | 建議重做 T1+T2 | `weekly-plan` 新快照→新一期 | `t2TrainingPeriodService.test.ts`（「新報告…從第 1 期重來」） | ⚠️ 並行自動開下一期（P-11） |
| PUSH-九-步驟1–5(HTML操作) | 建檔→T1→T1 推薦方面→T2 矩陣→T2 報告 | T1/T2 流程（既有＋v3 推薦入口 `T2EntranceV3`） | 見 REC | ✅（流程已有；非推送規則本體） |
| PUSH-九-步驟6選周期 | T3 與訓練方案上半 T3、下半活動；選周期（1週/1月/3月） | 無周期選擇 | — | 🔀 同 §5.1；T3 不做 |
| PUSH-九-步驟7期末檢核UI | 治療師選進步狀況重新生成 | 自動判（`periodForWeek`） | `t2TrainingPeriodService.test.ts` | ⚠️ P-4 |
| PUSH-九-能力排序與配額表 | 方案頁顯示各能力色/窗口/本期個數/模組 | `PlanScreen.tsx`（`abilityRow`、`push.dimensions`） | `t2PushCopy.test.ts`、`t2TrainingPeriodService.test.ts`（「計劃頁的位置」） | ✅（P17）；畫面層無獨立渲染測試? |
| PUSH-九-逐週活動卡 | 練什麼/準備/怎麼玩/本期做法/小提醒 | Keep 既有 `DetailScreen.tsx`、`PlayerScreen.tsx` ＋本月做法 | `trainingDetail.test.ts`、`trainingScreens.render.test.ts` | ✅ |
| PUSH-九-打卡格＋觀察記錄 | 週一到日七格；家長觀察記錄欄 | `CheckinScreen.tsx`、`CalendarScreen.tsx`（Keep） | `trainingCheckin.test.ts`、`trainingCalendar.test.ts` | ⚠️ 心情/進步只記錄不進判斷（Keep §9-6） |
| PUSH-九-期末檢核區 | 三檔判斷標準印在頁面 | `PUSH_PAGE.adjusted`（只顯示已調整的結果） | `t2PushCopy.test.ts`? | ✅ 2026-10-08 補：`PUSH_PAGE.periodEndRows` 三檔判斷標準與做法印在計劃頁（`14b07a9`，`trainingScreens.render.test.ts`） |
| PUSH-九-可列印/存PDF | 整頁可列印，每張週卡自動分頁 | 無（grep 無 print 樣式） | — | 🔀 不做：客戶描述的是他們的離線單頁工具；本產品是手機線上 App、打卡在線上記錄。需要時另開票（待使用者決定） |
| PUSH-九-交代家長4句 | 「這個月一共 12 個活動…」等 | `pushCopy.ts` `guidanceLines` | `t2PushCopy.test.ts` | ✅（§5.3） |
| PUSH-十-紅色須轉介 | 紅色能力一定要轉介專業評估 | `pushCopy.ts` `referralLine` ＋ `serviceChoices`（`PlanScreen.tsx:595`） | `t2PushCopy.test.ts`（referralLine 被引入；專屬斷言?） | ✅ `referralLine`（`plan-referral`）＋邊界聲明 `PUSH_PAGE.boundary`、按筛查推估的提醒 `PUSH_PAGE.t1Evidence`（2026-10-08 補，`trainingScreens.render.test.ts`） |
| PUSH-十-非診斷非治療計畫 | 邊界聲明 | 家長端用語（`parentWording` 掃描） | `parentWording.structure.test.ts` | ✅? 整體聲明句未逐一確認 |
| PUSH-十-系統不含量表題目 | 「量表在獨立工具施測」 | — | — | 🔀 我方內建題庫與伺服器計分（ADR-0010，R-15） |
| PUSH-十-感覺處理借用模組 | 感覺處理借 2/3/5/11/14 | `DIM_MOD.SEN` | `t2ActivityMatch.test.ts` | ✅ |
| PUSH-十-活動庫可JSON覆蓋 | HTML 系統第 1 步可覆蓋活動庫 | 後台批量匯入 `POST /api/admin/activities/import`（不同機制） | `activitiesAdmin.http.test.ts` | 🔀 不適用（客戶 HTML 功能） |
| PUSH-腳本-300支 | 腳本總冊 300 支接入、人物配置 017/030/040 以腳本為準（規格 P15） | `scripts/t2/activityContent.ts`、`src/t2/activityContent.ts`、`2026-10-07-activity-people.sql` | `activityContent.test.ts`、`activityGuide.test.ts` | ✅（P15）；人物配置 ⚠️ P-8 |
| PUSH-P16-每週3支 | 每週 3 支連帶 x/4 → x/3 | `practiceStats.ts`（分母用實際支數）；`planPeriod` perWeek=3 | `t2PracticeStats.test.ts`（標題仍寫「四支」） | ? 邏輯用動態分母，但多處註解/文案仍寫 x/4、規格要的「結構測試釘 3」未找到 |
| PUSH-示範片模式 | 17 支示範片限制（`TRAINING_SAMPLE_ONLY`） | `planPeriod`(sampleOnly)、`server.ts:160` | `t2TrainingPeriod.test.ts`（「示範片模式」） | ⚠️ 保留、行為照舊（P-7） |
| PUSH-退場-舊配對 | 刪 `matchWeeklyActivities` 等（規格 §7） | `activityMatch.ts` 仍存在、開關關時使用 | `t2ActivityMatch.test.ts` | ⏸ worklog「推送票 6 拿掉舊配對」延後 |

---

## 三、KIT：完整版工具包（24 支 T2）

| ID | 需求 | 實作位置 | 測試 | 狀態 |
|---|---|---|---|---|
| KIT-ADR0010 | 抽資料、伺服器重算，不內嵌客戶網頁 | `src/t2/kitv3/*`、`scripts/t2-extract-kitv3.ts` | `t2KitV3.structure.test.ts` | 🔀 偏離 IT 接入說明書（ADR-0010；R-15 待客戶） |
| KIT-R3a | 抽取地基、型別、`--check`、結構測試 | `scripts/t2/kitv3.ts`、`kitv3-recipes.ts`、`src/t2/kitv3/types.ts` | `t2KitV3.structure.test.ts` | ✅（`527d60c`） |
| KIT-R3b | GM、SOC、ADP、PLC、LANG（達成率族；LANG PL 60 月、50 切點） | `kitv3/sxk-gm.ts` 等、`score.ts` | `t2KitV3Pct.test.ts` | ✅（`fd9d2bf`） |
| KIT-R3c-LQ | 56 題帶差、不確定、紅旗→至少 2 | `kitv3/sxk-lq.ts` | `t2KitV3Lq.test.ts` | ⚠️ 紅旗 → 至少 2 為暫採（規格 §4.3） |
| KIT-R3c-VOC | A 里程碑＋C；B 詞表不出、6 旗標僅算 3 條 | `kitv3/sxk-voc.ts` | `t2KitV3Voc.test.ts` | ⚠️ R-19 |
| KIT-R3c-ASQ3 | 21 題組、各面向 85/70/55、`RED_BANDS` 轉介 | `kitv3/sxk-asq3.ts` | `t2KitV3Asq3.test.ts` | ⚠️ R-28（1–2 月用 3 月組）；轉介不改 0–3 |
| KIT-R3c-MCHAT | 第一階段 20 題、0–2/3–7/8+ → 0/2/3 | `kitv3/mchat-rf.ts` | `t2KitV3Mchat.test.ts` | ⚠️ 不做第二階段（R-18）；授權 R-26 |
| KIT-R3d-ASB/ASR | 關切率族 22/40(ASB)、20/38(ASR)；倒退→最差段 | `kitv3/sxk-asb.ts`、`sxk-asr.ts` | `t2KitV3Concern.test.ts` | ⚠️ R-16、R-17 |
| KIT-R3d-QOL | 依月齡挑表、不出 0–3、報告一段 | `kitv3/sxk-qol.ts` | `t2KitV3Concern.test.ts`、`t2KitV3Submit.test.ts` | ✅ |
| KIT-R3e-AB/ATT | 33/50、25/42；功能影響不計分；ATT 課堂可整段「無法觀察」 | `kitv3/sxk-ab.ts`、`sxk-att.ts` | `t2KitV3Attention.test.ts`、`t2KitV3Submit.test.ts` | ✅ |
| KIT-R3e-SNAP/CHEXI | SNAP 1.2/1.8 取最重分量表；CHEXI 51/52/73 | `kitv3/snap-iv.ts`、`chexi.ts` | `t2KitV3SnapChexi.test.ts` | ⚠️ 授權 R-26 |
| KIT-R3e-LDP/LDS | 依年級挑題、4 段 | `kitv3/sxk-ldp.ts`、`sxk-lds.ts` | `t2KitV3Ld.test.ts` | ⚠️ 月齡→年級 R-27 |
| KIT-R3f-SP/SPb | H25/H512/H1215、28/45 | `kitv3/sxk-sp.ts`、`sxk-spb.ts` | `t2KitV3Sp.test.ts` | ⚠️ R-20（60–71 月用 H512） |
| KIT-R3f-ADL | 七級倒算、72/45 | `kitv3/sxk-adl.ts` | `t2KitV3Adl.test.ts` | ✅ |
| KIT-R3f-EMO/TIC | EMO 矩陣（影響高＋症狀低→2）；TIC 0–50 四段、紅旗轉介句 | `kitv3/sxk-emo.ts`、`sxk-tic.ts` | `t2KitV3EmoTic.test.ts` | ⚠️ R-21（安全題不問家長） |
| KIT-R3f-氣質 | 九向度高/中/低、不出整體分級、依月齡挑 ITQ/TTS/BSQ | `kitv3/temperament.ts` | `t2KitV3Temperament.test.ts` | ⚠️ R-23 |
| KIT-R3g-登錄/交卷 | 24 支登錄表；窗口照客規；缺答/多題/值域外 400；整段略過；年級 | `kitv3/index.ts`、`submit.ts`；`server.ts:1362,1401` | `t2KitV3Registry.test.ts`、`t2KitV3Submit.test.ts`、`t2ToolResultsV3.http.test.ts`、`t2ToolResultsV3Off.http.test.ts`、`t2ToolResultStoreV3.test.ts` | ✅（`T2_RECOMMEND_V3` 後；`toolkit_version = kit-20260923`） |
| KIT-§4.1-分段轉0–3 | 四段 0/1/2/3、三段 0/1/3；用頁面報告那套分段 | `kitv3/score.ts` `grade03` | 各支測試；`t2JudgeV3.test.ts`（「24 支答滿的 grade03 鍵都在 primary」） | ⚠️ R-7（自訂暫採）、R-16 |
| KIT-§4.1-無主維度 | QOL、ITQ/TTS/BSQ 不出 0–3、不進維度判定 | `judgeV3.ts` | `t2JudgeV3.test.ts`（「做了但沒有判定…不算數」） | ✅ |
| KIT-§5.1-維度判定 | 不篩/未做(partial、not_assessed、clear)/no_tool/多份取最重 | `src/t2/judgeV3.ts` | `t2JudgeV3.test.ts` | ⚠️ R-12 取較重 |
| KIT-§5.2-快照版本 | `T2FindingsV3`、`toolkitVersion`、近 90 天、舊快照照舊 | `src/t2/findingsV3.ts`；`server.ts:1536` | `t2FindingsV3.test.ts`、`t2FindingsV3.http.test.ts` | ⚠️ R-29、R-30 |
| KIT-R3h-作答畫面 | 面向選項組、不確定/看不到/不適用、七級/0–5、挑表、年級 | `answeringV3.ts`、`T2AssessmentV3.tsx`、`kitv3/lazy.ts` | `t2AnsweringV3.test.ts` | ✅（畫面層實看拋棄式 harness，無自動渲染測試） |
| KIT-R3h-報告頁 | 提示、九宮格、QOL 段、氣質偏向、作答回顧挑最差檔 | `T2ReportV3.tsx`、`reportCopyV3.ts` | `t2ReportCopyV3.test.ts`、`t2ReportView.structure.test.ts` | ⚠️ R-31、R-32 |
| KIT-報告文字AI | v3 報告文字接 AI、驗證不過退模板 | `src/t2/report/proseV3.ts`、`promptV3.ts` | `t2ReportProseV3.test.ts`、`t2FindingsV3.http.test.ts` | ⚠️ R-34（字數界） |
| KIT-R3i | 紙本比對 `--kit v3`、差異清單給客戶 | `scripts/t2-diff-paper.ts` | `t2KitV3PaperDiff.test.ts`；`docs/reference/T2完整版纸本比对-2026-10-07.md` | ✅（24 支 2709 句、26 句找不到） |
| KIT-§6-舊資料 | 舊作答不轉、舊快照照存、開關關一行不動 | `server.ts` 分流 | `t2ToolResultsV3Off.http.test.ts`、`t2PlanProjectB.http.test.ts` | ✅ |
| KIT-§2.3-教師/本人版 | 只開家長版 | — | — | ⚠️ 這一輪不開（R-25） |
| KIT-§2.1-T3七支 | 不接 | — | — | 🔀 使用者 10/07（僅 T2） |
| KIT-§4.4-舊規則層/標籤 | 新題庫不接舊標籤規則 | 無對應（刻意） | — | ✅（刻意不做） |

---

## 四、❌ 與 ? 項目

**❌ 未實作**
- REC-§7-需排除：診斷檔案在執行期已關（ADR-0011），改列 🔀。
- REC-§10-Python參考實作：客戶未提供，改列「—」。
- PUSH-九-可列印/存PDF：刻意不做（手機線上 App），改列 🔀，待使用者決定是否另開票。

**? 無法驗證／證據不足**
- REC-§1-適用年齡：<12 月「直接推 ASQ3＋GM＋PLC」沒有對應程式 —— **走不到**：T1 題組從 12 個月起，沒有 T1 就沒有推薦（`/api/t2/plan` 回 404 `T1_REQUIRED`）。若要服務 12 個月以下，要先決定那時的入口。
- REC-§5-缺口8項：缺口句為通用句，ATT<36、SEN<24 的氣質替代說法未逐項測。
- REC-§7-兩診斷並存：引擎有邏輯，但 golden 只測單診斷，無專測；執行期診斷也已關。
- REC-V13：測試標題只明列 23/24、47/48、71/72、119/120 與 SP/LDP/ASQ3 切點，35/36、59/60、143/144、155/156 是否全覆蓋未逐行驗。
- PUSH-四-模組編號公式：未見直接比對測試（`moduleNoOf` 由 seed 測試間接保護）。
- ~~PUSH-九-期末檢核區~~：2026-10-08 已補。
- ~~PUSH-十-紅色須轉介／邊界聲明~~：2026-10-08 已補邊界聲明並以渲染測試釘住。
- PUSH-P16-每週3支：x/4 分母動態，但註解與測試標題多處仍寫「四支／x/4」，規格要求的「結構測試釘 3」未找到。
- PUSH-九-能力排序與配額表畫面：資料層有測試，PlanScreen 本身沒有專屬渲染測試。

---

## 五、各狀態計數

以「表格列」為單位（含一列內混合狀態者按其主要狀態）：

| 文件 | ✅ | ⚠️ | 🔀 | ⏸ | ❌ | ? |
|---|---|---|---|---|---|---|
| 一、REC（推薦規格書，共 約 76 列） | 36 | 15 | 17（含引擎✅／執行期🔀 混合列 14） | 2 | 2 | 4 |
| 二、PUSH（推送規則，共 45 列） | 21 | 14 | 5 | 1 | 1 | 3 |
| 三、KIT（工具包，共 29 列） | 14 | 12 | 3 | 0 | 0 | 0 |
| 合計 | 71 | 41 | 25 | 3 | 3 | 7 |

備註：REC 的「引擎 ✅／執行期 🔀」混合列：引擎功能與測試完整，但家長端執行期因 ADR-0011 關掉（`ONE_TOOL_PER_DIMENSION = true`），上面計為 🔀。計數為人工估計，誤差 ±3。
全部 v3 行為仍在 `T2_RECOMMEND_V3`/`TRAINING_PUSH_V3` 預設關閉之後；R5（退場 `interimPlan.ts`）與推送票 6（拿掉舊配對）依 worklog 延後。
