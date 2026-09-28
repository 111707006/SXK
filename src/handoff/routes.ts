/**
 * B→A 交接的端點（ADR-0009、docs/specs/b-to-a-handoff.md §4）。`server.ts` 只注册、注入依賴：
 * 發出端的 Router 掛在 `multiCompanyOnly`（只有專案 B），接收端的掛在 `tier2Only`（只有專案 A）。
 *
 * 發出端（B）
 * - `GET  /api/handoff/config`         前端決定要不要畫按鈕
 * - `POST /api/handoff/start`          B 家長按下按鈕：要登入、要同意、要有 T1 成績 → 交接連結（2 分鐘）
 * - `POST /internal/handoff/redeem`    A 的伺服器來兌換（密鑰）：一次性，交出規格 §1 那一包
 *
 * 接收端（A）
 * - `POST /api/handoff/redeem`         家長的瀏覽器帶著交接碼來：向 B 兌換 → 找或建帳號 → 帶入 → 登入
 *
 * 錯誤一律不分辨原因（找不到、用過、過期、密鑰錯都是同一句）：這幾支不能變成「這個碼存不存在」的查詢機。
 */
import express from 'express';
import type { AssessmentRecord, DimensionScore } from '../types';
import {
  buildHandoffPayload,
  generateHandoffCode,
  handoffUrl,
  hashHandoffCode,
  HANDOFF_TTL_SEC,
  isHandoffCodeShape,
  readHandoffPayload,
  secretMatches,
  type HandoffSourceConfig,
  type HandoffTargetConfig,
} from './core';
import type { ConsumedHandoff } from '../db/handoffs';
import type { HandoffKind } from './core';

export interface ParentData {
  child: Record<string, unknown> | null;
  completedScores: DimensionScore[];
  orders: unknown[];
  reportHistory: AssessmentRecord[];
}

// ── 發出端（B） ──────────────────────────────────────────────────

export interface HandoffSourceDeps {
  config: HandoffSourceConfig | null;
  dbReady: () => boolean;
  /** 未登入／帳號已不在就回 401 並回 `null`；登入了回資料庫的 `users.id`。 */
  requireParent: (req: express.Request, res: express.Response) => Promise<number | null>;
  loadParent: (userId: number) => Promise<{ phone: string | null; data: ParentData | null } | null>;
  loadCompany: (userId: number) => Promise<{ id: number; slug: string; name: string } | null>;
  createCode: (input: { userId: number; codeHash: string; kind: HandoffKind; ttlSec: number; consentVersion: string | null }) => Promise<number>;
  consumeCode: (codeHash: string) => Promise<ConsumedHandoff | null>;
}

const hasT1 = (scores: unknown): scores is DimensionScore[] =>
  Array.isArray(scores) && scores.some(s => s && typeof s === 'object' && (s as DimensionScore).tierId === 'T1');

