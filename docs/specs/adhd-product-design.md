---
status: 草稿，待使用者確認（2026-11-23）
---

# 第三個產品：成人 ADHD 篩查（arscreen.cn）設計

使用者 2026-11-23 的要求是「網域不同，其他都一樣」，也就是照專案 B 的登入與後台，把客戶的成人 ADHD 單頁做成 SXK 的第三個產品。
方向（2026-11-23，使用者交給主 session 決定，採折衷）：

1. 程式與部署照 B 複製：同一份程式碼、新的 `APP_MODE`、自己的資料庫、PM2 與 nginx（arscreen.cn）。手機驗證碼登入、合作單位 `?c=`、後台帳號、合作单位都沿用 B，不重寫。
2. **作答與報告直接用客戶的 HTML**，題目、計分、報告一字不改。只加兩件事：
   - 進頁前要登入；
   - 作答完成時，把作答與頁面算出的結果存一筆到伺服器。
   
   對客戶 HTML 的修改要最小、集中在一處、註明日期。
3. 後台先做最基本的三樣：受評者列表、點進去看那一份報告（用同一份 HTML 只讀載入）、導出 .xlsx。
4. 不確定的地方列在第 8 節，給使用者看過才寫程式。

## 1. 客戶頁面盤點（`/var/www/arscreen/index.html`，改版 2026-11-11，274 KB）

2026-11-23 在瀏覽器實際跑過：填假資料，再讀頁面算出的 `APP.d.s2`。流程有六步：

| 步 | 代號 | 內容 | 頁面算的 |
|---|---|---|---|
| 準備 | `case` | 姓名（必填）、性別、年齡（直接填或填出生日期）、評估日期、職業、用藥狀態、想改善的事 | 未滿 18 歲不判讀 |
| T1 | `s1` | ASRS v1.1 六題（0–4） | 第 1–3 題 ≥2、第 4–6 題 ≥3 算達標；達標 ≥4 項＝提示 |
| T2 | `a18` | ASRS 18 題（另一套譯文） | 注意（1–9）、多動衝動（10–18）兩組各自選「经常／非常频繁」的題數 |
| T2 | `obs` | SXK-OBS-30，30 題 0–3、九個面向；分本人填與知情人填兩種 | 「明显／严重」題數、各面向的燈號 |
| T2 | `copm` | 想改善的日常事情，最多 5 件，各打 1–10 分；可跳過 | 只描述 |
| 結果 | `s2` | 報告 | `APP.d.s2`：結論、三項資料有幾項出現提示、各段摘要 |

頁面上要特別看的幾處：

- **「改善曲线」**：四條線（未介入、藥物、心理康復、藥物＋心理康復，0→52 週）。這是示意圖，跟受評者本人的作答無關。
- 品牌寫的是 **「禾新」**（`window.PUBLIC_CONFIG.institution`）。「了解深入评估／预约方式」的連結網址是空的，價錢寫「费用洽询」。
- **「保存个案档 ↓」與「资料管理（工作人员）导出备份」**：兩個都是 JSON 匯出入，之所以存在，是因為資料原本只存在瀏覽器裡。
- **頁面原本的草稿機制**：localStorage 鍵 `ADHD_SCREEN_LOCAL_V15:*`，同一台裝置可以存多份個案。
- 頁面上已經有可以接的全域變數：`APP`（`APP.d.s2` 是結果）、`go`、`casePayload()`（整份個案 JSON：`SXK-ADHD-SCREEN` v1.3，含基本資料、各步作答、結果）、`loadCase(raw)`、`resetCase`、`syncAll`。我們要做的兩件事都接得上，**不必改頁面原本的程式碼**。
- **ASRS 授權**：頁尾寫「ASRS © New York University and the President and Fellows of Harvard College」，並連到 NYU 的授權頁。

## 2. 架構：新的 `APP_MODE=adhd`

|                    | 專案 A               | 專案 B             | **ADHD**                                    |
|--------------------|----------------------|--------------------|---------------------------------------------|
| `APP_MODE`／`VITE_APP_MODE` | `full`        | `t1only`           | **`adhd`**                                  |
| 網域               | sxkscreen.com        | t1.sxkscreen.com   | **arscreen.cn**（備案通過前見 Q8）          |
| 資料庫             | `sxk_db`             | `sxk_t1_db`        | **`sxk_adhd_db`**（新建，不與 B 共用）      |
| PM2／埠／目錄      | `sxk-app`／5000      | `sxk-b`／5001      | **`sxk-adhd`／5002／`/var/www/sxk-adhd`**   |
| 合作單位 `?c=`     | `A_COMPANIES` 開著才有 | 有               | **有**（同 B）                              |

