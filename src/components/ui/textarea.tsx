import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(
    'flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
    className,
  )} {...props} />;
}
