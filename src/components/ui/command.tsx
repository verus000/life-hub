'use client';

import type { ComponentProps } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icons';

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive className={cn('flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground', className)} {...props} />;
}

export function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return <div className="flex items-center gap-2 border-b border-border px-3">
    <Icon name="search" className="size-4 text-muted-foreground" />
    <CommandPrimitive.Input className={cn('flex h-11 w-full min-w-0 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:opacity-50 sm:text-sm', className)} {...props} />
  </div>;
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn('max-h-56 overflow-y-auto overflow-x-hidden p-1', className)} {...props} />;
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground" {...props} />;
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item className={cn('relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground pointer-coarse:min-h-11', className)} {...props} />;
}
