import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadReportLayout, reportLayoutFrom, reportLayoutSnapshot, resetReportLayoutForTest } from '../src/utils/reportLayout';

/** 前端怎麼讀報告版面的開關（#71）：只問一次；問不到、形狀不對都當關（＝照舊）。 */

beforeEach(() => resetReportLayoutForTest());

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('reportLayout', () => {
  it('還沒問完：關、未就緒', () => {
    expect(reportLayoutSnapshot()).toEqual({ noWeeklyPlan: false, ready: false });
  });

  it('伺服器說開：開', async () => {
    await loadReportLayout(() => ok({ noWeeklyPlan: true }));
    expect(reportLayoutSnapshot()).toEqual({ noWeeklyPlan: true, ready: true });
  });

  it('伺服器說關：關', async () => {
    await loadReportLayout(() => ok({ noWeeklyPlan: false }));
    expect(reportLayoutSnapshot()).toEqual({ noWeeklyPlan: false, ready: true });
  });

  it('舊伺服器沒有這一支（404）、斷線：關，但算問完了（捲動不必一直等）', async () => {
    await loadReportLayout(() => Promise.resolve(new Response('', { status: 404 })));
    expect(reportLayoutSnapshot()).toEqual({ noWeeklyPlan: false, ready: true });
    resetReportLayoutForTest();
    await loadReportLayout(() => Promise.reject(new TypeError('network')));
    expect(reportLayoutSnapshot()).toEqual({ noWeeklyPlan: false, ready: true });
  });

  it('只認 true：字串 "1"、1 都不算', () => {
    expect(reportLayoutFrom({ noWeeklyPlan: '1' }).noWeeklyPlan).toBe(false);
    expect(reportLayoutFrom({ noWeeklyPlan: 1 }).noWeeklyPlan).toBe(false);
    expect(reportLayoutFrom(null).noWeeklyPlan).toBe(false);
  });

  it('整個分頁只問一次', async () => {
    const f = vi.fn(() => ok({ noWeeklyPlan: true }));
    await Promise.all([loadReportLayout(f), loadReportLayout(f), loadReportLayout(f)]);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
