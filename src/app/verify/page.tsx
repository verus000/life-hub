'use client';

/* 邮箱激活：读取 ?token= 调用验证接口（成功即写入会话 Cookie），展示结果 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { Icon } from '@/components/icons';
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
    <AuthShell title={state === 'loading' ? '正在激活…' : state === 'ok' ? '激活成功' : '激活失败'} subtitle="邮箱验证">
        <div className="text-center">
          <Icon name={state === 'ok' ? 'check' : 'bell'} className={'mx-auto mb-5 size-9 ' + (state === 'fail' ? 'text-danger' : 'text-brand')} />
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
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyBody />
    </Suspense>
  );
}
