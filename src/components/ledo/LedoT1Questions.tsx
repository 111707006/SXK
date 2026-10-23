import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import type { T1Question } from '../../t1Data';

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
  const q = questions[at];
  if (!q) return null;
  const total = questions.length;
  const last = at === total - 1;
  const answered = answers[q.id] !== undefined;
  const allAnswered = questions.every(x => answers[x.id] !== undefined);

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
        <span className="text-xs text-ledo-accent-soft-ink">想想最近一个月在家或户外的样子</span>
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
