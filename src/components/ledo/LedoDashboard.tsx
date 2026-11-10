import type { ReactNode } from 'react';
import type { DimensionScore } from '../../types';
import { DIMENSIONS_DATA } from '../../data';
import { PRODUCT } from '../../productConfig';
import { STATUS_WORDING } from '../../utils/statusWording';
import { Avatar, Chip, Greeting, LEDO_ART, ListRow, SectionHead, STATUS_TONE, TONE, Tile, greetingFor } from './ui';
import { WORDING_1022 } from '../../wording1022';
import { useDesktopLayout } from '../../desktop/useDesktopLayout';

/**
 * Ledo 版評估面板（設計稿第 3 頁）：打招呼、大小不一的色塊（插畫卡＋兩個數字）、
 * 九個方面分成「先看这几项」與「发展稳定」兩段清單。舊版的長說明不放（T1 作答頁開頭自己有）。
 *
 * 點一個方面做的事與舊版 `DimensionGrid` 一樣（`onSelectDimension`），只換畫法。
 */

interface Props {
  childName: string;
  completedScores: DimensionScore[];
  onSelectDimension: (dimensionId: string) => void;
  onViewReport: () => void;
  onStartT1Screening: () => void;
  /** 1022：孩子不在 T1 範圍內時，T1 那張卡換成這張紅燈卡（issue #82）。 */
  t1Blocked?: ReactNode;
  /** 1022（簡報 11/03 第 16–17 頁）：點紅、黃的方面（或紅黃按鈕）到報告上的 T2 購買區。沒給就照舊 `onSelectDimension`。 */
  onOpenT2?: () => void;
  /** 做過 T2、判定照 T2 的方面（`src/t2/t2Verdicts.ts`）：九宮格那一格多一行「按深度评估」，看得出不是 T1 的結果。 */
  t2Dimensions?: Readonly<Record<string, unknown>>;
}

