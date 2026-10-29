'use client';

import { useState } from 'react';
import { searchCountries } from '@/lib/model';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './command';

export function CountryCombobox({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const countries = searchCountries(query);
  const select = (next: string) => { onChange(next); setOpen(false); };
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setQuery(''); }}>
    <PopoverTrigger asChild>
      <Button id={id} aria-label="归属国家" role="combobox" aria-expanded={open} variant="outline" className={cn('w-full min-w-0 justify-between px-3 font-normal', !value && 'text-muted-foreground')}>
        <span className="truncate">{value || '选择国家或地区'}</span><Icon name="chevron" className="size-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0">
      <Command shouldFilter={false}>
        <CommandInput aria-label="搜索国家" placeholder="搜索中文或英文…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>没有找到匹配的国家</CommandEmpty>
          {countries.map(([name, english, flag]) => <CommandItem key={name} value={name} onSelect={() => select(name)}>
            <span>{flag}</span><span>{name}</span><span className="ml-auto text-xs text-muted-foreground">{english}</span>
            {name === value && <Icon name="check" className="size-3.5 text-primary" />}
          </CommandItem>)}
          {query.trim() && !countries.some(([name]) => name === query.trim()) && <CommandItem value="custom" onSelect={() => select(query.trim())}>使用“{query.trim()}”</CommandItem>}
          {value && <CommandItem value="clear" onSelect={() => select('')}>清除选择</CommandItem>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
