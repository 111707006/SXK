import { PRODUCT } from '../productConfig';
import { peekCompanySlug } from '../utils/attribution';
// 條款內文的唯一來源。頁尾那兩個彈窗（App.tsx）渲染的是同一份 —— 見該檔說明。
// 這裡刻意用完整的兩份，不是以前那個刪節版：使用者在這一頁勾的是「已審閱並同意」。
import { CombinedLegalBody } from './LegalTerms';
import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, Smartphone, KeyRound } from 'lucide-react';

interface AuthScreenProps {
  /** `identity` 只是畫面上顯示的標籤（家長的手機號），不是識別鍵。 */
  onAuthSuccess: (identity: string, token: string | null, childData: any, scores: any[], orders: any[], history: any[]) => void;
  dbConfigured: boolean | null;
}

/**
 * 家長端的登入畫面 —— **手機號驗證碼是唯一入口**（#27）。
 *
 * 電子郵件註冊與登入、以及那顆一鍵填充展示帳號的按鈕都已經下線。純驗證碼登入
 * 沒有獨立的「註冊」動作：第一次驗證成功即建立帳號，所以這裡也只有一組欄位、
 * 一顆送出鍵，沒有分頁可切。
 */

/** 與後端 `PHONE_PATTERN` 相同。 */
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export default function AuthScreen({ onAuthSuccess, dbConfigured }: AuthScreenProps) {
  const [phone, setPhone] = useState<string>('');
  const [smsCode, setSmsCode] = useState<string>('');
  const [codeSent, setCodeSent] = useState<boolean>(false);
  /** 還要等幾秒才能再索取一次。0 代表現在就可以。 */
  const [cooldown, setCooldown] = useState<number>(0);
  const [sendingCode, setSendingCode] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  // 冷卻倒數。伺服器才是那個說了算的（它拿得到最近一次索取的時間），
  // 這裡只是把它的答案顯示出來，讓家長知道還要等多久而不是一直按。
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /** 讀回應內容，順便處理伺服器回了一頁 HTML 的情形。 */
  const readJson = async (resp: Response, what: string): Promise<any> => {
    try {
      return await resp.json();
    } catch {
      if (!resp.ok) throw new Error(`${what}异常 (HTTP ${resp.status})`);
      throw new Error('服务器返回了无效的响应格式，请稍后再试');
    }
  };

  const handleRequestCode = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!PHONE_PATTERN.test(phone.trim())) {
      setError('请填写正确的 11 位手机号码');
      return;
    }
    setSendingCode(true);
    try {
      const resp = await fetch('/api/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 歸屬只在建立帳號的那一刻寫得進去。識別碼有效與否由後端判斷 ——
        // 前端一律照送，查不到就是未歸屬，不猜任何一家公司。
        body: JSON.stringify({ phone: phone.trim(), companySlug: peekCompanySlug() }),
      });
      const data = await readJson(resp, '获取验证码');

      if (!resp.ok) {
        // 429 會附上還要等幾秒，照著倒數比讓家長盲按有用。
        if (typeof data.retryAfterSec === 'number') setCooldown(data.retryAfterSec);
        throw new Error(data.error || '验证码发送失败，请稍后再试');
      }

      setCodeSent(true);
      setCooldown(typeof data.cooldownSec === 'number' ? data.cooldownSec : 60);
      setSuccessMsg('验证码已发送，请查收短信。');
    } catch (err: any) {
      setError(err.message || '网络连接异常，请重试');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!PHONE_PATTERN.test(phone.trim())) {
      setError('请填写正确的 11 位手机号码');
      return;
    }
    if (!/^\d{6}$/.test(smsCode.trim())) {
      setError('请填写 6 位验证码');
      return;
    }
    // 第一次验证成功就会建立帐号，所以同意条款问在这里 ——
    // 纯验证码登入没有另一个叫「注册」的时刻可以问。
    if (!agreedToTerms) {
      setError('请先审阅并同意服务及免责条款、隐私保护条款');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          code: smsCode.trim(),
          companySlug: peekCompanySlug(),
        }),
      });
      const data = await readJson(resp, '登录请求');

      if (!resp.ok) throw new Error(data.error || '登录失败，请重新获取验证码');

      onAuthSuccess(
        data.phone,
        data.token || null,
        data.child,
        data.completedScores || [],
        data.orders || [],
        data.reportHistory || []
      );
    } catch (err: any) {
      setError(err.message || '网络连接异常，请重试');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white border border-brand-stone rounded-3xl p-8 shadow-xl text-left animate-fade-in relative overflow-hidden">
      {/* Visual embellishment */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-sage/10 rounded-full blur-2xl -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-beige/40 rounded-full blur-xl -ml-12 -mb-12" />

      <div className="relative z-10 space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 bg-brand-forest text-white rounded-2xl items-center justify-center font-extrabold shadow-lg shadow-brand-forest/15 text-lg mb-1">
            <span>{PRODUCT.brand.logoMark}</span>
          </div>
          <h2 className="text-xl font-black text-brand-forest tracking-tight">
            {PRODUCT.brand.headerTitle}
          </h2>
        </div>

        {/* 手机号是唯一入口，没有分页可切（#27） */}
        <p className="text-center text-[11px] font-bold text-brand-charcoal/60">
          手机号验证码登录
        </p>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 font-medium animate-fade-in">
            <AlertCircle size={14} className="shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 font-medium animate-fade-in">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-500 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-brand-forest/80 tracking-wider uppercase block">
              手机号
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-charcoal/40">
                <Smartphone size={14} />
              </span>
              <input
                type="tel"
                required
                inputMode="numeric"
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="请输入 11 位手机号"
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 bg-brand-cream/40 focus:bg-white border border-brand-stone/80 focus:border-brand-forest focus:ring-1 focus:ring-brand-forest rounded-2xl text-xs font-medium transition outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-brand-forest/80 tracking-wider uppercase block">
              短信验证码
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-charcoal/40">
                  <KeyRound size={14} />
                </span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6 位数字"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-brand-cream/40 focus:bg-white border border-brand-stone/80 focus:border-brand-forest focus:ring-1 focus:ring-brand-forest rounded-2xl text-xs font-medium transition outline-none"
                />
              </div>
              {/* 冷卻中按不下去，且按鈕自己说得出还要等多久 */}
              <button
                type="button"
                onClick={handleRequestCode}
                disabled={sendingCode || loading || cooldown > 0}
                className="shrink-0 px-4 py-2.5 rounded-2xl border border-brand-forest/30 bg-brand-sage/20 hover:bg-brand-sage/40 disabled:bg-brand-stone/20 disabled:text-brand-charcoal/40 disabled:border-brand-stone/40 text-brand-forest text-[11px] font-extrabold transition cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                {cooldown > 0 ? `${cooldown} 秒后重发` : sendingCode ? '发送中…' : codeSent ? '重新获取' : '获取验证码'}
              </button>
            </div>
          </div>

          {/*
            同意条款每次都问：纯验证码登入没有另一个叫「注册」的时刻可以问 ——
            而第一次验证成功就已经建好帐号了。
          */}
          <label className="flex items-start gap-2 cursor-pointer group mt-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded border-brand-stone/60 text-brand-forest focus:ring-brand-moss/40 accent-brand-forest shrink-0"
            />
            <span className="text-[10px] text-brand-charcoal/70 leading-relaxed">
              本人已审阅并同意
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }}
                className="text-brand-forest font-bold hover:underline cursor-pointer"
              >
                服务及免责条款
              </button>
              、
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }}
                className="text-brand-forest font-bold hover:underline cursor-pointer"
              >
                隐私保护条款
              </button>
              等声明。
            </span>
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-forest hover:bg-brand-forest-dark disabled:bg-brand-charcoal/30 text-white rounded-2xl text-xs font-extrabold transition shadow-lg shadow-brand-forest/15 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"></span>
                <span>请稍后...</span>
              </span>
            ) : (
              <>
                <span>验证并登录</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>

          <p className="text-[10px] text-brand-charcoal/55 leading-relaxed text-center">
            首次验证成功即为您创建账户，无需单独注册，也不需要设置密码。
          </p>
        </form>

        {/* 服务及隐私条款合并弹窗 */}
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowTermsModal(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-brand-stone/30 bg-gradient-to-r from-brand-sage/20 to-brand-cream/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-brand-moss rounded-xl flex items-center justify-center">
                    <ShieldCheck size={16} className="text-white" />
                  </div>
                  <h2 className="text-base font-black text-brand-forest">服务及隐私条款</h2>
                </div>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="w-7 h-7 rounded-full bg-brand-stone/20 hover:bg-brand-stone/40 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="text-brand-charcoal/60 text-sm font-bold">✕</span>
                </button>
              </div>

              {/* 内容区 */}
              <div className="overflow-y-auto px-6 py-5 space-y-6 text-xs text-brand-charcoal/80 leading-relaxed">
                <CombinedLegalBody />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
