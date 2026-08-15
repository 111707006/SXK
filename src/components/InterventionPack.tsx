/**
 * 干預包 —— 家長照著做的圖文分解步驟（issue #26）。
 *
 * 內容由（維度，年齡段，嚴重度）取出，一則步驟一張分解圖配一句指令，順序就是
 * 照著做的順序，另有選填的影片連結。素材還沒到位的格子明白說「準備中」並導向
 * 專家 —— **不退回鄰近年齡段、不退回通用方案**。理由與規則見
 * `src/utils/interventionMatch.ts`。
 *
 * 這個元件只畫畫面：要哪一格、拿不到時說什麼，分別在 `useInterventionPack` 與
 * `interventionMessage`。
 */
import React from 'react';
import { AlertCircle, ClipboardList, MessageSquare, PlayCircle } from 'lucide-react';
import { useInterventionPack, interventionMessage } from '../utils/interventionPack';

interface InterventionPackProps {
  dimensionId: string | null;
  /** 孩子的**實足月齡**（今天幾個月大），不是這份報告當時的測評月齡。 */
  currentAgeMonth: number | null;
  /** 這個維度的判定；`null` 代表沒有讀得懂的成績。 */
  severity: string | null;
  /** 導向專家諮詢。沒有傳就不顯示那顆按鈕（而不是顯示一顆按不動的）。 */
  onContactExpert?: () => void;
}

export default function InterventionPack({
  dimensionId,
  currentAgeMonth,
  severity,
  onContactExpert,
}: InterventionPackProps) {
  const { status, cell, pack } = useInterventionPack(dimensionId, currentAgeMonth, severity);

  const header = (
    <div className="flex items-center gap-2 border-b border-brand-stone/80 pb-2">
      <div className="w-6 h-6 bg-brand-forest rounded-lg flex items-center justify-center text-white text-xs font-black">
        <ClipboardList size={13} />
      </div>
      <h2 className="text-base font-black text-brand-forest">家庭干预训练步骤</h2>
      {cell && (
        // 年齡段一定要寫出來。干預包用的是**今天**的月齡，而這份報告是照當時的
        // 測評月齡讀的 —— 孩子跨段之後兩者會分岔，不寫出來就沒有人知道這組步驟
        // 是照哪一個年齡挑的。
        <span className="text-[10px] bg-brand-sage text-brand-forest font-bold px-2 py-0.5 rounded-full border border-brand-stone/50">
          {cell.ageBandName}・{cell.severity === 'delay' ? '需关注' : '需留意'}
        </span>
      )}
    </div>
  );

  if (status !== 'ok' || !pack) {
    const message = interventionMessage(status, cell);
    return (
      <div className="space-y-6 text-left pt-2">
        {header}
        <div className="bg-brand-cream/30 border border-brand-stone rounded-3xl p-6 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="text-brand-clay shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-brand-charcoal">{message.title}</h3>
              {message.body && (
                <p className="text-xs text-brand-charcoal/70 leading-relaxed">{message.body}</p>
              )}
            </div>
          </div>
          {message.offerExpert && onContactExpert && (
            <button
              onClick={onContactExpert}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-forest text-white rounded-xl text-xs font-bold hover:bg-brand-moss transition"
            >
              <MessageSquare size={12} />
              联系专家一对一指导
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left pt-2">
      {header}

      <div className="bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-brand-charcoal">{pack.title}</h3>
            <p className="text-[11px] text-brand-charcoal/60 mt-1">
              共 {pack.steps.length} 步，按顺序进行。每天做得完一遍就够，做不到的一步先停下来。
            </p>
          </div>
          {pack.videoUrl && (
            // 影片是輔助，不是主體：連結另開，圖文本身在弱網或離線快取下照樣看得完。
            <a
              href={pack.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-sage/40 text-brand-forest border border-brand-stone/50 rounded-xl text-xs font-bold hover:bg-brand-sage/60 transition"
            >
              <PlayCircle size={13} />
              观看示范影片
            </a>
          )}
        </div>

        <ol className="space-y-4">
          {pack.steps.map((step, i) => (
            <li
              key={i}
              className="flex flex-col sm:flex-row gap-4 rounded-2xl border border-brand-stone/60 bg-brand-cream/20 p-4"
            >
              <div className="sm:w-40 shrink-0">
                <img
                  src={step.imageUrl}
                  alt={`第 ${i + 1} 步分解图`}
                  loading="lazy"
                  className="w-full h-32 sm:h-28 object-contain rounded-xl bg-white border border-brand-stone/40"
                />
              </div>
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-6 h-6 rounded-full bg-brand-forest text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-xs text-brand-charcoal leading-relaxed font-bold break-words">
                  {step.instruction}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {onContactExpert && (
          <div className="pt-3 border-t border-brand-stone/40 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-brand-charcoal/60">做的过程中有疑问，或孩子明显做不到某一步？</p>
            <button
              onClick={onContactExpert}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-forest/40 text-brand-forest rounded-xl text-xs font-bold hover:bg-brand-sage/30 transition"
            >
              <MessageSquare size={12} />
              联系专家
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
