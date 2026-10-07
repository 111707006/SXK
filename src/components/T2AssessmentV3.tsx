import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, FileText, Layers, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { authFetch } from '../utils/api';
import { formatAge } from '../utils/dateUtils';
import { RATER_OPTIONS } from '../t2/answering';
import { GRADE_LABELS, formV3, isNa, keepAnswersFor, missingV3, setNa, type V3Answers } from '../t2/answeringV3';
import { KITV3_LOADERS } from '../t2/kitv3/lazy';
import type { ScoreContext } from '../t2/kitv3/score';
import type { KitV3Bank } from '../t2/kitv3/types';
import type { PlanV3Response } from '../t2/recommend/parentPlan';
import type { Rater } from '../t2/types';

interface T2AssessmentV3Props {
  plan: PlanV3Response;
  onBack: () => void;
  onOpenReport: (generate: boolean) => void;
}

/** 清單上的一份：這次推的，或近 90 天做過的。 */
interface ListTool {
  code: string;
  name: string;
  reason?: string;
  rater?: string;
  minutes?: number;
  session?: 1 | 2;
}

/** 「10 月 7 日」—— 完成日期，只要日期。 */
function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/**
 * 完整版題庫的逐支作答（T2 v3，`T2_RECOMMEND_V3`）—— `T2Assessment` 讀到 v3 的 plan 時改走這裡。
 *
 * 【清單】入口那份推薦（第一次／第二次填寫）＋近 90 天做過的（標「已完成」、可再做一次）。打開這一頁時的清單就是這一份；
 * 交完一份只在畫面上標完成，不重讀推薦 —— 引擎會把做過的換成別的，清單在家長眼前變來變去比少一格糟。
 *
 * 【題目】那一支的題庫在打開時才下載（`KITV3_LOADERS`），表單走 `formV3`（與伺服器驗卷同一份 `askedItems`），
 * 這一檔不手抄任何一題。月齡用 plan 上的 `answerAgeMonth`、情境用 `context`，與伺服器一致。
 */
