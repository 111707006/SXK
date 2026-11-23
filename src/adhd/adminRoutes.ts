/**
 * 成人 ADHD 後台的三支（設計第 2.3 節）。只在 `APP_MODE=adhd`（`createAdminRouter` 的 `adhd` 選項）註冊。
 * 範圍一律走 `withScope`：公司成員只拿得到自家，全域管理員要先選定視野（同家長列表）。
 *
 * - `GET  /adhd/assessments?page=`：列表，一頁 `ADHD_PAGE_SIZE` 筆
 * - `GET  /adhd/assessments/:id`：那一筆的個案 JSON（後台用客戶頁面只讀打開，`/assess/?admin-view=`）
 * - `POST /adhd/assessments/export`：導出 `.xlsx`，每次在 `admin_exports` 記一筆，記不下就 500、不給檔
 */
import type express from 'express';
import * as store from '../admin/adminStore';
import type { CompanyCondition } from '../admin/companyScope';
import { adhdExportFileName, adhdWorkbook } from './adminXlsx';

import type { AdminIdentity } from '../admin/companyScope';

type AuthedRequest = express.Request & { admin?: AdminIdentity };
type WithScope = (req: AuthedRequest, res: express.Response) => CompanyCondition | null;

export function registerAdhdAdminRoutes(router: express.Router, withScope: WithScope): void {
  router.get('/adhd/assessments', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    try {
      const page = Number(req.query.page) || 1;
      res.setHeader('Cache-Control', 'no-store');
      res.json(await store.listAdhdAssessmentsPage(condition, page));
    } catch (err: any) {
      console.error('[Admin] adhd list failed:', err?.message);
      res.status(500).json({ error: '读取评估列表失败。' });
    }
  });

  router.get('/adhd/assessments/:id', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    const id = /^\d{1,10}$/.test(req.params.id) ? Number(req.params.id) : NaN;
    if (!Number.isSafeInteger(id)) return res.status(404).json({ error: '找不到这份结果', code: 'NOT_FOUND' });
    try {
      const payload = await store.getAdhdAssessmentPayload(condition, id);
      if (payload === null) return res.status(404).json({ error: '找不到这份结果', code: 'NOT_FOUND' });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ payload });
    } catch (err: any) {
      console.error('[Admin] adhd read failed:', err?.message);
      res.status(500).json({ error: '读取失败。' });
    }
  });

  router.post('/adhd/assessments/export', async (req: AuthedRequest, res) => {
    const condition = withScope(req, res);
    if (!condition) return;
    try {
      const rows = await store.listAdhdAssessmentsForExport(condition);
      const file = await adhdWorkbook(rows);
      await store.recordExport({
        adminUserId: req.admin!.adminUserId,
        condition,
        kind: 'adhd_assessments',
        rowCount: rows.length,
        filters: '{}',
        requestIp: req.ip ?? null,
      });
      const name = adhdExportFileName(new Date());
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="adhd-${name.replace(/\D/g, '')}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      );
      res.setHeader('Cache-Control', 'no-store');
      res.send(file);
    } catch (err: any) {
      console.error('[Admin] adhd export failed:', err?.message);
      res.status(500).json({ error: '导出失败，请稍后再试。' });
    }
  });
}
