import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import { authFetch } from '../utils/api';
import { reportSourceLabel } from '../utils/reportSource';
import { STATUS_WORDING } from '../utils/statusWording';
import { serviceTypeDescriptors, type ServiceType } from '../utils/serviceTypes';
import { SITE_DIMENSION_NAME } from '../t2/dimensionMap';
import { buildSmartGoals } from '../t2/goals';
import { hasSafetyConcern } from '../t2/report/prose';
import type { T2ReportProse, ProseDimension } from '../t2/report/prose';
import { SAFETY_SENTENCE } from '../t2/report/sentences';
import {
  REVIEW_EMPTY_SENTENCE,
  dimensionStatus,
  redoSentence,
  reviewGroups,
  stripSafetyPrefix,
} from '../t2/reportCopy';
import type { DimensionCode, DimensionFinding, T2Findings } from '../t2/types';
import T2WeeklyPlan from './T2WeeklyPlan';

/** `POST /api/t2/findings` 與 `GET /api/t2/findings/latest` 回的一份快照。 */
interface FindingsEntry {
  id: number;
  createdAt: string;
  findings: T2Findings;
  /** 存的時候壞掉會是 `null`；那時只剩狀態總覽與回顧可看。 */
  prose: T2ReportProse | null;
  isAiGenerated: boolean;
  aiEngine: string;
}

interface T2ReportProps {
  onBack: () => void;
  /** 配不到活動、沒有問卷的維度導向四種服務：開預約表、預選那一種。 */
  onBookService: (type: ServiceType) => void;
  /** 家長填的孩子名字；目標句的主詞。沒有就用「孩子」。 */
  childName?: string;
  /** 進來就按「生成」（從作答清單的按鈕來），而不是先讀最新那一份。 */
  generateOnOpen?: boolean;
}

/** 「9 月 12 日」。 */
function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/**
 * 三級 band 的膠囊顏色。與 T1 報告九宮格同一組色：綠／黃／紅照篩查判定，
 * 沒有第二把尺（ADR-0007）。四種「沒有判定」一律灰 —— 它們不在這把尺上。
 */
const STATUS_CLASS: Record<'normal' | 'borderline' | 'delay' | 'state', string> = {
  normal: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  borderline: 'bg-amber-50 border-amber-200 text-amber-800',
  delay: 'bg-rose-50 border-rose-200 text-rose-800',
  state: 'bg-brand-cream/60 border-brand-stone text-brand-charcoal/70',
};

/**
 * T2 深度評估的報告頁（票 #61，規格 §6.3 的段落順序與 §6.4 的作答回顧）—— **家長端專屬**。
 *
 * 【這一頁做什麼】
 * 家長按「生成」→ `POST /api/t2/findings`（伺服器彙整、配活動、算目標、叫模型、驗證、存一列）→
 * 把回來的那一份排出來。沒按時讀 `GET /latest`。這一檔**不判定、不改寫、不重算**：
 * 判定在快照裡、句子在 prose 裡、活動在 `/api/t2/weekly-plan` 那一份裡；只有 SMART 目標是
 * 純函式從快照算的（與伺服器組提示時用的是同一支 `buildSmartGoals`）。
 *
 * 【段落順序】（§6.3）
 * `safety_concern` 橫幅（有才有）→ 總覽（overview ＋ 九個維度的狀態）→ 逐維度（只有 watch／refer）
 * → 沒有問卷的維度（no_tool 的專屬段落，導向專家）→ 氣質（有標籤才有）→ 目標 → 本週活動
 * （票 #60 的畫面嵌進來）→ closing → 作答回顧（可摺疊）。
 *
 * 【四種非 band 值不能長得像 clear】（§5.7）
 * prose 對 `partial`／`not_assessed` 不出段落（勘誤 M1），所以它們只在「總覽」的九宮格上出現 ——
 * 那一格必須明寫「還沒做完／這次沒做」，膠囊是灰的、字是 `DIMENSION_STATE_SENTENCE`，
 * 與 clear 的綠色「目前发展稳定」分得開。`test/t2ReportView.structure.test.ts` 釘住。
 *
 * 【用字】
 * band 只走 `statusWording.ts`（經 `reportCopy.ts`）；tier 的內部名稱一個都不出現（快照裡有，
 * 畫面不讀它）。題目原文只在回顧那一段（`reviewGroups`），敘述段不引用。
 */