**為什麼另開資料庫**：受評者是成人本人。同一支手機號，在 B 是一位家長，在 ADHD 是受評者本人；放進 B 的庫，`(company_key, phone)` 唯一鍵會把這兩種人當成同一個帳號（就是 ADR-0002 防的那一種錯）。

### 2.1 伺服器（`server.ts`）

`resolveAppMode` 多收 `adhd`。`server.ts` 用到 `APP_MODE` 的地方有 36 處，逐處歸成三類，並用測試釘住：

- **跟 B 一樣**：合作公司、簡訊登入、後台、條款、客服二維碼。這些改成看一個新函式 `isMultiCompany(APP_MODE)`。
- **只在 A**：T2、訓練、商城、付款。`adhd` 下一律 404。
- **只在 B**：T1 報告 `/api/report`、交接、`/r/:token`、`/api/db/*`（孩子資料）。`adhd` 下不註冊。

新路由放在 `src/adhd/routes.ts`，`server.ts` 只負責掛上去，見第 4 節。

### 2.2 受評者端：React 外殼 ＋ 客戶的頁面

| 網址 | 誰畫的 | 內容 |
|---|---|---|
| `/`（`?c=` 照 B） | React（`main.tsx` 看 `PRODUCT.mode === 'adhd'`，掛一個小的 `AdhdShell`） | 沿用 B 的 `AuthScreen`（手機驗證碼、`peekCompanySlug()`）、合作單位 LOGO、條款彈窗、頁尾。登入後列出歷次結果（日期、結論），兩顆按鈕：「開始新的評估」→ `/assess/`、「查看」→ `/assess/?view=<id>` |
| `/assess/` | **客戶的 HTML**，加一個 `<script>` | 作答與報告 |

伺服器回 `/assess/` 時用的是 repo 裡那份套過修改的 HTML（第 3 節），不是 SPA。B 的 `App.tsx` 整個不載入。

### 2.3 後台（`AdminApp` 沿用）

| 分頁 | 處理 |
|---|---|
| 合作单位、后台帐号、公司視野切換與紀錄 | **原樣沿用** |
| **受评者列表**（新） | 欄位：姓名、手機、單位、評估時間、主要結論（`conclusion.title`）。依時間排序，可篩合作單位（走 `withScope`）。導出 `.xlsx`，每次導出在 `admin_exports` 記一筆，記不下就 500、不給檔 |
| **詳情** | 在 iframe 開 `/assess/?admin-view=<id>`：同一份 HTML 只讀載入那一筆，畫面與受評者看到的一模一樣（ADR-0007） |
| 專家、九維汇总、活動庫、首頁素材、優惠券、清分…… | 不出現（`adminCenter` 照 profile 給） |

## 3. 對客戶 HTML 的修改：只加一個 script

**原檔**收進 repo：`ADHD/成人ADHD筛查版_20261111.html`，一個位元組都不改；客戶換版就新增一份新檔。

**修改**全部集中在一個檔 `src/adhd/bridge.js`（純 JS，檔頭註明「2026-11-2x 加；套在客戶頁面 20261111 版」）。由腳本 `scripts/adhd-patch-page.ts` 在原檔的 `</body>` 前插入：

```html
<!-- SXK 2026-11-2x：登入與存檔（src/adhd/bridge.js），客戶原檔不改 -->
<script src="/assess/bridge.js?v=…"></script>
```

插好的檔案寫到 `dist/adhd/index.html`，伺服器在 `/assess/` 回它。
`test/adhdPage.test.ts` 要求兩件事：產出的檔案等於「原檔＋這一行」；頁面裡橋接腳本要用的全域變數（`APP`、`go`、`casePayload`、`loadCase`、`resetCase`）都還在。客戶換版時重跑腳本，探針找不到就停下來，不靜靜壞掉。

`bridge.js` 做的事：

