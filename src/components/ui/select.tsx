'use client';

import type { ComponentProps } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icons';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn('flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:truncate pointer-coarse:min-h-11', className)} {...props}>
    {children}<SelectPrimitive.Icon asChild><Icon name="chevron" className="size-4 shrink-0 text-muted-foreground" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>;
}

export function SelectContent({ className, children, position = 'popper', ...props }: ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal>
    <SelectPrimitive.Content data-slot="select-content" position={position} sideOffset={6} collisionPadding={12} className={cn('relative z-[70] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-popover outline-none duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)} {...props}>
      <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center"><Icon name="chevron" className="size-3 rotate-180" /></SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center"><Icon name="chevron" className="size-3" /></SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>;
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn('relative flex min-h-9 w-full cursor-default select-none items-center rounded-lg py-2 pl-3 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 pointer-coarse:min-h-11', className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 grid size-4 place-items-center"><SelectPrimitive.ItemIndicator><Icon name="check" className="size-3.5" /></SelectPrimitive.ItemIndicator></span>
  </SelectPrimitive.Item>;
}