export default function T2AssessmentV3({ plan, onBack, onOpenReport }: T2AssessmentV3Props) {
  const [completed, setCompleted] = useState<Record<string, string>>(
    Object.fromEntries(plan.completed.map(c => [c.code, c.createdAt])),
  );
  const [hasReport, setHasReport] = useState(false);
  const [selected, setSelected] = useState<ListTool | null>(null);
  const [bank, setBank] = useState<KitV3Bank | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [rater, setRater] = useState<Rater | null>(null);
  const [grade, setGrade] = useState<number | undefined>(undefined);
  const [answers, setAnswers] = useState<V3Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/t2/findings/latest')
      .then(r => { if (!cancelled) setHasReport(r.ok); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const ctx: ScoreContext = useMemo(
    () => ({ ageM: plan.answerAgeMonth, ...plan.context, ...(grade !== undefined ? { grade } : {}) }),
    [plan, grade],
  );
  const form = useMemo(() => (bank ? formV3(bank, ctx) : null), [bank, ctx]);
  const missing = useMemo(() => (bank && form ? missingV3(bank, { ...ctx, ...(form.grade ? { grade: form.grade.value } : {}) }, answers) : []), [bank, form, ctx, answers]);

  const tools: ListTool[] = [
    ...plan.tools,
    ...plan.completed.filter(c => !plan.tools.some(t => t.code === c.code)).map(c => ({ code: c.code, name: c.name })),
  ];

  const openTool = async (tool: ListTool) => {
    const load = KITV3_LOADERS[tool.code];
    if (!load) return;
    setSelected(tool);
    setBank(null);
    setRater(null);
    setGrade(undefined);
    setAnswers({});
    setError(null);
    setFlash(null);
    setLoadingBank(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      setBank(await load());
    } catch (err) {
      console.warn('Failed to load T2 v3 bank:', err);
      setError('暂时打不开这份问卷，请稍后再试。');
    } finally {
      setLoadingBank(false);
    }
  };

  const closeTool = () => {
    setSelected(null);
    setBank(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeGrade = (g: number) => {
    if (!bank) return;
    setGrade(g);
    setAnswers(a => keepAnswersFor(formV3(bank, { ...ctx, grade: g }), a));
  };

  const ready = rater !== null && missing.length === 0;

  const submit = async () => {
    if (!selected || !form || !ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await authFetch('/api/t2/tool-results', {
        method: 'POST',
        body: JSON.stringify({
          toolkitVersion: 'kit-20260923',
          toolId: selected.code,
          assessedAgeMonth: plan.answerAgeMonth,
          rater,
          answers,
          ...(form.grade ? { grade: form.grade.value } : {}),
        }),
      });
      const ct = resp.headers.get('content-type');
      const body = ct && ct.includes('application/json') ? await resp.json() : null;
      if (!resp.ok || !body || typeof body.id !== 'number') {
        setError(typeof body?.error === 'string' ? body.error : '暂时无法保存这份问卷，请稍后再试。');
        return;
      }
      setCompleted(c => ({ ...c, [selected.code]: body.createdAt }));
      setFlash(`「${selected.name}」已完成，已记录。`);
      closeTool();
    } catch (err) {
      console.warn('Failed to submit T2 v3 tool result:', err);
      setError('暂时无法保存这份问卷，请稍后再试。');
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

  const choice = (on: boolean) =>
    on
      ? 'border-brand-moss bg-brand-sage text-brand-forest font-semibold shadow-sm'
      : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/80 font-medium';

  // ── 作答 ──
  if (selected) {
    if (loadingBank || !form) {
      return shell(
        error
          ? <p className="text-xs text-brand-charcoal/60">{error}</p>
          : (
            <div className="flex items-center gap-2 text-xs text-brand-charcoal/60">
              <Loader2 size={14} className="animate-spin text-brand-moss" />
              正在打开问卷...
            </div>
          ),
        backButton('返回问卷清单', closeTool),
      );
    }
    let no = 0;
    const gateText = rater === null ? '请先选择填表人' : missing.length > 0 ? `还有 ${missing.length} 题未作答` : '全部答完，可以交卷';
    return shell(
      <div className="space-y-6">
        <div className="bg-brand-cream/35 p-4 rounded-2xl border border-brand-stone/50">
          <h2 className="text-sm font-extrabold text-brand-forest">{selected.name}</h2>
          <p className="text-[11px] text-brand-charcoal/70 mt-0.5">
            按孩子现在 {formatAge(plan.answerAgeMonth)} 出题；请照孩子平常的表现作答。
          </p>
        </div>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-brand-forest">这份问卷由谁填写？</h3>
          <div className="flex flex-wrap gap-2">
            {RATER_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                id={`t2v3-rater-${o.value}`}
                disabled={submitting}
                onClick={() => setRater(o.value)}
                className={`px-3.5 py-2 rounded-xl border text-xs transition cursor-pointer ${choice(rater === o.value)}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {form.grade && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-brand-forest">孩子现在读几年级？</h3>
            <p className="text-[10px] text-brand-charcoal/55">按年龄先选好了；跳级或晚读的请改成实际的年级，题目会跟着换。</p>
            <select
              id="t2v3-grade"
              value={form.grade.value}
              disabled={submitting}
              onChange={e => changeGrade(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-brand-stone/60 bg-white text-xs text-brand-forest"
            >
              {Array.from({ length: form.grade.range[1] - form.grade.range[0] + 1 }, (_, i) => form.grade!.range[0] + i).map(g => (
                <option key={g} value={g}>{GRADE_LABELS[g]}</option>
              ))}
            </select>
          </section>
        )}

        {form.sections.map(section => {
          const na = isNa(answers, section.key);
          return (
            <section key={section.key} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-brand-forest border-l-4 border-brand-moss pl-2">{section.name}</h3>
                {section.naLabel && (
                  <label className="text-[11px] text-brand-charcoal/70 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      id={`t2v3-na-${section.key}`}
                      checked={na}
                      disabled={submitting}
                      onChange={e => setAnswers(a => setNa(a, section, e.target.checked))}
                    />
                    {section.naLabel}
                  </label>
                )}
              </div>
              {section.optional && <p className="text-[10px] text-brand-charcoal/50">这一部分可以不填。</p>}
              {na ? (
                <p className="text-[11px] text-brand-charcoal/55 bg-brand-cream/30 rounded-xl px-3 py-2">这一部分这次不作答。</p>
              ) : (
                section.items.map(item => {
                  no += 1;
                  const chosen = answers[item.key];
                  const wide = !!item.anchors || section.options.some(o => o.hint) || section.options.length > 4;
                  return (
                    <div key={item.key} className="p-4 bg-white border border-brand-stone rounded-2xl space-y-3 hover:border-brand-moss/40 transition">
                      <div className="flex gap-2.5">
                        <span className="text-[11px] font-bold text-brand-charcoal/60 bg-brand-cream border border-brand-stone/30 w-5.5 h-5.5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          {no}
                        </span>
                        <div className="flex-1 space-y-1">
                          <h4 className="text-xs sm:text-sm font-semibold text-brand-forest leading-relaxed">{item.text}</h4>
                          {item.hint && <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">{item.hint}</p>}
                        </div>
                      </div>
                      <div className={`grid grid-cols-1 gap-2 pl-8 ${wide ? '' : section.options.length <= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
                        {section.options.map((opt, oi) => {
                          const anchor = item.anchors?.[oi];
                          const on = chosen === opt.value && item.key in answers;
                          return (
                            <button
                              key={String(opt.value)}
                              type="button"
                              id={`t2v3-opt-${item.key}-${opt.value ?? 'na'}`}
                              disabled={submitting}
                              onClick={() => setAnswers(a => ({ ...a, [item.key]: opt.value }))}
                              className={`py-2.5 px-3 rounded-xl border text-xs transition cursor-pointer ${wide ? 'text-left' : 'text-center'} ${choice(on)}`}
                            >
                              <span className="block leading-relaxed">{anchor ?? opt.label}</span>
                              {anchor && <span className="block text-[10px] text-brand-charcoal/45 mt-0.5">{opt.label}</span>}
                              {!anchor && opt.hint && <span className="block text-[10px] text-brand-charcoal/55 font-normal leading-relaxed mt-0.5">{opt.hint}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          );
        })}

        {error && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{error}</p>}

        <div className="pt-6 border-t border-brand-stone/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className={`text-[11px] font-semibold ${ready ? 'text-brand-moss' : 'text-brand-charcoal/60'}`}>{gateText}</span>
          <button
            type="button"
            id="t2v3-submit-btn"
            disabled={!ready || submitting}
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

  // ── 清單 ──
  const doneCount = tools.filter(t => completed[t.code]).length;
  const bySession: Array<{ title: string; items: ListTool[] }> = [
    { title: plan.sessions === 2 ? '第一次填写' : '要填的问卷', items: tools.filter(t => t.session === 1) },
    { title: '第二次填写', items: tools.filter(t => t.session === 2) },
    { title: '最近做过的', items: tools.filter(t => t.session === undefined) },
  ].filter(g => g.items.length > 0);

  return shell(
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-extrabold text-brand-forest">逐份作答</h2>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
          按孩子现在 {formatAge(plan.answerAgeMonth)} 出题，每份都可以分开做、也可以重做（每次都另记一笔）。
          已完成 {doneCount} / {tools.length} 份{plan.totalMinutes > 0 && <>，全部约 {plan.totalMinutes} 分钟</>}。
        </p>
      </div>

      {flash && (
        <div className="p-3 bg-brand-sage/40 border border-brand-moss/30 rounded-xl flex items-center gap-2 text-brand-forest text-xs font-bold">
          <Check size={14} className="text-brand-moss shrink-0" />
          {flash}
        </div>
      )}

      {tools.length === 0 && <p className="text-xs text-brand-charcoal/60">目前没有要作答的问卷。请回到报告查看安排。</p>}

      {bySession.map(g => (
        <section key={g.title} className="space-y-2">
          <div className="text-[10px] font-bold text-brand-charcoal/50 uppercase tracking-wider">{g.title}</div>
          <ul className="space-y-2">
            {g.items.map(t => {
              const when = completed[t.code];
              return (
                <li key={t.code} className="p-4 bg-white border border-brand-stone rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-xs font-semibold text-brand-forest">{t.name}</div>
                    {t.reason && <div className="text-[11px] text-brand-charcoal/70 leading-relaxed">{t.reason}</div>}
                    {(t.rater || t.minutes) && (
                      <div className="text-[10px] text-brand-charcoal/50">
                        {[t.rater, t.minutes ? `约 ${t.minutes} 分钟` : null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {when && (
                      <div className="text-[10px] text-emerald-700 flex items-center gap-1">
                        <Check size={11} /> 已完成 · {formatDay(when)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    id={`t2v3-open-${t.code}`}
                    onClick={() => openTool(t)}
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

      <div className="pt-5 border-t border-brand-stone/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
          {doneCount === 0 ? '还没有完成任何一份问卷；先答完第一次的几份，报告会更完整。' : `已完成的 ${doneCount} 份会整理成一份报告。`}
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          {hasReport && (
            <button
              type="button"
              id="t2v3-view-report-btn"
              onClick={() => onOpenReport(false)}
              className="px-4 py-2.5 rounded-xl border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText size={13} />
              查看上次的报告
            </button>
          )}
          <button
            type="button"
            id="t2v3-generate-report-btn"
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
