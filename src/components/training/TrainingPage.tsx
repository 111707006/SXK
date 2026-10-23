/**
 * 「线上干预」獨立頁（2026-09-28 使用者：線上干預不放在報告裡，從導覽列另外開）。
 *
 * 內容就是原本報告第六段那一塊（`TrainingSection`：入口、計劃頁、詳情、抽屜、片庫、日曆），
 * 換的只是位置：導覽列「线上干预」→ 這一頁。報告第六段改成一行連結過來。
 *
 * 這一頁自己讀最新的報告快照（`GET /api/t2/findings/latest`）—— 評估結果、第幾週、換著玩都要它。
 * 還沒生成報告（404）、還沒解鎖深度評估（報告在 T2 閘門後面，403）時，說清楚要先做什麼，並帶到 T2 入口
 * （與計劃頁「重新评估」同一個出口：即時 T1 報告、捲到 T2 入口那張卡）。
 *
 * 線上干預要先買過 T2（ADR-0012），之後在 T2 報告裡另外買線上干預（`src/t2/trainingGate.ts`，現在免費）。
 * App 不把 T2 的鎖傳進來：這一頁讀報告拿到 403 就是「上鎖」，伺服器那幾支線上干預的端點也一樣先看 T2。
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ServiceType } from '../../utils/serviceTypes';
import { authFetch } from '../../utils/api';
import { PRODUCT } from '../../productConfig';
import type { T2Findings } from '../../t2/types';
import { TRAINING_PAGE, TRAINING_PASS } from '../../t2/trainingCopy';
import { calendarDateOf } from '../../t2/weeks';
import { daysLeft } from '../../t2/trainingPass';
import TrainingSection from './TrainingSection';

export interface TrainingPageProps {
  childName?: string;
  onBookService: (type: ServiceType) => void;
  /** 去 T2 入口（即時 T1 報告並捲到那張卡）。沒報告、沒解鎖、計劃頁「重新评估」都走它。 */
  onGoToT2: () => void;
  /**
   * 居家訓練使用權（`TRAINING_PLAN`，#91）：`null`＝這個部署沒有使用權這回事（照舊）。有效時頁首寫「还剩 N 天」；
   * 沒有或到期時整頁換成開通／續買的說明，不去讀報告（伺服器那幾支本來就是 403）。
   */
  trainingPass?: { active: boolean; endsOn: string | null; lastEndsOn: string | null } | null;
  /** 去開通／續買（訓練計劃頁，#110）；沒給就不畫按鈕。 */
  onOpenPlans?: () => void;
}

type Status = 'loading' | 'ready' | 'none' | 'locked' | 'error';

export default function TrainingPage({ childName, onBookService, onGoToT2, trainingPass = null, onOpenPlans }: TrainingPageProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [findings, setFindings] = useState<T2Findings | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
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
  }, [attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const passBlocked = trainingPass !== null && !trainingPass.active;
  const today = calendarDateOf(new Date());

  return (
    <div
      className={PRODUCT.features.ledo
        ? 'bg-white rounded-[32px] p-4 sm:p-6 max-w-xl mx-auto shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] text-left'
        : 'bg-white rounded-3xl border border-brand-stone p-5 md:p-8 max-w-3xl mx-auto shadow-sm text-left'}
      id="training-page"
    >
      {trainingPass?.active && trainingPass.endsOn && (
        <p id="training-pass-remaining" className="mb-3 rounded-full bg-ledo-accent-soft px-3.5 py-1.5 text-xs font-bold text-ledo-accent-soft-ink">
          {TRAINING_PASS.remaining(daysLeft(today, trainingPass.endsOn), trainingPass.endsOn)}
          {onOpenPlans && daysLeft(today, trainingPass.endsOn) <= 7 && (
            <button type="button" onClick={onOpenPlans} className="ml-2 underline underline-offset-2 cursor-pointer">{TRAINING_PASS.renew}</button>
          )}
        </p>
      )}
      {passBlocked ? (
        <div id="training-pass-required" className="space-y-4">
          <h2 className="text-xl font-extrabold text-brand-forest">{TRAINING_PAGE.navLabel}</h2>
          <p className="text-xs text-brand-charcoal leading-relaxed">{trainingPass.lastEndsOn ? TRAINING_PASS.expired : TRAINING_PASS.none}</p>
          {onOpenPlans && (
            <button
              type="button"
              id="training-pass-renew"
              onClick={onOpenPlans}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-forest hover:bg-brand-forest/90 text-white shadow-md shadow-brand-forest/20 active:scale-[0.98] transition cursor-pointer"
            >
              {TRAINING_PASS.renew}
            </button>
          )}
        </div>
      ) : status === 'ready' && findings ? (
        <TrainingSection findings={findings} childName={childName} onBookService={onBookService} onReassess={onGoToT2} />
      ) : status === 'loading' ? (
        <div className="flex items-center gap-2 text-xs text-brand-charcoal/80">
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
