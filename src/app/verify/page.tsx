'use client';

/* 邮箱激活：读取 ?token= 调用验证接口（成功即写入会话 Cookie），展示结果 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/icons';
import { Btn } from '@/components/ui';

function VerifyBody() {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('fail');
      setMessage('激活链接无效');
      return;
    }
    fetch('/api/auth/verify?token=' + encodeURIComponent(token))
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
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
        setState('fail');
        setMessage('无法连接服务，请稍后重试');
      });
  }, [token]);

  return (
    <div className="fixed inset-0 z-80 grid place-items-center p-6 bg-[#F4F8FAEE]">
      <div className="w-full max-w-[360px] px-7 py-8 rounded-[18px] bg-surface border border-line shadow-[0_18px_44px_#2940351F] text-center">
        <div className="flex items-center justify-center gap-2.5 mb-3 text-brand">
          <Logo className="w-6 h-6" />
          <span className="text-[15px] font-medium text-ink">生活管理</span>
        </div>
        <h2 className="m-0 mb-3 text-[17px] font-medium text-ink">
          {state === 'loading' ? '正在激活…' : state === 'ok' ? '激活成功' : '激活失败'}
        </h2>
        <p className="m-0 text-[13px] leading-relaxed text-ink-2">{message}</p>
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
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyBody />
    </Suspense>
  );
}
