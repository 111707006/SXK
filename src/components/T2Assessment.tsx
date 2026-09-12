import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, FileText, Layers, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { authFetch } from '../utils/api';
import { formatAge } from '../utils/dateUtils';
import { describePlanItem } from '../t2/entrance';
import {
  RATER_OPTIONS,
  asrItemNotes,
  canSubmit,
  completedAt,
  displayItemText,
  displayPrompt,
  exclusiveChecked,
  followupHints,
  formFor,
  missingCount,
  preAnswered,
  togglePreMulti,
} from '../t2/answering';
import type { AnswerValue, CompletedEntry, Draft, PreValue, ToolForm } from '../t2/answering';
import type { PlanItem, T2Plan, ToolId } from '../t2/types';

/** `GET /api/t2/tool-results` 的回應：每支最新且完整的一筆，各附 band。這裡只讀四個欄位。 */
interface ToolResultsResponse {
  results: Array<{ id: number; createdAt: string; result: { toolId: ToolId }; bands: CompletedEntry['bands'] }>;
}

interface T2AssessmentProps {
  onBack: () => void;
  /**
   * 開報告頁（票 #61）。`generate` 為 true 是按了「生成报告」—— 報告頁一進去就打 POST；
   * false 是「查看上次的报告」，只讀最新那一份。
   */
  onOpenReport: (generate: boolean) => void;
}

const EMPTY_DRAFT: Draft = { rater: null, pre: {}, answers: {} };

function toEntries(data: ToolResultsResponse): CompletedEntry[] {
  return data.results.map(r => ({ id: r.id, createdAt: r.createdAt, toolId: r.result.toolId, bands: r.bands }));
}

/** 「9 月 12 日」—— 清單上的完成日期，只要日期不要時間。 */
function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/**
 * T2 深度評估的逐支作答（票 #58，規格 §11 階段 5 的作答那半）—— **家長端專屬**，只有解鎖後到得了。
 *
 * 【兩個畫面】
 * 工具清單：入口（#56）那份 plan 的必做／選做／加測／補充四組，已完成的標示完成與日期，同一支可重做
 * （另起一筆，伺服器不覆蓋）。加測工具只在星號做完且判留意或關注時多一句「再花约 N 题可以更精确」。
 * 作答：填表人 → 前置題 → 題目（只出起始月齡 ≤ 測評月齡的），缺答不能交卷。交卷打 `POST /api/t2/tool-results`，
 * 分數是伺服器算的；成功後回到清單。
 *
 * 【題目怎麼來】
 * 全部從 `src/t2/answering.ts` 的 `formFor()` 拿（底下是計分層的 `askedItems()`，與伺服器驗收卷的是同一份），
 * 這一檔**不手抄任何一題**，也不直接印 `item.text` —— M-CHAT 要經 `displayItemText` 轉簡體。
 * `test/t2AssessmentCopy.structure.test.ts` 釘住。
 *
 * 【月齡】
 * 用 plan 上伺服器算的 `ageMonth`（今天的實足月齡），與清單上的題數同一個來源；交卷把它當
 * `assessedAgeMonth` 送回去，伺服器照它出題驗卷。表單開著跨了月，伺服器會退回（多題或缺題），
 * 畫面把伺服器的話原樣顯示。
 */
