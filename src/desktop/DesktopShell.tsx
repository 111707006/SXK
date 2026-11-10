import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import type { NavItem } from '../components/ledo/LedoTabBar';
import type { DimensionScore } from '../types';
import { STATUS_WORDING } from '../utils/statusWording';
import { TONE } from '../components/ledo/ui';

/**
 * 電腦版「分屏导览」（原型 `prototypes/desktop-v2` 的版型 C，使用者 2026-11-10 選定）：
 * 上面一條頂欄（平台名稱、導覽、孩子按鈕），下面左邊 300px 的情境欄、右邊頁面內容。
 * 只在 `useDesktopWide()` 成立、而且有孩子檔案時畫（`App.tsx`）；1024px 以下的頁首、底欄一行不動。
 *
 * 導覽的去處、字、停用條件都是 `App.tsx` 的 `navItems`（與手機頁首同一份、同一組 id）；
 * 孩子按鈕與個人中心面板也是頁首那一份（`customerMenu`）。這裡只管擺在哪裡。
 */

/** 頂欄的寬度與左右邊距：主內容區用同一組，兩邊對齊。 */
export const DESKTOP_FRAME = 'mx-auto w-full max-w-[1360px] px-8';

/** 頂欄右邊的孩子按鈕（`customerMenu` 在頂欄裡用這組 class）。 */
export const DESKTOP_CHILD_BUTTON =
  'flex items-center gap-2 rounded-full border border-ledo-line bg-white px-3.5 py-2 text-sm font-extrabold text-ledo-ink transition hover:bg-ledo-field cursor-pointer select-none';

/** 頂欄裡的個人中心面板：從孩子按鈕往下、靠右開。 */
export const DESKTOP_CHILD_MENU = 'absolute right-0 top-full mt-3 w-[22rem]';

export function DesktopTopBar({
  title,
  badge,
  status,
  items,
  right,
}: {
  title: ReactNode;
  /** 合作公司徽章（#90），沒有就不畫 */
  badge?: ReactNode;
  /** 雲端同步中／同步失敗的小字 */
  status?: ReactNode;
  items: NavItem[];
  /** 右邊的孩子按鈕與個人中心 */
  right: ReactNode;
}) {
  return (
    <header id="desktop-topbar" className="sticky top-0 z-40 w-full border-b border-ledo-line bg-white">
      <div className={`${DESKTOP_FRAME} flex items-center gap-8`}>
        <div className="flex shrink-0 items-center gap-2 py-4">
          <h1 className="text-base font-black text-ledo-ink">{title}</h1>
          {badge}
          {status}
        </div>
        <nav aria-label="主导览" className="flex min-w-0 gap-6">
          {items.map(item => (
            <button
              key={item.key}
              id={item.id}
              type="button"
              disabled={item.disabled}
              onClick={item.onClick}
              aria-current={item.active ? 'page' : undefined}
              className={[
                'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-bold transition',
                item.active ? 'border-ledo-accent text-ledo-ink' : 'border-transparent text-ledo-ink-2 hover:text-ledo-ink',
                item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <item.icon size={16} strokeWidth={1.9} className="shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto shrink-0">{right}</div>
      </div>
    </header>
  );
}

/** 情境欄的「下一步」：由 `App.tsx` 照這位家長現有的資料決定（沒有就不畫）。 */
export interface DesktopNextStep {
  title: string;
  detail?: string;
  action: string;
  onClick: () => void;
}

/**
 * 左邊的情境欄：孩子、現在的狀況（這一次 T1 的三種判定各幾個方面）、下一步。
 * 只畫這位家長的資料；讀不到的那一塊不出現，不補預設值。
 */
export function DesktopContext({
  childName,
  childAge,
  childGender,
  scores,
  showStatus,
  next,
  onOpenStatus,
}: {
  childName: string;
  childAge: string;
  childGender: 'boy' | 'girl' | string;
  /** 這一次的 T1 判定（面板用的那一份，做過 T2 的方面照 T2） */
  scores: DimensionScore[];
  /** 頁面自己已經有三種判定的數字（首頁、評估面板）時不重複 */
  showStatus: boolean;
  next: DesktopNextStep | null;
  /** 點「需要支持」那兩列：同評估面板的紅、黃按鈕 */
  onOpenStatus?: () => void;
}) {
  const t1 = scores.filter(s => s.tierId === 'T1');
  const rows: Array<{ st: DimensionScore['status']; tone: 'more' | 'mild' | 'ok' }> = [
    { st: 'delay', tone: 'more' },
    { st: 'borderline', tone: 'mild' },
    { st: 'normal', tone: 'ok' },
  ];
  return (
    <aside id="desktop-context" className="sticky top-[88px] space-y-4 self-start text-left">
      <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ledo-accent-soft text-base font-black text-ledo-accent-soft-ink">
            {childName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <b className="block truncate text-base font-black text-ledo-ink">{childName}</b>
            <span className="text-xs text-ledo-ink-2">{childGender === 'boy' ? '男孩' : '女孩'} · {childAge}</span>
          </div>
        </div>
      </section>

      {showStatus && t1.length > 0 && (
        <section id="desktop-context-status" className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)]">
          <p className="text-xs font-bold text-ledo-ink-2">现在的状况</p>
          <div className="mt-3 space-y-2">
            {rows.map(({ st, tone }) => {
              const n = t1.filter(s => s.status === st).length;
              const clickable = st !== 'normal' && n > 0 && Boolean(onOpenStatus);
              const cls = `flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${TONE[tone].bg} ${TONE[tone].ink}`;
              const body = (
                <>
                  <span className="text-sm font-bold">{STATUS_WORDING[st].label}</span>
                  <span className="text-xl font-black tabular-nums">{n}</span>
                </>
              );
              return clickable ? (
                <button key={st} type="button" onClick={onOpenStatus} className={`${cls} cursor-pointer hover:brightness-[0.97]`}>{body}</button>
              ) : (
                <div key={st} className={cls}>{body}</div>
              );
            })}
          </div>
        </section>
      )}

      {next && (
        <button
          type="button"
          id="desktop-context-next"
          onClick={next.onClick}
          className="block w-full rounded-[28px] bg-ledo-bar p-5 text-left text-white transition hover:brightness-110 cursor-pointer"
        >
          <span className="text-xs font-bold text-white/60">下一步</span>
          <span className="mt-1 block text-lg font-black leading-snug">{next.title}</span>
          {next.detail && <span className="mt-1 block text-xs leading-relaxed text-white/75">{next.detail}</span>}
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-black">
            {next.action} <ArrowRight size={15} />
          </span>
        </button>
      )}
    </aside>
  );
}