1. **擋未登入**：localStorage 沒有 `senxinkang_token`（B 的家長端用的同一個鍵，同源讀得到），就導回 `/?next=/assess/`。
2. **完成時存檔**：包住頁面最後一版的 `go`，走到報告頁（`s2`）而且 `APP.d.s2.conclusion.status !== 'incomplete'` 時，POST `casePayload()` 到 `/api/adhd/assessments`。
   - 同一份個案只算一筆：bridge 為每份個案產生一個 `clientCaseId`（存 sessionStorage），換新個案時（包住 `resetCase`）重新產生。伺服器以 `(user_id, clientCaseId)` 做 upsert：回頭改答案再看報告，更新的是同一筆；開始新的評估就是新的一筆。
   - 內容沒變不重送（比對指紋）。送失敗會在畫面角落提示一行「结果尚未保存，重试」，這是唯一新增的畫面元素。
3. **只讀檢視**：`?view=<id>` 讀自己的那一筆；`?admin-view=<id>` 讀後台那一支，用後台 token（`adminApi.ts` 的 `TOKEN_KEY`，同源）。讀到後 `loadCase(payload)` → 跳到報告；加一個 class 把導航、作答、匯出區藏起來，同時不觸發存檔。

**伺服器不重算分數**，存的是頁面自己算的結果，這一點與 ADR-0010 的取捨相反，會另寫 ADR-0021。理由：

- 這個產品不收費、不解鎖任何東西，存下來的結果只用來給受評者回看、給後台看；
- 要求是一字不改，重算就等於維護第二套計分。

代價：受評者可以竄改自己送出的結論。所以伺服器仍然會檢查形狀（各步題數、值域、`system`／`version`），形狀不符一律 400、不落表。

## 4. 資料與 API

**沿用的表**：`deploy/schema.sql` 整份套到 `sxk_adhd_db`（用不到的表留空，無害），用到的是 `companies`、`users`、`sms_codes`、`admin_users`、`admin_company_switches`、`admin_exports`。

**新增一張表**：遷移 `deploy/migrations/2026-11-2x-adhd-assessments.sql`，只加不刪：

```sql
CREATE TABLE IF NOT EXISTS `adhd_assessments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `client_case_id` VARCHAR(100) NOT NULL,
  `page_version` VARCHAR(40) NOT NULL,         -- 客戶頁面版本 '20261111'
  `payload` JSON NOT NULL,                     -- casePayload() 原樣（基本資料、作答、頁面算的結果）
  `subject_name` VARCHAR(100) NOT NULL,        -- 以下三欄從 payload 抄出來，列表與導出用
  `conclusion_status` VARCHAR(20) NOT NULL,
  `conclusion_title` VARCHAR(100) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_case` (`user_id`, `client_case_id`),
  INDEX `idx_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_adhd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

這張表沒有 `company_id`，公司範圍經 `users` 帶出：在 `test/adminScope.structure.test.ts` 列為「經 users 帶公司條件」的表。資料層 `src/db/adhdAssessments.ts` 每個查詢都帶 `user_id`。

**API**：只在 `APP_MODE=adhd` 時註冊。

| 路徑 | 方法 | 說明 |
|---|---|---|
| `/api/adhd/assessments` | POST | `{clientCaseId, payload}`，以 `(user_id, clientCaseId)` upsert，回 `{id}`；形狀不符回 400 |
| `/api/adhd/assessments` | GET | 自己的歷次：`id, createdAt, updatedAt, conclusionTitle` |
| `/api/adhd/assessments/:id` | GET | 自己的一筆 `payload`；別人的回 404 |
| `/api/admin/adhd/people` | GET | 受評者列表，一頁 100 行，走 `withScope` |
| `/api/admin/adhd/people/export` | POST | 導出 `.xlsx`，記 `admin_exports` |
| `/api/admin/adhd/assessments/:id` | GET | 後台只讀用的 `payload`，走 `withScope` |

`/assess/` 與 `/assess/bridge.js` 是靜態檔，公開；資料一律要經上面的 API 拿。

## 5. 導出欄位（一筆評估一行）

姓名｜手機｜單位｜評估日期｜年齡｜主要結論，後面接頁面結果裡現成的幾個數字：

- 六題達標 x/6
- 18 題：注意 x/9、多動衝動 x/9
- OBS 填寫來源
- OBS「明显／严重」x/30
- 三項資料有幾項出現提示 x/3

這些數字直接從存下的 `payload` 讀，不重算。九個面向要不要各一欄見 Q9。

