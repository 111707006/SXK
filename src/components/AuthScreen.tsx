import React, { useState } from 'react';
import { Mail, Lock, Sparkles, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (email: string, childData: any, scores: any[], orders: any[], history: any[]) => void;
  dbConfigured: boolean | null;
}

export default function AuthScreen({ onAuthSuccess, dbConfigured }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation
    if (!email.trim() || !password) {
      setError('请填写所有必填字段');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('两次输入的密码不一致');
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
          body: JSON.stringify({ email, password }),
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
                loginData.child,
                loginData.completedScores || [],
                loginData.orders || [],
                loginData.reportHistory || []
              );
            } else {
              setIsLogin(true);
              setSuccessMsg(null);
              setLoading(false);
            }
          } catch (e) {
            setIsLogin(true);
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
    setIsLogin(true);
    setError(null);
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
            <span>森</span>
          </div>
          <h2 className="text-xl font-black text-brand-forest tracking-tight">
            森心康儿童发展评估平台
          </h2>
          <p className="text-xs text-brand-charcoal/60 leading-relaxed font-medium">
            9维3层多感官脑发育神经网络数字筛查与分层诊断系统
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-brand-beige/50 p-1 rounded-2xl border border-brand-stone/40">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all duration-200 ${
              isLogin
                ? 'bg-white text-brand-forest shadow-sm border border-brand-stone/30 font-extrabold'
                : 'text-brand-charcoal/60 hover:text-brand-forest'
            }`}
          >
            邮箱登录
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all duration-200 ${
              !isLogin
                ? 'bg-white text-brand-forest shadow-sm border border-brand-stone/30 font-extrabold'
                : 'text-brand-charcoal/60 hover:text-brand-forest'
            }`}
          >
            免费注册
          </button>
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

          {!isLogin && (
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
                <span>{isLogin ? '立即登录' : '同意服务条款并注册'}</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </form>

        {/* Divider & Sandbox evaluation quick login hint */}
        <div className="pt-2 border-t border-brand-stone/60 space-y-3.5">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-brand-charcoal/50">
              数据存储模式:
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
              dbConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {dbConfigured ? '腾讯云云开发 (CloudBase)' : '本地暂存安全模式'}
            </span>
          </div>

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
      </div>
    </div>
  );
}
