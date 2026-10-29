import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" type={type} className={cn(
    'flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15 aria-invalid:border-destructive aria-invalid:ring-destructive/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm pointer-coarse:min-h-11',
    className,
  )} {...props} />;
}
