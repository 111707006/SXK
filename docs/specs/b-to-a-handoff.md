# 規格：B 的家長免登入轉到 A 做 T2（交接）

> 依據：[ADR-0009](../adr/0009-b-to-a-handoff-keeps-databases-separate.md)（2026-09-28）。
> 這份寫「怎麼做」；「為什麼資料庫不合併、為什麼不重新登入」在 ADR。
> **第一期**（本規格 §8 票 1–4）：B 報告頁的按鈕 → A 直接登入並帶入資料 → 停在 T2 入口。
> **第二期**（票 5–8）：後台一次發送簡訊邀請與 A 的同意畫面**已做**（票 5–7，使用者 2026-09-28）；B 登入頁的簡訊同意、
> A 後台來源欄（票 8）還沒做。
> **2026-09-28 使用者修改**：連結不限時間、可以重複用（「只要登入 B 的就不用限制時間」）。

## 1. 名詞

| 詞 | 意思 |
|---|---|
| 發出端 | 專案 B（`APP_MODE=t1only`，`sxk_t1_db`）。產生交接碼、兌換時交出資料 |
| 接收端 | 專案 A（`APP_MODE=full`，`sxk_db`）。拿交接碼向發出端換資料、發 A 的登入狀態 |
| 交接碼 | 24 位元組亂數（base64url 32 字，簡訊裡短一點）。資料庫只存 SHA-256；**不過期、可重複兌換**（B 帳號刪掉就失效） |
| 帶過去的資料 | 孩子檔案、T1 成績（`completed_scores`）、**與這份成績相符的最新一份 T1 報告**（T2 入口掛在 T1 報告裡面 —— 沒有報告就看不到 T2），來源公司 |
| 不帶的 | 專家預約、聯絡人、訂單、B 的其他報告 |

## 2. 流程（第一期：按鈕）

```
家長（B 報告頁） ── 按「到森心康做深度评估」──▶ B  POST /api/handoff/start   {consent:true}   Bearer=B 家長
                                              B  產生交接碼（不過期）→ 回 {url: "<A>/handoff#code=…"}
瀏覽器 ── location.href = url ─────────────────▶ A  /handoff（SPA）讀 #code，網址立刻換成 /
A 前端 ── POST /api/handoff/redeem {code} ─────▶ A
                                              A ── POST <B 內部>/internal/handoff/redeem {code}，Bearer=HANDOFF_SECRET ──▶ B
                                              B  核對：雜湊存在 → 記一次使用 → 回資料
                                              A  以（未歸屬，同一支手機）找或建帳號 → 帶入資料（A 已有篩查就不覆蓋）→ 記轉入
                                              A  回與 /api/auth/sms/verify 相同形狀的登入結果
A 前端 ── 照一般登入成功處理 → 打開 T1 報告並捲到 T2 入口
```

- 交接碼放在**網址片段**（`#code=`）：片段不會送到伺服器，不進 nginx 日誌、不隨 Referer 外流。A 讀到後馬上 `history.replaceState` 拿掉。
- A 與 B 在同一台主機（A :5000、B :5001）：A 打 `HANDOFF_SOURCE_ORIGIN`（例 `http://127.0.0.1:5001`），不經公網。
- 同意：按鈕下方一行「点击即同意把孩子的筛查结果带到森心康」＋隱私條款連結；`consent: true` 才發碼，版本記在交接碼那一列（`HANDOFF_CONSENT_VERSION`），A 轉入時一併記下。
- 同一條連結之後再開（書籤、瀏覽紀錄）照樣登入同一個 A 帳號；A 已經有 T1 就不再帶入，只記一筆 `imported=0`。

### 簡訊邀請（後台）

```
B 後台（全域管理員，選定一個視野） ── 勾選家長 → 「发送邀请简讯」→ 確認 ──▶ B  POST /api/admin/handoff-invites {userIds}（一批 ≤50）
                                              B  每位能收的家長：新交接碼（kind=sms）→ 發邀請範本（變數只有碼）→ 記 handoff_invites
家長手機 ── 點 https://<A>/handoff#invite=… ──▶ A  同意畫面（「同意并继续」＋同意小字）→ 按下 → 同上 redeem → 登入、T2 入口
```

- 能收：有手機號、做過 T1、他的交接碼沒被用過（＝還沒到過 A）、7 天內沒有成功收過一封（`src/handoff/invite.ts`）。
  伺服器照這個再判一次，畫面上的勾選不算數。
- 簡訊範本（`ALI_SMS_INVITE_TEMPLATE_CODE`，推廣類，要另外送審）裡網址是寫死的文字，只有交接碼是變數 `${code}`，例：
  `您好，孩子的筛查结果可以带到森心康继续做深度评估，点击 https://sxkscreen.com/handoff#invite=${code} 进入，不用重新登录。拒收请回复R`

## 3. 資料表（`deploy/migrations/2026-09-28-handoffs.sql`，兩個資料庫都套 —— A、B 共用同一份 schema）

