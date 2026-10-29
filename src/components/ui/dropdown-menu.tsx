'use client';

import type { ComponentProps } from 'react';
import { DropdownMenu as DropdownPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, onCloseAutoFocus, ...props }: ComponentProps<typeof DropdownPrimitive.Content>) {
  return <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} collisionPadding={12} onCloseAutoFocus={(event) => {
      onCloseAutoFocus?.(event);
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) event.preventDefault();
    }} className={cn('z-[60] min-w-44 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-popover outline-none duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95', className)} {...props} />
  </DropdownPrimitive.Portal>;
}

export function DropdownMenuItem({ className, variant = 'default', ...props }: ComponentProps<typeof DropdownPrimitive.Item> & { variant?: 'default' | 'destructive' }) {
  return <DropdownPrimitive.Item data-slot="dropdown-menu-item" className={cn('relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground pointer-coarse:min-h-11', variant === 'destructive' && 'text-destructive focus:bg-danger-soft focus:text-destructive [&_svg]:text-destructive', className)} {...props} />;
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn('px-2.5 py-2 text-xs font-medium text-muted-foreground', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn('-mx-1.5 my-1 h-px bg-border', className)} {...props} />;
}
