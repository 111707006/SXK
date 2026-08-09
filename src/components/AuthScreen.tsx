import { PRODUCT } from '../productConfig';
import { peekCompanySlug } from '../utils/attribution';
import React, { useEffect, useState } from 'react';
import { Mail, Lock, Sparkles, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, FileText, Smartphone, KeyRound } from 'lucide-react';

interface AuthScreenProps {
  /** `identity` 只是畫面上顯示的標籤（手機號或舊帳號的電子郵件），不是識別鍵。 */
  onAuthSuccess: (identity: string, token: string | null, childData: any, scores: any[], orders: any[], history: any[]) => void;
  dbConfigured: boolean | null;
}

/**
 * 登入方式。**預設是手機號** —— 家長記不住密碼，但手機一直在手上。
 *
 * 電子郵件那兩個分頁是給既有家長走的，會在 #27 一併移除；
 * 純驗證碼登入沒有獨立的「註冊」動作，所以手機號只有一個分頁。
 */
type AuthMode = 'phone' | 'email_login' | 'email_register';

/** 與後端 `PHONE_PATTERN` 相同。 */
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export default function AuthScreen({ onAuthSuccess, dbConfigured }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('phone');
  const isLogin = mode !== 'email_register';
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

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

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
  };

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

  const handlePhoneSubmit = async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (mode === 'phone') {
      await handlePhoneSubmit();
      return;
    }

    // Validation
    if (!email.trim() || !password) {
      setError('请填写所有必填字段');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!isLogin && !agreedToTerms) {
      setError('请先审阅并同意服务及免责条款、隐私保护条款');
      return;
    }

    if (password.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Log in
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        let data: any = {};
        try {
          data = await resp.json();
        } catch (jsonErr) {
          if (!resp.ok) {
            throw new Error(`登录请求异常 (HTTP ${resp.status})`);
          }
          throw new Error('服务器返回了无效的响应格式，请稍后再试');
        }

        if (!resp.ok) {
          throw new Error(data.error || '登录失败，请检查账号密码');
        }

        // Successfully logged in
        onAuthSuccess(
          data.email,
          data.token || null,
          data.child,
          data.completedScores || [],
          data.orders || [],
          data.reportHistory || []
        );
      } else {
        // Register
        const resp = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 歸屬只在建立帳號的這一刻寫得進去。識別碼有效與否由後端判斷 ——
          // 前端一律照送，查不到就是未歸屬，不猜任何一家公司。
          body: JSON.stringify({ email, password, companySlug: peekCompanySlug() }),
        });

        let data: any = {};
        try {
          data = await resp.json();
        } catch (jsonErr) {
          if (!resp.ok) {
            throw new Error(`注册请求异常 (HTTP ${resp.status})`);
          }
          throw new Error('服务器返回了无效的响应格式，请稍后再试');
        }

        if (!resp.ok) {
          throw new Error(data.error || '注册失败，请稍后重试');
        }

        setSuccessMsg('注册成功！正在为您自动登录并准备个人档案...');
        
        // Auto-login after brief delay
        setTimeout(async () => {
          try {
            const loginResp = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            let loginData: any = {};
            try {
              loginData = await loginResp.json();
            } catch (e) {
              // ignore
            }
            if (loginResp.ok) {
              onAuthSuccess(
                loginData.email,
                loginData.token || null,
                loginData.child,
                loginData.completedScores || [],
                loginData.orders || [],
                loginData.reportHistory || []
              );
            } else {
              setMode('email_login');
              setSuccessMsg(null);
              setLoading(false);
            }
          } catch (e) {
            setMode('email_login');
            setSuccessMsg(null);
            setLoading(false);
          }
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || '网络连接异常，请重试');
      setLoading(false);
    }
  };

  const handleUseDemoAccount = () => {
    setEmail('test@test.com');
    setPassword('123456');
    switchMode('email_login');
  };

  const TABS: Array<{ id: AuthMode; label: string }> = [
    { id: 'phone', label: '手机号登录' },
    { id: 'email_login', label: '邮箱登录' },
    { id: 'email_register', label: '免费注册' },
  ];

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

        {/* Tab Selection — 手机号在第一个，且是预设 */}
        <div className="flex bg-brand-beige/50 p-1 rounded-2xl border border-brand-stone/40">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchMode(tab.id)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all duration-200 ${
                mode === tab.id
                  ? 'bg-white text-brand-forest shadow-sm border border-brand-stone/30 font-extrabold'
                  : 'text-brand-charcoal/60 hover:text-brand-forest'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
          {mode === 'phone' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-brand-forest/80 tracking-wider uppercase block">
                  电子邮箱
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-charcoal/40">
                    <Mail size={14} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@domain.com"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-brand-cream/40 focus:bg-white border border-brand-stone/80 focus:border-brand-forest focus:ring-1 focus:ring-brand-forest rounded-2xl text-xs font-medium transition outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-brand-forest/80 tracking-wider uppercase block">
                  登录密码
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-charcoal/40">
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入 6 位以上密码"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-brand-cream/40 focus:bg-white border border-brand-stone/80 focus:border-brand-forest focus:ring-1 focus:ring-brand-forest rounded-2xl text-xs font-medium transition outline-none"
                  />
                </div>
              </div>

              {mode === 'email_register' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[11px] font-extrabold text-brand-forest/80 tracking-wider uppercase block">
                    确认密码
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-charcoal/40">
                      <Lock size={14} />
                    </span>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入您的密码"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 bg-brand-cream/40 focus:bg-white border border-brand-stone/80 focus:border-brand-forest focus:ring-1 focus:ring-brand-forest rounded-2xl text-xs font-medium transition outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/*
            同意条款问在**会建立帐号的那些流程**上。手机号那条路每次都问，
            因为纯验证码登入没有另一个叫「注册」的时刻可以问 ——
            而第一次验证成功就已经建好帐号了。
          */}
          {mode !== 'email_login' && (
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
          )}

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
                <span>
                  {mode === 'phone' ? '验证并登录' : isLogin ? '立即登录' : '同意服务条款并注册'}
                </span>
                <ArrowRight size={13} />
              </>
            )}
          </button>

          {mode === 'phone' && (
            <p className="text-[10px] text-brand-charcoal/55 leading-relaxed text-center">
              首次验证成功即为您创建账户，无需单独注册，也不需要设置密码。
            </p>
          )}
        </form>

        {/* Divider & Sandbox evaluation quick login hint */}
        {mode !== 'phone' && (
          <div className="pt-2 space-y-3.5">

            <div className="bg-brand-beige/40 p-3 rounded-2xl border border-brand-stone/50 text-[10px] space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-brand-forest">
                <Sparkles size={11} className="text-brand-moss shrink-0" />
                <span>💡 快速测试账号：</span>
              </div>
              <p className="text-brand-charcoal/70">
                如果您需要免去注册流程快速进行系统体验，我们为您内置了一键填充的测试账户。
              </p>
              <button
                type="button"
                onClick={handleUseDemoAccount}
                className="text-brand-forest font-extrabold hover:underline text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <span>使用一键填充 `test@test.com` 账号</span>
                <ArrowRight size={10} />
              </button>
            </div>
          </div>
        )}

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
                {/* 服务及免责条款 */}
                <section>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brand-stone/30">
                    <FileText size={14} className="text-brand-moss" />
                    <h3 className="font-black text-brand-forest text-sm">服务及免责条款</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">一、服务说明</h4>
                      <p>{PRODUCT.brand.systemName}为监护人提供儿童发育评估、AI评估报告生成、康复建议参考及智能穿戴设备商城等服务。本系统基于"9维3层分层神经系统检测"理念，结合人工智能技术，为儿童发育状况提供数字化参考信息。</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                      <p className="font-black text-red-700 text-xs">⚠️ 免责声明（重要）：</p>
                      <ul className="list-disc pl-5 space-y-1 text-red-800/90">
                        <li><strong>本系统所有评估内容、报告及建议仅供参考，不构成任何医疗诊断、治疗建议或医疗行为。</strong></li>
                        <li><strong>本系统非医疗器械，不具备医疗资质，不能替代专业医疗机构的诊断与治疗。</strong></li>
                        <li>AI生成的评估报告基于算法模型运算，可能存在偏差，不应作为唯一决策依据。</li>
                        <li>儿童发育评估涉及专业医学判断，请务必以正规医院儿科、儿童保健科或发育行为科医生的诊断为准。</li>
                        <li>如儿童存在发育迟缓、行为异常或其他健康问题，请及时就医，切勿依赖本系统结果延误治疗。</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">二、服务限制</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>本系统提供的评估工具为初步参考，不能替代标准化临床评估量表的专业施测与解读</li>
                        <li>AI评估报告的准确性受输入数据质量、模型训练数据范围等因素影响</li>
                        <li>商城所售穿戴设备为辅助训练工具，非医疗器械，不具有治疗功效</li>
                        <li>本系统不对因使用评估结果而做出的任何决策承担责任</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">三、用户责任</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>用户（监护人）应确保提供的儿童档案信息真实、准确</li>
                        <li>用户应理解并同意本系统的评估结果仅供参考，不得将其用于医疗诊断、法律证据或其他专业用途</li>
                        <li>用户不得将本系统用于商业目的或未经授权的二次分发</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">四、责任限制</h4>
                      <p>在法律允许的最大范围内，{PRODUCT.brand.legalEntity}及其关联公司对因使用或无法使用本系统而造成的任何直接、间接、附带、特殊或后果性损害不承担赔偿责任。</p>
                    </div>
                  </div>
                </section>

                {/* 隐私保护条款 */}
                <section>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brand-stone/30">
                    <ShieldCheck size={14} className="text-brand-moss" />
                    <h3 className="font-black text-brand-forest text-sm">隐私保护条款</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">一、数据收集范围</h4>
                      <p>本系统仅收集为完成发育评估与康复建议所必需的最少数据，包括：儿童基本档案信息、发育评估量表作答数据、AI评估报告生成记录、用户注册账号信息。本系统<strong className="text-brand-forest">不会</strong>收集儿童面部图像、地理位置、通讯录等与评估无关的个人信息。</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">二、数据存储与安全</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>所有数据均存储于加密数据库中，传输过程采用 HTTPS/TLS 加密协议</li>
                        <li>密码经 bcrypt 哈希加密存储，不可逆向还原</li>
                        <li>AI 模型调用过程中，儿童数据经脱敏处理后发送</li>
                        <li>定期执行安全审计与漏洞扫描</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">三、数据使用目的</h4>
                      <p>收集的数据仅用于：生成儿童发育评估报告与康复建议、提供穿戴设备商城购买服务、改善系统功能与用户体验（匿名化统计分析）。<strong className="text-brand-forest">不会</strong>将数据用于商业广告推送、第三方营销或任何未经监护人明确授权的目的。</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">四、数据共享与披露</h4>
                      <p>除以下情形外，本系统不会向任何第三方共享或披露用户数据：经监护人明确书面同意、法律法规要求或司法机关依法调取、为保护本系统或公众安全所必需。</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">五、用户权利</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>查阅权</strong>：随时查看儿童的评估数据与报告</li>
                        <li><strong>更正权</strong>：修改不准确的个人信息</li>
                        <li><strong>删除权</strong>：申请删除儿童档案及全部关联数据</li>
                        <li><strong>撤回同意权</strong>：随时撤回对数据处理的授权</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-charcoal text-[11px] mb-1">六、儿童数据特别保护</h4>
                      <p>本系统严格遵守《中华人民共和国个人信息保护法》《儿童个人信息网络保护规定》等法律法规，对儿童个人信息实行专门保护：收集前须取得监护人明示同意、设置专门访问控制策略、定期对员工进行安全培训。</p>
                    </div>
                  </div>
                </section>

                <div className="pt-3 border-t border-brand-stone/30 text-[10px] text-brand-charcoal/50 text-center">
                  最后更新日期：2026年7月 · {PRODUCT.brand.legalEntity}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
