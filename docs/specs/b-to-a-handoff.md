# 規格：B 的家長免登入轉到 A 做 T2（交接）

> 依據：[ADR-0009](../adr/0009-b-to-a-handoff-keeps-databases-separate.md)（2026-09-28）。
> 這份寫「怎麼做」；「為什麼資料庫不合併、為什麼不重新登入」在 ADR。
> **第一期**（本規格 §8 票 1–4）：B 報告頁的按鈕 → A 直接登入並帶入資料 → 停在 T2 入口。
> **第二期**（票 5–8）：簡訊邀請、確認頁、B 登入頁的簡訊同意、A 後台來源欄。等 ADR「待定」四項有答案再上線。

## 1. 名詞

| 詞 | 意思 |
|---|---|
| 發出端 | 專案 B（`APP_MODE=t1only`，`sxk_t1_db`）。產生交接碼、兌換時交出資料 |
| 接收端 | 專案 A（`APP_MODE=full`，`sxk_db`）。拿交接碼向發出端換資料、發 A 的登入狀態 |
| 交接碼 | 32 位元組亂數（base64url 43 字）。資料庫只存 SHA-256；**一次性**；按鈕 2 分鐘、簡訊 72 小時 |
| 帶過去的資料 | 孩子檔案、T1 成績（`completed_scores`）、**與這份成績相符的最新一份 T1 報告**（T2 入口掛在 T1 報告裡面 —— 沒有報告就看不到 T2），來源公司 |
| 不帶的 | 專家預約、聯絡人、訂單、B 的其他報告 |

## 2. 流程（第一期：按鈕）

```
家長（B 報告頁） ── 按「到森心康做深度评估」──▶ B  POST /api/handoff/start   {consent:true}   Bearer=B 家長
                                              B  產生交接碼（2 分鐘）→ 回 {url: "<A>/handoff#code=…"}
瀏覽器 ── location.href = url ─────────────────▶ A  /handoff（SPA）讀 #code，網址立刻換成 /
A 前端 ── POST /api/handoff/redeem {code} ─────▶ A
                                              A ── POST <B 內部>/internal/handoff/redeem {code}，Bearer=HANDOFF_SECRET ──▶ B
                                              B  核對：雜湊存在、未用過、未過期 → 標記已用 → 回資料
                                              A  以（未歸屬，同一支手機）找或建帳號 → 帶入資料（A 已有篩查就不覆蓋）→ 記轉入
                                              A  回與 /api/auth/sms/verify 相同形狀的登入結果
A 前端 ── 照一般登入成功處理 → 打開 T1 報告並捲到 T2 入口
```

- 交接碼放在**網址片段**（`#code=`）：片段不會送到伺服器，不進 nginx 日誌、不隨 Referer 外流。A 讀到後馬上 `history.replaceState` 拿掉。
- A 與 B 在同一台主機（A :5000、B :5001）：A 打 `HANDOFF_SOURCE_ORIGIN`（例 `http://127.0.0.1:5001`），不經公網。
- 同意：按鈕下方一行「点击即同意把孩子的筛查结果带到森心康」＋隱私條款連結；`consent: true` 才發碼，版本記在交接碼那一列（`HANDOFF_CONSENT_VERSION`），A 轉入時一併記下。

## 3. 資料表（`deploy/migrations/2026-09-28-handoffs.sql`，兩個資料庫都套 —— A、B 共用同一份 schema）

`handoff_codes`（發出端用）

| 欄 | 型別 | |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `code_hash` | CHAR(64) UNIQUE | 交接碼的 SHA-256（hex）。碼本身不落地 |
| `user_id` | INT UNSIGNED FK → users ON DELETE CASCADE | 發給誰（B 的家長） |
| `kind` | ENUM('button','sms') | 決定時效；第二期才有 sms |
| `consent_version` | VARCHAR(32) NULL | 家長按下時看到的同意文字版本 |
| `created_at` / `expires_at` / `redeemed_at` | DATETIME | 到期與「已用」都由資料庫的時鐘判斷（同 `sms_codes`） |

`handoff_imports`（接收端用）

| 欄 | 型別 | |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `user_id` | INT UNSIGNED FK → users ON DELETE CASCADE | A 的帳號 |
| `source_user_id` | INT UNSIGNED | B 的帳號（另一個資料庫，沒有外鍵） |
| `source_company_id` / `source_company_slug` / `source_company_name` | 可 NULL | 來源公司**當下的快照**（B 的家長可能未歸屬） |
| `kind` | ENUM('button','sms') | |
| `consent_version` | VARCHAR(32) NULL | |
| `imported` | TINYINT(1) | 1＝資料有帶進去；0＝A 已經有篩查，只記來源 |
| `created_at` | DATETIME | |

後台硬刪家長（ADR-0006）靠外鍵連帶刪掉兩張表的列，不另寫。

## 4. 端點

### 發出端（只在 `APP_MODE=t1only` 註冊）

