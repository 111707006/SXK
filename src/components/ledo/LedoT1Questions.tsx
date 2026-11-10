import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import type { T1Question } from '../../t1Data';
import { useDesktopLayout } from '../../desktop/useDesktopLayout';

/**
 * Ledo 版 T1 作答（設計稿第 4 頁）：一屏一題。進度條、方面標籤、題目放大，答案是整排大按鈕。
 *
 * 只換畫法：題目、作答值（2／1／0）與交卷都是 `T1Screening` 那一份 —— 這裡讀 `answers`、
 * 選了呼叫 `onSelect`、最後一題按「完成」呼叫 `onSubmit`，計分一行都不在這裡。
 */
export default function LedoT1Questions({ questions, answers, ageBandName, onSelect, onSubmit, onExit, submitLabel = '完成评估' }: {
  /** 照作答順序（同一個方面的題目排在一起） */
  questions: T1Question[];
  answers: Record<string, number>;
  ageBandName: string;
  onSelect: (questionId: string, score: number) => void;
  onSubmit: () => void;
  onExit: () => void;
  /** 最後一題那顆按鈕的字（1022 開著時是「生成报告」：按下去就到報告頁）。 */
  submitLabel?: string;
}) {
  // 從第一題還沒答的開始（中途離開再回來不從頭）；全答完了（從「补充资料」按上一题回來）停在最後一題
  const [at, setAt] = useState(() => {
    const first = questions.findIndex(q => answers[q.id] === undefined);
    return first < 0 ? questions.length - 1 : first;
  });
  const desk = useDesktopLayout();
  const q = questions[at];
  if (!q) return null;
  const total = questions.length;
  const last = at === total - 1;
  const answered = answers[q.id] !== undefined;
  const allAnswered = questions.every(x => answers[x.id] !== undefined);
  // 作答規則（哪一題、最後一題、答了沒、全答完沒）只算這一次，電腦版只換排法
  if (desk) return <DeskT1 {...{ questions, answers, ageBandName, onSelect, onSubmit, onExit, submitLabel, at, setAt, last, answered, allAnswered }} />;

  return (
    <div id="ledo-t1" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6">
      <div className="grid grid-cols-[36px_1fr_36px] items-center gap-2">
        <button type="button" aria-label="上一题" disabled={at === 0} onClick={() => setAt(i => i - 1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-ledo-line text-ledo-ink disabled:opacity-30 cursor-pointer disabled:cursor-default">
          <ChevronLeft size={16} />
        </button>
        <b className="truncate text-center text-base font-black text-ledo-ink">{q.dimensionName}</b>
        <button type="button" aria-label="离开作答" onClick={onExit}
          className="grid h-9 w-9 place-items-center rounded-full border border-ledo-line text-ledo-ink cursor-pointer">
          <X size={16} />
        </button>
      </div>

      <div className="h-[5px] rounded-full bg-ledo-line" aria-hidden="true">
        <div className="h-full rounded-full bg-ledo-accent transition-all" style={{ width: `${((at + 1) / total) * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs tabular-nums text-ledo-ink-2">
        <span>第 {at + 1} 题 · 共 {total} 题</span>
        <span>{ageBandName}</span>
      </div>

      <div className="flex flex-col gap-2.5 rounded-3xl bg-ledo-accent-soft p-4">
        <span className="self-start rounded-full bg-white px-3 py-[5px] text-xs font-bold text-ledo-ink">{q.dimensionName}</span>
        <p className="text-lg font-bold leading-relaxed text-ledo-ink">{q.text}</p>
        <span className="text-xs text-ledo-accent-soft-ink">想想孩子最近一个月在家或户外的表现</span>
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label={q.text}>
        {q.options.map(opt => {
          const on = answers[q.id] === opt.score;
          return (
            <button
              key={opt.score}
              type="button"
              role="radio"
              aria-checked={on}
              id={`t1-option-${q.id}-${opt.score}`}
              onClick={() => onSelect(q.id, opt.score)}
              className={`flex items-center justify-between rounded-[18px] border-[1.5px] px-4 py-3.5 text-left text-[15px] font-bold transition cursor-pointer ${
                on ? 'border-ledo-accent bg-ledo-accent text-white' : 'border-ledo-line bg-white text-ledo-ink'
              }`}
            >
              {opt.label}
              {on && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" disabled={at === 0} onClick={() => setAt(i => i - 1)}
          className="rounded-full bg-ledo-accent-soft py-3.5 text-sm font-black text-ledo-accent-soft-ink disabled:opacity-40 cursor-pointer disabled:cursor-default">
          上一题
        </button>
        {last ? (
          <button type="button" id="ledo-t1-submit" disabled={!allAnswered} onClick={onSubmit}
            className="rounded-full bg-ledo-bar py-3.5 text-sm font-black text-white disabled:opacity-40 cursor-pointer disabled:cursor-default">
            {submitLabel}
          </button>
        ) : (
          <button type="button" id="ledo-t1-next" disabled={!answered} onClick={() => setAt(i => i + 1)}
            className="rounded-full bg-ledo-bar py-3.5 text-sm font-black text-white disabled:opacity-40 cursor-pointer disabled:cursor-default">
            下一题
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 電腦版（版型 C 的 T1 作答）：左邊題目卡、答案三個並排；右邊「九个方面」每一方面答了幾題（照 `answers` 算），
 * 點一個方面跳到它第一題。題目、作答、交卷與手機版同一份，只換排法。
 */
function DeskT1({ questions, answers, ageBandName, onSelect, onSubmit, onExit, submitLabel, at, setAt, last, answered, allAnswered }: {
  questions: T1Question[];
  answers: Record<string, number>;
  ageBandName: string;
  onSelect: (questionId: string, score: number) => void;
  onSubmit: () => void;
  onExit: () => void;
  submitLabel: string;
  at: number;
  setAt: (fn: (i: number) => number) => void;
  last: boolean;
  answered: boolean;
  allAnswered: boolean;
}) {
  const q = questions[at];
  const total = questions.length;
  const done = questions.filter(x => answers[x.id] !== undefined).length;
  // 手機版是一題一題往下（沒答不能下一题）；跳方面也只跳到已經答到的地方，不讓人跳過沒答的題
  const firstOpen = questions.findIndex(x => answers[x.id] === undefined);
  const reachable = (first: number) => firstOpen < 0 || first <= firstOpen;
  const dims = questions.reduce<{ id: string; name: string; first: number; total: number; done: number }[]>((acc, x, i) => {
    let d = acc.find(a => a.id === x.dimensionId);
    if (!d) acc.push((d = { id: x.dimensionId, name: x.dimensionName, first: i, total: 0, done: 0 }));
    d.total += 1;
    if (answers[x.id] !== undefined) d.done += 1;
    return acc;
  }, []);
  const card = 'rounded-[28px] bg-white shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)]';

  return (
    <div id="ledo-t1" className="grid w-full grid-cols-[minmax(0,1fr)_240px] items-start gap-5 text-left xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-4">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-xs text-ledo-ink-2">{ageBandName}</p>
            <h2 className="text-[22px] font-black text-ledo-ink">T1 作答</h2>
          </div>
          <button type="button" onClick={onExit} className="flex items-center gap-1.5 rounded-full border border-ledo-line bg-white px-4 py-2 text-sm font-bold text-ledo-ink cursor-pointer">
            <X size={14} />离开作答
          </button>
        </div>
        <div className={`${card} p-4`}>
          <div className="mb-2 flex justify-between text-xs font-bold tabular-nums">
            <span className="text-ledo-ink">已答 {done} / {total} 题</span>
            <span className="text-ledo-ink-2">第 {at + 1} 题</span>
          </div>
          <div className="h-2.5 rounded-full bg-ledo-field" aria-hidden="true">
            <div className="h-full rounded-full bg-ledo-accent transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
        <section className={`${card} space-y-5 p-6`}>
          <div className="space-y-2">
            <span className="inline-block rounded-full bg-ledo-accent-soft px-3 py-[5px] text-xs font-bold text-ledo-accent-soft-ink">{q.dimensionName}</span>
            <p className="text-[22px] font-black leading-snug text-ledo-ink">{q.text}</p>
            <p className="text-sm text-ledo-ink-2">想想孩子最近一个月在家或户外的表现</p>
          </div>
          <div className="grid gap-2.5 xl:grid-cols-3 xl:gap-3" role="radiogroup" aria-label={q.text}>
            {q.options.map(opt => {
              const on = answers[q.id] === opt.score;
              return (
                <button
                  key={opt.score}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  id={`t1-option-${q.id}-${opt.score}`}
                  onClick={() => onSelect(q.id, opt.score)}
                  className={`flex items-center justify-between gap-2 rounded-3xl xl:min-h-[72px] border-[1.5px] px-5 py-4 text-left text-base font-black transition cursor-pointer ${
                    on ? 'border-ledo-accent bg-ledo-accent text-white' : 'border-ledo-line bg-white text-ledo-ink hover:bg-ledo-field'
                  }`}
                >
                  {opt.label}
                  {on && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <button type="button" disabled={at === 0} onClick={() => setAt(i => i - 1)}
              className="flex items-center gap-1.5 rounded-full border border-ledo-line bg-white px-6 py-3 text-sm font-black text-ledo-ink disabled:opacity-40 cursor-pointer disabled:cursor-default">
              <ChevronLeft size={16} />上一题
            </button>
            {last ? (
              <button type="button" id="ledo-t1-submit" disabled={!allAnswered} onClick={onSubmit}
                className="rounded-full bg-ledo-bar px-8 py-3 text-sm font-black text-white disabled:opacity-40 cursor-pointer disabled:cursor-default">
                {submitLabel}
              </button>
            ) : (
              <button type="button" id="ledo-t1-next" disabled={!answered} onClick={() => setAt(i => i + 1)}
                className="rounded-full bg-ledo-bar px-8 py-3 text-sm font-black text-white disabled:opacity-40 cursor-pointer disabled:cursor-default">
                下一题
              </button>
            )}
          </div>
        </section>
      </div>
      <aside id="ledo-t1-dims" className={`${card} p-5`}>
        <p className="mb-3 text-sm font-black text-ledo-ink">{dims.length} 个方面</p>
        <ol className="space-y-1">
          {dims.map(d => {
            const current = d.id === q.dimensionId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setAt(() => d.first)}
                  disabled={!reachable(d.first)}
                  aria-current={current ? 'step' : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition cursor-pointer ${
                    current ? 'bg-ledo-accent-soft font-black text-ledo-accent-soft-ink' : d.done === d.total ? 'text-ledo-ink hover:bg-ledo-field' : 'text-ledo-ink-2 hover:bg-ledo-field'
                  } disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 text-xs tabular-nums">{d.done}/{d.total}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
