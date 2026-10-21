import type { ReactNode } from 'react';
import { ChevronRight, Play } from 'lucide-react';
import type { AssessmentStatus } from '../../types';

/**
 * Ledo 版的幾個共用畫法（設計稿 `.hi`、`.rowh`、`.tile`、`.it`、`.cb`、`.pl`、`.chip`）。
 * 只管長相；字與資料由呼叫端給。舊版不用這一檔。
 */

/** 判定三色（ok／mild／more）＋鋼藍、薰衣草、淺灰：色塊與頭像底色。 */
export type Tone = 'ok' | 'mild' | 'more' | 'acc' | 'lav' | 'field';

export const TONE: Record<Tone, { bg: string; ink: string }> = {
  ok: { bg: 'bg-ledo-ok', ink: 'text-ledo-ok-ink' },
  mild: { bg: 'bg-ledo-mild', ink: 'text-ledo-mild-ink' },
  more: { bg: 'bg-ledo-more', ink: 'text-ledo-more-ink' },
  acc: { bg: 'bg-ledo-accent-soft', ink: 'text-ledo-accent-soft-ink' },
  lav: { bg: 'bg-ledo-lav', ink: 'text-ledo-lav-ink' },
  field: { bg: 'bg-ledo-field', ink: 'text-ledo-ink-2' },
};

/** 判定 → 色調（三色與報告、九宮格同一套）。 */
export const STATUS_TONE: Record<AssessmentStatus, Tone> = { normal: 'ok', borderline: 'mild', delay: 'more' };

/** 打招呼標題：上一行小字、下一行大字。 */
export function Greeting({ small, title, right }: { small: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-ledo-ink-2">{small}</p>
        <h2 className="text-[22px] font-black leading-snug text-ledo-ink text-balance">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/** 一段的標題列：左粗字、右珊瑚色小連結（可省）。 */
export function SectionHead({ title, action, onAction }: { title: ReactNode; action?: ReactNode; onAction?: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[15px] font-black text-ledo-ink">{title}</h3>
      {action && (onAction ? (
        <button type="button" onClick={onAction} className="whitespace-nowrap text-xs font-bold text-ledo-coral-ink cursor-pointer">{action}</button>
      ) : (
        <span className="whitespace-nowrap text-xs text-ledo-ink-2">{action}</span>
      ))}
    </div>
  );
}

/** 粉彩數字色塊。 */
export function Tile({ tone, value, label, note, className = '', children }: {
  tone: Tone; value?: ReactNode; label: ReactNode; note?: ReactNode; className?: string; children?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-3xl p-3.5 ${t.bg} ${t.ink} ${className}`}>
      {value !== undefined && <span className="text-[28px] font-black leading-tight tabular-nums">{value}</span>}
      <span className="text-xs font-bold">{label}</span>
      {note && <span className="text-xs opacity-90">{note}</span>}
      {children}
    </div>
  );
}

/** 清單行左邊的方形頭像：一個字或一張圖。 */
export function Avatar({ tone = 'acc', text, img }: { tone?: Tone; text?: ReactNode; img?: string }) {
  const t = TONE[tone];
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-sm font-black ${img ? 'bg-ledo-accent-soft' : `${t.bg} ${t.ink}`}`}>
      {img ? <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : text}
    </span>
  );
}

/** 右邊的圓鈕（往下一頁）。 */
export function RoundArrow() {
  return (
    <span aria-hidden="true" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-ledo-line bg-white text-ledo-ink">
      <ChevronRight size={14} strokeWidth={2.4} />
    </span>
  );
}

/** 鋼藍播放鈕。 */
export function PlayButton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'h-9 w-9 rounded-xl' : size === 'lg' ? 'h-[60px] w-[60px] rounded-[20px]' : 'h-[46px] w-[46px] rounded-2xl';
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-ledo-accent text-white shadow-[0_10px_20px_-10px_#47779E] ${box}`}>
      <Play size={size === 'lg' ? 20 : 15} fill="currentColor" strokeWidth={0} />
    </span>
  );
}

/** 一行一項：頭像、標題＋小字、右邊的東西（預設圓鈕）。給了 `onClick` 整行是一顆按鈕。 */
export function ListRow({ avatar, title, sub, right, onClick, id, disabled }: {
  avatar: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; id?: string; disabled?: boolean;
}) {
  const body = (
    <>
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <b className="text-sm font-bold text-ledo-ink">{title}</b>
        {sub && <small className="text-xs text-ledo-ink-2">{sub}</small>}
      </span>
      {right === undefined ? <RoundArrow /> : right}
    </>
  );
  return onClick ? (
    <button type="button" id={id} onClick={onClick} disabled={disabled}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl text-left transition active:scale-[0.99] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
      {body}
    </button>
  ) : (
    <div id={id} className="flex min-w-0 items-center gap-3">{body}</div>
  );
}

/** 小膠囊。 */
export function Chip({ tone = 'acc', on = false, children }: { tone?: Tone | 'white'; on?: boolean; children: ReactNode }) {
  const cls = on
    ? 'bg-ledo-accent text-white'
    : tone === 'white'
      ? 'bg-white text-ledo-ink'
      : `${TONE[tone].bg} ${TONE[tone].ink}`;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-[5px] text-xs font-bold ${cls}`}>{children}</span>;
}

/** 早上好／下午好／晚上好（看家長手機的時間）。 */
export function greetingFor(now: Date): string {
  const h = now.getHours();
  return h < 11 ? '早上好' : h < 18 ? '下午好' : '晚上好';
}