| 端點 | 身分 | 行為 |
|---|---|---|
| `GET /api/handoff/config` | 無 | `{enabled}`：`HANDOFF_SECRET`、`HANDOFF_TARGET_ORIGIN`、資料庫三者都在才是 `true`。前端據此決定要不要畫按鈕 |
| `POST /api/handoff/start` | B 家長 Bearer | body `{consent: true}`。沒同意 400 `CONSENT_REQUIRED`；沒有孩子檔案或 T1 成績 409 `SCREENING_REQUIRED`；未啟用 404。成功 `{url}` |
| `POST /internal/handoff/redeem` | `Authorization: Bearer <HANDOFF_SECRET>`（常數時間比對） | body `{code}`。任何一種不成立（找不到、用過、過期、密鑰錯）都回同一個 404/401，不分辨原因。成功回 `{phone, sourceUserId, source:{companyId,slug,name}\|null, child, completedScores, t1Report\|null, kind, consentVersion}` |

`/internal/*` 另在 `deploy/nginx.conf` 對外擋掉（深度防禦；密鑰才是那一道閘）。

### 接收端（只在 `APP_MODE=full` 註冊）

| 端點 | 身分 | 行為 |
|---|---|---|
| `POST /api/handoff/redeem` | 無（交接碼就是憑據） | body `{code}`。未設定 503；發出端說無效 410 `HANDOFF_INVALID`；發出端連不上 502。成功回 `{success, phone, token, child, completedScores, orders, reportHistory, handoff:{imported, sourceName}}` —— 前 7 欄與 `/api/auth/sms/verify` 相同 |

- 過 `authLimiter`（與簡訊登入同一個速率限制）。
- 帶入規則：A 帳號**還沒有任何 T1 成績**才帶入（孩子檔案、成績、那一份 T1 報告）；否則不動 A 的資料，只記一筆 `imported=0`。
- 同一個交接碼在發出端就只能兌換一次，A 不另外防重。

## 5. 前端

- **B 報告頁**（`AnalysisReport`，專案 B）：T1 報告生成後、家長已登入、`/api/handoff/config` 回 `enabled` 時，在原本 T2 插槽的位置畫一張卡
  （`HandoffCard`）：一句說明、按鈕「到森心康做深度评估」、同意小字。按下 → `start` → `location.href = url`。失敗就在卡上說原因。
- **A 落地**（`App`，專案 A）：開頁時路徑是 `/handoff` 且片段有 `code` → 先把網址換成 `/`、畫「正在把筛查结果带过来…」→ 打 `redeem`
  → 成功照一般登入處理，然後打開即時 T1 報告並捲到 T2 入口（與付費回來同一條：`focusT2`）；失敗回登入頁並說「这个连结已经用过或过期了，请用手机验证码登录」。

## 6. 設定

| 變數 | 在哪一邊 | |
|---|---|---|
| `HANDOFF_SECRET` | A、B | 同一個長亂數。沒設＝功能關閉 |
| `HANDOFF_TARGET_ORIGIN` | B | A 的對外網址，例 `https://sxkscreen.com` |
| `HANDOFF_SOURCE_ORIGIN` | A | B 的內部網址，例 `http://127.0.0.1:5001` |
| `HANDOFF_CONSENT_VERSION` | B | 同意文字版本，預設 `2026-09-28` |

## 7. 安全

- 交接碼 256 位元亂數、只存雜湊、一次性、按鈕 2 分鐘；兌換用條件式 UPDATE（`redeemed_at IS NULL AND expires_at > NOW()`），兩個請求同時兌換只有一個會成功。
- A 採信 B 的手機號：B 的帳號本身是簡訊驗證碼登入的（ADR-0009）。
- 內部端點只收密鑰；錯誤一律同一句，不當「這個碼存不存在」的查詢機。
- 只帶 §1 的欄位。

## 8. 票

| # | 期 | 內容 | 護欄 |
|---|---|---|---|
| 1 | 一 | 遷移＋`schema.sql`＋資料層（`src/db/handoffs.ts`）＋純函式（`src/handoff/`：產碼、雜湊、挑 T1 報告、遮罩手機） | 單元測試；schema 與遷移一致 |
| 2 | 一 | 發出端三支端點 | HTTP 測試：未啟用 404、要登入、要同意、要有篩查、一次性、過期、密鑰錯、錯誤不分辨 |
| 3 | 一 | 接收端 `redeem` | HTTP 測試（假的發出端）：建帳號、帶入、已有篩查不覆蓋、記轉入、無效 410、連不上 502、回應形狀同登入 |
| 4 | 一 | B 的 `HandoffCard`、A 的 `/handoff` 落地；nginx 擋 `/internal/`；AGENTS.md、deploy/README | 兩個程序對兩個資料庫的端到端（本機） |
| 5 | 二 | 後台勾選＋發送邀請（只有全域管理員）、邀請狀態欄；同一位家長 7 天一封 | |
| 6 | 二 | 簡訊模組可發不同範本；邀請範本（等審核） | |
| 7 | 二 | A `/i/:碼` 確認頁（遮罩手機、按一下才兌換）；發出端 `peek` 端點 | |
| 8 | 二 | B 登入頁的簡訊同意勾選（只發給勾了的人）；A 後台家長列表「來源」欄 | |
