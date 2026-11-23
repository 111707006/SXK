/**
 * 成人 ADHD 受評者端的三支端點（`APP_MODE=adhd`，設計第 4 節）。`server.ts` 只注入登入檢查與資料層。
 *
 * - `POST /api/adhd/assessments`：`{clientCaseId, payload}`，以（帳號, clientCaseId）upsert，回 `{id}`
 * - `GET  /api/adhd/assessments`：自己的歷次
 * - `GET  /api/adhd/assessments/:id`：自己的一筆 `payload`（別人的 404）
 *
 * 沒有記憶體模式：資料庫沒設好就 503（登入本來就要資料庫，ADR-0002）。
 */
import express from 'express';
import { ADHD_PAGE_VERSION } from './page';
import { CLIENT_CASE_ID, checkAdhdPayload } from './payload';
import type { AdhdAssessmentListItem, AdhdAssessmentUpsert } from '../db/adhdAssessments';

export interface AdhdStore {
  upsert(userId: number, input: AdhdAssessmentUpsert): Promise<number>;
  list(userId: number): Promise<AdhdAssessmentListItem[]>;
  findPayload(userId: number, id: number): Promise<unknown | null>;
}

export interface AdhdRouteDeps {
  /** 回 `null` 代表已經回應（401）。 */
  requireUser(req: express.Request, res: express.Response): Promise<string | null>;
  /** 帳號 id → 資料庫的 id；資料庫沒設好回 `null`。 */
  dbUserIdOf(userId: string): number | null;
  store: AdhdStore;
}

export function createAdhdRouter(deps: AdhdRouteDeps): express.Router {
  const router = express.Router();

  async function who(req: express.Request, res: express.Response): Promise<number | null> {
    const userId = await deps.requireUser(req, res);
    if (!userId) return null;
    const dbId = deps.dbUserIdOf(userId);
    if (dbId === null) {
      res.status(503).json({ error: '资料库尚未设定，暂时无法保存。', code: 'DB_UNAVAILABLE' });
      return null;
    }
    return dbId;
  }

  router.post('/api/adhd/assessments', async (req, res) => {
    const userId = await who(req, res);
    if (userId === null) return;
    const { clientCaseId, payload } = (req.body ?? {}) as { clientCaseId?: unknown; payload?: unknown };
    if (typeof clientCaseId !== 'string' || !CLIENT_CASE_ID.test(clientCaseId)) {
      return res.status(400).json({ error: 'clientCaseId 不对', code: 'BAD_CASE_ID' });
    }
    const check = checkAdhdPayload(payload);
    if (!check.ok) return res.status(400).json({ error: check.error, code: 'BAD_PAYLOAD' });
    try {
      const id = await deps.store.upsert(userId, {
        clientCaseId,
        pageVersion: ADHD_PAGE_VERSION,
        payload,
        ...check.summary,
      });
      res.json({ id });
    } catch (err) {
      console.error('[ADHD] save failed:', err);
      res.status(500).json({ error: '保存失败，请稍后再试。' });
    }
  });

  router.get('/api/adhd/assessments', async (req, res) => {
    const userId = await who(req, res);
    if (userId === null) return;
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ assessments: await deps.store.list(userId) });
    } catch (err) {
      console.error('[ADHD] list failed:', err);
      res.status(500).json({ error: '读取失败，请稍后再试。' });
    }
  });

  router.get('/api/adhd/assessments/:id', async (req, res) => {
    const userId = await who(req, res);
    if (userId === null) return;
    const id = /^\d{1,10}$/.test(req.params.id) ? Number(req.params.id) : NaN;
    if (!Number.isSafeInteger(id)) return res.status(404).json({ error: '找不到这份结果', code: 'NOT_FOUND' });
    try {
      const payload = await deps.store.findPayload(userId, id);
      if (payload === null) return res.status(404).json({ error: '找不到这份结果', code: 'NOT_FOUND' });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ payload });
    } catch (err) {
      console.error('[ADHD] read failed:', err);
      res.status(500).json({ error: '读取失败，请稍后再试。' });
    }
  });

  return router;
}
