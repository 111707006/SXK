import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  BirthDateSelection,
  birthDateToSelection,
  birthDateWindow,
  clampSelection,
  dayOptions,
  monthOptions,
  selectionToBirthDate,
  yearOptions,
} from '../utils/birthDateOptions';

/**
 * 出生日期：年／月／日三個原生下拉。
 *
 * 【為什麼不是 `<input type="date">`】那個控制項在 iPad Safari 上叫出的是系統
 * 繪製的浮層，位置與尺寸我們控制不了。客戶影片裡家長點開年月滾輪之後，滾輪把
 * 整張表單蓋住，「保存修改」按鈕壓在它底下，連點十秒都關不掉。不跟原生控制項
 * 對打 —— 換掉它。`<select>` 展開的清單貼著控制項本身，表單全程可見。
 *
 * 【為什麼這裡幾乎沒有邏輯】選項生成與夾值全在 `utils/birthDateOptions`：專案
 * 沒有 jsdom，留在 JSX 裡的分支一行都測不到。
 *
 * 快捷登記表單與修改檔案彈窗共用這一個元件，兩邊只差在尺寸。
 */

interface BirthDateSelectProps {
  /** 目前的出生日期（`YYYY-MM-DD`）。空字串代表還沒選完，或這份檔案還沒有出生日期。 */
  value: string;
  onChange: (birthDate: string) => void;
  /** 「今天」。由呼叫端傳進來，畫面上的年齡與這裡的選項才是同一個時鐘。 */
  today: Date;
  /**
   * 檔案上**已經存下來**的出生日期。孩子滿 15 歲之後它會超出適用範圍，
   * 此時可選區間為它往外讓一步，家長改個名字才不會把孩子的生日弄丟。
   */
  storedBirthDate?: string;
  /** `md` 給快捷登記表單，`sm` 給彈窗。 */
  size?: 'md' | 'sm';
  idPrefix?: string;
}

// 字級 16px 以上，iOS Safari 聚焦時才不會把整頁放大。
const FIELD_SIZE = {
  md: { field: 'pl-3 pr-8 py-3 rounded-2xl text-base', chevron: 14 },
  sm: { field: 'pl-2.5 pr-7 py-2.5 rounded-xl text-base', chevron: 13 },
} as const;

export default function BirthDateSelect({
  value,
  onChange,
  today,
  storedBirthDate,
  size = 'md',
  idPrefix = 'birthdate',
}: BirthDateSelectProps) {
  const dateWindow = useMemo(() => birthDateWindow(today, storedBirthDate), [today, storedBirthDate]);

  const [selection, setSelection] = useState<BirthDateSelection>(() => birthDateToSelection(value));
  // 上一次由這個元件送出去的值。外面把 `value` 換掉了（例如按下資料樣例）才重新讀，
  // 否則「只選了年」這種中途狀態 —— 它送出的是空字串 —— 會被自己的 onChange 洗掉。
  const [emitted, setEmitted] = useState(value);
  if (value !== emitted) {
    setEmitted(value);
    setSelection(birthDateToSelection(value));
  }

  const update = (next: BirthDateSelection) => {
    const clamped = clampSelection(next, dateWindow);
    const birthDate = selectionToBirthDate(clamped);
    setSelection(clamped);
    setEmitted(birthDate);
    onChange(birthDate);
  };

  const parts: { key: keyof BirthDateSelection; label: string; unit: string; options: number[] }[] = [
    { key: 'year', label: '出生年份', unit: '年', options: yearOptions(dateWindow) },
    { key: 'month', label: '出生月份', unit: '月', options: monthOptions(dateWindow, selection.year) },
    { key: 'day', label: '出生日', unit: '日', options: dayOptions(dateWindow, selection.year, selection.month) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {parts.map(({ key, label, unit, options }) => (
        <div key={key} className="relative">
          <select
            id={`${idPrefix}-${key}`}
            aria-label={label}
            value={selection[key] ?? ''}
            onChange={(e) => update({ ...selection, [key]: e.target.value === '' ? null : Number(e.target.value) })}
            className={`w-full appearance-none cursor-pointer bg-brand-cream/30 border border-brand-stone/60
              text-brand-charcoal transition focus:outline-none focus:ring-2 focus:ring-brand-moss/20
              focus:border-brand-moss ${FIELD_SIZE[size].field}`}
          >
            <option value="">{unit}</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n} {unit}
              </option>
            ))}
          </select>
          {/* appearance-none 拿掉了原生箭頭，補一個回去，否則它看起來像個文字欄位 */}
          <ChevronDown
            size={FIELD_SIZE[size].chevron}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-charcoal/40 pointer-events-none"
          />
        </div>
      ))}
    </div>
  );
}
