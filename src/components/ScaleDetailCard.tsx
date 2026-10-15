import { ClipboardCheck, Home, ListChecks, Target } from 'lucide-react';
import type { ScaleDetailEntry } from '../t2/findingsV3';
import type { ScaleDetailFacet, ScaleDetailFocus, Tone } from '../t2/scaleDetail';
import {
  FOCUS_TITLE,
  FREQUENT_START,
  NEXT_STEP_LABEL,
  NEXT_STEP_NOTE,
  PREVIOUS_LABEL,
  STRENGTHS_LABEL,
  TIPS_LABEL,
} from '../t2/scaleDetailCopy';

/**
 * 量表详解的一張卡（規格 `t2-v3-scale-detail-report.md` §6；版面照 2026-10-15 給使用者看的範例）。
 * 只畫快照裡存好的 `ScaleDetail`，不算、不組句 —— 句子都在 `scaleDetail.ts`／`scaleDetailCopy.ts`（用字掃描裡）。
 */

const TONE_CHIP: Readonly<Record<Tone, string>> = {
  0: 'bg-brand-sage/30 text-brand-forest border-brand-moss/30',
  1: 'bg-amber-50 text-amber-800 border-amber-200',
  2: 'bg-amber-100 text-amber-900 border-amber-300',
  3: 'bg-rose-50 text-rose-800 border-rose-200',
};
const NEUTRAL_CHIP = 'bg-brand-cream/60 text-brand-charcoal/70 border-brand-stone/40';

/** 三種作答的顏色：達成率族好的是綠；頻率族「很少或没有」也是綠 —— 都是 0 最好。 */
const KIND_BAR = ['bg-brand-moss', 'bg-amber-400', 'bg-brand-stone/70'] as const;
const KIND_TEXT = ['text-brand-moss', 'text-amber-700', 'text-brand-charcoal/60'] as const;

function Bar({ counts }: { counts: readonly [number, number, number] }) {
  const total = Math.max(1, counts[0] + counts[1] + counts[2]);
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-brand-cream/60" aria-hidden>
      {counts.map((c, i) => <div key={i} className={KIND_BAR[i]} style={{ width: `${(c / total) * 100}%` }} />)}
    </div>
  );
}

function List({ label, items, tone }: { label: string; items: readonly string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <div className={`text-[11px] font-bold ${tone}`}>{label}</div>
      <ul className="space-y-0.5">
        {items.map(t => (
          <li key={t} className="text-xs text-brand-charcoal/85 flex gap-1.5"><span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0" />{t}</li>
        ))}
      </ul>
    </div>
  );
}

