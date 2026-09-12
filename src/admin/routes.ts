/**
 * 管理中心的所有路由。
 *
 * ⚠️ **這個檔案不得匯入 `src/db/mysql`。** `test/adminScope.structure.test.ts`
 * 會擋住。取資料只有一條路：`./adminStore`，而那裡的每一句家長查詢都帶公司條件。
 * 少了這條規則，一支路由自己下一句 `SELECT * FROM users` 就能繞過整套隔離，
 * 而純函式測試會照樣全綠。
 *
 * 每一支讀寫家長資料的路由都經過 `withScope`，公司條件由**工作階段**產生，
 * 不由請求參數產生 —— 後者只是一個換數字的遊戲。
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import * as store from './adminStore';
import {
  resolveCompanyCondition,
  type AdminCenterShape,
  type AdminIdentity,
  type CompanyCondition,
} from './companyScope';
import { buildIdentity, signAdminToken, verifyAdminToken } from './adminAuth';
import { readMaterialInput } from '../utils/materialCells';
import { readActivityPatch } from '../utils/activityAdmin';
import { SLUG_PATTERN } from '../utils/companySlug';
import { isAllowedAssetUrl, assetUrlError } from '../utils/assetUrl';

const BCRYPT_ROUNDS = 10;

/** 活動編號：一個大寫字母加 3–7 位數字（種子是 'A001'–'A300'，欄位是 VARCHAR(8)）。 */
const ACTIVITY_ID_PATTERN = /^[A-Z]\d{3,7}$/;

// 進站識別碼的格式規則收在 `src/utils/companySlug.ts`，與前端共用同一份。

type AuthedRequest = express.Request & { admin?: AdminIdentity };

