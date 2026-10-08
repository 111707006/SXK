import { ClipboardList, History, Sprout } from 'lucide-react';
import type { DimensionScore } from '../types';
import { STATUS_WORDING } from '../utils/statusWording';
import {
  ANSWER_LABEL, flaggedDimensions, itemsAnswered, screeningSeries, t1AnswersOf, type ScreeningPoint,
} from '../t1report/answers';
import type { T1DimensionNote } from '../t1report/shape';
import { STATUS_CLASS } from './reportStatusClass';

/**
 * 新版 T1 報告（`T1_REPORT_REAL`，只在專案 A）取代舊版三塊的畫面（`ReportBody.tsx` 看快照換版）：
 *
 * - `AnswersOverview` 取代四個儀表（`IntegrationGauges`，數字是模型照 45–98 填的）與同齡比較條
 *   （`PeerComparison`，「居同龄前 X%」沒有常模）：這個年齡題組做到了幾項、三種作答的分布、
 *   被標記的方面各一段說明與還不能／有時做得到的那幾題。
 * - `ScreeningHistory` 取代三條寫死的預測曲線（`PrognosisTrajectoryChart`，每個孩子一樣）：
 *   這位家長自己歷次報告的關注分。
 *
 * 這裡每一個數字都從 `src/t1report/answers.ts` 算，讀不到就不畫那一塊，不補數字。
 * 不跟其他孩子比、不預測：T1 沒有常模，也沒有依據說三個月後會怎樣。
 */

const STATUS_DOT: Record<string, string> = {
  normal: 'bg-emerald-500',
  borderline: 'bg-amber-500',
  delay: 'bg-rose-500',
};

const STATUS_HEX: Record<string, string> = {
  normal: '#10b981',
  borderline: '#f59e0b',
  delay: '#e11d48',
};