function doneDate(scores: DimensionScore[]): string | null {
  const t = scores.map(s => Date.parse(s.completedAt)).filter(n => !Number.isNaN(n));
  if (t.length === 0) return null;
  const d = new Date(Math.max(...t));
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export default function LedoDashboard({ childName, completedScores, onSelectDimension, onViewReport, onStartT1Screening, t1Blocked, onOpenT2, t2Dimensions }: Props) {
  const t1 = completedScores.filter(s => s.tierId === 'T1');
  const done = t1.length > 0;
  const byId = new Map(t1.map(s => [s.dimensionId, s]));
  const dims = DIMENSIONS_DATA.map(d => ({ d, s: byId.get(d.id) }));
  // 需要支持的排前面：較多支持先、少量支持後（同報告的先後）。
  const flagged = dims
    .filter(x => x.s && x.s.status !== 'normal')
    .sort((a, b) => (a.s!.status === 'delay' ? 0 : 1) - (b.s!.status === 'delay' ? 0 : 1));
  const stable = dims.filter(x => x.s?.status === 'normal');
  const count = (st: DimensionScore['status']) => t1.filter(s => s.status === st).length;
  const date = doneDate(t1);
  const ui1022 = PRODUCT.features.ui1022;
  // 電腦版側欄工作台（VITE_DESKTOP_LAYOUT、≥ 1024px）：同一組區塊排成兩欄；關著時 class 一字不差。
  const desk = useDesktopLayout();

  // 1022 做完 T1（簡報 11/03 第 16–17 頁，使用者 2026-11-06）：由上而下 ①紅／黃／綠三顆，各顯示幾項
  // ②九宮格（主要內容，「评估细项概要」）③T1 卡與「重新评估」。底色由藍改灰；紅、黃點了到 T2 購買區，綠的不能點。
  if (done && ui1022 && !t1Blocked) {
    const openFlagged = (id: string) => (onOpenT2 ? onOpenT2() : onSelectDimension(id));
    const firstOf = (st: DimensionScore['status']) => dims.find(x => x.s?.status === st)?.d.id;
    const buttons: Array<{ st: DimensionScore['status']; tone: 'more' | 'mild' | 'ok' }> = [
      { st: 'delay', tone: 'more' },
      { st: 'borderline', tone: 'mild' },
      { st: 'normal', tone: 'ok' },
    ];
    const greeting = <Greeting small={`${childName}的家长，${greetingFor(new Date())}`} title={WORDING_1022.dashboard.panelTitle(childName)} />;
    const statusButtons = (
        <div id="ledo-status-buttons" className={desk ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-3 gap-2'}>
          {buttons.map(({ st, tone }) => {
            const n = count(st);
            const clickable = st !== 'normal' && n > 0;
            const first = firstOf(st);
            return (
              <button
                key={st}
                type="button"
                id={`ledo-status-${tone}`}
                disabled={!clickable}
                onClick={clickable && first ? () => openFlagged(first) : undefined}
                className={desk
                  ? `flex min-w-0 items-center gap-4 rounded-3xl px-5 py-4 text-left ${TONE[tone].bg} ${TONE[tone].ink} ${clickable ? 'cursor-pointer hover:brightness-[0.97]' : 'cursor-default'}`
                  : `flex min-w-0 flex-col items-start gap-0.5 rounded-3xl p-3 text-left ${TONE[tone].bg} ${TONE[tone].ink} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={desk ? 'text-[34px] font-black leading-none tabular-nums' : 'text-[26px] font-black leading-tight tabular-nums'}>{n}</span>
                <span className={desk ? 'text-sm font-bold leading-snug' : 'text-xs font-bold leading-snug'}>{STATUS_WORDING[st].label}</span>
              </button>
            );
          })}
        </div>
    );

    const detail = (
        <section id="ledo-detail-block" className={desk ? 'space-y-4 rounded-[32px] bg-white p-6 shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)]' : 'space-y-2.5 rounded-[28px] bg-ledo-field p-3'}>
          <h3 className={desk ? 'text-base font-black text-ledo-ink' : 'px-1 text-sm font-black text-ledo-ink'}>{WORDING_1022.dashboard.gridTitle}</h3>
          <div id="ledo-dim-grid" className={desk ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-3 gap-2'}>
            {dims.map(({ d, s }) => {
              const tone = s ? TONE[STATUS_TONE[s.status] ?? 'ok'] : TONE.field;
              const flaggedDim = Boolean(s && s.status !== 'normal');
              return (
                <button
                  key={d.id}
                  type="button"
                  id={`ledo-dim-${d.id}`}
                  disabled={!flaggedDim}
                  onClick={flaggedDim ? () => openFlagged(d.id) : undefined}
                  className={desk
                    ? `flex min-h-[120px] min-w-0 flex-col items-start gap-1.5 rounded-3xl p-4 text-left ${tone.bg} ${flaggedDim ? 'cursor-pointer hover:brightness-[0.97]' : 'cursor-default'}`
                    : `flex min-w-0 flex-col items-start gap-1 rounded-2xl p-2.5 text-left ${tone.bg} ${flaggedDim ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <b className={desk ? 'break-words text-base font-black leading-snug text-ledo-ink' : 'break-words text-[13px] font-black leading-snug text-ledo-ink'}>{d.name}</b>
                  <span className={desk ? `text-sm font-bold leading-snug ${tone.ink}` : `text-xs font-bold leading-snug ${tone.ink}`}>{s ? STATUS_WORDING[s.status].label : '还没评估'}</span>
                  {s && t2Dimensions?.[d.id] !== undefined && (
                    <span className="text-xs leading-snug text-ledo-ink-2">按深度评估</span>
                  )}
                  {flaggedDim && (
                    <span className="mt-auto rounded-full bg-white px-2 py-0.5 text-xs font-black text-ledo-ink">{PRODUCT.dashboard.dimensionCardCta}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
    );

    const summary = (
        <div id="ledo-dash-summary" className={desk ? 'flex flex-wrap items-center gap-3 rounded-[28px] bg-white p-4 shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)] [&>button]:w-full' : 'flex items-center gap-3 rounded-[28px] bg-ledo-field p-3'}>
          <div className={desk ? 'h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ledo-field' : 'h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white'}>
            <img src={LEDO_ART.panel} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-sm font-black text-ledo-ink">{WORDING_1022.t1Name}</b>
            <span className="text-xs text-ledo-ink-2">{`${date ?? ''}完成 · ${t1.length}/${DIMENSIONS_DATA.length}`}</span>
          </div>
          <button type="button" id="ledo-start-t1" onClick={onStartT1Screening} className="shrink-0 rounded-full bg-ledo-accent px-4 py-2.5 text-sm font-black text-white cursor-pointer">
            重新评估
          </button>
        </div>
    );

    const viewReport = (
        <button type="button" id="ledo-view-report" onClick={onViewReport} className={desk ? 'w-full rounded-full bg-white py-3 text-sm font-black text-ledo-ink shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)] hover:bg-ledo-field cursor-pointer' : 'w-full rounded-full bg-ledo-field py-3 text-sm font-black text-ledo-ink cursor-pointer'}>
          查看报告
        </button>
    );

    if (desk) {
      // 電腦版：左邊九宮格（主要內容），右邊三種判定的數字、T1 卡與「查看报告」。
      return (
        <div id="ledo-dashboard" className="mx-auto w-full max-w-6xl space-y-5 text-left animate-fade-in">
          <div className="px-1">{greeting}</div>
          <div className="grid grid-cols-12 items-start gap-5">
            <div className="col-span-8 min-w-0">{detail}</div>
            <div className="col-span-4 flex min-w-0 flex-col gap-4">
              {statusButtons}
              {summary}
              {viewReport}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div id="ledo-dashboard" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
        {greeting}

        {statusButtons}

        {detail}

        {summary}

        {viewReport}
      </div>
    );
  }

  return (
    <div id="ledo-dashboard" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <Greeting
        small={`${childName}的家长，${greetingFor(new Date())}`}
        title={done ? `${childName}的 ${DIMENSIONS_DATA.length} 个方面` : ui1022 ? WORDING_1022.dashboard.startTitle : '先做一次 T1 综合评估'}
      />

      {t1Blocked ?? (
      <div id="ledo-dash-summary" className="grid grid-cols-2 gap-2.5">
        <div className={`flex flex-col gap-2 rounded-3xl bg-ledo-accent-soft p-3.5 text-ledo-accent-soft-ink ${done ? 'row-span-2' : 'col-span-2'}`}>
          <div className={`overflow-hidden rounded-2xl bg-white ${done ? 'aspect-square' : 'aspect-[3/2]'}`}>
            <img src={LEDO_ART.panel} alt="" className="h-full w-full object-cover" />
          </div>
          <b className="text-sm font-black text-ledo-ink">{ui1022 ? WORDING_1022.t1Name : 'T1 综合评估'}</b>
          {(done || PRODUCT.dashboard.stepTwoHint) && (
            <span className="text-xs">{done ? `${date ?? ''}完成 · ${t1.length}/${DIMENSIONS_DATA.length}` : PRODUCT.dashboard.stepTwoHint}</span>
          )}
          <button
            type="button"
            id="ledo-start-t1"
            onClick={onStartT1Screening}
            className="mt-auto rounded-full bg-ledo-accent px-3 py-2.5 text-sm font-black text-white cursor-pointer"
          >
            {done ? '重新评估' : '开始评估'}
          </button>
        </div>
        {done && (
          <>
            <Tile tone="ok" value={count('normal')} label={STATUS_WORDING.normal.label} />
            <Tile
              tone="more"
              value={count('delay')}
              label={STATUS_WORDING.delay.label}
              note={count('borderline') > 0 ? `另有 ${count('borderline')} 项${STATUS_WORDING.borderline.label}` : undefined}
            />
          </>
        )}
      </div>
      )}

      {done && !ui1022 && flagged.length > 0 && (
        <>
          <SectionHead title="先看这几项" action="生成 AI 报告" onAction={onViewReport} />
          <div className="space-y-2.5">
            {flagged.map(({ d, s }) => (
              <ListRow
                key={d.id}
                id={`ledo-dim-${d.id}`}
                avatar={<Avatar tone={STATUS_TONE[s!.status]} text={d.name.slice(0, 1)} />}
                title={d.name}
                sub={`T1 得分 ${s!.score}/${s!.maxScore} · ${STATUS_WORDING[s!.status].label}`}
                right={<Chip tone="white">{PRODUCT.dashboard.dimensionCardCta}</Chip>}
                onClick={() => onSelectDimension(d.id)}
              />
            ))}
          </div>
        </>
      )}

      {done && !ui1022 && stable.length > 0 && (
        <>
          <SectionHead title={STATUS_WORDING.normal.label} action={`${stable.length} 项`} />
          <div className="space-y-2.5">
            {stable.map(({ d, s }) => (
              <ListRow
                key={d.id}
                id={`ledo-dim-${d.id}`}
                avatar={<Avatar tone="ok" text={d.name.slice(0, 1)} />}
                title={d.name}
                sub={`T1 得分 ${s!.score}/${s!.maxScore}`}
                onClick={() => onSelectDimension(d.id)}
              />
            ))}
          </div>
        </>
      )}

      {done && !ui1022 && flagged.length === 0 && (
        <button type="button" onClick={onViewReport} className="w-full rounded-full bg-ledo-accent-soft py-3 text-sm font-black text-ledo-accent-soft-ink cursor-pointer">
          生成 AI 报告
        </button>
      )}

      {/* 1022（issue #85）：「会看哪些方面」那一長串不放。 */}
      {!done && !t1Blocked && !ui1022 && (
        <>
          <SectionHead title="会看哪些方面" action={`${DIMENSIONS_DATA.length} 项`} />
          <div className="space-y-2.5">
            {DIMENSIONS_DATA.map(d => (
              <ListRow key={d.id} avatar={<Avatar tone="field" text={d.name.slice(0, 1)} />} title={d.name} sub="还没评估" right={null} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
