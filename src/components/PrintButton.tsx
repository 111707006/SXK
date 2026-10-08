import { useState } from 'react';
import { Printer } from 'lucide-react';
import { isWeChatBrowser } from './training/device';

/** 微信裡叫不出列印視窗時的那一句。 */
export const PRINT_WECHAT_HINT = '微信里不能直接打印：请点右上角「…」，选「在浏览器打开」，再按一次「打印 / 存成 PDF」。';

/**
 * 「打印 / 存成 PDF」按鈕：呼叫瀏覽器自己的列印（手機上可以選「存成 PDF」），同 T1 報告的做法。
 * 微信內建瀏覽器叫不出列印視窗（家長多半從微信進來），按下去改成說一句怎麼用瀏覽器打開。
 * 自己帶 `print:hidden`：印出來的紙上不需要這顆按鈕。
 */
export default function PrintButton({ id, className = '' }: { id: string; className?: string }) {
  const [hint, setHint] = useState(false);
  const onClick = () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (isWeChatBrowser(ua)) {
      setHint(true);
      return;
    }
    window.print();
  };
  return (
    <div className={`print:hidden space-y-1 ${className}`}>
      <button
        type="button"
        id={id}
        onClick={onClick}
        className="px-3.5 py-2 rounded-xl border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
      >
        <Printer size={13} />
        打印 / 存成 PDF
      </button>
      {hint && <p className="text-[10px] text-brand-charcoal/60 max-w-[16rem] leading-relaxed">{PRINT_WECHAT_HINT}</p>}
    </div>
  );
}
