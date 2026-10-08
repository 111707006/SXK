import React, { useEffect, useState } from 'react';
import { AlertTriangle, Award, ChevronDown, ChevronRight, ClipboardList, HeartHandshake, Layers, RefreshCw, Sparkles, UserRound } from 'lucide-react';
import { reportSourceLabel } from '../utils/reportSource';
import { SITE_DIMENSION_NAME } from '../t2/dimensionMap';
import type { T2FindingsV3 } from '../t2/findingsV3';
import { KITV3_LOADERS } from '../t2/kitv3/lazy';
import type { KitV3Bank } from '../t2/kitv3/types';
import type { ProseDimensionV3, T2ReportProseV3 } from '../t2/report/proseV3';
import type { DimensionCode } from '../t2/types';
import { RETEST_SENTENCE, REVIEW_EMPTY_SENTENCE, dimensionStatus } from '../t2/reportCopy';
import {
  TEMPERAMENT_LEAD,
  TEMPERAMENT_NO_NORM,
  noticeLinesV3,
  qolSummaryV3,
  reviewGroupsV3,
  temperamentLinesV3,
  toolNameV3,
} from '../t2/reportCopyV3';
import { REPORT_TRAINING_LINK } from '../t2/trainingCopy';
import { STATUS_CLASS } from './reportStatusClass';

/** 氣質與生活品質那兩支的客規代碼（不進九宮格，各有一段）。 */
const TEMPERAMENT_TOOL = 'ITQ/TTS/BSQ';
const QOL_TOOL = 'SXK-QOL';

interface T2ReportV3Props {
  /** `prose` 是伺服器存的那一份（模型或模板）；舊的 v3 快照（2026-10-08 之前）是 null，那時只有規則輸出。 */
  entry: { createdAt: string; findings: T2FindingsV3; prose: unknown; isAiGenerated: boolean };
  /** 「重新生成」那一顆與它底下那一行，`T2Report` 組好傳進來（生成的狀態在那邊）。 */
  regenerate: React.ReactNode;
  errorLine: React.ReactNode;
  /** 四種服務的按鈕，`T2Report` 走 `serviceChoices` 組好傳進來。 */
  serviceButtons: React.ReactNode;
  onOpenTraining?: () => void;
  formatDay: (iso: string) => string;
}

/** 讀回來的是不是完整版的文字（舊版的有 `weeklyPlanIntro`）；不是就當沒有。 */
function proseOf(raw: unknown): T2ReportProseV3 | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const x = raw as Record<string, unknown>;
  return typeof x.overview === 'string' && typeof x.closing === 'string' && Array.isArray(x.perDimension) && !('weeklyPlanIntro' in x)
    ? (x as unknown as T2ReportProseV3)
    : null;
}

/**
 * 完整版題庫的報告（T2 v3，題庫規格 §5.3）—— `T2Report` 讀到 `toolkitVersion: 'kit-20260923'` 的快照改畫這裡。
 *
 * 【文字】兩種來源分開放：
 * - 伺服器生成時寫好的 `prose`（模型或模板，`src/t2/report/proseV3.ts`，已過驗證器）：總覽一段、留意／關注的維度各一段、
 *   沒有問卷的方面各一句、結尾。這一頁不叫模型。
 * - 規則輸出：最上方提示、九宮格（狀態句照舊走 `dimensionStatus`）、生活品質、氣質、線上干預的連結、「三个月后重评」、
 *   作答回顧。句子全在 `reportCopyV3.ts`／`reportCopy.ts`（都在用字掃描裡）。
 * 2026-10-08 之前存的 v3 快照沒有 `prose`，只出規則輸出那幾段。
 *
 * 【題庫】氣質的兩極與作答回顧要題庫：打開時把快照裡用到的那幾支延遲載入（每支一個 chunk）；
 * 載不到的那一支，回顧先不列、氣質那一段不出 —— 不影響九宮格與提示。
 */
