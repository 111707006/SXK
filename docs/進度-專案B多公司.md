# 進度：專案 B 多合作公司（GitHub Issues #1–#13）

> 更新時間：2026-08-06。
> 規格見 GitHub Issues `111707006/SXK` #1（epic）與 #2–#13；架構決定見 `docs/adr/0001-project-b-multi-company.md`。

## 現況一句話

**#2–#13 全部完成，前後端都有了。`npx tsc --noEmit` 全綠，225 個測試全過。**

管理中心的畫面已實作（`src/admin/AdminApp.tsx` + `src/admin/panels/`），
並跑過一輪 max-effort code review，15 個發現全部修掉。

## 已完成

### 接縫與測試基礎（#2 完成）

- `server.ts` 只**定義**應用程式，不再自己 `listen`；新增 `main.ts` 作為唯一會綁定連接埠的進入點。
  `package.json` 的 `dev` / `build` 都改指向 `main.ts`（產出檔名仍是 `dist/server.cjs`，部署設定不用動）。
- `/api` 的 JSON 404 兜底從 `startServer()` 內移到模組底部 —— 測試看到的行為與正式環境一致。
- `vitest.config.ts`（新）+ `test/setup/testEnv.ts`（新）：**測試前先把 MYSQL_* 等環境變數清空**，
  否則 `dotenv.config()` 會讀進開發機 `.env` 裡的真實 RDS 連線資訊，一條 HTTP 測試就打到線上資料庫。
- `test/helpers/httpApp.ts`：`loadApp()` + `startTestApp()`，對真實路由發真實請求。
- `test/paywallGate.http.test.ts`：釘住 2026-07-31 的付費閘門繞過。
  **已實測把 bug 放回去（`dimensionName` 改回讀 body）→ 該條測試失敗**。

### 資料模型（`deploy/schema.sql`）

新增 `companies`、`admin_users`、`admin_company_switches`、`specialists`；
`users` 加 `company_id`（歸屬，NULL = 未歸屬，`ON DELETE SET NULL`）。
檔案末端附了既有資料庫的 `ALTER TABLE` 遷移註解，並寫明既有家長一律留在未歸屬、不可批次指派。

### 公司隔離（#6 核心）

- `src/admin/companyScope.ts` —— 純函式。`CompanyCondition` **型別上沒有「全部公司」這個值**；
  `resolveCompanyCondition()` 回判別聯集；`companyWhereSql()` 永遠產出非空片段。
- `src/admin/adminStore.ts` —— 後台唯一的資料入口，每一句家長查詢都內插 `${scope.sql}`。
- `src/admin/routes.ts` —— 所有 `/api/admin/*`，**不得匯入 `src/db/mysql`**，公司條件只從工作階段取得。
- `src/admin/adminAuth.ts` —— 後台 token 與家長端**分開簽章**（由 `SESSION_SECRET` 再推導一層）；
  角色與啟用狀態每次請求都回查資料庫。
- `src/admin/exportView.ts` —— 匯出頁只接受已取好的 `ParentDetail`，型別上拿不到 pool。

三層測試（ticket #1 指定的那三種）：

| 檔案 | 管的事 |
|---|---|
| `test/companyScope.test.ts` | 條件在任何輸入下都產得出來，且沒有空條件的路徑 |
| `test/adminScope.structure.test.ts` | 每一句查詢都用了它；`routes.ts` 沒有 SQL、沒有 db import；例外清單只有兩項且各有理由 |
| `test/adminIsolation.http.test.ts` | 37 條 HTTP 測試：跨公司列表／詳情／匯出／專家／彙總、停用帳號、未選定公司、切換留紀錄 |

**已實測兩種「把 bug 放回去」**：
1. `listParents` 拿掉 `WHERE ${scope.sql}` → 結構測試 3 條失敗。
2. `withScope` 改成信任 `req.query.companyId` → HTTP 測試「公司成員無法用查詢參數把自己換到別家公司」失敗。

### 端點（全部已實作並測過）

