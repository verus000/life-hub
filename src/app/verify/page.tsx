'use client';

/* 邮箱激活：读取 ?token= 调用验证接口（成功即写入会话 Cookie），展示结果 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo, SunnyArtwork } from '@/components/icons';
import { Btn } from '@/components/ui';

type VerificationResult = {
  ok: boolean;
  data: { email?: string; claimed?: number; error?: string };
};

function VerifyBody() {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [message, setMessage] = useState('');
  const request = useRef<{ token: string; result: Promise<VerificationResult> } | null>(null);

  useEffect(() => {
    if (!token) {
      setState('fail');
      setMessage('激活链接无效');
      return;
    }
    let current = true;
    /* StrictMode 会重复启动 effect；复用当前请求，避免消费一次性令牌两次。 */
    if (request.current?.token !== token) {
      request.current = {
        token,
        result: fetch('/api/auth/verify?token=' + encodeURIComponent(token))
          .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) })),
      };
    }
    setState('loading');
    setMessage('');
    request.current.result
      .then(({ ok, data }) => {
        if (!current) return;
        if (ok) {
          setState('ok');
          setMessage(
            '邮箱 ' + (data.email || '') + ' 已激活。' +
              (data.claimed ? '已为你认领 ' + data.claimed + ' 条历史记录。' : ''),
          );
        } else {
          setState('fail');
          setMessage(String(data.error || '激活失败，请重试'));
        }
      })
      .catch(() => {
        if (!current) return;
        setState('fail');
        setMessage('无法连接服务，请稍后重试');
      });
    return () => { current = false; };
  }, [token]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 sm:px-6">
      <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-surface border border-line shadow-card text-center">
        <div className="flex flex-col items-center bg-hero px-7 pb-5 pt-7">
          <div className="flex items-center justify-center gap-2.5 text-brand">
            <Logo className="h-9 w-9 -rotate-6" />
            <span className="text-base font-extrabold tracking-wide text-ink">生活管理</span>
          </div>
          <SunnyArtwork className="mt-2 h-32 w-40" />
        </div>
        <div className="px-7 py-7">
          <h1 className="m-0 mb-3 text-xl font-bold text-ink">
            {state === 'loading' ? '正在激活…' : state === 'ok' ? '激活成功' : '激活失败'}
          </h1>
          <p className="m-0 break-words text-sm leading-relaxed text-ink-2" role="status">{message}</p>
          {state === 'ok' && (
            <Btn variant="primary" className="mt-5 w-full" onClick={() => (window.location.href = '/')}>
              进入应用
            </Btn>
          )}
          {state === 'fail' && (
            <Btn className="mt-5 w-full" onClick={() => (window.location.href = '/login')}>
              返回登录
            </Btn>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyBody />
    </Suspense>
  );
}
