import { useState, type KeyboardEvent } from 'react';
import { Share2 } from 'lucide-react';
import type { AssessmentStatus, DimensionScore } from '../types';
import { STATUS_WORDING } from '../utils/statusWording';
import {
  ABILITY_MAP_COPY, ABILITY_RING, abilityLinksFor, abilityName, linkSentences, type AbilityLinkView,
} from '../t1report/abilityLinks';
import { STATUS_HEX } from './ReportRealBlocks';
import { STATUS_CLASS } from './reportStatusClass';

/**
 * 「九大能力关联图」（新版 T1 報告，只在專案 A；取代腦區拓撲圖）。資料與句子在 `src/t1report/abilityLinks.ts`。
 *
 * 九個點照這個孩子的判定上色，十二條線是固定的關聯；兩端都被標記的線畫粗、上色。
 * 點一個能力：列出它的線與說明；點一條線：那一條的說明（兩端都被標記多一句）。
 * 點與線都是可以 Tab 到、Enter／空白鍵按的按鈕（`role="button"`＋`aria-label`）；說明區 `aria-live`。
 */

const W = 420;
const H = 310;
const CX = W / 2;
const CY = 158;
const R = 96;
const NODE_R = 17;
const GREY = '#d6d3d1';
const UNKNOWN = '#a8a29e';

type Selection = { kind: 'node'; id: string } | { kind: 'link'; key: string } | null;

function position(i: number) {
  const angle = (-90 + (360 / ABILITY_RING.length) * i) * (Math.PI / 180);
  return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle), cos: Math.cos(angle), sin: Math.sin(angle) };
}

const POS: Record<string, ReturnType<typeof position>> = Object.fromEntries(ABILITY_RING.map((id, i) => [id, position(i)]));

function onActivate(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };
}