export default function T2ReportV3({ entry, regenerate, errorLine, serviceButtons, onOpenTraining, formatDay }: T2ReportV3Props) {
  const { findings } = entry;
  const prose = proseOf(entry.prose);
  const proseById = new Map<DimensionCode, ProseDimensionV3>((prose?.perDimension ?? []).map(p => [p.dimensionId, p]));
  const flagged = findings.dimensions.filter(d => (d.band === 'refer' || d.band === 'watch') && proseById.has(d.dimensionId));
  const [banks, setBanks] = useState<Record<string, KitV3Bank>>({});
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(findings.toolResults.map(r => r.toolId))].filter(id => KITV3_LOADERS[id]);
    void Promise.allSettled(ids.map(id => KITV3_LOADERS[id]().then(bank => [id, bank] as const))).then(settled => {
      if (cancelled) return;
      const loaded: Record<string, KitV3Bank> = {};
      for (const s of settled) if (s.status === 'fulfilled') loaded[s.value[0]] = s.value[1];
      setBanks(loaded);
    });
    return () => { cancelled = true; };
  }, [findings]);

  const ageMonth = findings.child.assessedAgeMonth;
  const notices = noticeLinesV3(findings);
  const t1Notices = findings.t1Notices ?? [];
  const grid = findings.dimensions.filter(d => d.band !== 'not_screened');
  const noTool = findings.dimensions.filter(d => d.band === 'no_tool');
  const qolResult = findings.toolResults.find(r => r.toolId === QOL_TOOL);
  const qol = qolResult ? qolSummaryV3(qolResult) : null;
  const tempResult = findings.toolResults.find(r => r.toolId === TEMPERAMENT_TOOL);
  const tempLines = tempResult && banks[TEMPERAMENT_TOOL] ? temperamentLinesV3(tempResult, banks[TEMPERAMENT_TOOL]) : [];
  const review = reviewGroupsV3(findings, banks);
  const doneNames = findings.toolResults.map(r => toolNameV3(r.toolId));

  const sectionTitle = (icon: React.ReactNode, text: string) => (
    <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
      {icon}
      {text}
    </h3>
  );

  return (
    <div className="space-y-7">
      {/* 標頭：來源、生成日期、測評月齡 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand-moss font-bold text-xs uppercase tracking-wider">
            <Award size={14} />
            {reportSourceLabel(entry.isAiGenerated)}
          </div>
          <h2 className="text-lg font-bold text-brand-forest mt-1">深度评估报告</h2>
          <p className="text-[11px] text-brand-charcoal/70 mt-1">
            {formatDay(entry.createdAt) && `${formatDay(entry.createdAt)}生成 · `}按答题时 {ageMonth} 个月整理
          </p>
        </div>
        {regenerate}
      </div>
      {errorLine}

      {/*
        最上方的提示：先是生成當下 T1 帶來的（安全、社交溝通警訊、抽動……，ADR-0011，快照的 t1Notices，附預約），
        再是問卷的旗標（§5.3：轉介、倒退、情緒影響大、能作答的題不夠）
      */}
      {(t1Notices.length > 0 || notices.length > 0) && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3" id="t2v3-notices">
          <ul className="space-y-1.5">
            {[...t1Notices.map(n => n.text), ...notices].map(line => (
              <li key={line} className="flex items-start gap-2.5 text-xs font-bold leading-relaxed">
                <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={15} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {t1Notices.some(n => n.book) && serviceButtons}
        </div>
      )}

      {/* 1. 總覽：九宮格（不篩的不出） */}
      <section className="space-y-3">
        {sectionTitle(<ClipboardList size={15} />, '总览')}
        {prose && <p className="text-xs text-brand-charcoal leading-relaxed" id="t2v3-overview">{prose.overview}</p>}
        <p className="text-[11px] text-brand-charcoal/75 leading-relaxed">
          {doneNames.length > 0
            ? `这份报告整理自近 3 个月填写的 ${doneNames.length} 份问卷：${doneNames.join('、')}。`
            : '近 3 个月还没有填写完的问卷，下面先按筛查结果列出各方面。'}
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2" id="t2v3-dimension-grid">
          {grid.map(d => {
            const s = dimensionStatus(d, ageMonth);
            const cls = STATUS_CLASS[s.kind === 'band' ? s.status : s.tone];
            return (
              <li key={d.dimensionId} data-band={d.band} className={`rounded-xl border px-3 py-2 ${cls}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{SITE_DIMENSION_NAME[d.dimensionId]}</span>
                  <span className="text-[10px] font-bold shrink-0">{s.label}</span>
                </div>
                <p className="text-[10px] leading-relaxed mt-0.5 opacity-90">{s.tag}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 2. 逐維度：留意／關注的維度各一段（prose 有才出） */}
      {flagged.length > 0 && (
        <section className="space-y-3" id="t2v3-per-dimension">
          {sectionTitle(<Layers size={15} />, '各方面')}
          {flagged.map(d => {
            const p = proseById.get(d.dimensionId)!;
            const s = dimensionStatus(d, ageMonth);
            return (
              <article key={d.dimensionId} className="rounded-2xl border border-brand-stone/60 p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-brand-forest">{SITE_DIMENSION_NAME[d.dimensionId]}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLASS[s.kind === 'band' ? s.status : s.tone]}`}>{s.label}</span>
                </div>
                <p className="text-xs text-brand-charcoal leading-relaxed">{p.whatWeSaw}</p>
                <p className="text-[11px] text-brand-charcoal/80 leading-relaxed">{p.whyItMatters}</p>
              </article>
            );
          })}
        </section>
      )}

      {/* 3. 沒有問卷的方面：導向四種服務 */}
      {noTool.length > 0 && (
        <section className="space-y-3" id="t2v3-no-tool">
          {sectionTitle(<UserRound size={15} />, '这个月龄没有问卷可以做的方面')}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            {noTool.map(d => (
              <div key={d.dimensionId} className="space-y-1">
                <h4 className="text-xs font-extrabold text-brand-forest">
                  {SITE_DIMENSION_NAME[d.dimensionId]}
                  {/* 有 prose 時那一段已經講了「这个年龄没有问卷」，標題旁的狀態句就不重複 */}
                  {!proseById.get(d.dimensionId) && (
                    <span className="ml-2 font-bold text-[10px] text-brand-charcoal/60">{dimensionStatus(d, ageMonth).tag}</span>
                  )}
                </h4>
                {proseById.get(d.dimensionId) && (
                  <p className="text-[11px] text-brand-charcoal/85 leading-relaxed">{proseById.get(d.dimensionId)!.whatWeSaw}</p>
                )}
              </div>
            ))}
            <p className="text-[11px] text-brand-charcoal/75">这几个方面可以直接和专家聊一聊{t1Notices.some(n => n.book) ? '（预约按钮在最上方）' : '：'}</p>
            {!t1Notices.some(n => n.book) && serviceButtons}
          </div>
        </section>
      )}

      {/* 4. 生活品質（不進九宮格） */}
      {qol && (
        <section className="space-y-2" id="t2v3-qol">
          {sectionTitle(<HeartHandshake size={15} />, '日常生活')}
          <p className="text-xs text-brand-charcoal leading-relaxed">{qol.sentence}</p>
          {qol.heavier.length > 0 && (
            <p className="text-[11px] text-brand-charcoal/80 leading-relaxed">比较明显的是：{qol.heavier.join('、')}。</p>
          )}
        </section>
      )}

      {/* 5. 氣質（不進九宮格；講偏向，不講好壞） */}
      {tempLines.length > 0 && (
        <section className="space-y-2" id="t2v3-temperament">
          {sectionTitle(<Sparkles size={15} />, '孩子的风格')}
          <p className="text-[11px] text-brand-charcoal/75 leading-relaxed">{TEMPERAMENT_LEAD}</p>
          {tempResult?.score.flags?.includes('no_norm') && (
            <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">{TEMPERAMENT_NO_NORM}</p>
          )}
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {tempLines.map(l => (
              <li key={l.dimension} className="rounded-lg border border-brand-stone/60 bg-brand-cream/25 px-2.5 py-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-brand-charcoal/80">{l.dimension}</span>
                <span className={`text-[11px] font-bold ${l.band === 1 ? 'text-brand-charcoal/50' : 'text-brand-forest'}`}>{l.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. 線上干預：只留一行連結（2026-09-28 起不放在報告裡） */}
      {onOpenTraining && (
        <section id="t2v3-weekly">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl bg-brand-forest text-white px-5 py-4">
            <p className="text-xs leading-relaxed">{REPORT_TRAINING_LINK.text}</p>
            <button
              type="button"
              id="t2v3-open-training-btn"
              onClick={onOpenTraining}
              className="shrink-0 px-4 py-2 rounded-xl bg-white text-brand-forest text-xs font-bold hover:bg-brand-cream active:scale-[0.98] transition cursor-pointer"
            >
              {REPORT_TRAINING_LINK.action}
            </button>
          </div>
        </section>
      )}

      <p className="text-[11px] text-brand-charcoal/80 leading-relaxed" id="t2v3-retest">{RETEST_SENTENCE}</p>

      {prose && (
        <p className="text-xs text-brand-charcoal/85 leading-relaxed border-t border-brand-cream pt-5" id="t2v3-closing">{prose.closing}</p>
      )}

      {/* 7. 作答回顧：選了最差兩檔的題，可摺疊 */}
      <section className="space-y-3" id="t2v3-review">
        <button
          type="button"
          onClick={() => setReviewOpen(o => !o)}
          aria-expanded={reviewOpen}
          className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-forest hover:text-brand-moss transition cursor-pointer"
        >
          {reviewOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          你勾选的项目
          <span className="text-[10px] font-bold text-brand-charcoal/50 ml-1">（还没稳定的那些，可以当成练习目标）</span>
        </button>
        {reviewOpen && (
          review.length === 0 ? (
            <p className="text-[11px] text-brand-charcoal/70">{REVIEW_EMPTY_SENTENCE}。</p>
          ) : (
            <div className="space-y-3">
              {review.map(g => (
                <div key={g.toolId} className="rounded-2xl border border-brand-stone/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-brand-forest">{g.heading}</span>
                    <span className="text-[10px] text-brand-charcoal/50 shrink-0">{formatDay(g.computedAt)}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {g.items.map(item => (
                      <li key={item.key} className="text-[11px] text-brand-charcoal leading-relaxed flex gap-2">
                        <span className="text-brand-charcoal/40 shrink-0">{item.sectionName}</span>
                        <span className="flex-1">
                          {item.text}
                          <span className="ml-1.5 text-[10px] font-bold text-brand-clay">{item.answer}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <div className="pt-2 flex items-center gap-2">
        <RefreshCw size={12} className="text-brand-charcoal/40" />
        <p className="text-[10px] text-brand-charcoal/50">每次生成都会另存一份，之后打开这一页看到的是最新的那一份。</p>
      </div>
    </div>
  );
}