`handoff_codes`（發出端用）

| 欄 | 型別 | |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `code_hash` | CHAR(64) UNIQUE | 交接碼的 SHA-256（hex）。碼本身不落地 |
| `user_id` | INT UNSIGNED FK → users ON DELETE CASCADE | 發給誰（B 的家長） |
| `kind` | ENUM('button','sms') | 按鈕或後台邀請 |
| `consent_version` | VARCHAR(32) NULL | 家長按下時看到的同意文字版本 |
| `created_at` | DATETIME | |
| `expires_at` | DATETIME NULL | **NULL＝不過期**（現在全部都是）。欄位留著：哪天要加時效只改寫入那一句 |
| `use_count` / `last_used_at` | INT／DATETIME NULL | 每兌換一次加一、記時間（資料庫的時鐘）。後台據此知道這位家長到過 A |

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

`handoff_invites`（發出端的後台用）

| 欄 | 型別 | |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `user_id` | INT UNSIGNED FK → users ON DELETE CASCADE | 收件的家長 |
| `code_id` | INT UNSIGNED NULL FK → handoff_codes ON DELETE SET NULL | 這一則裡的那組碼 |
| `admin_user_id` | INT UNSIGNED NULL FK → admin_users ON DELETE SET NULL | 誰按的 |
| `status` | ENUM('sent','failed') | |
| `detail` | VARCHAR(255) NULL | 失敗時簡訊通道回的原因 |
| `sent_at` | DATETIME | 7 天一封看這一欄（只算 `sent`） |

後台硬刪家長（ADR-0006）靠外鍵連帶刪掉三張表的列，不另寫。

## 4. 端點

### 發出端（只在 `APP_MODE=t1only` 註冊）

| 端點 | 身分 | 行為 |
|---|---|---|
| `GET /api/handoff/config` | 無 | `{enabled: true, targetName}` 或 `{enabled: false}`：`HANDOFF_SECRET`、`HANDOFF_TARGET_ORIGIN`、資料庫三者都在才開。前端據此決定要不要畫按鈕；`targetName`（「森心康」）由伺服器給 —— B 的建置不准寫品牌名（`test/brandIsolation.test.ts`），卡只在開啟時才拿得到那個名字 |
| `POST /api/handoff/start` | B 家長 Bearer | body `{consent: true}`。沒同意 400 `CONSENT_REQUIRED`；沒有孩子檔案或 T1 成績 409 `SCREENING_REQUIRED`；未啟用 404。成功 `{url}` |
| `POST /internal/handoff/redeem` | `Authorization: Bearer <HANDOFF_SECRET>`（常數時間比對） | body `{code}`。任何一種不成立（找不到、密鑰錯、資料不全）都回同一個 404，不分辨原因；可以重複兌換，每次記一次使用。成功回 `{phone, sourceUserId, source:{companyId,slug,name}\|null, child, completedScores, t1Report\|null, kind, consentVersion}` |
| `GET /api/admin/handoff-invites/config` | 後台全域管理員 | `{enabled: false}` 或 `{enabled: true, ready, missing}`（邀請範本設好沒） |
| `POST /api/admin/handoff-invites` | 後台全域管理員（要選定視野） | body `{userIds}`（1–50）。交接沒開 404、範本沒設好 503 `INVITE_CHANNEL_NOT_READY`（一組碼都不建）。回 `{sent, skipped:[{userId, reason}], failed:[{userId, detail}]}`；視野外與不存在的 reason 都是 `not_found` |

`/internal/*` 另在 `deploy/nginx.conf` 對外擋掉（深度防禦；密鑰才是那一道閘）。

### 接收端（只在 `APP_MODE=full` 註冊）

| 端點 | 身分 | 行為 |
|---|---|---|
| `POST /api/handoff/redeem` | 無（交接碼就是憑據） | body `{code}`。未設定 503；發出端說無效 410 `HANDOFF_INVALID`；發出端連不上 502。成功回 `{success, phone, token, child, completedScores, orders, reportHistory, handoff:{imported, sourceName}}` —— 前 7 欄與 `/api/auth/sms/verify` 相同 |

- 過 `authLimiter`（與簡訊登入同一個速率限制）。
- 帶入規則：A 帳號**還沒有任何 T1 成績**才帶入（孩子檔案、成績、那一份 T1 報告）；否則不動 A 的資料，只記一筆 `imported=0`。
- 同一個交接碼可以重複兌換（使用者 2026-09-28）；A 每次都照上面的帶入規則走，所以第二次起只會登入、記一筆 `imported=0`。

## 5. 前端

- **B 報告頁**（`AnalysisReport`，專案 B）：T1 報告生成後、家長已登入、`/api/handoff/config` 回 `enabled` 時，在原本 T2 插槽的位置畫一張卡
  （`HandoffCard`）：一句說明、按鈕「到森心康做深度评估」、同意小字（「隐私保护条款」開 B 自己的條款視窗）。按下 → `start` → `location.href = url`。失敗就在卡上說原因。
  句子在 `src/handoff/handoffCopy.ts`，名字由 config 的 `targetName` 填進去。畫面掛哪一半由 `PRODUCT.features.handoff`（B `send`、A `receive`）決定。
