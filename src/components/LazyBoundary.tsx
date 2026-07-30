import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * `React.lazy` 元件的載入邊界 —— Suspense（載入中）+ ErrorBoundary（載入失敗）。
 *
 * 為什麼需要 ErrorBoundary：專案 A 專屬的大型元件改用 lazy 之後，chunk 是在使用者
 * 點下去的當下才去抓的。抓不到（重新部署後檔名雜湊改變、手機網路斷一下）時
 * dynamic import 會 reject，而 Suspense 只處理 pending、不處理 rejected ——
 * React 會一路往上 unwind 到根節點，整頁變空白且無路可退。
 *
 * 改回可重試的錯誤畫面，讓失敗侷限在這一塊。
 *
 * 【為什麼重試是整頁重新載入，而不是清掉 hasError】
 * React.lazy 會**快取失敗的 promise**（React 19 實測：ctor 只被呼叫一次，
 * 之後每次讀取都拋出同一個快取的錯誤）。單純把 hasError 設回 false 會立刻
 * 再拋一次、邊界再接住一次，使用者看起來像是按了沒反應。
 *
 * 而且最常見的成因就是重新部署 —— 此時記憶體裡的 index.html 仍指向已不存在的
 * 舊 chunk 檔名，只有重新載入才會拿到新的 index 與新的檔名。所以整頁重載
 * 不只是比較簡單，而是對這個情境比較正確的修法。
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

class LazyErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[LazyBoundary] 元件載入失敗', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="py-12 bg-white rounded-3xl border border-brand-stone p-8 text-center space-y-3">
        <AlertTriangle className="mx-auto text-amber-500" size={28} />
        <p className="text-xs font-bold text-brand-forest">本页面加载失败</p>
        <p className="text-[11px] text-brand-charcoal/60 leading-relaxed">
          可能是网络不稳定，或系统刚完成更新。请重新载入页面；若仍无法加载，请稍后再试。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 px-4 py-2 bg-brand-forest text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 active:scale-[0.98] transition"
        >
          <RefreshCw size={12} />
          重新载入
        </button>
      </div>
    );
  }
}

/** lazy 元件載入中的佔位畫面 */
function LazyFallback() {
  return (
    <div className="py-16 bg-white rounded-3xl border border-brand-stone p-8 text-center text-brand-charcoal/60">
      <p className="text-xs font-medium">载入中…</p>
    </div>
  );
}

export default function LazyBoundary({ children }: Props) {
  return (
    <LazyErrorBoundary>
      <React.Suspense fallback={<LazyFallback />}>{children}</React.Suspense>
    </LazyErrorBoundary>
  );
}