export default function T2Report({ onBack, onBookService, childName, generateOnOpen }: T2ReportProps) {
  const [entry, setEntry] = useState<FindingsEntry | null>(null);
  const [status, setStatus] = useState<'loading' | 'generating' | 'ready' | 'none' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const openedRef = useRef(false);

  const generate = async () => {
    setStatus('generating');
    setError(null);
    try {
      const resp = await authFetch('/api/t2/findings', { method: 'POST' });
      const ct = resp.headers.get('content-type');
      const body = ct && ct.includes('application/json') ? await resp.json() : null;
      if (!resp.ok || !body || !body.findings) {
        setError(typeof body?.error === 'string' ? body.error : '暂时无法生成报告，请稍后再试。');
        setStatus(entry ? 'ready' : 'error');
        return;
      }
      setEntry(body as FindingsEntry);
      setReviewOpen(false);
      setStatus('ready');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.warn('Failed to generate T2 report:', err);
      setError('暂时无法生成报告，请稍后再试。');
      setStatus(entry ? 'ready' : 'error');
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (generateOnOpen) {
      // 一次掛載只打一次 POST：每次生成都另存一列、叫一次模型，StrictMode 的雙重掛載不該變成兩份報告。
      if (!openedRef.current) {
        openedRef.current = true;
        void generate();
      }
      return;
    }
    (async () => {
      try {
        const resp = await authFetch('/api/t2/findings/latest');
        if (resp.status === 404) {
          if (!cancelled) setStatus('none');
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = (await resp.json()) as FindingsEntry;
        if (cancelled) return;
        setEntry(body);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load T2 report:', err);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = status === 'generating';

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      disabled={busy}
      className={`flex items-center gap-1.5 text-xs font-semibold text-brand-charcoal/85 hover:text-brand-forest transition ${busy ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <ArrowLeft size={16} />
      返回问卷清单
    </button>
  );

  const generateButton = (label: string) => (
    <button
      type="button"
      id="t2-generate-btn"
      disabled={busy}
      onClick={generate}
      className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
        busy
          ? 'bg-brand-cream border border-brand-stone text-brand-charcoal/40 cursor-not-allowed shadow-none'
          : 'bg-brand-forest hover:bg-brand-forest/90 text-white shadow-brand-forest/20 active:scale-[0.98] cursor-pointer'
      }`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
      {busy ? '正在生成…' : label}
    </button>
  );

  const shell = (children: React.ReactNode) => (
    <div className="bg-white rounded-3xl border border-brand-stone p-5 md:p-8 max-w-3xl mx-auto shadow-sm text-left">
      <div className="flex items-center justify-between border-b border-brand-cream pb-5 mb-6">
        {backButton}
        <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
          <Layers size={10} /> 第二层 · 深度评估
        </span>
      </div>
      {children}
    </div>
  );

  const errorLine = error && (
    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{error}</p>
  );

  if (status === 'loading') {
    return shell(
      <div className="flex items-center gap-2 text-xs text-brand-charcoal/60">
        <Loader2 size={14} className="animate-spin text-brand-moss" />
        正在读取报告...
      </div>,
    );
  }

  if (status === 'generating' && !entry) {
    return shell(
      <div className="space-y-3 py-6 text-center">
        <Loader2 size={22} className="animate-spin text-brand-moss mx-auto" />
        <p className="text-xs font-bold text-brand-forest">正在整理这次填写的问卷，写成一份报告…</p>
        <p className="text-[11px] text-brand-charcoal/60">通常需要半分钟左右，请不要关闭这一页。</p>
      </div>,
    );
  }

  if (status === 'none' || (status === 'error' && !entry)) {
    return shell(
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-extrabold text-brand-forest">
            {status === 'none' ? '还没有生成过深度评估报告' : '暂时读不到报告'}
          </h2>
          <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
            {status === 'none'
              ? '答完问卷后按下面的按钮，系统会把这次填写的结果整理成一份报告，并安排这一周的家庭活动。'
              : '请稍后再打开这一页，或直接重新生成一份。'}
          </p>
        </div>
        {errorLine}
        {generateButton('生成报告')}
      </div>,
    );
  }

  // status === 'ready'（或正在重新生成、畫面上還留著上一份）
  const { findings, prose } = entry!;
  const goals = buildSmartGoals(findings, { childName });
  const byId = new Map<DimensionCode, DimensionFinding>(findings.dimensions.map(d => [d.dimensionId, d]));
  const proseById = new Map<DimensionCode, ProseDimension>((prose?.perDimension ?? []).map(p => [p.dimensionId, p]));
  // 段落順序照 prose（伺服器已依 §8 排好）；watch／refer 與 no_tool 分開兩段（§6.3）。
  const flagged = (prose?.perDimension ?? []).filter(p => {
    const band = byId.get(p.dimensionId)?.band;
    return band === 'watch' || band === 'refer';
  });
  const noTool = findings.dimensions.filter(d => d.band === 'no_tool');
  const redoByTool = new Map((findings.redos ?? []).map(r => [r.toolId, r.daysSinceLast]));
  const review = reviewGroups(findings);
  const safety = hasSafetyConcern(findings);

  const serviceButtons = (
    <div className="flex flex-wrap gap-2 pt-1">
      {serviceTypeDescriptors().map(d => (
        <button
          key={d.type}
          type="button"
          onClick={() => onBookService(d.type)}
          className="px-3 py-2 rounded-xl border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest text-[11px] font-bold transition active:scale-[0.99] cursor-pointer text-left flex items-center gap-1.5"
        >
          <UserRound size={12} className="shrink-0" />
          {d.label}
        </button>
      ))}
    </div>
  );

  /** 這個維度用到的工具裡，30 天內重做過的（§10.2 第 2 項）。 */
  const redoLines = (d: DimensionFinding) =>
    d.tools.filter(t => redoByTool.has(t)).map(t => `${redoSentence(redoByTool.get(t)!)}（${t.toUpperCase()}）`);

  const sectionTitle = (icon: React.ReactNode, text: string) => (
    <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
      {icon}
      {text}
    </h3>
  );

  return shell(
    <div className="space-y-7">
      {/* 標頭：來源三態、生成日期、測評月齡 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand-moss font-bold text-xs uppercase tracking-wider">
            <Award size={14} />
            {reportSourceLabel(entry!.isAiGenerated)}
          </div>
          <h2 className="text-lg font-bold text-brand-forest mt-1">深度评估报告</h2>
          <p className="text-[11px] text-brand-charcoal/70 mt-1">
            {formatDay(entry!.createdAt) && `${formatDay(entry!.createdAt)}生成 · `}按答题时 {findings.child.assessedAgeMonth} 个月整理
          </p>
        </div>
        <div className="shrink-0 space-y-1.5">
          {generateButton('重新生成')}
          <p className="text-[10px] text-brand-charcoal/50 max-w-[14rem]">照现在已填的问卷再整理一份；上一份仍保留。</p>
        </div>
      </div>
      {errorLine}

      {/* safety_concern 置頂（§5.6）：整份報告最該被讀到的一句，原樣照抄，不交給任何人改寫 */}
      {safety && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start gap-3 text-xs font-bold leading-relaxed" id="t2-safety-banner">
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
          <span>{SAFETY_SENTENCE}</span>
        </div>
      )}

      {/* 1. 總覽 */}
      <section className="space-y-3">
        {sectionTitle(<ClipboardList size={15} />, '总览')}
        {prose ? (
          <p className="text-xs text-brand-charcoal leading-relaxed">{stripSafetyPrefix(prose.overview)}</p>
        ) : (
          <p className="text-[11px] text-brand-charcoal/60">这份报告的文字读不出来，下面先看各方面的结果。</p>
        )}
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2" id="t2-dimension-grid">
          {findings.dimensions.map(d => {
            const s = dimensionStatus(d.band);
            const cls = STATUS_CLASS[s.kind === 'band' ? s.status : 'state'];
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

      {/* 2. 逐維度：只有 watch／refer 的維度有段落（§6.4） */}
      {flagged.length > 0 && (
        <section className="space-y-3" id="t2-per-dimension">
          {sectionTitle(<Layers size={15} />, '各方面')}
          {flagged.map(p => {
            const d = byId.get(p.dimensionId)!;
            const s = dimensionStatus(d.band);
            const redos = redoLines(d);
            return (
              <article key={p.dimensionId} className="rounded-2xl border border-brand-moss/20 bg-white/70 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-xs font-extrabold text-brand-forest">{SITE_DIMENSION_NAME[p.dimensionId]}</h4>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_CLASS[s.kind === 'band' ? s.status : 'state']}`}>
                    {s.tag}
                  </span>
                </div>
                <p className="text-xs text-brand-charcoal leading-relaxed">{p.whatWeSaw}</p>
                <p className="text-[11px] text-brand-charcoal/80 leading-relaxed">{p.whyItMatters}</p>
                {p.caveats.length > 0 && (
                  <ul className="space-y-1 pt-1 border-t border-brand-stone/40">
                    {p.caveats.map((c, i) => (
                      <li key={i} className="text-[10px] text-brand-charcoal/65 leading-relaxed flex gap-1.5">
                        <span className="shrink-0">·</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {redos.length > 0 && (
                  <p className="text-[10px] text-brand-clay font-semibold">{redos.join('；')}</p>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* 3. 沒有問卷的維度：no_tool 的專屬段落，導向專家（§4.5、§6.4） */}
      {noTool.length > 0 && (
        <section className="space-y-3" id="t2-no-tool">
          {sectionTitle(<UserRound size={15} />, '这个月龄没有问卷可以做的方面')}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            {noTool.map(d => {
              const p = proseById.get(d.dimensionId);
              return (
                <div key={d.dimensionId} className="space-y-1">
                  <h4 className="text-xs font-extrabold text-brand-forest">
                    {SITE_DIMENSION_NAME[d.dimensionId]}
                    <span className="ml-2 font-bold text-[10px] text-brand-charcoal/60">{dimensionStatus(d.band).tag}</span>
                  </h4>
                  {p && <p className="text-xs text-brand-charcoal leading-relaxed">{p.whatWeSaw}</p>}
                  {p && <p className="text-[11px] text-brand-charcoal/80 leading-relaxed">{p.whyItMatters}</p>}
                </div>
              );
            })}
            <p className="text-[11px] text-brand-charcoal/75">这几个方面可以直接和专家聊一聊：</p>
            {serviceButtons}
          </div>
        </section>
      )}

      {/* 4. 氣質：有標籤才有 */}
      {prose?.temperament && (
        <section className="space-y-2" id="t2-temperament">
          {sectionTitle(<Sparkles size={15} />, '孩子的风格')}
          <p className="text-xs text-brand-charcoal leading-relaxed">{prose.temperament}</p>
        </section>
      )}

      {/* 5. 目標（§8） */}
      {goals.length > 0 && (
        <section className="space-y-3" id="t2-goals">
          {sectionTitle(<Target size={15} />, '接下来的目标')}
          <ol className="space-y-2">
            {goals.map(g => (
              <li key={g.dimensionId} className="rounded-2xl border border-brand-stone/60 bg-brand-cream/30 p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-brand-forest">{g.area}</span>
                  <span className="text-[10px] font-bold text-brand-charcoal/60 shrink-0">
                    {STATUS_WORDING[g.band === 'refer' ? 'delay' : 'borderline'].label}
                  </span>
                </div>
                <p className="text-[11px] text-brand-charcoal leading-relaxed"><span className="font-bold">十二周：</span>{g.longTerm}</p>
                <p className="text-[11px] text-brand-charcoal leading-relaxed"><span className="font-bold">四周：</span>{g.shortTerm}</p>
                <p className="text-[10px] text-brand-charcoal/65 leading-relaxed">{g.measure}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 6. 本週活動（票 #60 的畫面） */}
      <section className="space-y-3" id="t2-weekly">
        {prose && <p className="text-xs text-brand-charcoal leading-relaxed">{prose.weeklyPlanIntro}</p>}
        <T2WeeklyPlan onBookService={onBookService} />
      </section>

      {/* 7. closing */}
      {prose && (
        <p className="text-xs text-brand-charcoal/85 leading-relaxed border-t border-brand-cream pt-5" id="t2-closing">
          {prose.closing}
        </p>
      )}

      {/* 8. 作答回顧（§6.4）：題目原文只出現在這裡，可摺疊 */}
      <section className="space-y-3" id="t2-review">
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
                    <span className="text-[10px] text-brand-charcoal/50 shrink-0">
                      {formatDay(g.computedAt)}
                      {redoByTool.has(g.toolId) && ` · ${redoSentence(redoByTool.get(g.toolId)!)}`}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {g.items.map(item => (
                      <li key={item.key} className="text-[11px] text-brand-charcoal leading-relaxed flex gap-2">
                        <span className="text-brand-charcoal/40 shrink-0">{item.sectionName ? `${item.sectionName} ${item.no}` : item.no}</span>
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
    </div>,
  );
}