function FacetRow({ f, headline, previous }: { f: ScaleDetailFacet; headline: { label: string; index: 0 | 2 }; previous?: readonly [number, number, number] }) {
  const n = f.counts[headline.index];
  return (
    <li className="grid grid-cols-[minmax(6rem,9rem)_1fr] sm:grid-cols-[9rem_1fr_auto] items-center gap-x-3 gap-y-1">
      <span className="text-xs font-semibold text-brand-forest">{f.name}</span>
      <Bar counts={f.counts} />
      <span className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:justify-end flex-wrap">
        <span className="text-[11px] text-brand-charcoal/60 whitespace-nowrap">
          {headline.label} {n}/{f.asked}
          {previous && <span className="text-brand-charcoal/40">（{PREVIOUS_LABEL} {previous[headline.index]}/{previous[0] + previous[1] + previous[2]}）</span>}
        </span>
        {f.plain && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${f.tone === null ? NEUTRAL_CHIP : TONE_CHIP[f.tone]}`}>{f.plain}</span>}
      </span>
    </li>
  );
}

function Focus({ f, kinds, mode }: { f: ScaleDetailFocus; kinds: readonly string[]; mode: 'next' | 'frequent' }) {
  const mid = f.items.filter(i => i.kind === 1).map(i => i.text);
  const worst = f.items.filter(i => i.kind === 2).map(i => i.text);
  return (
    <div className="rounded-2xl border border-brand-stone/60 bg-brand-cream/20 p-4 space-y-3 break-inside-avoid">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h5 className="text-sm font-extrabold text-brand-forest">{f.name}</h5>
        {f.plain && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${f.tone === null ? NEUTRAL_CHIP : TONE_CHIP[f.tone]}`}>{f.plain}</span>}
      </div>
      {f.what && <p className="text-xs text-brand-charcoal/75 leading-relaxed">{f.what}</p>}
      <div className="grid sm:grid-cols-3 gap-3">
        {mode === 'next' && <List label={STRENGTHS_LABEL} items={f.strengths} tone={KIND_TEXT[0]} />}
        {mode === 'frequent' && <List label={`${FREQUENT_START}（${kinds[2]}）`} items={worst} tone={KIND_TEXT[2]} />}
        <List label={`${kinds[1]}（${mid.length} 题）`} items={mid} tone={KIND_TEXT[1]} />
        {mode === 'next' && <List label={`${kinds[2]}（${worst.length} 题）`} items={worst} tone={KIND_TEXT[2]} />}
      </div>
      {f.next && (
        <div className="flex gap-2 items-start rounded-xl bg-white border border-brand-moss/20 p-3">
          <Target size={14} className="text-brand-clay mt-0.5 shrink-0" />
          <p className="text-xs text-brand-forest"><b>{NEXT_STEP_LABEL}：</b>「{f.next}」—— {NEXT_STEP_NOTE}</p>
        </div>
      )}
      {f.tips.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-brand-forest flex items-center gap-1"><Home size={12} /> {TIPS_LABEL}</div>
          <ul className="space-y-1">{f.tips.map(t => <li key={t} className="text-xs text-brand-charcoal/85 flex gap-1.5"><span className="text-brand-clay">·</span>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default function ScaleDetailCard({ entry }: { entry: ScaleDetailEntry }) {
  const d = entry.detail;
  // 每個面向那一條寫哪一個數：達成率、七級寫「已经会 / 自己做到」幾題，頻率族寫「常出现」幾題。
  const headline = d.mode === 'next' ? { label: d.kinds[0].label, index: 0 as const } : { label: d.kinds[2].label, index: 2 as const };
  const prevByKey = new Map((entry.previous?.facets ?? []).map(f => [f.key, f.counts] as const));
  return (
    <article className="bg-white rounded-2xl border border-brand-stone/60 shadow-sm p-5 space-y-5 break-inside-avoid" data-scale={d.code}>
      <div className="space-y-1">
        <h4 className="text-base font-extrabold text-brand-forest flex items-center gap-1.5">
          <ClipboardCheck size={16} className="text-brand-clay" /> {d.displayName}
        </h4>
        <p className="text-xs text-brand-charcoal/65">{d.oneLiner}这次回答了 {d.asked} 题。</p>
      </div>

      <div className="rounded-xl bg-brand-sage/10 border border-brand-moss/20 p-4 space-y-2">
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          {d.kinds.map((k, i) => (k.label ? (
            <span key={k.label} className={`px-2 py-0.5 rounded-full ${i === 0 ? 'bg-brand-moss text-white' : i === 1 ? 'bg-amber-100 text-amber-900' : 'bg-brand-stone/40 text-brand-charcoal'}`}>
              {k.label} {k.count} 题
            </span>
          ) : null))}
        </div>
        <p className="text-sm text-brand-charcoal leading-relaxed">{d.overall}</p>
      </div>

      {d.facets.length > 1 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-brand-charcoal/60 flex items-center gap-1"><ListChecks size={12} /> 各个方面</div>
          <ul className="space-y-2.5">
            {d.facets.map(f => <FacetRow key={f.key} f={f} headline={headline} previous={prevByKey.get(f.key)} />)}
          </ul>
          <div className="flex gap-3 text-[10px] text-brand-charcoal/50 pt-1 flex-wrap">
            {d.kinds.map((k, i) => (k.label ? <span key={k.label} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm ${KIND_BAR[i]}`} />{k.label}</span> : null))}
          </div>
        </div>
      )}

      {d.focus.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-brand-charcoal/60">{FOCUS_TITLE[d.mode]}</div>
          {d.focus.map(f => <Focus key={f.key} f={f} kinds={d.kinds.map(k => k.label)} mode={d.mode} />)}
        </div>
      )}
    </article>
  );
}
