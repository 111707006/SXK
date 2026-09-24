/**
 * 示範片庫（Keep 規格 §3.9；K15）：蓋在報告上的一層，從報告入口的「示范片库」分頁與第 6 項入口點進來。
 *
 * 版面照樣品的 `LibraryScreen`（Keep 的「課程」列表）：篩選 → 兩欄卡片（封面、片長、編號、標題、適齡）
 * → 底下一句。樣品只有模組一、標題寫死「模组一 · 身体动一动」；這裡**依模組分組**，每組一個標題
 *（現在只有模組一），所以篩選放在最上面、組標題跟著組走。
 *
 * 【資料】
 * - 有哪幾支：`GET /api/t2/library`（有示範片的啟用活動、依編號排，伺服器挑的），與詳情的系列列共用
 *   同一次讀取（`useActivity.ts` 的 `useLibraryLoad`）。片庫是空的（片子還沒上架）時給一句話，不給空白。
 * - 本週／換著玩的標記、「適合{孩子名}現在」的月齡：每週活動那一份（`data.plan`；月齡是配對用的
 *   實足月齡 `ageMonth`）。讀不到每週活動時只剩「全部」、不標。
 * - 點了進詳情（`from: 'library'`）；片庫的活動也能打卡，算進本週次數、不算進 x/4（`practiceStats`）。
 *
 * 【沒搬的】樣品的封面圖與 mp4（封面用活動庫的 `posterUrl`；片庫只放封面、不載片，§6.3）、
 * 「每支十秒上下」（片長由資料來，每張卡自己寫）。
 */
import { useState } from 'react';
import { ListVideo, Loader2, Play } from 'lucide-react';
import {
  CLIP_STATE,
  LIBRARY,
  activityNo,
  libraryChips,
  libraryFootnote,
  librarySummary,
  moduleHeading,
} from '../../t2/trainingCopy';
import { useTraining } from './TrainingContext';
import { filterLibrary, fitsNow, groupByModule, libraryMark, type LibraryFilter } from './libraryData';
import { clipClock } from './trainingData';
import { useLibraryLoad } from './useActivity';
import { Cover, LightNav, Tag } from './ui';

function Note({ children }: { children: string }) {
  return <p className="mx-4 mt-8 text-[14px] text-brand-charcoal/70 leading-relaxed">{children}</p>;
}

export default function LibraryScreen() {
  const { data, nav, childName } = useTraining();
  const library = useLibraryLoad(true);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const plan = data.plan;
  const ageMonth = plan ? plan.ageMonth : null;

  let body;
  if (library.status === 'loading') {
    body = (
      <p className="mx-4 mt-8 flex items-center gap-2 text-[13px] text-brand-charcoal/60">
        <Loader2 size={14} className="animate-spin" />
        {LIBRARY.loading}
      </p>
    );
  } else if (library.status === 'error') {
    body = <Note>{LIBRARY.error}</Note>;
  } else if (library.entries.length === 0) {
    body = (
      <div className="mx-6 mt-12 flex flex-col items-center text-center" data-testid="library-empty">
        <ListVideo size={40} className="text-brand-moss" />
        <p className="mt-4 text-[14px] text-brand-charcoal/70 leading-relaxed">{LIBRARY.empty}</p>
      </div>
    );
  } else {
    const all = library.entries;
    const list = ageMonth === null ? all : filterLibrary(all, filter, ageMonth);
    const groups = groupByModule(list);
    const chips =
      ageMonth === null
        ? []
        : libraryChips(childName, {
            all: all.length,
            fit: filterLibrary(all, 'fit', ageMonth).length,
            later: filterLibrary(all, 'later', ageMonth).length,
          });
    body = (
      <>
        <p className="px-4 pt-1 text-[13px] text-brand-charcoal/55">{librarySummary(all.length)}</p>
        {chips.length > 0 && (
          <div className="mt-3 flex gap-2.5 overflow-x-auto training-no-scrollbar px-4" data-testid="library-filters">
            {chips.map(c => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                aria-pressed={filter === c.key}
                className={`shrink-0 h-9 px-4 rounded-full text-[14px] cursor-pointer ${
                  filter === c.key ? 'bg-brand-forest text-white' : 'border border-brand-stone text-brand-charcoal'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {groups.length === 0 && <Note>{LIBRARY.filterEmpty}</Note>}
        {groups.map(g => (
          <section key={g.moduleNo} className="mt-5" data-testid="library-module">
            <h2 className="px-4 text-[22px] font-black text-brand-forest">{moduleHeading(g.moduleNo)}</h2>
            <div className="mt-3 px-4 grid grid-cols-2 gap-x-3 gap-y-4">
              {g.entries.map(a => {
                const mark = libraryMark(a.id, plan);
                const fits = ageMonth !== null && fitsNow(a, ageMonth);
                const length = clipClock(a.videoSeconds);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => nav.openPage({ name: 'detail', id: a.id, from: 'library' })}
                    className="min-w-0 text-left cursor-pointer"
                  >
                    <Cover src={a.posterUrl} className="aspect-[4/3] rounded-md">
                      {!a.posterUrl && <Play size={34} aria-hidden="true" className="absolute inset-0 m-auto text-brand-moss/30" />}
                      <span className="absolute left-1.5 bottom-1.5 rounded bg-black/60 text-white text-[10px] px-1.5 py-px flex items-center gap-0.5 tabular-nums">
                        <Play size={9} fill="currentColor" />
                        {length || CLIP_STATE.badgeClip}
                      </span>
                      {mark && (
                        <span className="absolute left-1.5 top-1.5">
                          <Tag tone={mark === 'plan' ? 'hot' : 'custom'}>{mark === 'plan' ? LIBRARY.markPlan : LIBRARY.markSwap}</Tag>
                        </span>
                      )}
                    </Cover>
                    <p className="mt-1.5 text-[15px] font-bold text-brand-forest leading-snug">
                      <span className="tabular-nums text-brand-charcoal/35 mr-1 font-normal">{activityNo(a.id)}</span>
                      {a.title}
                    </p>
                    <p className={`text-[12px] ${fits ? 'text-brand-forest' : 'text-brand-charcoal/50'}`}>
                      {a.ageLabel}
                      {fits ? LIBRARY.fitsNow : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <p className="mt-7 px-4 text-[12px] text-brand-charcoal/50 leading-relaxed">{libraryFootnote(childName)}</p>
      </>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white" data-testid="training-library">
      <LightNav title={LIBRARY.title} onBack={nav.back} />
      <div className="flex-1 overflow-y-auto training-no-scrollbar pb-10">
        {body}
      </div>
    </div>
  );
}
