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
import { resolveCompanyCondition, type AdminIdentity, type CompanyCondition } from './companyScope';
import { buildIdentity, signAdminToken, verifyAdminToken } from './adminAuth';
import { renderParentExportHtml } from './exportView';
import { readMaterialInput } from '../utils/materialCells';

const BCRYPT_ROUNDS = 10;

/** 進站連結的識別碼：只收小寫英數與連字號，長度 2–64。 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

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

export function createAdminRouter(): express.Router {
  const router = express.Router();

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
   */
  router.post('/select-company', async (req: AuthedRequest, res) => {
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
    const result = resolveCompanyCondition(req.admin!);
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
   * 匯出單筆家長資料（可列印，交給不會登入系統的專家）。
   *
   * **刻意呼叫與詳情畫面同一個 `getParentDetail`**，不另開取資料的路徑 ——
   * 匯出最容易被實作成一句獨立查詢，而那句查詢就會成為繞過範圍限制的第二條路。
   */
  router.get('/parents/:id/export', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: '找不到该家长。' });
      return;
    }
    try {
      const detail = await store.getParentDetail(condition, id);
      if (!detail) {
        res.status(404).json({ error: '找不到该家长。' });
        return;
      }
      res.type('html').send(renderParentExportHtml(detail));
    } catch (err: any) {
      console.error('[Admin] export failed:', err.message);
      res.status(500).json({ error: '汇出失败。' });
    }
  });

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
  router.get('/company', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    try {
      res.json({ company: await store.getScopedCompany(condition) });
    } catch (err: any) {
      console.error('[Admin] getScopedCompany failed:', err.message);
      res.status(500).json({ error: '读取公司设定失败。' });
    }
  });

  router.put('/company', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    const raw = req.body?.wecomWebhookUrl;
    const url = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    if (url && !/^https:\/\//.test(url)) {
      res.status(400).json({ error: '企业微信 webhook 必须是 https:// 开头的网址。' });
      return;
    }
    try {
      const affected = await store.updateScopedCompanyWebhook(condition, url);
      if (affected === 0) {
        res.status(400).json({ error: '「未归属」不是一家公司，没有通知位置可以设定。' });
        return;
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[Admin] updateCompanyWebhook failed:', err.message);
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

  router.get('/companies', async (req: AuthedRequest, res) => {
    if (!requireGlobal(req, res)) return;
    res.json({ companies: await store.listCompanies() });
  });

  router.post('/companies', async (req: AuthedRequest, res) => {
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

  /** 跨公司彙總：只回統計數字，不回任何個別家長。 */
  router.get('/summary', async (req: AuthedRequest, res) => {
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
      const affected = await store.updateMaterial(id, parsed.input);
      if (affected === 0) {
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

  return router;
}
