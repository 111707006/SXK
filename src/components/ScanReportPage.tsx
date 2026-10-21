import { useEffect, useState, type ReactNode } from 'react';
import ReportBody from './ReportBody';
import { BeianFooter } from './BeianFooter';
import { formatAge } from '../utils/dateUtils';
import type { RenderableReport } from '../utils/reportHistory';
import { useReportLayout } from '../utils/reportLayout';

/**
 * 掃碼報告頁（客戶 10/17 第 1 項，規格 docs/specs/client-changes-2026-10-17.md §2.2）。
 *
 * 家長在 iPad 上看完報告、掃二維碼，同一份報告在自己手機上打開。開關 `REPORT_SCAN_SPA` 開著時伺服器把
 * `/r/:token` 交給 SPA，`main.tsx` 看路徑進這一頁（不進 App：App 會要人登入、畫導覽列）。
 *
 * 畫的是與 App、後台**同一個** `ReportBody`（ADR-0007）。**只讀**：插槽一個都不放（T2 入口、二維碼卡、預約），
 * 這一頁自己沒有按鈕與連結。資料是 `GET /api/r/:token` 回的那一筆快照（伺服器收乾淨過），不帶手機號、
 * 帳號、其他報告 —— 所以歷次對照畫不出真的樣子，那一塊不畫（`historyUnavailable`）。
 *
 * 拿不到時的字照舊（伺服器拼的那一頁的原句），家長看到的不變。
 */

interface ScanData {
  child: { name: string | null; ageMonth: number | null; gender: 'boy' | 'girl' | null };
  record: RenderableReport;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: ScanData }
  | { kind: 'failed'; message: string };

const NOT_FOUND = '这个报告连结无效，或对应的报告已经不在了。';
const UNAVAILABLE = '报告暂时读取不了，请稍后再扫一次。';

export default function ScanReportPage({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const { noWeeklyPlan } = useReportLayout();

  useEffect(() => {
    let alive = true;
    fetch(`/api/r/${encodeURIComponent(token)}`)
      .then(async resp => {
        if (resp.status === 404) return { kind: 'failed', message: NOT_FOUND } as const;
        if (!resp.ok) return { kind: 'failed', message: UNAVAILABLE } as const;
        const data = (await resp.json()) as ScanData;
        if (!data?.record?.aiReport) return { kind: 'failed', message: NOT_FOUND } as const;
        return { kind: 'ok', data } as const;
      })
      .catch(() => ({ kind: 'failed', message: UNAVAILABLE }) as const)
      .then(next => {
        if (alive) setState(next);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (state.kind !== 'ok') return;
    const name = state.data.child.name;
    document.title = name ? `${name} 的发展报告` : '发展报告';
  }, [state]);

  if (state.kind === 'loading') {
    return <Centered><p className="text-sm text-brand-charcoal/80">正在载入报告…</p></Centered>;
  }

  if (state.kind === 'failed') {
    return (
      <Centered>
        <div className="bg-white rounded-2xl px-6 py-7 max-w-sm text-center leading-relaxed">
          <p className="text-[15px] text-brand-charcoal">{state.message}</p>
          <p className="mt-2.5 text-[13px] text-brand-charcoal/80">请回到评估现场的画面，重新扫一次二维码。</p>
        </div>
      </Centered>
    );
  }

  const { child, record } = state.data;
  const childLine = [
    child.name ?? record.childName,
    child.gender === 'boy' ? '男' : child.gender === 'girl' ? '女' : null,
    child.ageMonth === null ? null : formatAge(child.ageMonth),
  ].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-brand-cream/20">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-4">
        <p className="text-xs font-semibold text-brand-forest">受测儿档案：{childLine}</p>
        <ReportBody
          childName={record.childName}
          scores={record.scores}
          aiReport={record.aiReport}
          isAiGenerated={record.isAiGenerated}
          reportId={record.id || null}
          reportCreatedAt={record.createdAt || null}
          historyUnavailable
          noWeeklyPlan={noWeeklyPlan}
        />
        <p className="text-xs text-brand-charcoal/80 text-center print:hidden">
          这一页是您扫码带走的报告，网址可以收藏起来，之后随时打开。
        </p>
      </div>
      <BeianFooter />
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-brand-cream/40">
      <div className="flex-1 flex items-center justify-center p-6">{children}</div>
      <BeianFooter />
    </div>
  );
}
