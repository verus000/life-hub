'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { addDays, todayStr } from '@/lib/model';
import { validDate } from '@/lib/records';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type DatePickerProps = { id?: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

export function DatePicker({ id, label, value, onChange, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  /* 按本地日历解析/格式化，不能用 toISOString 截取业务日期。 */
  const selected = validDate(value) ? new Date(value + 'T12:00:00') : undefined;
  const choose = (next: string) => { onChange(next); setOpen(false); };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button id={id} aria-label={label} variant="outline" disabled={disabled} className={cn('w-full min-w-0 justify-start px-3 font-normal', !value && 'text-muted-foreground')}>
        <Icon name="calendar" className="size-4 text-muted-foreground" />
        <span className="truncate">{selected ? format(selected, 'yyyy年M月d日') : value || '选择日期'}</span>
        <Icon name="chevron" className="ml-auto size-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[286px] p-0" aria-label={label + '日历'}>
      <Calendar mode="single" required selected={selected} defaultMonth={selected}
        startMonth={new Date(Math.min(1900, selected?.getFullYear() ?? 1900), 0)}
        endMonth={new Date(Math.max(2100, selected?.getFullYear() ?? 2100), 11)}
        onSelect={(date) => { if (date) choose(format(date, 'yyyy-MM-dd')); }} />
      <div className="space-y-2 border-t border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <Button size="xs" variant="secondary" onClick={() => choose(todayStr())}>今天</Button>
          <Button size="xs" variant="ghost" disabled={!value} onClick={() => choose('')}>清除日期</Button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-auto text-[11px] text-muted-foreground">顺延</span>
          {[7, 30, 90].map((days) => <Button key={days} size="xs" variant="outline" onClick={() => choose(addDays(validDate(value) ? value : todayStr(), days))}>+{days}天</Button>)}
        </div>
      </div>
    </PopoverContent>
  </Popover>;
}