export function AbilityLinksMap({ scores }: { scores: DimensionScore[] }) {
  const statusOf = (id: string): AssessmentStatus | undefined => scores.find(s => s.dimensionId === id)?.status;
  const links = abilityLinksFor(statusOf);
  const boldLinks = links.filter(l => l.bold);
  const [sel, setSel] = useState<Selection>(boldLinks[0] ? { kind: 'link', key: boldLinks[0].key } : null);

  const selectedLink = sel?.kind === 'link' ? links.find(l => l.key === sel.key) ?? null : null;
  const selectedNode = sel?.kind === 'node' ? sel.id : null;
  const active = (l: AbilityLinkView) =>
    sel === null || (selectedLink ? selectedLink.key === l.key : l.a === selectedNode || l.b === selectedNode);
  const nodeLinks = selectedNode ? links.filter(l => l.a === selectedNode || l.b === selectedNode) : [];
  const idOf = (s: NonNullable<Selection>) => (s.kind === 'node' ? `n:${s.id}` : `l:${s.key}`);
  /** 再點一次同一個就收起來。 */
  const toggle = (next: NonNullable<Selection>) => setSel(cur => (cur && idOf(cur) === idOf(next) ? null : next));

  const colorOf = (id: string) => {
    const s = statusOf(id);
    return s ? STATUS_HEX[s] : UNKNOWN;
  };
  const statusLabel = (id: string) => {
    const s = statusOf(id);
    return s ? STATUS_WORDING[s].label : '这次没有结果';
  };

  return (
    <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-3 text-left">
      <div className="border-b border-brand-cream pb-2.5">
        <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
          <Share2 size={15} className="text-brand-moss" />
          {ABILITY_MAP_COPY.title}
        </h3>
        <p className="text-[10px] text-brand-charcoal/50 mt-0.5">{ABILITY_MAP_COPY.subtitle}</p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-md mx-auto block select-none" aria-label={ABILITY_MAP_COPY.title}>
        {/* 線：淡灰在下、粗線在上；每一條另有一條透明的粗線當點擊範圍（手機手指點得到）。 */}
        {[...links].sort((x, y) => Number(x.bold) - Number(y.bold)).map(l => {
          const p = POS[l.a];
          const q = POS[l.b];
          const on = active(l);
          const label = `${abilityName(l.a)}和${abilityName(l.b)}的关联${l.bold ? '（两项都需要支持）' : ''}`;
          return (
            <g
              key={l.key}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selectedLink?.key === l.key}
              onClick={() => toggle({ kind: 'link', key: l.key })}
              onKeyDown={onActivate(() => toggle({ kind: 'link', key: l.key }))}
              className="cursor-pointer focus:outline-none"
            >
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth={16} />
              <line
                x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke={l.bold ? STATUS_HEX[l.tone] : GREY}
                strokeWidth={l.bold ? (selectedLink?.key === l.key ? 6 : 4.5) : selectedLink?.key === l.key ? 3 : 1.5}
                strokeLinecap="round"
                opacity={on ? 1 : 0.25}
              />
            </g>
          );
        })}

        {ABILITY_RING.map(id => {
          const p = POS[id];
          const name = abilityName(id);
          const anchor = p.cos > 0.3 ? 'start' : p.cos < -0.3 ? 'end' : 'middle';
          const lx = anchor === 'start' ? p.x + NODE_R + 6 : anchor === 'end' ? p.x - NODE_R - 6 : p.x;
          const ly = anchor === 'middle' ? (p.sin < 0 ? p.y - NODE_R - 8 : p.y + NODE_R + 18) : p.y + 5;
          const picked = selectedNode === id;
          const dim = sel !== null && !picked && !(selectedLink && (selectedLink.a === id || selectedLink.b === id))
            && !(selectedNode && nodeLinks.some(l => l.a === id || l.b === id));
          return (
            <g
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`${name}：${statusLabel(id)}`}
              aria-pressed={picked}
              onClick={() => toggle({ kind: 'node', id })}
              onKeyDown={onActivate(() => toggle({ kind: 'node', id }))}
              className="cursor-pointer focus:outline-none"
              opacity={dim ? 0.45 : 1}
            >
              <circle cx={p.x} cy={p.y} r={NODE_R + 6} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={NODE_R} fill="white" stroke={colorOf(id)} strokeWidth={picked ? 5 : 3.5} />
              <circle cx={p.x} cy={p.y} r={NODE_R - 7} fill={colorOf(id)} />
              <text x={lx} y={ly} textAnchor={anchor} fontSize="13" fontWeight="bold" fill="#2f3a2f">{name}</text>
            </g>
          );
        })}
      </svg>

      <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 text-[9px] text-brand-charcoal/60">
        {(['normal', 'borderline', 'delay'] as const).map(s => (
          <span key={s} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_HEX[s] }} /> {STATUS_WORDING[s].label}
          </span>
        ))}
      </div>

      <div aria-live="polite" className="rounded-xl bg-brand-cream/40 border border-brand-stone/50 p-3.5 text-[11px] text-brand-charcoal leading-relaxed space-y-1.5 min-h-[3rem]">
        {selectedLink ? (
          linkSentences(selectedLink).map((t, i) => (
            <p key={i} className={i === 0 ? 'font-semibold' : 'text-brand-forest'}>{t}</p>
          ))
        ) : selectedNode ? (
          <>
            <p className="font-semibold flex items-center gap-1.5 flex-wrap">
              {abilityName(selectedNode)}
              {statusOf(selectedNode) && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${STATUS_CLASS[statusOf(selectedNode)!]}`}>
                  {statusLabel(selectedNode)}
                </span>
              )}
            </p>
            <p className="text-brand-charcoal/70">{ABILITY_MAP_COPY.linksOf(abilityName(selectedNode))}</p>
            <ul className="space-y-1.5">
              {nodeLinks.map(l => (
                <li key={l.key}>
                  {linkSentences(l).map((t, i) => (
                    <p key={i} className={i === 0 ? '' : 'text-brand-forest font-semibold'}>{t}</p>
                  ))}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-brand-charcoal/60">{ABILITY_MAP_COPY.hint}</p>
        )}
      </div>
    </div>
  );
}
