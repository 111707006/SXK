/**
 * 詳情頁的四個抽屜（Keep 規格 §3.8，票 7）：動作列表、要準備、跟練方式、投屏。加到日曆在
 * `ReminderSheet.tsx`，问专家在 `ExpertSheet.tsx`（票 6）。
 *
 * 每個抽屜都是堆疊裡的一層（`SheetState`），關掉＝`nav.back()`，與返回鍵同一個出口。版面照樣品的
 * `ActionsSheet`、`EquipSheet`、`ModeSheet`、`CastSheet`；只做樣式 A，樣品裡 B（章節，點一步從那裡播）、
 * C（倒數、準備 5 秒）的分支不搬。活動內容經 `useActivity` 讀（與詳情同一份，不重讀）。
 */
import { useState, type ReactNode } from 'react';
import { Cast, CircleCheck, Loader2, MapPin, Package, ShieldCheck, Users } from 'lucide-react';
import { GUIDE_PREP_KEYS } from '../../t2/types';
import { ACTIONS_SHEET, CAST_SHEET, DETAIL, EQUIP_SHEET, MODE_SHEET, stepNo, splitMinutes } from '../../t2/trainingCopy';
import { browserStorage, followModeFor, readFollowMode, writeFollowMode, type FollowMode } from './followMode';
import type { DetailSource } from './layerStack';
import { useTraining } from './TrainingContext';
import { clipClock, hasClip } from './trainingData';
import { useActivity, type ActivityLoad } from './useActivity';
import { Sheet, StepImage } from './ui';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[18px] font-bold text-brand-forest">
      <span className="w-1 h-5 rounded bg-brand-moss" />
      {children}
    </h3>
  );
}

/** 活動還在讀、或讀不到時抽屜裡的一句話（通常讀過了：詳情先讀的）。 */
function NotReady({ load }: { load: ActivityLoad }) {
  return (
    <p className="pr-12 text-[14px] text-brand-charcoal/70 flex items-center gap-2">
      {load.status === 'loading' && <Loader2 size={16} className="animate-spin shrink-0" />}
      {load.status === 'loading' ? DETAIL.loading : load.status === 'missing' ? DETAIL.notFound : DETAIL.error}
    </p>
  );
}

// ── 動作列表 ─────────────────────────────────────────────────────────────

