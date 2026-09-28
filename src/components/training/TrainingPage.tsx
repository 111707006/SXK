/**
 * 「线上干预」獨立頁（2026-09-28 使用者：線上干預不放在報告裡，從導覽列另外開）。
 *
 * 內容就是原本報告第六段那一塊（`TrainingSection`：入口、計劃頁、詳情、抽屜、片庫、日曆），
 * 換的只是位置：導覽列「线上干预」→ 這一頁。報告第六段改成一行連結過來。
 *
 * 這一頁自己讀最新的報告快照（`GET /api/t2/findings/latest`）—— 評估結果、第幾週、換著玩都要它。
 * 還沒生成報告（404）、還沒解鎖（403 或 App 已知道是 locked）時，說清楚要先做什麼，並帶到 T2 入口
 * （與計劃頁「重新评估」同一個出口：即時 T1 報告、捲到 T2 入口那張卡）。
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ServiceType } from '../../utils/serviceTypes';
import { authFetch } from '../../utils/api';
import type { T2Findings } from '../../t2/types';
import { TRAINING_PAGE } from '../../t2/trainingCopy';
import TrainingSection from './TrainingSection';

export interface TrainingPageProps {
  childName?: string;
  /** App 已經知道 T2 沒解鎖（`t2Access === 'locked'`）：不必打 API，直接說要先解鎖。 */
  locked: boolean;
  onBookService: (type: ServiceType) => void;
  /** 去 T2 入口（即時 T1 報告並捲到那張卡）。沒報告、沒解鎖、計劃頁「重新评估」都走它。 */
  onGoToT2: () => void;
}

type Status = 'loading' | 'ready' | 'none' | 'locked' | 'error';

export default function TrainingPage({ childName, locked, onBookService, onGoToT2 }: TrainingPageProps) {
  const [status, setStatus] = useState<Status>(locked ? 'locked' : 'loading');
  const [findings, setFindings] = useState<T2Findings | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (locked) {
      setStatus('locked');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const resp = await authFetch('/api/t2/findings/latest');
        if (cancelled) return;
        if (resp.status === 404) return setStatus('none');
        if (resp.status === 403) return setStatus('locked');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = (await resp.json()) as { findings: T2Findings };
        if (cancelled) return;
        setFindings(body.findings);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load T2 findings for training:', err);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [locked, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  return (
    <div className="bg-white rounded-3xl border border-brand-stone p-5 md:p-8 max-w-3xl mx-auto shadow-sm text-left" id="training-page">
      {status === 'ready' && findings ? (
        <TrainingSection findings={findings} childName={childName} onBookService={onBookService} onReassess={onGoToT2} />
      ) : status === 'loading' ? (
        <div className="flex items-center gap-2 text-xs text-brand-charcoal/60">
          <Loader2 size={14} className="animate-spin text-brand-moss" />
          {TRAINING_PAGE.loading}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-brand-forest">{TRAINING_PAGE.navLabel}</h2>
          <p className="text-xs text-brand-charcoal leading-relaxed">
            {status === 'none' ? TRAINING_PAGE.noReport : status === 'locked' ? TRAINING_PAGE.locked : TRAINING_PAGE.error}
          </p>
          <button
            type="button"
            onClick={status === 'error' ? retry : onGoToT2}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-forest hover:bg-brand-forest/90 text-white shadow-md shadow-brand-forest/20 active:scale-[0.98] transition cursor-pointer"
          >
            {status === 'none' ? TRAINING_PAGE.noReportAction : status === 'locked' ? TRAINING_PAGE.lockedAction : TRAINING_PAGE.retry}
          </button>
        </div>
      )}
    </div>
  );
}
