import type { DimensionScore } from '../../types';
import { DIMENSIONS_DATA } from '../../data';
import { PRODUCT } from '../../productConfig';
import { STATUS_WORDING } from '../../utils/statusWording';
import { Avatar, Chip, Greeting, ListRow, SectionHead, STATUS_TONE, Tile, greetingFor } from './ui';

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
}

function doneDate(scores: DimensionScore[]): string | null {
  const t = scores.map(s => Date.parse(s.completedAt)).filter(n => !Number.isNaN(n));
  if (t.length === 0) return null;
  const d = new Date(Math.max(...t));
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export default function LedoDashboard({ childName, completedScores, onSelectDimension, onViewReport, onStartT1Screening }: Props) {
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

  return (
    <div id="ledo-dashboard" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <Greeting
        small={`${childName}的家长，${greetingFor(new Date())}`}
        title={done ? `${childName}的 ${DIMENSIONS_DATA.length} 个方面` : '先做一次 T1 综合评估'}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <div className={`flex flex-col gap-2 rounded-3xl bg-ledo-accent-soft p-3.5 text-ledo-accent-soft-ink ${done ? 'row-span-2' : 'col-span-2'}`}>
          <div className={`overflow-hidden rounded-2xl bg-white ${done ? 'aspect-square' : 'aspect-[3/2]'}`}>
            <img src="/ledo/panel.jpg" alt="" className="h-full w-full object-cover" />
          </div>
          <b className="text-sm font-black text-ledo-ink">T1 综合评估</b>
          <span className="text-xs">{done ? `${date ?? ''}完成 · ${t1.length}/${DIMENSIONS_DATA.length}` : PRODUCT.dashboard.stepTwoHint}</span>
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

      {done && flagged.length > 0 && (
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

      {done && stable.length > 0 && (
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

      {done && flagged.length === 0 && (
        <button type="button" onClick={onViewReport} className="w-full rounded-full bg-ledo-accent-soft py-3 text-sm font-black text-ledo-accent-soft-ink cursor-pointer">
          生成 AI 报告
        </button>
      )}

      {!done && (
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