## 6. 施工順序（一項一個 commit；每次 `pnpm lint` 與相關測試全過）

1. 原檔、`adhd-patch-page.ts`、`bridge.js` 的骨架、頁面探針測試
2. `ProductMode` 加 `adhd`（`productConfig`、`vite.config.ts`、`check-brand.mjs`、`resolveAppMode`）；A、B 的建置要逐位元不變
3. `server.ts` 36 處歸類、`isMultiCompany`、路由註冊表測試（`adhd` 下 A、B 專屬的端點都是 404）、`/assess/` 靜態路由
4. 遷移、`schema.sql`、資料層、受評者的三支 API、http 測試
5. `bridge.js`：擋未登入、存檔、只讀檢視
6. `AdhdShell`：登入、歷次結果、開始新的評估
7. 後台：列表、詳情（iframe）、導出
8. 部署材料（只寫，不部署）：`ecosystem.config.cjs`、`nginx.conf`（arscreen.cn）、`deploy/README.md`、`.env.example`
9. AGENTS.md 與 ADR-0021

「新行為先關著」：整個產品只在 `APP_MODE=adhd` 下存在，A、B 的路由與 bundle 不變，由第 2、3 步的測試釘住，所以不另設開關。

**驗收**：在本機 Docker 測試站另起一個 `APP_MODE=adhd`、`SMS_PROVIDER=console`、獨立假資料庫的實例，走一遍：
`?c=` 進站 → 手機登入 → 作答 → 看到報告 → 後台看到那一筆 → 打開報告 → 導出 `.xlsx`。
不碰正式庫、不送簡訊、不 push、不部署。

## 7. 不做（這一版）

- 伺服器重算分數、React 版的作答與報告
- 掃碼帶走的報告連結、AI、付款、交接、商城、訓練、兒童九維汇总

## 8. 要問使用者的

標「暫採」的，是沒有回答時我會照著做的做法。

1. **品牌**：頁面寫「禾新」。外殼（登入頁標題、條款裡的營運主體、頁尾版權）要寫什麼？客戶頁面裡的字照原樣不動。
   - 暫採：外殼標題「成人 ADHD 筛查」，營運主體先空著待填。
2. ⛔ **授權**：ASRS 六題的商業使用要向 NYU 取得授權（頁面自己就連到授權頁）。18 題的中文譯文出處也要確認。這件事不擋開發，但擋上線。
3. **「改善曲线」**：頁面裡的示意曲線，性質跟 2026-10-08 從 T1 報告拿掉的預測曲線相同。既然要求「一字不改」，就照原樣保留。
   - 要不要請客戶自己決定拿掉？
4. **頁面的匯出入**：「保存个案档」「资料管理（工作人员）导出备份」都還留著。資料已經存在伺服器，這兩樣容易讓人以為還要自己保存。
   - 暫採：照原樣保留（不改客戶頁）。若要藏，只在 bridge 裡用 CSS 藏。
5. **一個帳號幾個人**：
   - 暫採：一個帳號是一個受評者，可以做很多次。
   - 頁面每次都要填姓名，所以如果是治療室人員用同一個帳號替多位個案填，目前的做法也能存，只是後台列表會以「帳號」為單位。要不要以「每一筆評估」為單位列？
6. **知情人（OBS-30 他評）**：頁面是在同一台裝置上切換本人填或知情人填，而且只存當下那一種。
   - 暫採：照頁面。
7. **「了解深入评估／预约方式」**：頁面的連結網址是空的，照頁面不動。
   - 要接到 B 的「联系专家」或客服二維碼嗎？要接的話，等於要改客戶頁（可以在 bridge 裡做）。
8. **備案通過前的測試網址**：arscreen.cn 備案通過前，要不要先用 `adhd.sxkscreen.com`（主網域已備案）給客戶驗收？
9. **導出要不要九個面向各一欄**（有问题／需要关注／没问题）？
   - 暫採：要。數字都在 payload 裡，只是多幾欄。
10. ⛔ **同意機制**：合作單位會看到成人的心理健康資料，這跟 ADR-0001 記的是同一個缺口（個保法要求單獨同意）。
    - 要不要在登入頁加勾選同意？
11. **未滿 18 歲**：頁面會寫「不作成人筛查判读」。
    - 暫採：照樣存，後台照樣列。
