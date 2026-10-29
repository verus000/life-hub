'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';
import { Icon } from '@/components/icons';

export function Toaster() {
  return <Sonner theme="light" position="bottom-right" closeButton duration={2600} containerAriaLabel="通知"
    icons={{ success: <Icon name="check" className="size-4 text-ok" /> }}
    style={{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)', '--border-radius': '12px' } as CSSProperties}
    toastOptions={{ closeButtonAriaLabel: '关闭提示', classNames: { toast: 'font-sans text-sm shadow-popover', description: 'text-muted-foreground' } }} />;
}
