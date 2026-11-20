---
status: accepted（程式已寫、開關 `TRAINING_PUSH_MANUAL_AGE` 預設關）
date: 2026-11-21
amends: ADR-0015 第 3 點（貼過標籤的用 `targetMonth` 一個點對窗口）
---

# 推送用手冊適齡區間對月齡窗，`targetMonth` 只排先後

ADR-0015 起，貼過標籤的片用 `targetMonth`（一個點 `[t, t]`）對月齡窗。月齡窗是一期三個月各一段、寬度只有幾個月，
一個點很難落進去。2026-11-21 用正式站的片庫（207 支有片、11/16 那一批標籤）模擬 9 個月齡 × 5 種紅黃組合各一期：
**77% 的格子要放寬才排得進來**。而且那批 `targetMonth` 是取手冊適齡區間的中間值擬的草稿，最大 65 個月，
6 歲以上的孩子幾乎全部推到給小孩的片 —— 但照手冊與腳本，300 支裡有 270 支的適齡涵蓋 6 歲以上（例如「3–8 岁」）。

類似產品的做法（`docs/reference/類似產品的細項標籤設計-2026-11-21.md`）：HELP、Carolina、Portage 都是每一題標一段年齡，
不是一個點。我們每支片本來就有手冊適齡區間（`ageMonths`），推送沒用。

## 決定

新開關 `TRAINING_PUSH_MANUAL_AGE`（預設關，要配 `TRAINING_PUSH_TAGS`）。開著時新開的一期：

1. **對窗口一律用手冊適齡區間**（`ageSpanOf(a, tagged, manualAge)`），貼過標籤的也一樣。
2. **`targetMonth` 只排先後**：窗口內在「貼過標籤的先」「對中孩子細項多的先」「避開上一期的」之後、編號之前，加一層
   「`targetMonth` 離窗口近的先，同在窗口裡的離窗口中間近的先」（`targetCloseness`）。治療師標的最佳月齡仍然有作用。
3. 一期記 `plan.manualAge: true`、規則版 `push-manual-age-2026-11-21`；補位、換著玩、「往前取」的標記照那一期的規則。
   已經開了的一期照它存的規則走完。

不動的：誰是這個維度的候選（ADR-0015）、孩子的細項（ADR-0018）、顏色、名額、交錯、月齡窗本身。

## 效果（同一份模擬，實際重排）

放寬的格子 77% → 30%。各月齡：8 個月 100% → 88%、18 個月 81% → 61%、30 個月 71% → 19%、42 個月 56% → 12%、
54 個月 62% → 1%、66 與 80 個月 → 0%、100 個月 99% → 8%、130 個月 100% → 77%。
剩下的窗外集中在 1 歲以下與 10 歲以上：300 支本來就沒寫到這兩段（只有 7 支適齡從 6 個月起），要靠新的腳本，不是規則。

## 代價

- 手冊區間寬（中位數 60 個月），窗口內能挑的片變多，挑哪一支更依賴 `targetMonth` 與編號。`targetMonth` 是草稿，治療師覆核後排序才準。
- 同一支片對不同細項可能適合不同年齡；一支片只有一段區間。每支片平均只貼 1.56 個細項，暫不做「每個細項各一段」。

## 怎麼做

`src/t2/trainingPush.ts`（`ageSpanOf` 第三個參數、`targetCloseness`、`candidatesFor` 的 `manualAge`、`PeriodPlan.manualAge`）、
`src/t2/trainingPeriodService.ts`、`src/db/t2TrainingPeriods.ts`（存讀 `manualAge`，`plan` 是 JSON 欄、不用遷移）、`server.ts`（開關）。
測試：`test/t2TrainingPushManualAge.test.ts`（含上面那份模擬：放寬比例要從 6 成以上降到 4 成以下）。