function bearer(req: express.Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function identityView(identity: AdminIdentity) {
  return identity.role === 'company_member'
    ? { role: identity.role, email: identity.email, companyId: identity.companyId, selection: null }
    : { role: identity.role, email: identity.email, companyId: null, selection: identity.selection };
}

function issueToken(identity: AdminIdentity): string {
  return signAdminToken(
    identity.role === 'company_member'
      ? {
          aid: identity.adminUserId,
          email: identity.email,
          role: 'company_member',
          companyId: identity.companyId,
          sel: null,
        }
      : {
          aid: identity.adminUserId,
          email: identity.email,
          role: 'global_admin',
          companyId: null,
          sel: identity.selection,
        }
  );
}

/**
 * 後台碰不到、但必須跟著後台一起變的東西。
 *
 * `server.ts` 在記憶體裡留著一份家長資料的熱備份（`offlineUserData`），而
 * `adminStore` 只碰得到資料庫。刪掉一位家長之後那份備份必須跟著消失，否則孩子的
 * 健康資料會留在跑著的進程裡，直到下一次重啟 —— 而 ADR-0006 與家長端條款承諾的
 * 是「全部關聯資料」都刪掉。
 *
 * 做成回呼而不是讓 routes 去 import server：那會是一個循環相依（server 匯入 routes）。
 */
export interface AdminRouterHooks {
  /** 一位家長被刪除之後呼叫。丟例外不會讓那次刪除失敗 —— 資料庫那邊已經提交了。 */
  onParentDeleted?: (parentId: number) => void;
}

/**
 * @param shape 這個部署有沒有合作公司這回事。**沒有預設值**：忘了傳就是型別
 *   錯誤，而不是安靜地退回多公司行為 —— 那在專案 A 上的樣子是一個空列表。
 */
export function createAdminRouter(shape: AdminCenterShape, hooks: AdminRouterHooks = {}): express.Router {
  const router = express.Router();

  /**
   * 只有多合作公司才存在的路由（issue #19）。
   *
   * 專案 A 把它們註冊在一個**永遠不會被掛載**的 Router 上，於是那些路徑真的
   * 不存在，請求落到 `/api` 的 404 兜底 —— 與 `server.ts` 對 tier-2/3 端點的
   * 手法相同（見那裡的 `tier2Only`）。
   *
   * 這比「註冊處理函式再從裡面回 403」強兩件事：沒有處理函式就沒有東西可繞過；
   * 而 403 等於承認「這條路徑存在，只是你不能用」，404 什麼都沒承認。對
   * 「專案 A 上根本建不出合作公司」這句話來說，前者是可以被證明的，後者不是。
   */
  const multiCompanyOnly = shape.multiCompany ? router : express.Router();

  // ── 資料庫閘門 ──
  // 後台刻意沒有記憶體模式。家長端的記憶體降級是為了讓展示站跑得起來；
  // 一個「用假資料也能登入」的管理後台則毫無意義，而且會讓「有沒有資料」與
  // 「有沒有權限」兩件事在畫面上長得一模一樣。
  router.use((req, res, next) => {
    if (!store.isAvailable()) {
      res.status(503).json({
        error: '管理中心需要数据库。当前部署未配置 MYSQL_*，后台不可用。',
        code: 'ADMIN_UNAVAILABLE',
      });
      return;
    }
    // 沒有 SESSION_SECRET 就簽不出工作階段（見 adminAuth.ts）。在這裡明說，
    // 而不是讓 signAdminToken 在登入路由裡拋出一個「登入失败，请稍后再试」——
    // 那句話會讓維運人員一直去查密碼，而問題根本不在密碼。
    if (!process.env.SESSION_SECRET) {
      res.status(503).json({
        error: '管理中心需要 SESSION_SECRET。当前部署未配置，后台不可用。',
        code: 'ADMIN_UNAVAILABLE',
      });
      return;
    }
    next();
  });

  // ── 登入 ──
  router.post('/login', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) {
        res.status(400).json({ error: '请填写帐号与密码。' });
        return;
      }

      const account = await store.findAdminUserByEmail(email);
      // 帳號不存在、密碼錯誤、帳號已停用，回的是同一句話。
      // 分開講等於免費送出一份「這個信箱是不是後台帳號」的查詢服務。
      const ok = account ? await bcrypt.compare(password, account.passwordHash) : false;
      if (!account || !ok || !account.active) {
        res.status(401).json({ error: '帐号或密码错误，或该帐号已停用。' });
        return;
      }

      const identity = buildIdentity(
        { typ: 'admin', aid: account.id, email: account.email, role: account.role, companyId: account.companyId, sel: null, exp: 0 },
        account
      );
      if (!identity) {
        res.status(401).json({ error: '帐号设定不完整，请联系系统管理员。' });
        return;
      }

      res.json({ token: issueToken(identity), identity: identityView(identity) });
    } catch (err: any) {
      console.error('[Admin] Login failed:', err.message);
      res.status(500).json({ error: '登入失败，请稍后再试。' });
    }
  });

  // ── 以下全部需要有效且仍啟用的後台帳號 ──
  router.use(async (req: AuthedRequest, res, next) => {
    try {
      const payload = verifyAdminToken(bearer(req));
      if (!payload) {
        res.status(401).json({ error: '请先登入管理中心。', code: 'ADMIN_UNAUTHENTICATED' });
        return;
      }
      // 角色與啟用狀態一律以資料庫為準。停用一個帳號要立刻生效，
      // 不是等 token 過期 —— 「對方有人離職」是這個功能存在的理由。
      const account = await store.findAdminUserById(payload.aid);
      const identity = account ? buildIdentity(payload, account) : null;
      if (!identity) {
        res.status(401).json({ error: '登入状态已失效，请重新登入。', code: 'ADMIN_UNAUTHENTICATED' });
        return;
      }
      req.admin = identity;
      next();
    } catch (err: any) {
      console.error('[Admin] Session check failed:', err.message);
      res.status(500).json({ error: '登入状态检查失败。' });
    }
  });

  router.get('/me', async (req: AuthedRequest, res) => {
    const identity = req.admin!;
    // 全域管理員需要公司清單才切換得了；公司成員不該知道還有別家公司存在。
    const companies = identity.role === 'global_admin' ? await store.listCompanies() : [];
    res.json({ identity: identityView(identity), companies });
  });

  /**
   * 全域管理員切換視野。**每一次都留下紀錄。**
   *
   * 公司成員呼叫得到但改不了任何事 —— 他的視野由帳號決定，不由請求決定。
   *
   * 專案 A 沒有這條路徑：那裡只有一個視野（未歸屬），切換是一個沒有內容的
   * 動作，而它每被呼叫一次就在切換紀錄裡留下一筆沒有意義的資料。
   */
  multiCompanyOnly.post('/select-company', async (req: AuthedRequest, res) => {
    const identity = req.admin!;
    if (identity.role !== 'global_admin') {
      res.status(403).json({ error: '只有全域管理员能切换公司。', code: 'FORBIDDEN' });
      return;
    }

    const raw = req.body?.selection;
    let selection: { kind: 'company'; companyId: number } | { kind: 'unassigned' } | null = null;
    if (raw === 'unassigned') {
      selection = { kind: 'unassigned' };
    } else if (raw && typeof raw === 'object' && Number.isInteger(raw.companyId)) {
      const company = await store.findCompanyById(Number(raw.companyId));
      if (!company) {
        res.status(404).json({ error: '找不到该合作公司。' });
        return;
      }
      selection = { kind: 'company', companyId: company.id };
    } else if (raw !== null) {
      res.status(400).json({ error: '请指定要切换到的合作公司，或选择「未归属」。' });
      return;
    }

    if (selection) {
      await store.recordCompanySwitch(
        identity.adminUserId,
        selection.kind === 'company' ? selection.companyId : null,
        selection.kind,
        req.ip ?? null
      );
    }

    const next: AdminIdentity = { ...identity, selection };
    res.json({ token: issueToken(next), identity: identityView(next) });
  });

  /**
   * 公司條件的唯一取得處。
   *
   * 取不到條件（全域管理員尚未選定公司）就直接回應並回 `null` —— 呼叫端拿到
   * `null` 時**必須立刻 return**，不可自行決定要不要繼續。
   */
  function withScope(req: AuthedRequest, res: express.Response): CompanyCondition | null {
    const result = resolveCompanyCondition(req.admin!, shape);
    if (!result.ok) {
      res.status(409).json({
        error: '请先选定一家合作公司，才能查看资料。',
        code: 'NO_COMPANY_SELECTED',
      });
      return null;
    }
    return result.condition;
  }

  // ── 家長列表 ──
  router.get('/parents', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    try {
      const sort = req.query.sort === 'oldest' ? 'oldest' : 'newest';
      const booked =
        req.query.booked === 'booked' ? 'booked' : req.query.booked === 'not_booked' ? 'not_booked' : 'all';
      const parents = await store.listParents(condition, { sort, booked });
      res.json({ parents });
    } catch (err: any) {
      console.error('[Admin] listParents failed:', err.message);
      res.status(500).json({ error: '读取家长列表失败。' });
    }
  });

  // ── 單筆家長詳情 ──
  router.get('/parents/:id', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: '找不到该家长。' });
      return;
    }
    try {
      const detail = await store.getParentDetail(condition, id);
      // 不存在與不屬於這個視野回的是**同一個 404**：分開回應等於送出一台
      // 「這個 id 存在嗎」的查詢機，別家公司的家長規模就這樣漏出去。
      if (!detail) {
        res.status(404).json({ error: '找不到该家长。' });
        return;
      }
      res.json({ parent: detail });
    } catch (err: any) {
      console.error('[Admin] getParentDetail failed:', err.message);
      res.status(500).json({ error: '读取家长资料失败。' });
    }
  });

  /**
   * 刪除一位家長（ADR-0006）。**硬刪，不留紀錄。**
   *
   * 【兩種後台成員都刪得到】
   * 範圍就是各自的視野 —— 公司成員只刪得到自己公司的家長，全域管理員刪當下切到
   * 的視野裡的家長。這是刻意的偏離：`deploy/schema.sql` 的註解寫著孩子的健康資料
   * 掌管方是森心康，照那句話「只有全域管理員能刪」本來是預設答案。改成公司成員
   * 也能刪，是為了讓家長向合作公司提出刪除申請時，流程不必轉一手到森心康。
   * 不是漏了角色檢查。
   *
   * 【跨公司回 404，不是 403】
   * 與詳情路由一致 —— 403 等於承認那個 id 存在。
   *
   * 【有付款紀錄的擋下來】
   * 409 + `HAS_PAYMENTS`。付款是對帳憑證。已知缺口：付過錢的家長提出刪除申請目前
   * 沒有路可走，而條款承諾的是刪除。ADR-0006 記下了這件事，本次不做匿名化。
   */
  router.delete('/parents/:id', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: '找不到该家长。' });
      return;
    }
    try {
      const result = await store.deleteParent(condition, id);
      if (result === 'not_found') {
        res.status(404).json({ error: '找不到该家长。' });
        return;
      }
      if (result === 'has_payments') {
        res.status(409).json({
          error: '这位家长有付款纪录，无法删除。付款纪录是对帐凭证，退款与客诉都要用到。',
          code: 'HAS_PAYMENTS',
        });
        return;
      }
      // 資料庫以外還有一份記憶體熱備份要清（見 `AdminRouterHooks`）。
      // 包在 try 裡：那一步失敗不該讓一次已經提交的刪除回報成 500，
      // 但也不該無聲無息 —— 沒清掉就是孩子的資料還留在這個進程裡。
      try {
        hooks.onParentDeleted?.(id);
      } catch (hookErr: any) {
        console.error('[Admin] onParentDeleted hook failed:', hookErr?.message);
      }
      // 伺服器日誌照既有慣例留一行。**這不是刪除紀錄** —— ADR-0006 決定不建那張表，
      // 日誌會被輪替掉，兩年後問「你們當時刪了嗎」，系統答不出來。
      console.log(`[Admin] deleted parent ${id} by ${req.admin?.email ?? 'unknown'}`);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[Admin] deleteParent failed:', err.message);
      res.status(500).json({ error: '删除失败。' });
    }
  });

  /*
   * 匯出單筆家長資料的 `GET /parents/:id/export` 在 2026-09-11 移除（ADR-0007）。
   *
   * 它回的是伺服器拼字串出的純 HTML —— 一張九維度表格加 AI 文字，一張圖都沒有。
   * 後台改成顯示家長看到的那份報告之後，要讓這條路「長得一樣」等於用字串再實作
   * 一次整份報告（雷達圖、儀表、軌跡圖），而且之後每次改報告都要改兩處。
   *
   * 現在的列印走 `/admin/parents/:id/print`：同一個 SPA 的另一條路徑，呼叫的是
   * 上面那支 `GET /parents/:id`。issue #8 的理由（不讓匯出成為繞過公司範圍的第二條
   * 取資料路徑）因此原封不動成立 —— 新分頁只是再呼叫一次同一支端點。
   *
   * `renderParentExportHtml` 本身留著，家長掃碼帶走的那一頁（`/r/:token`）還在用它。
   */

  // ── 專家名單 ──
  router.get('/specialists', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    try {
      res.json({ specialists: await store.listSpecialists(condition, true) });
    } catch (err: any) {
      console.error('[Admin] listSpecialists failed:', err.message);
      res.status(500).json({ error: '读取专家名单失败。' });
    }
  });

  function readSpecialistInput(body: any): store.SpecialistInput | null {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 64) return null;
    const slots = Array.isArray(body?.slots)
      ? body.slots.filter((s: unknown): s is string => typeof s === 'string' && !!s.trim()).slice(0, 20)
      : [];
    const str = (v: unknown, max: number) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
    return {
      name,
      title: str(body?.title, 128),
      specialty: str(body?.specialty, 2000),
      experience: str(body?.experience, 2000),
      avatarUrl: str(body?.avatarUrl, 512),
      slots,
      active: body?.active !== false,
    };
  }

  router.post('/specialists', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    const input = readSpecialistInput(req.body);
    if (!input) {
      res.status(400).json({ error: '请填写专家姓名。' });
      return;
    }
    try {
      const created = await store.createSpecialist(condition, input);
      if (!created) {
        res.status(400).json({ error: '「未归属」不是一家公司，无法新增专家。' });
        return;
      }
      res.json({ specialist: created });
    } catch (err: any) {
      console.error('[Admin] createSpecialist failed:', err.message);
      res.status(500).json({ error: '新增专家失败。' });
    }
  });

  router.put('/specialists/:id', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    const id = Number(req.params.id);
    const input = readSpecialistInput(req.body);
    if (!Number.isInteger(id) || !input) {
      res.status(400).json({ error: '请填写专家姓名。' });
      return;
    }
    try {
      const affected = await store.updateSpecialist(condition, id, input);
      // 改到別家公司的專家與改到不存在的專家，回的是同一個 404。
      if (affected === 0) {
        res.status(404).json({ error: '找不到该专家。' });
        return;
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[Admin] updateSpecialist failed:', err.message);
      res.status(500).json({ error: '更新专家失败。' });
    }
  });

  // ── 本公司設定（企業微信通知位置） ──
  //
  // 專案 A 不掛載：未歸屬不是一家公司，沒有通知位置可以設定。留著的話那個分頁
  // 讀出 null、存下去回 400，是一個看起來壞掉但其實是設計的畫面。
  multiCompanyOnly.get('/company', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    try {
      res.json({ company: await store.getScopedCompany(condition) });
    } catch (err: any) {
      console.error('[Admin] getScopedCompany failed:', err.message);
      res.status(500).json({ error: '读取公司设定失败。' });
    }
  });

  multiCompanyOnly.put('/company', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    // `companies.wecom_webhook_url` 與 `logo_url` 都是 VARCHAR(512)。
    const MAX_URL = 512;

    /** 讀一個「可以留空」的網址欄位。回 `undefined` 代表這次請求沒帶它。 */
    function readOptionalUrl(key: string): string | null | undefined {
      if (!(key in (req.body ?? {}))) return undefined;
      const raw = req.body[key];
      if (raw === null) return null;
      if (typeof raw !== 'string') return undefined;
      const trimmed = raw.trim();
      return trimmed ? trimmed : null;
    }

    const patch: store.CompanySettingsPatch = {};

    const webhook = readOptionalUrl('wecomWebhookUrl');
    if (webhook !== undefined) {
      // webhook 是**呼叫**出去的網址，不是貼在頁面上的資源 —— 站內路徑對它沒有意義。
      if (webhook && !/^https:\/\//.test(webhook)) {
        res.status(400).json({ error: '企业微信 webhook 必须是 https:// 开头的网址。' });
        return;
      }
      if (webhook && webhook.length > MAX_URL) {
        res.status(400).json({ error: `企业微信 webhook 太长了（上限 ${MAX_URL} 个字元）。` });
        return;
      }
      patch.wecomWebhookUrl = webhook;
    }

    const logo = readOptionalUrl('logoUrl');
    if (logo !== undefined) {
      // LOGO 是貼到家長頁面上的圖，走與干預素材同一份規則（站內路徑要放行，
      // 因為這個 repo 沒有檔案上傳能力）。
      if (logo && !isAllowedAssetUrl(logo)) {
        res.status(400).json({ error: assetUrlError('LOGO 网址') });
        return;
      }
      if (logo && logo.length > MAX_URL) {
        res.status(400).json({ error: `LOGO 网址太长了（上限 ${MAX_URL} 个字元）。` });
        return;
      }
      patch.logoUrl = logo;
    }

    // 一個欄位都沒帶。這不是「未歸屬」，錯誤訊息不能講成那樣。
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: '没有要更新的设定。' });
      return;
    }

    try {
      const affected = await store.updateScopedCompanySettings(condition, patch);
      if (affected === 0) {
        res.status(400).json({ error: '「未归属」不是一家公司，没有设定可以更改。' });
        return;
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[Admin] updateCompanySettings failed:', err.message);
      res.status(500).json({ error: '更新公司设定失败。' });
    }
  });

  // ══════════════════════════════════════════════════════
  // 以下只有全域管理員 —— 合作公司無法自行增刪帳號
  // ══════════════════════════════════════════════════════
  function requireGlobal(req: AuthedRequest, res: express.Response): boolean {
    if (req.admin!.role !== 'global_admin') {
      res.status(403).json({ error: '只有全域管理员能执行此操作。', code: 'FORBIDDEN' });
      return false;
    }
    return true;
  }

  // 合作公司名冊。專案 A 不掛載 —— 「專案 A 上根本建不出合作公司」這句話
  // 要能被證明，靠的是這條路徑不存在，不是靠沒有人去按那個按鈕。
  multiCompanyOnly.get('/companies', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    res.json({ companies: await store.listCompanies() });
  });

  multiCompanyOnly.post('/companies', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim().toLowerCase() : '';
    if (!name || name.length > 128) {
      res.status(400).json({ error: '请填写公司名称。' });
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      res.status(400).json({ error: '进站识别码只能用小写英数与连字号，长度 2–64。' });
      return;
    }
    try {
      const company = await store.createCompany(name, slug);
      res.json({ company });
    } catch (err: any) {
      // slug 是 UNIQUE：兩家公司共用一個識別碼等於把家長送給错的公司。
      if (err?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ error: '这个进站识别码已经被使用。' });
        return;
      }
      console.error('[Admin] createCompany failed:', err.message);
      res.status(500).json({ error: '建立合作公司失败。' });
    }
  });

  router.get('/admin-users', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    res.json({ adminUsers: await store.listAdminUsers() });
  });

  router.post('/admin-users', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role === 'global_admin' ? 'global_admin' : 'company_member';
    const companyIdRaw = req.body?.companyId;

    if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
      res.status(400).json({ error: '请填写有效的信箱。' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: '密码至少 8 个字元。' });
      return;
    }

    let companyId: number | null = null;
    if (role === 'company_member') {
      if (!Number.isInteger(companyIdRaw)) {
        res.status(400).json({ error: '公司成员必须指定所属合作公司。' });
        return;
      }
      const company = await store.findCompanyById(Number(companyIdRaw));
      if (!company) {
        res.status(404).json({ error: '找不到该合作公司。' });
        return;
      }
      companyId = company.id;
    }

    try {
      const created = await store.createAdminUser(
        email,
        await bcrypt.hash(password, BCRYPT_ROUNDS),
        role,
        companyId
      );
      res.json({ adminUser: created });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ error: '这个信箱已经有后台帐号。' });
        return;
      }
      console.error('[Admin] createAdminUser failed:', err.message);
      res.status(500).json({ error: '开设后台帐号失败。' });
    }
  });

  router.post('/admin-users/:id/active', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    const id = Number(req.params.id);
    const active = req.body?.active === true;
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: '找不到该后台帐号。' });
      return;
    }
    // 停用自己會把自己鎖在門外，而且沒有第二個人能救 —— 直接擋下。
    if (id === req.admin!.adminUserId && !active) {
      res.status(400).json({ error: '不能停用自己的帐号。' });
      return;
    }
    const affected = await store.setAdminUserActive(id, active);
    if (affected === 0) {
      res.status(404).json({ error: '找不到该后台帐号。' });
      return;
    }
    res.json({ ok: true });
  });

  /**
   * 跨公司彙總：只回統計數字，不回任何個別家長。
   *
   * 專案 A 不掛載：一家公司都沒有，「跨公司」沒有東西可跨。
   */
  multiCompanyOnly.get('/summary', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    try {
      res.json({ summary: await store.summaryByCompany() });
    } catch (err: any) {
      console.error('[Admin] summary failed:', err.message);
      res.status(500).json({ error: '读取汇总失败。' });
    }
  });

  // ── 干預素材庫（issue #20）──
  //
  // 素材不是家長資料，因此這三支**不經過 `withScope`** —— 沒有一位家長的資料
  // 會從這裡出去，硬套一個公司條件只會讓人以為素材分公司。
  //
  // 但它們仍然限定全域管理員：素材是森心康的干預內容，合作公司不維護它，
  // 而專案 B 根本沒有深度評估。少了 `requireGlobal`，一家合作公司就能改掉
  // 所有孩子拿到的訓練步驟。

  router.get('/materials', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    try {
      res.json({ materials: await store.listMaterials() });
    } catch (err: any) {
      console.error('[Admin] listMaterials failed:', err.message);
      // 讀取失敗與「一格都還沒建立」必須分得開：混成同一種回應的話，
      // 沒跑遷移會被看成「還沒有人建素材」，然後一路帶到家長端。
      res.status(500).json({ error: '读取素材库失败。' });
    }
  });

  router.post('/materials', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    const parsed = readMaterialInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    try {
      res.json({ material: await store.createMaterial(parsed.input) });
    } catch (err: any) {
      // 一格一筆由資料庫的唯一鍵保證。撞上代表這一格已經有素材了，
      // 該做的是去編輯它 —— 而不是多一筆讓配對邏輯自己挑一個。
      if (err?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ error: '这一格已经建立过素材，请直接编辑既有的那一笔。' });
        return;
      }
      console.error('[Admin] createMaterial failed:', err.message);
      res.status(500).json({ error: '建立素材失败。' });
    }
  });

  router.put('/materials/:id', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: '找不到该素材。' });
      return;
    }
    const parsed = readMaterialInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    try {
      // 「找不到」問的是這個 id 在不在，不是這次儲存有沒有改到東西 ——
      // 一次原封不動的儲存（沒改欄位、或儲存鍵被按兩下）改不到任何一列，
      // 但那筆素材就在眼前。見 `store.updateMaterial` 的說明。
      if (!(await store.updateMaterial(id, parsed.input))) {
        res.status(404).json({ error: '找不到该素材。' });
        return;
      }
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ error: '这一格已经有别的素材了，请先处理那一笔。' });
        return;
      }
      console.error('[Admin] updateMaterial failed:', err.message);
      res.status(500).json({ error: '更新素材失败。' });
    }
  });

  // ── 活動庫標記頁（#62，規格 v2 §7.4）──
  //
  // 與素材庫同一個豁免、同一個理由：活動是森心康的內容，不是家長資料，**不經過
  // `withScope`**；但限定全域管理員 —— 少了 `requireGlobal`，一家合作公司就能改掉
  // 所有孩子每週拿到的訓練。
  //
  // 只有列表與局部更新，**沒有新增、沒有刪除**：300 支由種子寫入，之後新增走遷移；
  // 不再用的活動只停用（ADR-0005）。PATCH 而不是 PUT 的理由見 `readActivityPatch`。

  router.get('/activities', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    try {
      res.json({ activities: await store.listActivities() });
    } catch (err: any) {
      console.error('[Admin] listActivities failed:', err.message);
      // 讀取失敗與「一支都沒有」必須分得開：沒跑遷移會被看成「活動庫是空的」。
      res.status(500).json({ error: '读取活动库失败。' });
    }
  });

  router.patch('/activities/:id', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    const id = String(req.params.id);
    // 編號的格式沿用種子：'A017'（VARCHAR(8)）。格式不對就是找不到，不必問資料庫。
    if (!ACTIVITY_ID_PATTERN.test(id)) {
      res.status(404).json({ error: '找不到该活动。' });
      return;
    }
    const parsed = readActivityPatch(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    try {
      const activity = await store.updateActivity(id, parsed.patch);
      if (!activity) {
        res.status(404).json({ error: '找不到该活动。' });
        return;
      }
      // 回整支更新後的活動：畫面直接換掉列表裡那一列，四個進度數字跟著變，不必重抓 300 支。
      res.json({ activity });
    } catch (err: any) {
      console.error('[Admin] updateActivity failed:', err.message);
      res.status(500).json({ error: '更新活动失败。' });
    }
  });

  return router;
}