export function ActionsSheet({ id, from }: { id: string; from: DetailSource }) {
  const { nav } = useTraining();
  const load = useActivity(id);
  if (load.status !== 'ready') {
    return (
      <Sheet onClose={nav.back} tall>
        <NotReady load={load} />
      </Sheet>
    );
  }
  const a = load.activity;
  const clip = hasClip(a);
  const guide = a.guide;
  const length = guide ? splitMinutes(guide.length) : null;
  const clock = clip ? clipClock(a.videoSeconds) : '';
  const shots = guide?.shots.filter(s => s.say) ?? [];
  // 抽屜換成播放器（不是先關抽屜再推一層：兩個歷史動作疊在一起，瀏覽器不保證順序）
  const go = () => nav.replacePage({ name: 'go', id: a.id, from, mode: followModeFor(readFollowMode(), clip) });

  return (
    <Sheet onClose={nav.back} tall>
      <div data-testid="sheet-actions">
        <h2 className="text-[30px] font-black text-brand-forest">{ACTIONS_SHEET.title}</h2>
        <p className="mt-3 text-[16px] text-brand-forest">
          <b className="tabular-nums">{a.steps.length}</b> <span className="text-brand-charcoal/60">{ACTIONS_SHEET.steps}</span>
        </p>
        {(length || clock) && (
          <p className="mt-2 text-[16px] text-brand-forest flex flex-wrap gap-x-4 gap-y-1">
            {length && (
              <span>
                <b className="tabular-nums">{length.big}</b> <span className="text-brand-charcoal/60">{length.unit}</span>
              </span>
            )}
            {clock && (
              <span>
                <b className="tabular-nums">{clock}</b> <span className="text-brand-charcoal/60">{ACTIONS_SHEET.clip}</span>
              </span>
            )}
          </p>
        )}
        <p className="mt-4 text-[14px] leading-relaxed text-brand-charcoal/60">{clip ? ACTIONS_SHEET.noteClip : ACTIONS_SHEET.noteNoClip}</p>

        {a.steps.length > 0 && (
          <div className="mt-7">
            <SectionTitle>{ACTIONS_SHEET.playTitle}</SectionTitle>
            <ol className="relative mt-3">
              <span className="absolute left-[11px] top-2 bottom-2 w-px bg-brand-stone" />
              {a.steps.map((s, i) => (
                <li key={`${a.id}-${i}`} className="relative flex gap-4 pl-8 py-2">
                  <span className="absolute left-[8px] top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full bg-brand-stone" />
                  <StepImage src={s.imageUrl} n={i + 1} className="w-[104px] h-[72px] rounded-lg shrink-0" />
                  <div className="pt-0.5 min-w-0">
                    <p className="text-[16px] font-bold text-brand-forest leading-snug">{s.instruction}</p>
                    <p className="mt-1.5 text-[14px] text-brand-charcoal/55">{stepNo(i + 1)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {shots.length > 0 && (
          <div className="mt-7" data-testid="sheet-actions-say">
            <SectionTitle>{ACTIONS_SHEET.sayTitle}</SectionTitle>
            <p className="mt-2 text-[13px] text-brand-charcoal/55">{ACTIONS_SHEET.saySub}</p>
            <ol className="mt-3 space-y-2.5">
              {shots.map((shot, i) => (
                <li key={`${i}-${shot.name}`} className="rounded-xl bg-brand-sage px-3.5 py-3">
                  <p className="text-[12px] font-bold text-brand-moss">{shot.name}</p>
                  <p className="mt-1 text-[15px] text-brand-charcoal leading-snug">「{shot.say}」</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(a.easier || a.harder) && (
          <div className="mt-7 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-brand-sage p-3">
              <p className="text-[13px] font-bold text-brand-forest">{ACTIONS_SHEET.easier}</p>
              <p className="mt-1 text-[13px] text-brand-charcoal/80 leading-relaxed">{a.easier}</p>
            </div>
            <div className="rounded-xl bg-brand-sand p-3">
              <p className="text-[13px] font-bold text-brand-forest">{ACTIONS_SHEET.harder}</p>
              <p className="mt-1 text-[13px] text-brand-charcoal/80 leading-relaxed">{a.harder}</p>
            </div>
          </div>
        )}

        <button type="button" onClick={go} className="mt-8 w-full h-12 rounded-full bg-brand-forest text-white font-bold text-[16px] cursor-pointer">
          {ACTIONS_SHEET.go}
        </button>
      </div>
    </Sheet>
  );
}

// ── 要準備 ───────────────────────────────────────────────────────────────

/** 腳本「準備」四項的圖示，照 `GUIDE_PREP_KEYS` 的順序（场地、器材、安全检查、大人位置）。 */
const PREP_ICONS: ReactNode[] = [
  <MapPin key="p" size={20} className="text-brand-moss shrink-0 mt-0.5" />,
  <Package key="e" size={20} className="text-brand-moss shrink-0 mt-0.5" />,
  <ShieldCheck key="s" size={20} className="text-brand-clay shrink-0 mt-0.5" />,
  <Users key="a" size={20} className="text-brand-moss shrink-0 mt-0.5" />,
];

function PrepRow({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-brand-cream p-3">
      {icon}
      <div>
        <p className="text-[15px] font-bold text-brand-forest">{label}</p>
        <p className="mt-0.5 text-[13px] text-brand-charcoal/75 leading-relaxed">{text}</p>
      </div>
    </li>
  );
}

export function EquipSheet({ id }: { id: string }) {
  const { nav } = useTraining();
  const load = useActivity(id);
  if (load.status !== 'ready') {
    return (
      <Sheet onClose={nav.back}>
        <NotReady load={load} />
      </Sheet>
    );
  }
  const a = load.activity;
  const need = a.need || a.equipment.join('、');
  const prep = a.guide ? GUIDE_PREP_KEYS.flatMap((key, i) => (a.guide?.prep[key] ? [{ key, i, text: a.guide.prep[key] as string }] : [])) : [];
  return (
    <Sheet onClose={nav.back}>
      <div data-testid="sheet-equip">
        <h2 className="text-[24px] font-black text-brand-forest">{EQUIP_SHEET.title}</h2>
        <p className="mt-1.5 pr-12 text-[14px] text-brand-charcoal/60">{a.title}</p>
        <ul className="mt-4 space-y-2.5">
          {need && <PrepRow icon={PREP_ICONS[1]} label={EQUIP_SHEET.need} text={need} />}
          {prep.map(p => (
            <PrepRow key={p.key} icon={PREP_ICONS[p.i]} label={p.key} text={p.text} />
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

// ── 跟練方式 ─────────────────────────────────────────────────────────────

export function ModeSheet({ id }: { id: string }) {
  const { nav } = useTraining();
  const load = useActivity(id);
  const [chosen, setChosen] = useState<FollowMode>(() => readFollowMode());
  const clip = load.status === 'ready' && hasClip(load.activity);
  const current = followModeFor(chosen, clip);
  const options: Array<{ key: FollowMode; title: string; note: string; disabled: boolean }> = [
    { key: 'video', title: MODE_SHEET.video, note: clip ? MODE_SHEET.videoNote : MODE_SHEET.videoNoClip, disabled: !clip },
    { key: 'pictures', title: MODE_SHEET.pictures, note: MODE_SHEET.picturesNote, disabled: false },
  ];
  const pick = (mode: FollowMode) => {
    setChosen(mode);
    // 寫不進去（隱私模式、微信的一些設定）也照樣關：這一次按 GO 用畫面上選的，只是下次不記得
    writeFollowMode(browserStorage, mode);
    nav.back();
  };
  return (
    <Sheet onClose={nav.back}>
      <div data-testid="sheet-mode">
        <h2 className="text-[24px] font-black text-brand-forest">{MODE_SHEET.title}</h2>
        <p className="mt-1.5 text-[13px] text-brand-charcoal/55">{MODE_SHEET.savedHere}</p>
        <div className="mt-4 space-y-2.5">
          {options.map(o => (
            <button
              key={o.key}
              type="button"
              disabled={o.disabled}
              aria-pressed={current === o.key}
              onClick={() => pick(o.key)}
              className={`w-full rounded-xl border p-3.5 text-left flex items-start gap-3 disabled:opacity-40 cursor-pointer disabled:cursor-default ${
                current === o.key ? 'border-brand-moss bg-brand-sage' : 'border-brand-stone'
              }`}
            >
              <CircleCheck size={20} className={current === o.key ? 'text-brand-forest' : 'text-brand-stone'} />
              <span>
                <span className="block text-[15px] font-bold text-brand-forest">{o.title}</span>
                <span className="block mt-0.5 text-[13px] text-brand-charcoal/60">{o.note}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

// ── 投屏說明 ─────────────────────────────────────────────────────────────

/** 瀏覽器叫不出投屏（`tryNativeCast` 回 false）時開的說明。 */
export function CastSheet({ hasVideo }: { hasVideo: boolean }) {
  const { nav } = useTraining();
  return (
    <Sheet onClose={nav.back}>
      <div data-testid="sheet-cast">
        <h2 className="text-[24px] font-black text-brand-forest flex items-center gap-2">
          <Cast size={24} />
          {CAST_SHEET.title}
        </h2>
        <p className="mt-2 text-[14px] text-brand-charcoal/60 leading-relaxed">{hasVideo ? CAST_SHEET.leadClip : CAST_SHEET.leadNoClip}</p>
        <ul className="mt-4 space-y-3 text-[14px] text-brand-charcoal leading-relaxed">
          {CAST_SHEET.ways.map(w => (
            <li key={w.who}>
              <b className="text-brand-forest">{w.who}</b>
              {w.how}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
