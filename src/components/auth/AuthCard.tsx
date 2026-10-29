'use client';

/* 登录 / 注册 / 重发验证邮件：三视图切换卡片，沿用原有交互 */

import { useState } from 'react';
import { Logo } from '@/components/icons';
import { Btn } from '@/components/ui';

type View = 'login' | 'register' | 'resend';

async function post(path: string, body: object): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch('/api/auth/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* 保持空对象 */
  }
  return { ok: res.ok, status: res.status, data };
}

export function AuthCard() {
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const inputCls =
    'min-h-[38px] px-3 rounded-[10px] border border-line-strong bg-white text-[13px] text-ink focus:outline-2 focus:outline-brand focus:border-brand';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg('');
    setIsError(false);
    setBusy(true);
    try {
      if (view === 'login') {
        const r = await post('login', { email, password });
        if (r.ok) {
          window.location.href = '/';
          return;
        }
        const message = String(r.data.error || '登录失败，请重试');
        if (r.status === 403 && r.data.needVerify) {
          setMsg(message);
          setIsError(true);
          setView('resend');
          return;
        }
        throw new Error(message);
      }
      if (view === 'register') {
        if (password !== password2) {
          setMsg('两次输入的密码不一致');
          setIsError(true);
          return;
        }
        const r = await post('register', { email, password });
        if (!r.ok) throw new Error(String(r.data.error || '注册失败，请重试'));
        setMsg(String(r.data.message || '注册成功，请查收验证邮件'));
        setView('login');
        return;
      }
      const r = await post('resend', { email });
      if (!r.ok) throw new Error(String(r.data.error || '发送失败，请重试'));
      setMsg(String(r.data.message || '验证邮件已发送'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '操作失败，请重试');
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  const title = view === 'login' ? '登录' : view === 'register' ? '注册新账号' : '重发验证邮件';

  return (
    <div className="fixed inset-0 z-80 grid place-items-center p-6 bg-[#F4F8FAEE]">
      <div className="w-full max-w-[360px] px-7 pt-8 pb-6 rounded-[18px] bg-surface border border-line shadow-[0_18px_44px_#2940351F]">
        <div className="flex items-center gap-2.5 mb-4 text-brand">
          <Logo className="w-6 h-6" />
          <span className="text-[15px] font-medium text-ink">生活管理</span>
        </div>
        <h2 className="m-0 mb-4 text-[17px] font-medium text-ink">{title}</h2>

        <form onSubmit={submit} noValidate className="grid gap-3.5">
          {view !== 'resend' && (
            <label className="grid gap-1.5 text-[12px] text-ink-2">
              邮箱
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
                className={inputCls}
              />
            </label>
          )}
          {view !== 'resend' && (
            <label className="grid gap-1.5 text-[12px] text-ink-2">
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                placeholder="至少 8 位"
                minLength={8}
                required
                className={inputCls}
              />
            </label>
          )}
          {view === 'register' && (
            <label className="grid gap-1.5 text-[12px] text-ink-2">
              确认密码
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                placeholder="再次输入密码"
                minLength={8}
                required
                className={inputCls}
              />
            </label>
          )}

          <Btn type="submit" variant="primary" disabled={busy} className="mt-1 w-full min-h-10">
            {busy ? '提交中…' : view === 'login' ? '登录' : view === 'register' ? '注册' : '发送验证邮件'}
          </Btn>
        </form>

        <div className="flex justify-center flex-wrap gap-1.5 mt-4">
          {view !== 'login' && (
            <button type="button" className="text-[12px] text-brand hover:underline" onClick={() => setView('login')}>
              已有账号，去登录
            </button>
          )}
          {view === 'login' && (
            <>
              <button type="button" className="text-[12px] text-brand hover:underline" onClick={() => setView('register')}>
                注册新账号
              </button>
              <span className="text-[12px] text-ink-3">·</span>
              <button type="button" className="text-[12px] text-brand hover:underline" onClick={() => setView('resend')}>
                重发验证邮件
              </button>
            </>
          )}
        </div>

        <p className={`m-0 mt-3 min-h-[18px] text-[12px] leading-relaxed ${isError ? 'text-danger' : 'text-ink-2'}`} role="status">
          {msg}
        </p>
      </div>
    </div>
  );
}
