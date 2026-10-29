'use client';

/* 基于 shadcn/ui Calendar；月份与年份同样使用 Radix Select。 */
import type { ChangeEvent, ComponentProps } from 'react';
import { DayPicker, type DropdownProps } from 'react-day-picker';
import { zhCN } from 'react-day-picker/locale';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icons';
import { buttonVariants } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

function CalendarDropdown({ options, value, onChange, disabled, 'aria-label': label }: DropdownProps) {
  return <Select value={String(value)} disabled={disabled} onValueChange={(next) => {
    onChange?.({ target: { value: next } } as ChangeEvent<HTMLSelectElement>);
  }}>
    <SelectTrigger aria-label={label} className="h-8 w-auto gap-1.5 rounded-lg border-transparent px-2 text-xs shadow-none pointer-coarse:min-h-9"><SelectValue /></SelectTrigger>
    <SelectContent>{options?.map((option) => <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: ComponentProps<typeof DayPicker>) {
  return <DayPicker locale={zhCN} showOutsideDays={showOutsideDays} captionLayout="dropdown" className={cn('w-full p-3', className)}
    formatters={{ formatMonthDropdown: (date) => (date.getMonth() + 1) + '月', formatYearDropdown: (date) => date.getFullYear() + '年' }}
    classNames={{
      months: 'relative flex flex-col', month: 'w-full space-y-3',
      month_caption: 'flex h-9 items-center justify-center px-8', caption_label: 'text-sm font-medium', dropdowns: 'flex items-center gap-1',
      nav: 'pointer-events-none absolute inset-x-0 top-0 flex justify-between',
      button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'pointer-events-auto size-9'),
      button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'pointer-events-auto size-9'),
      month_grid: 'w-full border-collapse', weekdays: 'flex',
      weekday: 'flex-1 py-1 text-center text-[11px] font-normal text-muted-foreground', week: 'mt-1 flex w-full',
      day: 'relative flex-1 text-center text-sm',
      day_button: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'h-9 w-full rounded-lg text-[13px] font-normal'),
      selected: '[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:shadow-xs [&_button]:hover:bg-primary',
      today: 'rounded-lg [&_button]:font-semibold [&:not([data-selected=true])]:bg-secondary [&:not([data-selected=true])_button]:text-primary',
      outside: '[&_button]:text-muted-foreground/45', disabled: 'opacity-35', hidden: 'invisible', ...classNames,
    }}
    components={{
      Chevron: ({ orientation }) => <Icon name="chevron" className={cn('size-4', orientation === 'left' && 'rotate-90', orientation === 'right' && '-rotate-90')} />,
      Dropdown: CalendarDropdown,
    }} {...props} />;
}