- **A 落地**（`App`，專案 A）：開頁時路徑是 `/handoff` 且片段有 `code` → 先把網址換成 `/`、畫「正在把筛查结果带过来…」→ 打 `redeem`
  → 成功照一般登入處理，然後打開即時 T1 報告並捲到 T2 入口（與付費回來同一條：`focusT2`；帶過來的報告接不上就一進去生成）；
  失敗回登入頁並說「这个连结无法使用，请用手机验证码登录」（410）或「暂时无法把筛查结果带过来……」（502／503／網路）。
  片段是 `#invite=`（簡訊）時先畫同意畫面（`HANDOFF_INVITE`），按「同意并继续」才打 `redeem`；按「不用了」照一般開頁。
- **B 後台**（`ParentsPanel`，只有專案 B 的全域管理員、交接開著時）：勾選欄、「深度评估邀请」狀態欄（可邀请／没有手机号／
  还没做筛查／已去做深度评估／7 天内邀请过＋上次時間）、「发送邀请简讯（N 位）」→ 確認（會計費、收不回）→ 切批送出 → 送了幾位、
  跳過幾位（原因）、失敗幾位。範本沒設好時按鈕不能按，並說缺哪個環境變數。
  兌換期間不畫這台裝置上舊的登入狀態；失敗才照一般開頁讀資料（本來登入著的 A 家長不被一條用過的連結登出）。

## 6. 設定

| 變數 | 在哪一邊 | |
|---|---|---|
| `HANDOFF_SECRET` | A、B | 同一個長亂數。沒設＝功能關閉 |
| `HANDOFF_TARGET_ORIGIN` | B | A 的對外網址，例 `https://sxkscreen.com` |
| `HANDOFF_SOURCE_ORIGIN` | A | B 的內部網址，例 `http://127.0.0.1:5001` |
| `HANDOFF_CONSENT_VERSION` | B | 同意文字版本，預設 `handoff-consent-v1`（改了同意文字就換一個） |
| `ALI_SMS_INVITE_TEMPLATE_CODE` | B | 邀請簡訊的範本代碼（推廣類，另外送審）；金鑰與簽名與登入共用。沒設時後台的發送按鈕不能按 |

## 7. 安全

- 交接碼 192 位元亂數、只存雜湊；**不過期、可重複用**（使用者 2026-09-28）—— 連結就是一把 A 的鑰匙，轉發出去對方一直進得去
  （同 #22 報告連結的取捨）。B 的帳號刪掉，外鍵連帶刪掉交接碼，連結隨即失效。碼放在網址片段，不進伺服器日誌。
- 後台邀請：只有全域管理員、只發給當下視野；寫入一律 `INSERT … SELECT … FROM users u WHERE u.id = ? AND 公司條件`。
- A 採信 B 的手機號：B 的帳號本身是簡訊驗證碼登入的（ADR-0009）。
- 內部端點只收密鑰；錯誤一律同一句，不當「這個碼存不存在」的查詢機。
- 只帶 §1 的欄位。

## 8. 票

| # | 期 | 內容 | 護欄 |
|---|---|---|---|
| 1 | 一 | 遷移＋`schema.sql`＋資料層（`src/db/handoffs.ts`）＋純函式（`src/handoff/`：產碼、雜湊、挑 T1 報告、遮罩手機） | 單元測試；schema 與遷移一致 |
| 2 | 一 | 發出端三支端點 | HTTP 測試：未啟用 404、要登入、要同意、要有篩查、可重複兌換（2026-09-28 起；原本是一次性、會過期）、密鑰錯、錯誤不分辨 |
| 3 | 一 | 接收端 `redeem` | HTTP 測試（假的發出端）：建帳號、帶入、已有篩查不覆蓋、記轉入、無效 410、連不上 502、回應形狀同登入 |
| 4 | 一 | B 的 `HandoffCard`、A 的 `/handoff` 落地；nginx 擋 `/internal/`；AGENTS.md、deploy/README | 兩個程序對兩個資料庫的端到端（本機） |
| 5 | 二 | 後台勾選＋一次發送邀請（只有全域管理員）、邀請狀態欄；同一位家長 7 天一封 —— **已做** | `test/handoffInvites.http.test.ts` |
| 6 | 二 | 簡訊模組可發邀請範本；範本送審（等阿里雲）—— **程式已做** | `test/smsSender.test.ts` |
| 7 | 二 | A 的同意畫面（`#invite=`，按下才兌換）—— **已做**；原本的遮罩手機與 `peek` 端點不需要了（連結可重複用） | `test/handoffFrontend.structure.test.ts` |
| 8 | 二 | B 登入頁的簡訊同意勾選（只發給勾了的人）；A 後台家長列表「來源」欄 —— 還沒做（ADR 待定第 2 項） | |
