import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';
import { formatFen } from '../utils/price';
import {
  ArrowLeft, Lock, ShieldCheck, Sparkles, Infinity as InfinityIcon,
  Loader2, AlertCircle, FileText, Activity, Eye,
} from 'lucide-react';

/**
 * 跳去微信付款前存下訂單號，回跳後用它查單。
 * 用 sessionStorage 而非 localStorage —— 這是一次性的交接資料，關掉分頁就該消失。
 */
const PENDING_ORDER_KEY = 'senxinkang_pending_order';

interface PaywallProps {
  /** 單價（分）。來源是 `GET /api/unlocks` 的 `priceFen`，不在前端寫死。 */
  priceFen: number;
  /**
   * 展示模式：後端沒有持久層，付費牆擋不住也不該擋。畫面照常呈現，
   * 但會明確標示，並提供略過入口 —— 資料庫一接上這個 prop 就永遠是 false。
   */
  isDemo?: boolean;
  onBack: () => void;
  /** 已擁有 T2 權益時呼叫 —— 例如家長在另一個分頁買完後又回來點。 */
  onAlreadyUnlocked: () => void;
}

/**
 * 整份第二層深度評估的付費牆 —— **一個入口、一個價格**（票 #45）。
 *
 * 2026-09-11 之前這裡賣的是「一個維度的 T2+T3」，總覽的九張卡片各掛一個
 * 「¥19.9 解锁」。改掉的理由不是畫面難看：T2 的那幾支量表本來就會同時餵好幾個
 * 維度，按維度賣會讓同一份問卷被賣兩次，而被標記的維度往往不只一個。
 * T3 綁維度的做法不變，但 T3 暫緩，所以這個畫面上沒有它的入口。
 *
 * ⚠️ 這裡**沒有**「完成付款」的路徑，而且刻意如此。後端唯一會發放權益的地方是
 * 驗簽通過的微信回調與查單補償（`server.ts` 的註解寫了同一件事）。在前端補一顆
 * 「我已付款」按鈕，等於把付費內容送給任何按得到它的人。
 *
 * 目前 `/api/payment/create` 會開出真實的待付款單並回 `wechatReady: false` ——
 * 微信下單那一段卡在 ICP 備案與商戶號。所以這個畫面會**明確講出「支付通道尚未
 * 開放」**，不做假的成功畫面。這是專家預約那次學到的同一課：給家長假的成功，
 * 比直接告訴他還沒好更糟。
 */
