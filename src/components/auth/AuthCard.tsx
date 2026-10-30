'use client';

/* 登录 / 注册 / 重发验证邮件：三视图切换卡片，沿用原有交互 */

import { useState } from 'react';
import { AuthShell } from './AuthShell';
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

  const title = view === 'login' ? '欢迎回来' : view === 'register' ? '注册新账号' : '重发验证邮件';
  const subtitle = view === 'login' ? '登录生活管理，把小事安排好。' : view === 'register' ? '记下生活的小事，给自己多一点从容。' : '填写邮箱，我们会再发一封验证邮件。';

  return <AuthShell title={title} subtitle={subtitle}>
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Label className="grid gap-2 text-sm text-ink">
        邮箱
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required />
      </Label>
      {view !== 'resend' && <Label className="grid gap-2 text-sm text-ink">
        密码
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={view === 'login' ? 'current-password' : 'new-password'} placeholder={view === 'login' ? '输入密码' : '至少 8 位'} minLength={8} required />
      </Label>}
      {view === 'register' && <Label className="grid gap-2 text-sm text-ink">
        确认密码
        <Input type="password" value={password2} onChange={(event) => setPassword2(event.target.value)} autoComplete="new-password" placeholder="再次输入密码" minLength={8} required />
      </Label>}
      <Btn type="submit" variant="primary" disabled={busy} className="mt-2 w-full">
        {busy ? '提交中…' : view === 'login' ? '登录' : view === 'register' ? '注册' : '发送验证邮件'}
      </Btn>
    </form>
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {view !== 'login' ? <Button variant="link" size="sm" onClick={() => setView('login')}>已有账号，去登录</Button> : <>
        <Button variant="link" size="sm" onClick={() => setView('register')}>注册新账号</Button>
        <span className="text-xs text-ink-3" aria-hidden="true">·</span>
        <Button variant="link" size="sm" onClick={() => setView('resend')}>重发验证邮件</Button>
      </>}
    </div>
    <p className={'m-0 mt-3 min-h-5 text-center text-sm leading-relaxed ' + (isError ? 'text-danger' : 'text-ink-2')} role="status">{msg}</p>
    {view === 'login' && !msg && <p className="m-0 mt-2 text-center text-xs text-ink-3">注册后需验证邮箱。</p>}
  </AuthShell>;
}