`POST /api/admin/login`、`GET /me`、`POST /select-company`、`GET /parents`、`GET /parents/:id`、
`GET /parents/:id/export`、`GET|POST /specialists`、`PUT /specialists/:id`、`GET|PUT /company`、
`GET|POST /companies`、`GET|POST /admin-users`、`POST /admin-users/:id/active`、`GET /summary`。

### 家長端

- `src/utils/attribution.ts`（新）：進站時把 `?c=<slug>` 記在瀏覽器；**已記過的不覆寫**。
  `src/main.tsx` 在 render 前呼叫 `captureCompanySlug()`。
- `AuthScreen.tsx` 註冊時附上 `companySlug`；`server.ts` 的 `/api/auth/register` 用
  `resolveCompanyIdForSignup()` 換成 company id，**查不到一律未歸屬，不退回任何預設公司**。
- `GET /api/specialists`（新）：依家長歸屬回專家，並帶一個明確的 `reason`
  （`ok` / `unassigned` / `none_configured` / `unavailable`）。
- `src/utils/specialists.ts`（新）+ `AnalysisReport.tsx` 改用它；
  `PRODUCT.expertBooking.specialistSource` 決定走內建（專案 A）或公司名單（專案 B）。
  **專案 A 完全沒有行為改變。** 沒有專家時報告頁顯示明確替代說明，不出現空白預約區塊。
- `src/notify.ts`：通知依歸屬送到該公司 webhook；未設定退回全域並在日誌記一行；
  兩者皆無時 `reached NOBODY` 的錯誤會印出公司名。`test/notify.test.ts` 涵蓋四種情況。

### 管理中心畫面（#15）

- `src/admin/adminView.ts`（新）—— **畫面的決策層，純函式**。專案沒有 jsdom，
  「誰看得到什麼」「一個空列表代表什麼」寫在 JSX 條件裡就沒有任何測試驗得到，
  而它們錯掉的樣子恰好都很正常。因此判斷全部住在這裡，`test/adminView.test.ts`
  釘住 37 條，其中兩條是核心：**全域管理員未選定公司時進不到資料畫面**、
  **公司成員的選單裡不出現全域分頁**。
- `src/admin/ui.tsx`（新）—— 共用零件與 `useAsyncData`。六個分頁共用同一個
  「載入 → 顯示 → 修改 → 重新載入」的形狀，抄六份的話錯誤處理一定會走樣。
- `src/admin/AdminApp.tsx`（新）—— 殼：登入、公司切換、分頁切換、錯誤分流。
  切換視野時以 `scopeKey(identity)` 當 React key **強制重掛分頁**，
  避免上一家公司的資料留在畫面上。
- `src/admin/panels/`（新）—— 六個分頁，各自對應一張票。
- token 輪替收進 `adminApi`：`login` / `selectCompany` 自己寫入新 token，
  元件沒有「忘記」這個選項。忘記的後果是切換公司後仍用舊視野查詢。

### code review 修掉的 15 個發現

比較要緊的幾個：

| 問題 | 修法 |
|---|---|
| **`SESSION_SECRET` 缺席時後台簽章密鑰退回空字串** —— `HMAC(key='', …)` 是常數，任何人都能自簽 `global_admin` token | 失敗關閉：簽不出來、驗不過，router 加 503 閘門。`test/adminAuth.test.ts` 釘住，**已實測把 bug 放回去 → 2 條失敗** |
| **預約日期區間寫死 `2026-07-09~07-30`，已整段過期** —— 專案 B 唯一的轉換點每一筆都送出四週前的時段 | 改成 `bookingDayOffset()` 動態計算（明天起 30 天） |
| 載入失敗與「零筆資料」在分頁裡分不出來 | `useAsyncData` 一律設定 `failure`，錯誤不再被畫成「這家公司沒有家長」 |
| 後台時間以 UTC 顯示，比中國時間早 8 小時 | `formatDateTime` 固定換算到 `Asia/Shanghai`（伺服器端匯出頁共用同一個函式） |
| 「已保存」被它自己觸發的重載清掉 | effect 不再重設該旗標 |

