'use client';

/* shadcn/ui new-york，按晴空朋友主题定制；复用项目内联图标。 */
import type { ComponentProps } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border border-primary bg-primary text-primary-foreground hover:bg-brand-hover',
        outline: 'border border-line bg-background text-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground',
        secondary: 'border border-transparent bg-secondary text-secondary-foreground hover:bg-hero',
        ghost: 'border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'border border-destructive bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs pointer-coarse:min-h-11',
        xs: 'h-7 rounded-lg px-2.5 text-xs pointer-coarse:min-h-9',
        lg: 'h-11 px-6',
        icon: 'size-11 p-0',
        'icon-sm': 'size-8 rounded-lg p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