export function AnswersOverview({ scores, notes }: { scores: DimensionScore[]; notes: T1DimensionNote[] }) {
  const answers = t1AnswersOf(scores);
  const flagged = flaggedDimensions(answers);
  const counts = answers.counts;
  const noteOf = (id: string) => notes.find(n => n.dimensionId === id)?.note;
  const sum = answers.dimensions.reduce((a, d) => a + d.score, 0);
  const max = answers.dimensions.reduce((a, d) => a + d.maxScore, 0);
  if (answers.dimensions.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-4 text-left">
      <div className="border-b border-brand-cream pb-2.5">
        <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
          <ClipboardList size={15} className="text-brand-moss" />
          这次作答的样子
        </h3>
        <p className="text-[10px] text-brand-charcoal/50 mt-0.5">
          {answers.bandName ? `题目按孩子当时的年龄出题（${answers.bandName}）。` : ''}这里只看这一次的作答，不和其他孩子比较。
        </p>
      </div>

      {counts ? (
        <div className="space-y-2.5">
          <p className="text-sm font-extrabold text-brand-forest">
            这个年龄题组里，做到了 <span className="text-brand-moss text-base">{counts.can}</span> / {counts.total} 项
            {counts.partly > 0 && (
              <span className="text-[11px] font-semibold text-brand-charcoal/60">（另有 {counts.partly} 项有时・部分做得到）</span>
            )}
          </p>
          <div className="w-full h-4 rounded-full overflow-hidden flex border border-brand-stone/50" role="img"
            aria-label={`可以做到 ${counts.can} 题，有时・部分 ${counts.partly} 题，还不能 ${counts.notYet} 题`}>
            <div className="h-full bg-emerald-400" style={{ width: `${(counts.can / counts.total) * 100}%` }} />
            <div className="h-full bg-amber-300" style={{ width: `${(counts.partly / counts.total) * 100}%` }} />
            <div className="h-full bg-rose-300" style={{ width: `${(counts.notYet / counts.total) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-brand-charcoal/75 font-semibold">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />{ANSWER_LABEL[2]} {counts.can} 题</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-300" />{ANSWER_LABEL[1]} {counts.partly} 题</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-300" />{ANSWER_LABEL[0]} {counts.notYet} 题</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-extrabold text-brand-forest">
            {answers.dimensions.length} 个方面合计 <span className="text-brand-moss text-base">{sum}</span> / {max} 分
          </p>
          <p className="text-[10px] text-brand-charcoal/55">这份报告没有存下每一题的作答，所以这里只有合计分数。</p>
        </div>
      )}

      <div className="border-t border-brand-cream pt-3 space-y-3">
        <p className="text-xs font-extrabold text-brand-forest flex items-center gap-1.5">
          <Sprout size={14} className="text-brand-moss" />
          接下来可以多练的
        </p>
        {flagged.length === 0 ? (
          <p className="text-xs text-brand-charcoal/75 leading-relaxed">
            这次没有被标记的方面，每一题都做得到。下面的居家建议照常进行，三个月后再做一次筛查作为对照。
          </p>
        ) : (
          flagged.map(d => {
            const notYet = itemsAnswered(d, 0);
            const partly = itemsAnswered(d, 1);
            const note = noteOf(d.dimensionId);
            return (
              <div key={d.dimensionId} className="rounded-xl border border-brand-stone/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-brand-forest">{d.dimensionName}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${STATUS_CLASS[d.status]}`}>
                    {STATUS_WORDING[d.status].label}
                  </span>
                </div>
                {note && <p className="text-[11px] text-brand-charcoal leading-relaxed">{note}</p>}
                {(notYet.length > 0 || partly.length > 0) && (
                  <ul className="space-y-1">
                    {notYet.map(i => (
                      <li key={i.questionId} className="flex items-start gap-1.5 text-[11px] text-brand-charcoal/85">
                        <span className="shrink-0 mt-0.5 px-1.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-bold">{ANSWER_LABEL[0]}</span>
                        <span>{i.text}</span>
                      </li>
                    ))}
                    {partly.map(i => (
                      <li key={i.questionId} className="flex items-start gap-1.5 text-[11px] text-brand-charcoal/75">
                        <span className="shrink-0 mt-0.5 px-1.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold">{ANSWER_LABEL[1]}</span>
                        <span>{i.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[2])}/${Number(m[3])}` : '本次';
}

/** 一個維度的小折線：橫軸是歷次報告（由舊到新），縱軸是關注分 0–8（越高越建議多了解）。 */
function DimensionSpark({ name, points, id }: { name: string; points: ScreeningPoint[]; id: string }) {
  const W = 150, H = 54, padX = 10, padTop = 12, padBottom = 8;
  const n = points.length;
  const x = (i: number) => (n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1));
  // 關注分越高畫得越高（與雷達圖同一個方向：越凸出去越建議了解）。
  const y = (c: number) => padTop + (1 - c / 8) * (H - padTop - padBottom);
  const pts = points.map((p, i) => ({ i, v: p.dimensions[id] })).filter(p => p.v);
  const last = pts[pts.length - 1]?.v;
  return (
    <div className="rounded-xl border border-brand-stone/50 p-2.5">
      <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-brand-forest">
        <span className="truncate min-w-0">{name}</span>
        {last && <span className="shrink-0" style={{ color: STATUS_HEX[last.status] }}>关注分 {last.concern}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mt-1">
        <line x1={padX} y1={y(0)} x2={W - padX} y2={y(0)} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={padX} y1={y(8)} x2={W - padX} y2={y(8)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3" />
        {pts.length > 1 && (
          <polyline
            points={pts.map(p => `${x(p.i)},${y(p.v!.concern)}`).join(' ')}
            fill="none" stroke="#9ca3af" strokeWidth="1.5"
          />
        )}
        {pts.map(p => (
          <g key={p.i}>
            <circle cx={x(p.i)} cy={y(p.v!.concern)} r="3.5" fill={STATUS_HEX[p.v!.status] ?? STATUS_HEX.normal} stroke="white" strokeWidth="1.5" />
            <text x={x(p.i)} y={y(p.v!.concern) - 6} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#374151">{p.v!.concern}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ScreeningHistory({ history, current }: {
  history: unknown;
  current: { id?: string | null; createdAt?: string | null; scores: DimensionScore[] };
}) {
  const series = screeningSeries(history, current);
  const now = series[series.length - 1];
  const dims = t1AnswersOf(current.scores).dimensions;
  if (dims.length === 0) return null;
  const bands = new Set(series.map(p => p.bandName).filter(Boolean));

  return (
    <div className="bg-white rounded-2xl border border-brand-stone/70 p-5 shadow-sm space-y-3 text-left">
      <div className="border-b border-brand-cream pb-2.5">
        <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
          <History size={15} className="text-brand-moss" />
          历次筛查对照
        </h3>
        <p className="text-[10px] text-brand-charcoal/50 mt-0.5">
          每一点是一次报告里该方面的「关注分」（0–8，越高越建议进一步了解），只画您自己做过的筛查。
        </p>
      </div>

      {series.length > 1 && (
        <div className="flex flex-wrap gap-1.5 text-[10px] text-brand-charcoal/70 font-semibold">
          {series.map((p, i) => (
            <span key={p.id + i} className="px-2 py-0.5 rounded-full bg-brand-cream/60 border border-brand-stone/40">
              第 {i + 1} 次 · {p === now ? '本次' : shortDate(p.createdAt)}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {dims.map(d => <DimensionSpark key={d.dimensionId} id={d.dimensionId} name={d.dimensionName} points={series} />)}
      </div>

      {series.length === 1 ? (
        <p className="text-xs text-brand-charcoal/80 leading-relaxed font-semibold">
          这是第一次报告，图上只有这一次的点。三个月后再做一次，就能看到变化。
        </p>
      ) : bands.size > 1 ? (
        <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">
          这几次之间孩子跨了年龄段，前后的题目不同，对照时请以同一段的几次为主。
        </p>
      ) : null}

      <div className="flex justify-center gap-4 text-[9px] text-brand-charcoal/60">
        {(['normal', 'borderline', 'delay'] as const).map(s => (
          <span key={s} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`} /> {STATUS_WORDING[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}
