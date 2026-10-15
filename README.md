# 森心康 SXK — 兒童發展篩查與深度評估平台

家長為孩子完成分層問卷，系統依年齡段與九大發展維度產生報告，並依結果導向專家諮詢或付費深度評估。一套程式碼、兩個產品：完整版（`sxkscreen.com`）與精簡版（`t1.sxkscreen.com`，多家合作機構共用一個部署）。

> ⚠️ **免責聲明**：本系統的篩查結果與報告**不構成醫療診斷或醫療建議**。深度評估工具為森心康自建，尚未建立常模與信效度驗證，分級門檻為內部參考帶（見 [CONTEXT.md](CONTEXT.md) 「T2 原型」條目）。任何關於兒童發育的疑慮，請諮詢專業醫療機構。

> 📖 **先讀 [CONTEXT.md](CONTEXT.md)。** 這份 README 講「怎麼跑、東西在哪」；CONTEXT.md 講「每個詞是什麼意思、哪些詞不要用」。專案裡「篩查／報告／深度評估／工具／面向／維度／活動／解鎖」每個都有精確定義，寫程式、寫規格、開工單前都要對得上。

---

## 目錄

- [兩個產品](#兩個產品)
- [家長端流程](#家長端流程)
- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [環境變數](#環境變數)
- [API 一覽](#api-一覽)
- [資料庫](#資料庫)
- [T2 深度評估管線](#t2-深度評估管線)
- [後台](#後台)
- [測試與 CI](#測試與-ci)
- [部署](#部署)
- [目錄結構](#目錄結構)
- [文件地圖](#文件地圖)
- [已知限制與注意事項](#已知限制與注意事項)

---

## 兩個產品

| | 專案 A（完整版） | 專案 B（精簡版） |
|---|---|---|
| 網域 | `sxkscreen.com` | `t1.sxkscreen.com` |
| `APP_MODE` | `full` | `t1only` |
| 流程 | 篩查 → 報告 → 深度評估 → 每週活動；付費解鎖；商城 | 篩查 → 報告 → 聯繫專家（**止於此**） |
| 誰在經營 | 森心康自己 | 多家**合作公司**，各自的家長、專家、客服互不可見 |
| 家長身分 | 手機號 | **（合作公司，手機號）這一組**，同一個人在兩家公司進站是兩位家長（[ADR-0002](docs/adr/0002-parent-identity-is-company-plus-phone.md)） |
| 合作公司怎麼分 | 無 | 進站連結帶 `?c=<slug>`，於帳號建立那一刻綁定，此後不變；**不需要各自的子網域** |
| 品牌 | 森心康 | 各公司自己的名稱與 Logo，畫面上**不出現森心康**（[ADR-0004](docs/adr/0004-b-specialist-list-becomes-optional-with-linked-qr.md)） |
| 資料庫 | `sxk_db` | `sxk_t1_db`，單庫多公司，每張家長資料表帶 `company_id`（[ADR-0001](docs/adr/0001-project-b-multi-company.md)） |

兩個模式在**兩個層次**各切一次：

- **建置期** `VITE_APP_MODE` 決定前端 bundle 渲染什麼；
- **執行期** `APP_MODE` 決定這個程序註冊哪些路由——`t1only` 下深度評估、付費、商城的端點**根本不註冊**，路徑等同不存在，不是回 403。

`APP_MODE` 給了認不得的值程序直接起不來，刻意 fail-closed。

---

## 家長端流程

```
進站（B 帶 ?c=<slug>）
  └─ 手機號 + 簡訊驗證碼登入（唯一的登入方式）
       └─ 建立孩子檔案（姓名、出生日期、性別 → 月齡 → 年齡段）
            └─ T1 分齡篩查：1–15 歲、九大維度、按月齡出題
                 └─ 篩查結果 → 報告（伺服器生成、可掃碼帶走 /r/:token）
                      ├─ [B] 聯繫專家 → 預約單 → 企業微信群通知 → 客服接手（new→contacted→scheduled→done）
                      └─ [A] 深度評估入口（題量、診斷方向）
                           └─ 逐支工具作答（22 支自建工具，依維度與診斷方向調度）
                                └─ 產生發現（t2_findings 快照）→ T2 報告
                                     └─ 這一週的四支居家活動（300 支活動庫依維度／年齡段／標籤配對）
```

**九大維度**（全系統共用，順序固定）：動作發展、感覺處理、情緒與行為、語言溝通、社交互動、認知、注意力與執行、生活自理與適應、學習能力。同九件事在 T2 原型、`dimensionId`、中文三套命名的對照表在 [CONTEXT.md](CONTEXT.md) 「評估結構」。

---

## 技術架構

```
瀏覽器（React 19 SPA；/admin 走另一個入口）
   │
   ▼
Express（server.ts，TypeScript 單檔；main.ts 只負責綁埠）
   ├─ helmet / express-rate-limit（/api、/r、預約、登入各一組上限）
   ├─ HMAC 簽章的 session token（SESSION_SECRET）
   ├─ 家長端 API、T2 API、支付、報告連結、後台 API（/api/admin/*）
   ├─ express.static 服務前端產物（nginx 只做純代理與 TLS）
   │
   ├─ 阿里雲 RDS MySQL（mysql2；schema.sql + deploy/migrations/）
   ├─ 阿里雲 Dysmsapi（簡訊驗證碼；可換 console 供應商僅限本機）
   ├─ 阿里雲 DashScope（OpenAI 相容模式）
   │     ├─ qwen 報告生成（主引擎）
   │     ├─ qwen3-asr 語音辨識、qwen-vl 動作影格
   │     └─ Gemini（備用）→ 本地模板（離線兜底，isAiGenerated=false 如實標示）
   ├─ 微信支付 APIv3（H5；JSAPI 尚缺 openid 授權流程，回 501）
   └─ 企業微信群機器人 webhook（專家預約通知）
```

- **前端**：React 19 · Vite 6 · TypeScript 5 · Tailwind CSS 4 · lucide-react · motion
- **後端**：Express 4 · mysql2 · bcryptjs · helmet · express-rate-limit；esbuild 打包成單一 `dist/server.cjs`
- **測試**：vitest，105 個測試檔／2,351 個測試（2026-09-13）
- **AI 三級降級**：Qwen → Gemini → 本地模板。回應裡的 `aiEngine` 與 `isAiGenerated` 標明真實來源；T2 報告另有「三段備援退模板」，任何一段失敗都不會讓報告頁開天窗。

`server.ts` 與 `main.ts` 分開不是為了整潔，是為了可測試性：`import server.ts` 不會開始監聽，測試才看得到伺服器。2026-07-31 那次付費閘門授權繞過之所以 101 個測試一條都沒攔住，就是因為當時 import 即監聽。

---

## 快速開始

**需求**：Node.js ≥ 18（CI 用 22）、pnpm、一個能連上的 MySQL。

```bash
pnpm install
```

```bash
cp .env.example .env
```

把 `.env` 裡的 MySQL 五項、`SESSION_SECRET`、`APP_MODE` 填好。本機開發簡訊用 `SMS_PROVIDER=console`（驗證碼印在終端機，**只能用在本機**）。

```bash
pnpm run dev
```

開 `http://localhost:5000`（`PORT` 可改）。後台在 `http://localhost:5000/admin`，第一個後台帳號用 `node deploy/create-admin.mjs` 建。

### 常用指令

```bash
pnpm test          # vitest run
```

```bash
pnpm run lint      # tsc --noEmit
```

```bash
pnpm run build     # vite build + esbuild → dist/
```

```bash
pnpm start         # node dist/server.cjs（正式模式）
```

> ⚠️ **本機 `.env` 若指向正式站的 RDS 與簡訊帳號，`pnpm run dev` 讀寫的就是正式資料庫、簡訊也是真的送出去。** 開發前先確認 `MYSQL_HOST` 與 `SMS_PROVIDER`。看家長端畫面而不想碰資料庫，用純 vite harness stub 掉 fetch。

---

## 環境變數

完整說明與每一項的踩坑紀錄在 [.env.example](.env.example)，這裡只列語意。

### 核心

| 變數 | 必填 | 說明 |
|---|---|---|
| `APP_MODE` | ✅ | `full`（專案 A）或 `t1only`（專案 B）。其他值起不來 |
| `PORT` | | 監聽埠，預設 5000 |
| `SESSION_SECRET` | 正式站 ✅ | 簽 session token 的 HMAC 金鑰。未設則每次啟動隨機產生，重啟即全員登出 |
| `MYSQL_HOST` `MYSQL_PORT` `MYSQL_USER` `MYSQL_PASSWORD` `MYSQL_DATABASE` | ✅ | 阿里雲 RDS。**A 的 host 曾經一直指向 RDS 內網位址而連不上**，驗收時要驗到資料庫不是驗到 401 |
| `PUBLIC_BASE_URL` | 正式站建議 | 報告 QR 碼裡的絕對網址（scheme + host，無路徑）。未設用請求的 origin，在筆電上會產生手機打不開的 `localhost` |

### 簡訊登入（四項缺一即 503，程序照常啟動、日誌無異常）

| 變數 | 說明 |
|---|---|
| `ALI_SMS_ACCESS_KEY_ID` `ALI_SMS_ACCESS_KEY_SECRET` | 阿里雲 AccessKey |
| `ALI_SMS_SIGN_NAME` `ALI_SMS_TEMPLATE_CODE` | 簽名與範本，須先過阿里雲審核；範本必須帶 `${code}` |
| `SMS_PROVIDER` | `aliyun`（預設）或 `console`（只印終端機，**絕不可用於對外站台**） |
| `SMS_IP_DAILY_MAX` | 同一來源每日驗證碼上限，預設 50；設 0 即停發，遭濫用時最快的閘門 |

### AI

| 變數 | 說明 |
|---|---|
| `DASHSCOPE_API_KEY` | 阿里雲百煉。缺省走本地模板引擎 |
| `QWEN_REPORT_MODEL` `QWEN_ASR_MODEL` `QWEN_VL_MODEL` | 各引擎模型名，有預設值 |
| `GEMINI_API_KEY` | 備用報告引擎（大陸境內不可直連） |

### 支付（專案 A；全部設齊才啟用，缺項會在啟動日誌列出）

| 變數 | 說明 |
|---|---|
| `UNLOCK_PRICE_FEN` | 單一維度解鎖價，單位「分」，預設 1990 |
| `PAY_TRADE_TYPE` | `h5`（預設）或 `jsapi`（目前 501） |
| `WECHATPAY_APPID` `WECHATPAY_MCHID` `WECHATPAY_SERIAL_NO` `WECHATPAY_PRIVATE_KEY_PATH` `WECHATPAY_APIV3_KEY` `WECHATPAY_PUBLIC_KEY_PATH` `WECHATPAY_PUBLIC_KEY_ID` `WECHATPAY_NOTIFY_URL` | 微信支付 APIv3 商戶憑證，由本人在伺服器設定，不進版控 |
| `PAYWALL_DEMO_OPEN` | `1` 時付費牆照顯示但後端閘門不執行。**正式站不可開啟** |

### 備案號（兩處都要設，值一樣）

| 變數 | 設在哪 | 說明 |
|---|---|---|
| `VITE_ICP_BEIAN` | **建置**那台機器 | 寫進前端 bundle 的頁尾。設在伺服器 `.env` 完全無效 |
| `ICP_BEIAN` | **伺服器** `.env` | 伺服器自己吐的 HTML（掃碼報告頁 `/r/:token`、連結失效頁）用 |
| `VITE_POLICE_BEIAN` | 建置機器 | 公安網備，號碼下來後補 |

目前備案號 `沪ICP备2026009790号-3`（主辦單位：森跃诺动健康科技（上海）有限公司）。大陸已備案網站少了頁尾那段，阿里雲的處理是要求整改乃至關停接入。

### 其他

| 變數 | 說明 |
|---|---|
| `WECOM_WEBHOOK_URL` | 企業微信群機器人；沒設就沒有任何專家預約通知送出 |
| `RATE_AI_MAX` `RATE_AUTH_MAX` `RATE_API_MAX` `RATE_BOOKING_MAX` | 各組限流上限，有預設值 |

---

## API 一覽

所有 `/api/*` 受 `apiLimiter`；家長端端點需 session token。「模式」欄空白表示 A、B 都有。

### 家長端

| 方法 | 路徑 | 模式 | 說明 |
|---|---|---|---|
| POST | `/api/auth/sms/request` | | 索取驗證碼（手機號、來源雙重限額） |
| POST | `/api/auth/sms/verify` | | 驗證並發 session token |
| GET | `/api/db/status` `/api/db/load` · POST `/api/db/save` | | 家長資料（孩子檔案、篩查結果）的載入與保存 |
| POST | `/api/report` | | 伺服器生成篩查報告 |
| POST | `/api/report-link` · GET `/r/:token` | | 產生報告連結（QR 碼用）／伺服器直出的報告頁 |
| GET | `/api/specialists` · POST `/api/expert-booking` | | 專家名單（B 依公司過濾）／建立預約 |
| GET | `/api/company-brand` | B | 依 `?c=` 取合作公司名稱與 Logo |

### 深度評估（`tier2Only`，僅 A）

| 方法 | 路徑 | 說明 |
|---|---|---|
| PUT | `/api/t2/diagnosis` | 入口：記錄診斷方向（決定調度哪些工具） |
| GET | `/api/t2/plan` | 這位孩子要做哪幾支工具 |
| GET / POST | `/api/t2/tool-results` | 逐支工具的作答結果 |
| POST | `/api/t2/findings` · GET `/api/t2/findings/latest` | 產生發現快照並生成報告／取最近一份 |
| GET | `/api/t2/weekly-plan` | 這一週的四支活動（一週一筆） |
| POST | `/api/asr` `/api/ali-language-eval` `/api/motion-eval` `/api/motion-report` `/api/specialized-report` | 語言（ASR + SLP 報告）與動作影片專項 |

### 支付（`paidOnly`，僅 A）

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/api/payment/create` · GET `/api/payment/status` | 開單（H5）／查單 |
| POST | `/api/pay/wechat/notify` | 微信回調，驗簽後寫入 `payments` 與 `unlocks` |
| GET | `/api/unlocks` | 這位家長已解鎖的維度 |

### 後台（`/api/admin/*`，需後台成員登入）

`/login` `/me` `/select-company` · `/summary` · `/parents` `/parents/:id`（GET／DELETE） · `/specialists`（CRUD） · `/company` `/companies`（B：全域管理員切公司） · `/admin-users` · `/activities`（GET／PATCH，全域）。

角色只有兩種：**全域管理員**（森心康）與**公司成員**。公司無法自行增刪帳號，由森心康代為處理；當這件事開始煩人，就是升級成三種角色的訊號（[ADR-0001](docs/adr/0001-project-b-multi-company.md)）。

---

## 資料庫

- 基底：[deploy/schema.sql](deploy/schema.sql)
- 增量：[deploy/migrations/](deploy/migrations/)，檔名帶日期，依序套用；`node deploy/migrate.mjs` 執行，`migrate-check.txt` 是上次核對紀錄

| 表 | 用途 |
|---|---|
| `users` `user_data` `sms_codes` | 家長帳號、家長資料（JSON）、驗證碼 |
| `companies` `admin_users` `admin_company_switches` | 合作公司、後台成員、全域管理員的切換紀錄 |
| `specialists` `expert_bookings` | 專家名單、預約單（`new→contacted→scheduled→done`） |
| `report_links` | 報告連結 token（QR 碼） |
| `payments` `unlocks` | 付款、解鎖權益（範圍見 `2026-09-11-unlock-scope.sql`） |
| `t2_intake` `t2_tool_results` `t2_findings` `t2_weekly_plans` | 深度評估入口、逐支作答、發現快照、每週活動 |
| `activities` | 300 支活動庫，帶 `targetMonth`／`targets` 標籤 |
| `intervention_materials` | 舊干預素材（已退場，[ADR-0003](docs/adr/0003-intervention-materials-are-images-and-text.md)） |

**公司條件**：B 裡凡是家長資料的表都帶 `company_id`，後台查詢一律加公司條件。例外（`activities`、`intervention_materials` 等森心康自己的內容）必須明列在 `test/adminScope.structure.test.ts` 的 `GLOBAL_TABLES`——想讓一張新表不帶公司條件，先去改那個檔案，測試會擋。

**刪除**：家長刪除是硬刪、不留紀錄，公司成員也能刪（[ADR-0006](docs/adr/0006-parent-deletion-is-hard-and-unlogged.md)）。這是產品端 2026-09-11 的決定，不是漏了角色檢查。

---

## T2 深度評估管線

`src/t2/` 是整條管線，方向由左到右：

```
toolkit/        22 支工具的題庫常數（腳本產生，不要手改）
   └─ scoring/  面向計分、分級帶（tiers）、工具家族（families）
        └─ rules/   規則表：ASD、注意力／感覺、發展／自理／學習、氣質、成就、公開工具（M-CHAT-R/F、SNAP-IV、CHEXI）
             └─ findings.ts   發現＝維度 × 發現標籤 × 關注分（快照進 t2_findings）
                  ├─ report/  伺服器生成報告：prompt → prose → 三段備援 → template；blacklist 擋不該出現的字
                  └─ activityMatch.ts + act300.ts   依維度／年齡段／標籤從 300 支活動配四支；不退回鄰近年齡段
```

**三件不能弄錯的事：**

1. **題庫常數由腳本產生。** `scripts/t2/` 從客戶的工具包（`NEWT2/`，HTML 與紙本 docx）抽題，`scripts/t2-extract-toolkit.ts` 生成 `src/t2/toolkit/*.ts`，`scripts/t2-diff-paper.ts` 驗證紙本 22 支全零差異。改題目要改抽取腳本再重跑，手改的會在下次重跑時被蓋掉。
2. **原型只在「題目」那一層是權威。** 分級門檻是客戶自承的內部參考帶，追不到出處是因為源頭不存在，所以每筆結果都帶 caveat `unsourced_threshold`（`src/t2/caveats.ts`）。
3. **報告裡有兩把尺。** 圖表一律照篩查判定上色；關注分只當雷達圖上的數字，不是判定（[CONTEXT.md](CONTEXT.md) 「關注分」）。

規格：[docs/specs/t2-v2-sxk-toolkit-rules-engine-report-and-activities.md](docs/specs/t2-v2-sxk-toolkit-rules-engine-report-and-activities.md)；規格與程式碼的已知矛盾集中在 [勘誤檔](docs/specs/t2-v2-errata-2026-09-11.md)，新發現的矛盾加進勘誤檔，不改規格本文。拆票在 GitHub #40–#63。

**家長端用字**：「需留意／需關注」是團隊內部的詞，家長看到的字由客戶 2026-09-11 的[用語對照表](docs/reference/client-mockups/家长报告用语对照表-2026-09-11.md)決定，程式在 `src/utils/parentWording.ts`，`scripts/check-brand.mjs` 掃描違規字。

---

## 後台

`/admin`（`src/admin/`，與家長端同一個 bundle、不同入口）。面板：

| 面板 | 說明 |
|---|---|
| Summary | 各公司家長數、篩查數、預約數（B 下全域管理員看得到跨公司 `GROUP BY`） |
| Parents | 家長清單、報告原樣呈現（[ADR-0007](docs/adr/0007-admin-shows-the-parent-report-as-is.md)）、列印、硬刪 |
| Specialists | 專家 CRUD；B 每家公司各自一份，可選擇不建而改用企業微信客服連結（[ADR-0004](docs/adr/0004-b-specialist-list-becomes-optional-with-linked-qr.md)） |
| Companies / CompanySettings | B：合作公司、slug、名稱、Logo、客服連結 |
| AdminUsers | 後台成員（僅全域管理員） |
| Activities | 300 支活動逐支標記 `targetMonth`／`targets`，PATCH 帶了才改，四個進度數字（#62） |

---

## 測試與 CI

```bash
pnpm test
```

- `test/` 105 個檔、2,351 個測試；`*.structure.test.ts` 是結構性守門（例如 `adminScope.structure.test.ts` 掃所有 SQL 是否帶公司條件），改資料表或路由時最常撞到的是這些。
- 伺服器測試 `import server.ts` 不監聽，直接對 app 打請求。
- CI（[.github/workflows/ci.yml](.github/workflows/ci.yml)）：Node 22 · `pnpm install --frozen-lockfile` → `lint` → `test` → `build`。

家長端畫面的驗證：登入沒有記憶體模式、dev server 打正式庫，所以看元件用純 vite harness stub 掉 fetch，看完刪。

---

## 部署

完整步驟在 [deploy/README.md](deploy/README.md)（購買伺服器 → 初始化 → 上傳 → `.env` → `deploy-app.sh a|b` → nginx → 防火牆 → SSL → 運維指令 → DashScope Key）。這裡只記結構與坑。

| | 專案 A | 專案 B |
|---|---|---|
| 目錄 | `/var/www/sxk` | `/var/www/sxk-b` |
| PM2 | `sxk-app`（cluster） | `sxk-b` |
| 埠 | 5000 | 5001 |
| 部署指令 | `bash deploy/deploy-app.sh a` | `bash deploy/deploy-app.sh b` |

阿里雲 ECS（上海）+ RDS MySQL；nginx 1.24 純代理與 TLS（[deploy/nginx.conf](deploy/nginx.conf)），Node 用 `express.static` 自己服務前端。前端在**本機**建置後 scp 產物上去，所以 `VITE_*` 要在本機 build 時帶。

**四個踩過的坑：**

1. **A 沒有 `-a` 後綴，也不是 git repo。** 它在雙產品拆分前就上線了，用打包上傳部署。`deploy/` 三個檔案都照實記錄，不要「修正」成 `sxk-a`；A 的任何檔案（含 `deploy/` 本身）都只能 scp，`git pull` 對它無效。
2. **伺服器讀的是 GitHub，不是你的工作目錄。** 部署前先驗證伺服器上的程式碼版本；假設兩者一致弄壞過正式站兩次。
3. **從 Windows scp shell script 會帶 CRLF**，bash 讀到 `\r` 直接炸。先 `tr -d '\r'` 再傳，遠端指令加 `file deploy/deploy-app.sh | grep -v CRLF &&` 當閘門。
4. **`scp -r dist` 不刪舊檔**，`dist/assets/` 會累積孤兒 bundle，「伺服器上 grep 得到某字串」不算部署成功；要從外面打線上網址驗。產物裡沒有版本標記，線上跑哪一版只能比對 `index-<hash>.js`。

`railway.json`、`render.yaml` 是早期的境外部署設定，正式站不用。

---

## 目錄結構

```
├─ main.ts                    # 進程入口：唯一綁埠的地方
├─ server.ts                  # Express 應用：中介層、路由、閘門（APP_MODE 在這裡分流）
├─ index.html · vite.config.ts · vitest.config.ts · tsconfig.json
├─ src/
│  ├─ main.tsx                # /admin 走 AdminApp，其餘走 App
│  ├─ App.tsx                 # 家長端視圖狀態機
│  ├─ components/             # T1Screening、AnalysisReport、T2Entrance/Assessment/Report/WeeklyPlan、
│  │                          # Paywall、AuthScreen、BeianFooter、LanguageSpecialAssessment、WearablesMall…
│  ├─ admin/                  # 後台：AdminApp、routes.ts（/api/admin/* 定義在這）、panels/、companyScope.ts
│  ├─ t2/                     # 深度評估管線（見上節）
│  ├─ db/                     # mysql.ts 連線池；activities / t2* 各表的存取
│  ├─ utils/                  # access（解鎖判定）、parentWording、attribution（?c= 歸屬）、
│  │                          # reportLink、outTradeNo、bookingWindow、ageBandDrift…
│  ├─ data.ts · t1Data.ts     # 維度設定、T1 題組（按月齡分檔）
│  ├─ sms.ts · notify.ts · wechatPay.ts
│  └─ types.ts
├─ test/                      # vitest；*.structure.test.ts 是結構守門
├─ scripts/
│  ├─ t2/ · t2-extract-toolkit.ts · t2-diff-paper.ts · t2-extract-act300.ts · t2-activity-seed-sql.ts
│  ├─ check-brand.mjs         # 掃家長端違規用字
│  └─ sms-smoke.ts            # 簡訊通道煙霧測試
├─ deploy/                    # README、schema.sql、migrations/、deploy-app.sh、nginx.conf、ecosystem.config.cjs、
│                             # setup-server.sh、create-admin.mjs、migrate.mjs
├─ docs/
│  ├─ adr/                    # 0001–0007 不可逆決策
│  ├─ specs/                  # T2 v2 規格與勘誤
│  ├─ reference/              # 客戶交付物的轉錄（client-mockups/、量表盤點、判斷依據）
│  ├─ research/ · agents/
│  └─ 進度-專案B多公司.md
├─ NEWT2/                     # 客戶的 T2 原型：工具包 zip、評估中心 HTML、紙本 docx（題目來源，不執行）
├─ CONTEXT.md                 # 領域詞彙表（先讀這個）
├─ AGENTS.md                  # 給 AI 協作者的專案摘要
└─ .env.example
```

`files/`、`files1/`、`deploy-out/`、`dist/`、`.preview/` 是產物或已退場的舊資料，不要拿來當來源。

---

## 文件地圖

| 想知道 | 看 |
|---|---|
| 這個詞是什麼意思、哪個詞不要用 | [CONTEXT.md](CONTEXT.md) |
| 為什麼是這樣設計、當時否決了什麼 | [docs/adr/](docs/adr/) |
| T2 的規則、報告段落、活動配對怎麼算 | [docs/specs/](docs/specs/)（規格 + 勘誤） |
| 客戶到底給了什麼 | [docs/reference/](docs/reference/)、[NEWT2/](NEWT2/) |
| 怎麼部署、怎麼運維 | [deploy/README.md](deploy/README.md) |
| 每個環境變數的踩坑史 | [.env.example](.env.example) |
| 還沒跟客戶談定的事 | [與客戶討論的問題.md](與客戶討論的問題.md)、[待修問題清單-2026-09-13.md](待修問題清單-2026-09-13.md) |
| 專案 B 進度 | [docs/進度-專案B多公司.md](docs/進度-專案B多公司.md) |
| 演示怎麼走 | [演示腳本-T2v2-2026-09-13.md](演示腳本-T2v2-2026-09-13.md) |

---

## 已知限制與注意事項

- **T2 沒有治療師在場。** 家長自行施測，程式碼裡的「施測者」是家長，外行做不了臨床分級——這決定了報告能說什麼、不能說什麼。
- **22 支自建工具無常模、無信效度驗證**，同一支工具三套分級，每筆結果帶 `unsourced_threshold`。下一步是累積施測資料建立本土常模。
- **付費 JSAPI 尚未打通**（缺公眾號網頁授權取 openid），微信內建瀏覽器目前只能走 H5。
- **簡訊四項缺一就是家長全部登不進來**，而程序照常啟動——上線檢查清單第一條。
- **商城**（`WearablesMall`）為展示原型，不產生真實交易。
- **線下據點不在系統裡**，也不會進系統；預約由客服接手安排，這是已選的取捨。
- 舊干預包（九十格配對、素材庫分頁、`/api/intervention-pack`）已於 #63 退場，`intervention_materials` 表僅保留。
