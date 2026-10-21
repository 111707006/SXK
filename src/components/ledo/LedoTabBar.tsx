import type { LucideIcon } from 'lucide-react';

/** 導覽列的一個去處（`App.tsx` 的 `navItems`：頁首那一排與這條底欄共用）。 */
export interface NavItem {
  key: string;
  /** 頁首那一顆的 DOM id（既有的測試與捲動靠它找）；底欄另加 `-tab` 後綴，不撞。 */
  id: string;
  /** 頁首的字 */
  label: string;
  /** 底欄的字（五顆擠在一條上，要短） */
  short: string;
  icon: LucideIcon;
  active: boolean;
  /** `undefined`＝這一顆不會被停用（不是「目前沒停用」） */
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Ledo 版手機的底欄（設計稿每頁底下那條深色膠囊）。只在 `lg` 以下出現；桌機照舊用頁首那一排。
 * 停用的那幾顆（還沒做過篩查時的報告、線上干預）照樣畫出來、淡一點，跟頁首一樣。
 */
export default function LedoTabBar({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="导览"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto flex h-16 max-w-md items-center justify-around rounded-[26px] bg-ledo-bar px-1 shadow-[0_12px_30px_-12px_rgba(18,23,20,0.6)]">
        {items.map(item => (
          <button
            key={item.key}
            id={`${item.id}-tab`}
            type="button"
            disabled={item.disabled}
            onClick={item.onClick}
            aria-current={item.active ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[12px] font-bold leading-none transition ${
              item.active ? 'text-white' : 'text-white/55'
            } ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className={`grid h-8 w-12 place-items-center rounded-full ${item.active ? 'bg-white/15' : ''}`}>
              <item.icon size={19} strokeWidth={1.9} />
            </span>
            <span className="whitespace-nowrap">{item.short}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