其餘為 Button 的 props 覆寫順序、Blob 下載的 revoke 時機、`localStorage` 未防護、
`notify` 退回全域時的判斷不一致、不可用畫面沒有出口等。

## 還沒做

1. `/api/admin/*` 尚未對真實資料庫跑過 —— 本機 `.env` 指向線上 RDS，刻意沒有連。
   所有畫面是用一個臨時樁伺服器（已刪除）實際點過一輪的。
2. 第一個全域管理員帳號要手動塞（見下方取捨）。

## 部署順序（Render / 阿里雲皆同）

⚠️ **遷移必須在部署新版程式碼之前跑完，順序反了會靜默壞掉家長註冊。**

新版的 `createUser` 是 `INSERT INTO users (email, password, company_id)`。
`company_id` 不存在時這句會失敗，而註冊路由會把 SQL 錯誤當成「資料庫不可用」
退回記憶體模式，然後回 `{success: true}` —— 家長看到註冊成功、拿到 token，
但帳號沒進資料庫，重啟就消失。不是報錯，是靜默資料遺失。

1. 備份資料庫。
2. 跑 `deploy/migrations/2026-08-06-project-b-multi-company.sql`。
   結尾兩句驗證要分別回 `1` 與 `4`，沒有就別往下走。
3. 確認該環境有 `SESSION_SECRET`。沒有的話 `/api/admin/*` 整組回 503
   （`render.yaml` 是 `generateValue: true`，從 Blueprint 建的 service 已經有）。
4. 合併到 `master`。Render 兩個 service（`sxk` / `sxk-t1`）都從預設分支自動部署。
5. 手動建立第一個 `global_admin`（見下方取捨）。
6. 在後台建立第一家合作公司，把 `/?c=<slug>` 連結交給對方。

既有家長全部留在未歸屬（`company_id = NULL`），只有全域管理員看得到，不會消失。

## 交接時要知道的取捨

- **匯出是「可列印 HTML → 瀏覽器另存為 PDF」，不是真的產生 PDF 檔。**
  專案沒有 PDF 產生器，中文 PDF 需要內嵌十幾 MB 的字型檔進版控，而現有報告的列印
  （`AnalysisReport.tsx` 的 `window.print()`）走的就是這條路。要改成真的產 PDF 只需要動
  `src/admin/exportView.ts` 一個檔案，取資料那一段不會變。**這一點需要跟產品端確認。**
- **後台刻意沒有記憶體模式**：沒有 MYSQL_* 時整個 `/api/admin/*` 回 503 `ADMIN_UNAVAILABLE`。
- **`SESSION_SECRET` 是後台的部署前提**，不是可選項。沒有它整個 `/api/admin/*` 一樣回 503。
  家長端在缺它時退回一把隨機密鑰（重啟後登入失效，可以接受）；後台不能這樣做，
  因為任何「有預設值」的簽章密鑰都等於沒有簽章。
- **第一個全域管理員帳號要手動塞進 `admin_users`**。刻意沒有預設帳號也沒有自助註冊 ——
  一個有預設密碼的後台等於沒有後台。步驟（在部署機上跑，密碼不要留在 shell history）：

  ```bash
  node -e "require('bcryptjs').hash(process.argv[1],10).then(h=>console.log(h))" '你的密码'
  ```

  ```sql
  INSERT INTO admin_users (email, password, role, company_id, active)
  VALUES ('you@example.com', '<上一步印出的 $2b$… 杂凑>', 'global_admin', NULL, 1);
  ```

  `role` 只有 `global_admin` 與 `company_member` 兩個值；`company_member` 必須有 `company_id`
  （沒有的話 `buildIdentity()` 會擋下來，那是刻意的）。之後開設其他帳號走後台的
  「後台帳號」分頁，不必再碰資料庫。
- ⛔ **同意流程仍然不存在。** 合作公司看得到家長與孩子的完整資料而系統沒有任何同意機制，
  這是上線的法律前提（見 epic #1 與 ADR-0001），產品端決定延後，但它沒有因此變成普通待辦。
