'use client';

/* 通用对话框：遮罩点击关闭、标题栏、底部操作区 */

import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#29403559] p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] max-h-[86vh] flex flex-col rounded-2xl bg-surface border border-line shadow-[0_18px_44px_#29403526]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <h2 className="m-0 text-[15px] font-medium text-ink">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-soft hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto text-[13px] text-ink">{children}</div>
        {footer ? <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">{footer}</div> : null}
      </div>
    </div>
  );
}

/* 轻提示：受控显示，2.2 秒自动消失（由调用方管理定时器） */
export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed left-1/2 bottom-8 z-[70] -translate-x-1/2 px-4 py-2.5 rounded-xl bg-ink text-white text-[13px] shadow-lg opacity-95 pointer-events-none transition-opacity">
      {message}
    </div>
  );
}

/* 状态徽标：到期状态配色与原版一致 */
const BADGE_CLASS: Record<string, string> = {
  overdue: 'text-danger bg-danger-soft',
  today: 'text-warn bg-warn-soft',
  soon: 'text-brand bg-brand-soft',
  fine: 'text-ink-2 bg-surface-soft',
  none: 'text-ink-3 bg-surface-soft',
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className={
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] leading-5 font-medium ' +
        (BADGE_CLASS[tone] || BADGE_CLASS.none)
      }
    >
      {children}
    </span>
  );
}

/* 主按钮 / 次按钮：全站统一样式 */
export function Btn({
  variant = 'default',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'quiet' | 'danger' }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-[10px] text-[13px] font-medium transition-colors disabled:opacity-55 disabled:cursor-wait';
  const styles = {
    default: 'bg-surface border border-line-strong text-ink hover:bg-surface-soft',
    primary: 'bg-brand border border-brand text-white hover:brightness-95',
    quiet: 'bg-transparent border border-line text-ink-2 hover:bg-surface-soft hover:text-ink',
    danger: 'bg-surface border border-line-strong text-danger hover:bg-danger-soft',
  } as const;
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}
