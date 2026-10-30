'use client';

/* 领域组件的薄适配层，交互与样式由 shadcn/ui + Radix 负责。 */
import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './ui/button';
import { Badge as BaseBadge } from './ui/badge';
import { Icon } from './icons';
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
      <div className="min-h-0 overflow-y-auto px-6 pb-6 text-sm">{children}</div>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </DialogContent>
  </Dialog>;
}

const BADGE_CLASS: Record<string, string> = {
  overdue: 'border-danger/10 bg-danger-soft text-danger',
  today: 'border-warn/10 bg-warn-soft text-warn',
  soon: 'border-brand/10 bg-brand-soft text-brand',
  fine: 'border-border bg-muted/50 text-muted-foreground',
  none: 'border-transparent bg-muted text-muted-foreground',
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <BaseBadge className={cn(BADGE_CLASS[tone] || BADGE_CLASS.none)}>{children}</BaseBadge>;
}

const TILE_BAND: Record<string, string> = {
  overdue: 'bg-danger text-white',
  today: 'bg-sun text-ink',
  soon: 'bg-brand text-white',
  fine: 'bg-ink-3 text-white',
  none: 'bg-line-strong text-ink-2',
};

export const STATUS_TEXT: Record<string, string> = {
  overdue: 'font-medium text-danger',
  today: 'font-medium text-warn',
  soon: 'text-brand',
  fine: 'text-ink-3',
  none: 'text-ink-3',
};

/* 日历块：像一页撕下的日历，顶部月份色带随到期状态变色；无日期时显示“未设”。 */
export function DateTile({ date, tone }: { date?: string; tone: string }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  return <span className="flex h-[52px] w-12 shrink-0 flex-col overflow-hidden rounded-xl bg-surface text-center ring-1 ring-line" aria-hidden="true">
    <span className={cn('text-[11px] font-semibold leading-[18px]', TILE_BAND[tone] || TILE_BAND.none)}>{m ? Number(m[2]) + '月' : '未设'}</span>
    <span className="grid flex-1 place-items-center text-lg font-bold leading-none text-ink tabular-nums">{m ? Number(m[3]) : '—'}</span>
  </span>;
}

/* 行内主操作：手机上是圆形图标按钮，宽屏补上文字。 */
export function DoneButton({ label, title, icon = 'check', onClick }: { label: string; title: string; icon?: string; onClick: () => void }) {
  return <Button variant="outline" aria-label={label + '：' + title} onClick={onClick}
    className="size-10 shrink-0 rounded-full p-0 pointer-coarse:min-w-11 text-brand hover:border-brand hover:bg-brand hover:text-primary-foreground sm:w-auto sm:px-4">
    <Icon name={icon} /><span className="hidden sm:inline">{label}</span>
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
