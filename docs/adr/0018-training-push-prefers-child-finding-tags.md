---
status: accepted（程式已寫、開關 `TRAINING_PUSH_CHILD_TAGS` 預設關）
date: 2026-11-19
amends: ADR-0015（推送只知道維度、`matchedTags: []`）、t2-v3-toolkit-full-edition.md「新題庫不接標籤」
---

# 推送看孩子的細項：同一個方面裡對中的影片先推

ADR-0015 之後，影片貼了細項（發現標籤），推送照標籤判斷影片屬於哪個方面，但**孩子這一邊沒有細項**：
完整版量表（kit-20260923）的報告快照只有維度判定，代填（#112）雖然存了治療師勾的細項，推送也不讀。
所以治療師勾「语言·表达」或「语言·理解」，推出來是同一批語言影片。

使用者 2026-11-19：家長做完量表就要貼上細項、治療師代填的也要用，推送時同一個方面裡對中細項的影片先推。
對照表的草稿（`docs/specs/t2-v3-facet-tags-draft.md`、`docs/reference/T2完整版量表细项对照-草稿-2026-11-19.xlsx`）同日「全部同意」。

## 決定

1. **孩子的細項從哪裡來**（`src/t2/childTagsV3.ts` 的 `childTagsOf`）：
   - 完整版快照：用快照存的每一支作答與分數，照 `src/t2/facetTagsV3.ts` 的對照算。面向被判為需要留意
    （同量表详解挑「最需要練的面向」：不在最好那一段）就貼那個面向的細項；另有逐題（M-CHAT、ASR、感覺的影響題）、
     任何一題答「有」（能力倒退、ASQ3 警訊）、兩個面向相比（聽懂多於說出）、氣質九向度幾種規則。
     **不改快照形狀**：開期時現算，11/19 之前存的完整版報告也算得出來。
   - 代填與 9/08 版快照：每個維度本來就帶 `tags`，直接收。
2. **細項詞彙加兩個 ★**：`emo.anxiety`（焦虑与担忧，EMO E1–E5）、`mot.motor_planning`（动作计划，SP／SPB 的 PL）。
   附錄 B 的 44 個沒有對得上的。接在 `ACTIVITY_TAGS` 最後，`V3_ADDED_ACTIVITY_TAGS` 標出來；影片那邊要有人貼才推得到。
3. **推送**（`src/t2/trainingPush.ts`）：新開關 `TRAINING_PUSH_CHILD_TAGS`（預設關，要配 `TRAINING_PUSH_TAGS`）。開著時新開的一期
   把孩子的細項記在 `plan.childTags`、規則版 `push-child-tags-2026-11-19`；`candidatesFor` 在窗口內與放寬兩段裡各自把
   **對中這個方面細項多的**排前面（只算這個方面前綴的細項）。對不中的照舊補在後面，不會因此排不滿。
   補位、換著玩照那一期存的 `childTags`。
4. **理由句**：每週活動的 `reason.matchedTags` 填這支對中的細項，畫面原本就有的「（这次看到：……）」照第一個寫（`weeklyCopy.ts`，
   句子是 v2 審過的 `TAG_SENTENCES`；新增的兩個各補一句）。沒有細項的一期照舊是空陣列。

不動的：顏色、每月名額、交錯、月齡窗、12 週一期、期末判檔；誰是這個方面的候選（ADR-0015）。已經開了的一期照它存的規則走完 ——
開關打開後要馬上看到，就是重新生成 T2 報告或重新代填（新快照從第 1 期重來）。

## 為什麼

- 細項決定「練什麼」，嚴重度決定「要不要練」（CONTEXT.md「發現標籤」）。只看維度等於只用了一半的作答。
- 只排先後、不當硬篩：94 支片裡很多細項只有 0–3 支（注意力、認知、語音覺識、口腔……），硬篩會讓大半的格子變成「准备中」。
- 開期時現算、不寫進快照：快照的哲學是「生成時拍一張」，但作答本身就在快照裡；細項是對照表的函式，記在那一期上一樣固定得住，
  又不必重新生成舊報告。

## 代價與還沒定的

- 對照是看面向名稱與題目判的（草稿的「新判」58 列），治療師同意了，但還沒用真實個案驗過。
- 「需要留意」用的是量表详解的門檻（不在最好那一段），比報告判定寬：寧可多貼幾個細項，只影響先後。
- ASR「活动量与参与度」沒有方向，不貼；生活品質、抽動、功能影響、警訊題不貼（警訊只進報告）。
- 新增的兩個細項目前沒有影片貼，推不到片，要等後台貼標籤。

## 怎麼做

`src/t2/facetTagsV3.ts`（對照）、`src/t2/childTagsV3.ts`（算、只給伺服器）、`src/t2/findingTags.ts`＋`src/admin/findingTagLabels.ts`＋
`src/t2/report/sentences.ts`（兩個新細項）、`src/t2/trainingPush.ts`（`childMatches`、`childTags`）、`src/t2/trainingPeriodService.ts`、
`src/db/t2TrainingPeriods.ts`（存讀 `childTags`，`plan` 是 JSON 欄、不用遷移）、`server.ts`（開關）。
測試：`test/t2FacetTagsV3.test.ts`、`test/t2TrainingPushChildTags.test.ts`、`test/t2PushChildTags.http.test.ts`。