export default function Paywall({ priceFen, isDemo = false, onBack, onAlreadyUnlocked }: PaywallProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<{ outTradeNo: string; amountFen: number; reason?: string | null } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  /**
   * 從微信 H5 頁回跳後確認付款結果。
   *
   * **回跳本身不代表付款成功** —— 家長可能中途放棄、按上一頁，或根本沒付完就
   * 回來了。唯一可信的是後端查單（它會直接問微信）。前端在這裡什麼都不判斷，
   * 只把訂單號送回去問。
   */
  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return;
    let saved: { outTradeNo?: string; scope?: string };
    try { saved = JSON.parse(raw); } catch { sessionStorage.removeItem(PENDING_ORDER_KEY); return; }
    // 舊版存的是 `dimensionId`。那種殘留不再認得，直接忽略 —— 拿一張舊的維度訂單
    // 去查 T2 的結果，只會讓家長看到一個對不上的答案。
    if (!saved.outTradeNo || saved.scope !== 't2') return;

    let cancelled = false;
    setIsChecking(true);
    (async () => {
      try {
        const resp = await authFetch(`/api/payment/status?outTradeNo=${encodeURIComponent(saved.outTradeNo!)}`);
        const data = await resp.json().catch(() => ({}));
        if (cancelled) return;
        if (resp.ok && data.status === 'success') {
          sessionStorage.removeItem(PENDING_ORDER_KEY);
          onAlreadyUnlocked();
          return;
        }
        // 未完成 —— 不清掉訂單號，家長可能只是還沒付完。
        setError('尚未收到付款结果。如已完成支付，请稍候片刻再返回本页面。');
      } catch {
        if (!cancelled) setError('无法确认支付结果，请稍后重试。');
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreateOrder = async () => {
    setError(null);
    setIsCreating(true);
    try {
      const resp = await authFetch('/api/payment/create', {
        method: 'POST',
        // 沒有維度可送。`scope` 就是伺服器用來決定發哪一種權益的那一個欄位。
        body: JSON.stringify({ scope: 't2' }),
      });
      const ct = resp.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        throw new Error('服务器返回了非预期的响应。');
      }
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || '创建订单失败，请稍后重试。');
      }
      // 已擁有 → 直接放行，不再開一張單。後端也擋（`alreadyUnlocked`），
      // 這裡只是讓家長少看一個畫面。
      if (data.alreadyUnlocked) {
        onAlreadyUnlocked();
        return;
      }

      if (data.wechatReady && data.h5Url) {
        // 記下訂單號 —— 回跳後要靠它查單。H5 的 h5_url 只有 5 分鐘效期，
        // 拿到就跳，不存起來重用。
        sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
          outTradeNo: data.outTradeNo, scope: 't2',
        }));
        // 只允許在既有參數後追加 redirect_url，且值必須 urlencode。
        // 用一般導頁（不是 window.open / rel=noreferrer）—— H5 支付會檢查
        // Referer，少了它會直接失敗。
        const redirect = `${window.location.origin}${window.location.pathname}`;
        window.location.href = `${data.h5Url}&redirect_url=${encodeURIComponent(redirect)}`;
        return;
      }

      setPendingOrder({
        outTradeNo: data.outTradeNo,
        amountFen: data.amountFen,
        reason: typeof data.reason === 'string' ? data.reason : null,
      });
    } catch (err: any) {
      setError(err?.message || '创建订单失败，请稍后重试。');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-brand-charcoal/60 hover:text-brand-forest transition mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} />
        返回维度总览
      </button>

      <div className="bg-white rounded-3xl border border-brand-stone shadow-sm overflow-hidden">
        <div className="bg-brand-sage/40 px-6 py-5 border-b border-brand-stone/60">
          <div className="flex items-center gap-2 text-[11px] font-bold text-brand-moss">
            <Lock size={12} />
            深度评估 · 待解锁
          </div>
          <h2 className="text-lg font-extrabold text-brand-forest mt-1">第二层深度评估 · 整份解锁</h2>
          <p className="text-[11px] text-brand-charcoal/70 mt-1">
            依孩子的筛查结果安排要答的量表，答完生成深度报告与每周家庭活动。
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-brand-forest">¥</span>
            <span className="text-4xl font-extrabold text-brand-forest tracking-tight">{formatFen(priceFen)}</span>
            <span className="text-[11px] text-brand-charcoal/60 ml-1">/ 整份一次</span>
          </div>

          <ul className="space-y-2">
            {[
              { icon: FileText, text: '第二层能力量表，由家长填写' },
              { icon: Activity, text: '筛查中被标记的能力方面全部涵盖，不分开购买' },
              { icon: Sparkles, text: 'AI 生成的深度报告与每周家庭活动' },
              { icon: InfinityIcon, text: '永久有效，重做筛查后依然可用，可免费重测' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-xs text-brand-charcoal/80">
                <Icon size={14} className="text-brand-moss shrink-0 mt-0.5" />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2 text-[10px] text-brand-charcoal/60 bg-brand-cream rounded-xl p-3 border border-brand-stone/40">
            <ShieldCheck size={12} className="shrink-0 mt-0.5 text-brand-moss" />
            <span>
              一次解锁整份第二层深度评估。权益绑定您的帐号，不绑定某一次筛查批次。付款由微信支付处理，本平台不接触您的支付信息。
            </span>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/*
            展示模式的略過入口。
            付費牆在這種環境下擋不住任何東西，藏起來只是讓展示站的深度評估無路可走。

            觸發它的後端狀況有兩種（都由 `/api/unlocks` 的 `available: false` 表示）：
            沒有持久層，或 `PAYWALL_DEMO_OPEN=1`。文案刻意**不說是哪一種** ——
            早期版本寫死「未连接数据库」，開關上線後那句話在資料庫連著的展示站上
            就成了畫面上的假話，而這個畫面正是要拿給人看的那一個。
            正式環境兩種都不成立，這整塊從畫面上消失。
          */}
          {isDemo && (
            <div className="rounded-2xl border border-dashed border-brand-moss/50 bg-brand-sage/10 p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-forest">
                <Eye size={14} />
                展示模式
              </div>
              <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
                当前为展示环境，不会产生真实订单，付费墙仅供预览。正式环境不会出现下面这个按钮。
              </p>
              <button
                onClick={onAlreadyUnlocked}
                className="w-full py-2.5 rounded-xl border border-brand-moss/40 bg-white hover:bg-brand-cream text-brand-forest text-xs font-bold transition active:scale-[0.99] cursor-pointer"
              >
                跳过付费，直接查看深度评估（展示用）
              </button>
            </div>
          )}

          {pendingOrder ? (
            /*
             * 訂單開出來了，但微信下單那一段還沒接。**不能**顯示成功。
             * 訂單號有印出來是為了讓客服對得上單 —— 家長真的按到這一步時，
             * 手動處理是唯一誠實的選項。
             */
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800">
                <AlertCircle size={14} />
                支付通道尚未开放
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                订单已为您保留，但微信支付尚未开通，暂时无法完成付款。开通后您可凭订单号继续支付，无需重新下单。
              </p>
              {pendingOrder.reason && (
                <p className="text-[10px] text-amber-800/60">{pendingOrder.reason}</p>
              )}
              <div className="text-[10px] text-amber-900/70 font-mono bg-white/60 rounded-lg px-2.5 py-1.5 border border-amber-200 break-all">
                订单号：{pendingOrder.outTradeNo}
              </div>
              <p className="text-[10px] text-amber-800/70">
                金额：¥{formatFen(pendingOrder.amountFen)}
              </p>
            </div>
          ) : (
            <button
              onClick={handleCreateOrder}
              disabled={isCreating || isChecking}
              className="w-full py-3.5 rounded-2xl bg-brand-moss hover:bg-brand-moss/90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-extrabold transition flex items-center justify-center gap-2 shadow-md shadow-brand-moss/25 active:scale-[0.99] cursor-pointer"
            >
              {isChecking ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  正在确认支付结果...
                </>
              ) : isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  正在创建订单...
                </>
              ) : (
                <>
                  <Lock size={14} />
                  ¥{formatFen(priceFen)} 解锁深度评估
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