export default function T2Assessment({ onBack, onOpenReport }: T2AssessmentProps) {
  const [plan, setPlan] = useState<T2Plan | null>(null);
  const [entries, setEntries] = useState<CompletedEntry[]>([]);
  /** 有沒有生成過報告（`GET /api/t2/findings/latest` 是 200 還是 404）；讀不到就當沒有，只少一顆按鈕。 */
  const [hasReport, setHasReport] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState<PlanItem | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [planResp, resultsResp, latestResp] = await Promise.all([
          authFetch('/api/t2/plan'),
          authFetch('/api/t2/tool-results'),
          authFetch('/api/t2/findings/latest').catch(() => null),
        ]);
        if (!planResp.ok || !resultsResp.ok) throw new Error(`HTTP ${planResp.status}/${resultsResp.status}`);
        const planData = (await planResp.json()) as T2Plan;
        const resultsData = (await resultsResp.json()) as ToolResultsResponse;
        if (cancelled) return;
        setPlan(planData);
        setEntries(toEntries(resultsData));
        setHasReport(latestResp?.ok === true);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load T2 assessment:', err);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const form: ToolForm | null = useMemo(
    () => (plan && selected ? formFor(selected.toolId, plan.ageMonth) : null),
    [plan, selected],
  );

  const openTool = (item: PlanItem) => {
    setSelected(item);
    setDraft(EMPTY_DRAFT);
    setSubmitError(null);
    setFlash(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeTool = () => {
    setSelected(null);
    setDraft(EMPTY_DRAFT);
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setAnswer = (key: string, value: AnswerValue) =>
    setDraft(d => ({ ...d, answers: { ...d.answers, [key]: value } }));

  const setPre = (key: string, value: PreValue) =>
    setDraft(d => ({ ...d, pre: { ...d.pre, [key]: value } }));

  const submit = async () => {
    if (!plan || !form || !canSubmit(form, draft) || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resp = await authFetch('/api/t2/tool-results', {
        method: 'POST',
        body: JSON.stringify({
          toolId: form.toolId,
          assessedAgeMonth: plan.ageMonth,
          rater: draft.rater,
          pre: draft.pre,
          answers: draft.answers,
        }),
      });
      const ct = resp.headers.get('content-type');
      const body = ct && ct.includes('application/json') ? await resp.json() : null;
      if (!resp.ok || !body || typeof body.id !== 'number' || !body.result) {
        setSubmitError(typeof body?.error === 'string' ? body.error : '暂时无法保存这份问卷，请稍后再试。');
        return;
      }
      // 交卷成功：回應就是清單上的一筆，直接接上，不再 GET 一次。
      const entry: CompletedEntry = { id: body.id, createdAt: body.createdAt, toolId: body.result.toolId, bands: body.bands };
      setEntries(prev => [...prev.filter(e => e.toolId !== entry.toolId), entry]);
      setFlash(`${describePlanItem(selected!)} 已完成，已记录。`);
      setSelected(null);
      setDraft(EMPTY_DRAFT);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.warn('Failed to submit T2 tool result:', err);
      setSubmitError('暂时无法保存这份问卷，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  };

  const backButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className={`flex items-center gap-1.5 text-xs font-semibold text-brand-charcoal/85 hover:text-brand-forest transition ${submitting ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );

  const shell = (children: React.ReactNode, back: React.ReactNode) => (
    <div className="bg-white rounded-3xl border border-brand-stone p-6 md:p-8 max-w-3xl mx-auto shadow-sm text-left">
      <div className="flex items-center justify-between border-b border-brand-cream pb-5 mb-6">
        {back}
        <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
          <Layers size={10} /> 第二层 · 深度评估
        </span>
      </div>
      {children}
    </div>
  );

  if (status === 'loading') {
    return shell(
      <div className="flex items-center gap-2 text-xs text-brand-charcoal/60">
        <Loader2 size={14} className="animate-spin text-brand-moss" />
        正在读取要作答的问卷...
      </div>,
      backButton('返回报告', onBack),
    );
  }

  if (status === 'error' || !plan) {
    return shell(
      <div className="text-xs text-brand-charcoal/60">暂时读不到要作答的问卷，请稍后再打开。</div>,
      backButton('返回报告', onBack),
    );
  }

  // ── 作答 ──
  if (selected && form) {
    const missing = missingCount(form, draft.answers);
    const ready = canSubmit(form, draft);
    const isAsr = form.toolId === 'sxk-asr';
    const preMissing = form.preQuestions.some(q => !preAnswered(q, draft.pre[q.key]));
    const gateText = draft.rater === null
      ? '请先选择填表人'
      : preMissing
        ? '请先回答前面的问题'
        : missing > 0
          ? <>还有 {missing} 题未作答</>
          : '全部答完，可以交卷';

    return shell(
      <div className="space-y-6">
        <div className="flex items-center gap-4 bg-brand-cream/35 p-4 rounded-2xl border border-brand-stone/50">
          <div className="px-3 py-2 rounded-xl bg-white shadow-sm border border-brand-stone/40 text-brand-forest font-mono text-[11px] font-bold shrink-0">
            {form.toolId.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-brand-forest">{describePlanItem(selected)}</h2>
            <p className="text-[11px] text-brand-charcoal/70 mt-0.5">
              按孩子现在 {formatAge(plan.ageMonth)} 出题；请照最近一个月的日常表现作答。
            </p>
          </div>
        </div>

        {/* 填表人 */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-brand-forest">这份问卷由谁填写？</h3>
          <div className="flex flex-wrap gap-2">
            {RATER_OPTIONS.map(o => {
              const on = draft.rater === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  id={`t2-rater-${o.value}`}
                  disabled={submitting}
                  onClick={() => setDraft(d => ({ ...d, rater: o.value }))}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    on
                      ? 'border-brand-moss bg-brand-sage text-brand-forest font-semibold shadow-sm'
                      : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/80'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* 前置題（§5.1）：先於題目，不計分 */}
        {form.preQuestions.map(q => {
          const current = draft.pre[q.key];
          const multiValues = Array.isArray(current) ? current : [];
          const exclusiveOn = q.kind === 'multi' && exclusiveChecked(q, multiValues);
          return (
            <section key={q.key} className="space-y-2 rounded-2xl border border-brand-stone/60 bg-brand-sand/40 p-4">
              <h3 className="text-xs font-bold text-brand-forest">{displayPrompt(form.toolId, q.prompt)}</h3>
              {q.kind === 'multi' && <p className="text-[10px] text-brand-charcoal/50">可以多选</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map(o => {
                  const on = q.kind === 'multi'
                    ? multiValues.includes(o.value)
                    : q.kind === 'boolean'
                      ? current === (o.value === 'true')
                      : current === o.value;
                  const blocked = exclusiveOn && !o.exclusive && !on;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      id={`t2-pre-${q.key}-${o.value}`}
                      disabled={submitting || blocked}
                      onClick={() => {
                        if (q.kind === 'multi') setPre(q.key, togglePreMulti(q, multiValues, o.value));
                        else if (q.kind === 'boolean') setPre(q.key, o.value === 'true');
                        else setPre(q.key, o.value);
                      }}
                      className={`py-2.5 px-4 rounded-xl border text-xs font-medium text-left transition ${
                        on
                          ? 'border-brand-moss bg-brand-sage text-brand-forest font-semibold shadow-sm'
                          : 'border-brand-stone/40 bg-white hover:bg-brand-cream/50 text-brand-charcoal/80'
                      } ${blocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {displayPrompt(form.toolId, o.label)}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* 題目：依面向分組，只出這個月齡的 */}
        {form.sections.map(section => {
          let base = 0;
          for (const s of form.sections) {
            if (s === section) break;
            base += s.items.length;
          }
          return (
            <section key={section.key} className="space-y-3">
              {section.name && (
                <h3 className="text-xs font-bold text-brand-forest border-l-4 border-brand-moss pl-2">
                  {displayPrompt(form.toolId, section.name)}
                </h3>
              )}
              {section.items.map((fi, idx) => {
                const chosen = draft.answers[fi.key];
                const notes = isAsr ? asrItemNotes(section.key, fi.item.no) : [];
                return (
                  <div key={fi.key} className="p-4 bg-white border border-brand-stone rounded-2xl space-y-3 hover:border-brand-moss/40 transition">
                    <div className="flex gap-2.5">
                      <span className="text-[11px] font-bold text-brand-charcoal/60 bg-brand-cream border border-brand-stone/30 w-5.5 h-5.5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        {base + idx + 1}
                      </span>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-xs sm:text-sm font-semibold text-brand-forest leading-relaxed">
                          {displayItemText(form.toolId, fi.item)}
                        </h4>
                        {notes.map(n => (
                          <p key={n} className="text-[10px] text-brand-charcoal/60 leading-relaxed">{n}</p>
                        ))}
                      </div>
                    </div>

                    {isAsr && fi.item.anchors ? (
                      /* ASR：四條錨點全文是選項本體，「轻度不同」那四個字只當小字（§4.6） */
                      <div className="grid grid-cols-1 gap-2 pl-8">
                        {fi.item.anchors.map((anchor, ai) => {
                          const opt = form.options[ai];
                          const on = chosen === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              id={`t2-opt-${fi.key}-${opt.value}`}
                              disabled={submitting}
                              onClick={() => setAnswer(fi.key, opt.value)}
                              className={`py-2.5 px-4 rounded-xl border text-left transition cursor-pointer ${
                                on
                                  ? 'border-brand-moss bg-brand-sage text-brand-forest shadow-sm'
                                  : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/80'
                              }`}
                            >
                              <span className={`block text-xs leading-relaxed ${on ? 'font-semibold' : 'font-medium'}`}>{anchor}</span>
                              <span className="block text-[10px] text-brand-charcoal/45 mt-0.5">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`grid grid-cols-1 gap-2 pl-8 ${form.options.length <= 3 ? 'sm:grid-cols-3' : form.options.length === 4 ? 'sm:grid-cols-4' : ''}`}>
                        {form.options.map(opt => {
                          const on = chosen === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              id={`t2-opt-${fi.key}-${opt.value}`}
                              disabled={submitting}
                              onClick={() => setAnswer(fi.key, opt.value)}
                              className={`py-2.5 px-3 rounded-xl border text-xs transition cursor-pointer ${opt.definition ? 'text-left' : 'text-center'} ${
                                on
                                  ? 'border-brand-moss bg-brand-sage text-brand-forest font-semibold shadow-sm'
                                  : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/80 font-medium'
                              }`}
                            >
                              <span className="block">{displayPrompt(form.toolId, opt.label)}</span>
                              {/* ADL：七級的定義全文（§3.1「每級有一句定義，畫面要全文顯示」） */}
                              {opt.definition && (
                                <span className="block text-[10px] text-brand-charcoal/55 font-normal leading-relaxed mt-0.5">{opt.definition}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}

        {submitError && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{submitError}</p>
        )}

        <div className="pt-6 border-t border-brand-stone/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className={`text-[11px] font-semibold ${ready ? 'text-brand-moss' : 'text-brand-charcoal/60'}`}>{gateText}</span>
          <button
            type="button"
            id="t2-submit-btn"
            disabled={!canSubmit(form, draft) || submitting}
            onClick={submit}
            className={`px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition ${
              ready && !submitting
                ? 'bg-brand-forest hover:bg-brand-forest/90 text-white shadow-brand-forest/20 active:scale-[0.98] cursor-pointer'
                : 'bg-brand-cream border border-brand-stone text-brand-charcoal/40 cursor-not-allowed shadow-none'
            }`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? '正在保存...' : '交卷'}
          </button>
        </div>
      </div>,
      backButton('返回问卷清单', closeTool),
    );
  }

  // ── 工具清單 ──
  const done = completedAt(entries);
  const hints = followupHints(plan, entries);
  const groups: Array<{ title: string; note?: string; items: PlanItem[] }> = [
    { title: '必做', items: plan.required },
    { title: '选做', items: plan.optional },
    { title: '之后可能加测', note: '先做完上面的，需要时这里会提示。', items: plan.followup },
    { title: '补充问卷（不出判定）', items: plan.extras },
  ].filter(g => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const doneCount = groups.reduce((n, g) => n + g.items.filter(i => done[i.toolId]).length, 0);

  return shell(
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-extrabold text-brand-forest">逐份作答</h2>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
          按孩子现在 {formatAge(plan.ageMonth)} 出题，每份都可以分开做、也可以重做（每次都另记一笔）。
          已完成 {doneCount} / {total} 份。
        </p>
      </div>

      {flash && (
        <div className="p-3 bg-brand-sage/40 border border-brand-moss/30 rounded-xl flex items-center gap-2 text-brand-forest text-xs font-bold">
          <Check size={14} className="text-brand-moss shrink-0" />
          {flash}
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-brand-charcoal/60">目前没有要作答的问卷。请回到报告查看安排。</p>
      )}

      {groups.map(g => (
        <section key={g.title} className="space-y-2">
          <div className="text-[10px] font-bold text-brand-charcoal/50 uppercase tracking-wider">
            {g.title}
            {g.note && <span className="ml-2 font-medium normal-case tracking-normal">{g.note}</span>}
          </div>
          <ul className="space-y-2">
            {g.items.map(item => {
              const when = done[item.toolId];
              const hint = hints[item.toolId];
              return (
                <li key={item.toolId} className="p-4 bg-white border border-brand-stone rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-xs font-semibold text-brand-forest flex items-center gap-2">
                      <span className="font-mono text-[10px] text-brand-charcoal/50">{item.toolId.toUpperCase()}</span>
                      {describePlanItem(item)}
                    </div>
                    {when && (
                      <div className="text-[10px] text-emerald-700 flex items-center gap-1">
                        <Check size={11} /> 已完成 · {formatDay(when)}
                      </div>
                    )}
                    {hint && <div className="text-[10px] text-brand-clay font-semibold">{hint}</div>}
                  </div>
                  <button
                    type="button"
                    id={`t2-open-${item.toolId}`}
                    onClick={() => openTool(item)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition shrink-0 cursor-pointer ${
                      when
                        ? 'border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest'
                        : 'bg-brand-moss hover:bg-brand-moss/90 text-white shadow-sm active:scale-[0.98]'
                    }`}
                  >
                    {when ? <RotateCcw size={12} /> : <ChevronRight size={12} />}
                    {when ? '再做一次' : '开始作答'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/* 生成報告（票 #61）：一支都沒做完也生得出來（勘誤 P4），所以不擋；做了幾份就照幾份整理。 */}
      <div className="pt-5 border-t border-brand-stone/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
          {doneCount === 0
            ? '还没有完成任何一份问卷；先答完必做的几份，报告会更完整。'
            : `已完成的 ${doneCount} 份会整理成一份报告，并安排这一周的家庭活动。`}
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          {hasReport && (
            <button
              type="button"
              id="t2-view-report-btn"
              onClick={() => onOpenReport(false)}
              className="px-4 py-2.5 rounded-xl border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText size={13} />
              查看上次的报告
            </button>
          )}
          <button
            type="button"
            id="t2-generate-report-btn"
            onClick={() => onOpenReport(true)}
            className="px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-forest/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-forest/20 active:scale-[0.98] transition cursor-pointer"
          >
            <Sparkles size={13} />
            生成报告
          </button>
        </div>
      </div>
    </div>,
    backButton('返回报告', onBack),
  );
}