function bearerOf(req: express.Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function createHandoffSourceRouter(deps: HandoffSourceDeps): express.Router {
  const router = express.Router();
  const enabled = () => deps.config !== null && deps.dbReady();

  router.get('/api/handoff/config', (_req, res) => {
    res.json({ enabled: enabled() });
  });

  router.post('/api/handoff/start', async (req, res) => {
    try {
      if (!enabled()) {
        res.status(404).json({ error: '这个功能还没有开放。', code: 'HANDOFF_DISABLED' });
        return;
      }
      const userId = await deps.requireParent(req, res);
      if (userId === null) return;
      if (req.body?.consent !== true) {
        res.status(400).json({ error: '需要先同意把孩子的筛查结果带到森心康。', code: 'CONSENT_REQUIRED' });
        return;
      }
      const parent = await deps.loadParent(userId);
      if (!parent?.phone) {
        res.status(409).json({ error: '这个帐号没有手机号，暂时无法带过去。', code: 'PHONE_REQUIRED' });
        return;
      }
      if (!parent.data?.child || !hasT1(parent.data.completedScores)) {
        res.status(409).json({ error: '请先完成筛查，再到森心康做深度评估。', code: 'SCREENING_REQUIRED' });
        return;
      }
      const { code, hash } = generateHandoffCode();
      await deps.createCode({
        userId,
        codeHash: hash,
        kind: 'button',
        ttlSec: HANDOFF_TTL_SEC.button,
        consentVersion: deps.config!.consentVersion,
      });
      // 連結本身就是一把 2 分鐘的鑰匙：不讓任何一層快取留著它。
      res.set('Cache-Control', 'no-store');
      res.json({ url: handoffUrl(deps.config!.targetOrigin, code), expiresInSec: HANDOFF_TTL_SEC.button });
    } catch (err: any) {
      console.error('[Handoff] start failed:', err.message);
      res.status(500).json({ error: '暂时无法前往森心康，请稍后再试。' });
    }
  });

  router.post('/internal/handoff/redeem', async (req, res) => {
    const invalid = () => res.status(404).json({ error: 'not found' });
    try {
      if (!enabled() || !secretMatches(bearerOf(req), deps.config!.secret)) return invalid();
      const code = req.body?.code;
      if (!isHandoffCodeShape(code)) return invalid();
      const consumed = await deps.consumeCode(hashHandoffCode(code));
      if (!consumed) return invalid();
      const parent = await deps.loadParent(consumed.userId);
      if (!parent?.phone || !parent.data?.child || !hasT1(parent.data.completedScores)) {
        // 發碼時都有，兌換時沒了：兩分鐘內重做篩查或帳號被刪。碼已經用掉，當成無效。
        console.warn(`[Handoff] 交接码对应的家长资料不完整（user ${consumed.userId}），不交出。`);
        return invalid();
      }
      const company = await deps.loadCompany(consumed.userId);
      res.set('Cache-Control', 'no-store');
      res.json(buildHandoffPayload({
        phone: parent.phone,
        sourceUserId: consumed.userId,
        source: company ? { companyId: company.id, slug: company.slug, name: company.name } : null,
        child: parent.data.child,
        completedScores: parent.data.completedScores,
        reportHistory: parent.data.reportHistory,
        kind: consumed.kind,
        consentVersion: consumed.consentVersion,
      }));
    } catch (err: any) {
      console.error('[Handoff] internal redeem failed:', err.message);
      res.status(500).json({ error: 'internal error' });
    }
  });

  return router;
}

// ── 接收端（A） ──────────────────────────────────────────────────

export interface HandoffTargetDeps {
  config: HandoffTargetConfig | null;
  dbReady: () => boolean;
  fetchImpl: typeof fetch;
  findUserIdByPhone: (phone: string) => Promise<number | null>;
  createUser: (phone: string) => Promise<number>;
  loadData: (userId: number) => Promise<ParentData | null>;
  saveData: (userId: number, data: ParentData) => Promise<void>;
  recordImport: (input: {
    userId: number;
    sourceUserId: number;
    source: { companyId: number; slug: string; name: string } | null;
    kind: HandoffKind;
    consentVersion: string | null;
    imported: boolean;
  }) => Promise<void>;
  signToken: (userId: string) => string;
  /** 向 B 兌換的逾時（毫秒）。兩個程序在同一台主機上，5 秒已經很寬。 */
  timeoutMs?: number;
}

export function createHandoffTargetRouter(deps: HandoffTargetDeps): express.Router {
  const router = express.Router();

  router.post('/api/handoff/redeem', async (req, res) => {
    const invalid = () =>
      res.status(410).json({ error: '这个连结已经用过或过期了，请用手机验证码登录。', code: 'HANDOFF_INVALID' });
    try {
      if (deps.config === null || !deps.dbReady()) {
        res.status(503).json({ error: '这个功能还没有开放。', code: 'HANDOFF_UNAVAILABLE' });
        return;
      }
      const code = req.body?.code;
      if (!isHandoffCodeShape(code)) return invalid();

      let upstream: Response;
      try {
        upstream = await deps.fetchImpl(`${deps.config.sourceOrigin}/internal/handoff/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deps.config.secret}` },
          body: JSON.stringify({ code }),
          signal: AbortSignal.timeout(deps.timeoutMs ?? 5000),
        });
      } catch (err: any) {
        console.error('[Handoff] 连不上发出端：', err.message);
        res.status(502).json({ error: '暂时连不上，请稍后再试，或用手机验证码登录。', code: 'HANDOFF_SOURCE_UNREACHABLE' });
        return;
      }
      if (upstream.status === 404) return invalid();
      const payload = upstream.ok ? readHandoffPayload(await upstream.json().catch(() => null)) : null;
      if (!payload) {
        console.error(`[Handoff] 发出端的回应不对（HTTP ${upstream.status}）`);
        res.status(502).json({ error: '暂时连不上，请稍后再试，或用手机验证码登录。', code: 'HANDOFF_SOURCE_UNREACHABLE' });
        return;
      }

      const userId = (await deps.findUserIdByPhone(payload.phone)) ?? (await deps.createUser(payload.phone));
      const existing = await deps.loadData(userId);
      // A 已經有篩查就不覆蓋：那是這位家長在 A 自己做的，比帶過來的新或舊都不該由我們猜。
      const imported = !hasT1(existing?.completedScores);
      let data: ParentData = existing ?? { child: null, completedScores: [], orders: [], reportHistory: [] };
      if (imported) {
        const history = (existing?.reportHistory ?? []).filter(r => r.id !== payload.t1Report?.id);
        data = {
          child: payload.child,
          completedScores: payload.completedScores,
          orders: existing?.orders ?? [],
          reportHistory: payload.t1Report ? [...history, payload.t1Report] : history,
        };
        await deps.saveData(userId, data);
      }
      await deps.recordImport({
        userId,
        sourceUserId: payload.sourceUserId,
        source: payload.source,
        kind: payload.kind,
        consentVersion: payload.consentVersion,
        imported,
      });

      res.set('Cache-Control', 'no-store');
      // 前七欄與 `/api/auth/sms/verify` 相同 —— 前端照一般登入成功處理。
      res.json({
        success: true,
        phone: payload.phone,
        token: deps.signToken(String(userId)),
        child: data.child,
        completedScores: data.completedScores,
        orders: data.orders,
        reportHistory: data.reportHistory,
        handoff: { imported, sourceName: payload.source?.name ?? null },
      });
    } catch (err: any) {
      console.error('[Handoff] redeem failed:', err.message);
      res.status(500).json({ error: '暂时无法完成，请稍后再试，或用手机验证码登录。' });
    }
  });

  return router;
}
