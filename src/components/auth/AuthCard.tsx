'use client';

/* 登录 / 注册 / 重发验证邮件：三视图切换卡片，沿用原有交互 */

import { useState } from 'react';
import { Logo, SunnyArtwork } from '@/components/icons';
import { Btn } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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

export function AuthCard({ initialView = 'login' }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg('');
    setIsError(false);
    setBusy(true);
    try {
      if (!email.trim()) throw new Error('请填写邮箱');
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
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 sm:px-6">
      <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-surface border border-line shadow-card">
        <div className="relative isolate overflow-hidden bg-hero px-7 pb-6 pt-7">
          <div className="relative z-10 flex items-center gap-2.5 text-brand">
            <Logo className="h-9 w-9 -rotate-6" />
            <span className="text-base font-extrabold tracking-wide text-ink">生活管理</span>
          </div>
          <h1 className="relative z-10 m-0 mt-6 text-2xl font-extrabold text-hero-ink">{title}</h1>
          <p className="relative z-10 m-0 mt-2 max-w-[220px] text-[13px] text-hero-muted">
            {view === 'login' ? '把小日子，安排得明明白白。' : view === 'register' ? '记下生活的小事，给自己多一点从容。' : '填写邮箱，我们会再发一封验证邮件。'}
          </p>
          <SunnyArtwork className="pointer-events-none absolute -bottom-4 -right-7 h-36 w-40 opacity-85" />
        </div>

        <div className="px-7 pb-6 pt-6">
          <form onSubmit={submit} noValidate className="grid gap-4">
            <Label className="grid gap-2.5">
              邮箱
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Label>
            {view !== 'resend' && (
              <Label className="grid gap-2.5">
                密码
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                  placeholder="至少 8 位"
                  minLength={8}
                  required
                />
              </Label>
            )}
            {view === 'register' && (
              <Label className="grid gap-2.5">
                确认密码
                <Input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  minLength={8}
                  required
                />
              </Label>
            )}

            <Btn type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
              {busy ? '提交中…' : view === 'login' ? '登录' : view === 'register' ? '注册' : '发送验证邮件'}
            </Btn>
          </form>

          <div className="flex justify-center flex-wrap items-center gap-2 mt-4">
            {view !== 'login' && (
              <Button variant="link" size="sm" className="px-1" onClick={() => setView('login')}>
                已有账号，去登录
              </Button>
            )}
            {view === 'login' && (
              <>
                <Button variant="link" size="sm" className="px-1" onClick={() => setView('register')}>
                  注册新账号
                </Button>
                <span className="text-[12px] text-ink-3">·</span>
                <Button variant="link" size="sm" className="px-1" onClick={() => setView('resend')}>
                  重发验证邮件
                </Button>
              </>
            )}
          </div>

          <p className={`m-0 mt-3 min-h-[18px] text-[12px] leading-relaxed ${isError ? 'text-danger' : 'text-ink-2'}`} role="status">
            {msg}
          </p>
        </div>
      </div>
    </main>
  );
}
