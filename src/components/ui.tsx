'use client';

/* 领域组件的薄适配层，交互与样式由 shadcn/ui + Radix 负责。 */
import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './ui/button';
import { Badge as BaseBadge } from './ui/badge';
import { Icon } from './icons';
import { validDate } from '@/lib/records';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './ui/alert-dialog';

function returnFocusTarget(): HTMLElement | null {
  if (typeof document === 'undefined' || !(document.activeElement instanceof HTMLElement)) return null;
  const active = document.activeElement;
  const menu = active.closest('[role="menu"]');
  const triggerId = menu?.getAttribute('aria-labelledby');
  return (triggerId && document.getElementById(triggerId)) || active;
}

function useReturnFocus() {
  const target = useRef(returnFocusTarget());
  return (event: Event) => {
    event.preventDefault();
    if (!document.querySelector('[role="dialog"], [role="alertdialog"]') && target.current?.isConnected) target.current.focus();
  };
}

export function Modal({ title, description, onClose, children, footer }: { title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const descriptionId = useId();
  const onCloseAutoFocus = useReturnFocus();
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent aria-describedby={description ? descriptionId : undefined} onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}</DialogHeader>
      <div className="min-h-0 overflow-y-auto px-6 pb-6 text-sm sm:px-8 sm:pb-8">{children}</div>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </DialogContent>
  </Dialog>;
}

const BADGE_CLASS: Record<string, string> = {
  overdue: 'border-danger/10 bg-danger-soft text-danger',
  today: 'border-warn/10 bg-warn-soft text-warn',
  soon: 'border-brand/10 bg-brand-soft text-mint-ink',
  fine: 'border-border bg-muted/50 text-muted-foreground',
  none: 'border-transparent bg-muted text-muted-foreground',
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <BaseBadge className={cn(BADGE_CLASS[tone] || BADGE_CLASS.none)}>{children}</BaseBadge>;
}

export const STATUS_TEXT: Record<string, string> = {
  overdue: 'font-medium text-danger',
  today: 'font-medium text-warn',
  soon: 'text-brand',
  fine: 'text-ink-3',
  none: 'text-ink-3',
};

/* 本地日历日期：细数字与星期保持对齐，无彩色日历色带。 */
export function DateTile({ date, tone }: { date?: string; tone: string }) {
  if (!date || !validDate(date)) return <span className="inline-flex shrink-0 flex-col gap-1 text-ink-3"><span className="text-xl">—</span><span className="text-xs">未设</span></span>;
  const localDate = new Date(date + 'T00:00:00');
  return <time dateTime={date} title={date} data-tone={tone} className="inline-flex shrink-0 flex-col gap-1 text-ink">
    <span className="text-lg font-semibold leading-7 tracking-tight tabular-nums sm:text-[28px] sm:leading-9">{date.slice(5).replace('-', '.')}</span>
    <span className="text-xs font-normal text-ink-3 sm:text-sm">{localDate.toLocaleDateString('zh-CN', { weekday: 'short' })}</span>
  </time>;
}

/* 手机也保留文字与 44px 点击区域，避免仅靠图标猜测操作。 */
export function DoneButton({ label, title, icon = 'check', onClick }: { label: string; title: string; icon?: string; onClick: () => void }) {
  return <Button variant="secondary" aria-label={label + '：' + title} onClick={onClick}
    className="h-11 shrink-0 px-3 text-mint-ink sm:px-4 sm:text-base">
    <Icon name={icon} className="hidden size-4 sm:block" /><span>{label}</span>
  </Button>;
}

type BtnProps =Omit<ButtonProps, 'variant'> & { variant?: 'default' | 'primary' | 'soft' | 'quiet' | 'danger' };
const VARIANTS = { default: 'outline', primary: 'default', soft: 'secondary', quiet: 'ghost', danger: 'destructive' } as const;

export function Btn({ variant = 'default', ...props }: BtnProps) {
  return <Button variant={VARIANTS[variant]} {...props} />;
}

export function ConfirmDialog({ title, description, busy, onCancel, onConfirm }: { title: string; description: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const onCloseAutoFocus = useReturnFocus();
  return <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
    <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription>
      <div className="flex justify-end gap-2">
        <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
        <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); onConfirm(); }}>{busy ? '处理中…' : '确认删除'}</AlertDialogAction>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}
