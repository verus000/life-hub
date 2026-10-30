'use client';

/* 分类列表：同一网格对齐名称、日期、金额；手机改为上下分组。 */

import { useEffect, useId, useRef, useState } from 'react';
import { CATEGORIES, dateLabel, get, isActive, reminderCycle, statusOf } from '@/lib/model';
import { CYCLES, STATUSES, validDate } from '@/lib/records';
import type { Item } from '@/lib/types';
import { Badge, Btn, DateTile, DoneButton, STATUS_TEXT } from '@/components/ui';
import { Icon } from '@/components/icons';
import { AssetDistribution } from '@/components/AssetDistribution';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select-field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const ACTION_LABEL: Record<string, string> = { phone: '记录保活', broadband: '记录续费', parking: '记录缴费', asset: '记录复核' };
const LIST_META: Record<string, string[]> = {
  phone: ['provider', 'detail.country'], broadband: ['provider', 'detail.speed'],
  parking: ['provider', 'detail.slot', 'detail.cardType'], asset: ['provider', 'detail.assetType'],
};
const PERIOD: Record<string, string> = { weekly: '周', monthly: '月', quarterly: '季', semiannual: '半年', yearly: '年' };
const DUE_FILTERS: Array<[string, string]> = [
  ['all', '全部到期状态'], ['overdue', '已逾期'], ['today', '今日到期'],
  ['soon', '7 日内'], ['fine', '正常'], ['none', '未设日期'],
];
type ItemActions = {
  onMarkDone: (id: number) => void;
  onOpenEdit: (id: number) => void;
  onHistory: (id: number) => void;
  onChangeStatus: (id: number, status: string) => void;
  onRemove: (id: number) => void;
};

function ItemRow({ x, category, ...actions }: { x: Item; category: string } & ItemActions) {
  const status = statusOf(x);
  const active = isActive(x);
  const statusLabel = category === 'asset'
    ? !x.nextDate ? '未设复核日期' : status.days !== null && status.days > 0 ? status.days + ' 天后复核' : status.days === 0 ? '今日复核' : status.label
    : status.label;
  const title = x.title || '(未命名)';
  const meta = LIST_META[category].map((path) => get(x, path)).filter((value) => value !== '' && value !== null && value !== undefined).join(' · ');
  const extra: string[] = [];
  if (category === 'phone') extra.push('保活：' + (CYCLES[reminderCycle(x)] || '每月'), String(x.detail?.strategy || ''));
  if (category === 'broadband' && x.detail?.contractDate) extra.push('合约到期：' + dateLabel(String(x.detail.contractDate)));
  if (x.detail?.lastCompletedAt) extra.push('最近处理：' + dateLabel(String(x.detail.lastCompletedAt)));

  return <li className={'category-columns category-row' + (category === 'asset' ? ' category-asset-row' : '')}>
    <div className="category-name flex min-w-0 items-start gap-4">
      <span className="category-icon hidden md:grid"><Icon name={category} className="size-6" /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="break-words text-left text-[15px] font-semibold text-ink outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-brand sm:text-lg" onClick={() => actions.onOpenEdit(x.id)}>{title}</button>
          {!active && <Badge tone="none">{STATUSES[x.status || 'active']}</Badge>}
        </div>
        {meta && <p className="m-0 mt-1 break-words text-[13px] text-ink-2">{meta}</p>}
        {extra.filter(Boolean).length > 0 && <p className="m-0 mt-1 break-words text-[13px] text-ink-3">{extra.filter(Boolean).join(' · ')}</p>}
        {x.note && <p className="m-0 mt-1 break-words text-[13px] text-ink-3">{x.note}</p>}
        {active && <p className={'m-0 mt-1 text-[13px] md:hidden ' + STATUS_TEXT[status.key]}>{statusLabel}</p>}
      </div>
    </div>
    <div className="category-date">
      <div className={category === 'asset' ? 'md:hidden' : ''}>
        <DateTile date={x.nextDate} tone={active ? status.key : 'none'} />
        {active && <p className={'m-0 mt-1.5 hidden text-[13px] md:block ' + STATUS_TEXT[status.key]}>{statusLabel}</p>}
      </div>
      {category === 'asset' && <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 md:flex">
        <time dateTime={validDate(x.nextDate) ? x.nextDate : undefined} className="text-base font-semibold text-ink tabular-nums">{validDate(x.nextDate) ? x.nextDate.slice(5).replace('-', '.') : '—'}</time>
        {active && <span className={'text-[13px] ' + STATUS_TEXT[status.key]}>{statusLabel}</span>}
      </div>}
    </div>
    <div className="category-amount min-w-0 break-words text-sm text-ink tabular-nums sm:text-base">
      {x.amount === null || x.amount === undefined ? '—' : <>{x.currency || 'CNY'} {Number(x.amount).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}{category !== 'asset' && PERIOD[x.cycle] && <span className="ml-1 text-[13px] text-ink-2">/ {PERIOD[x.cycle]}</span>}</>}
    </div>
    <div className="category-actions">
      {active ? <DoneButton label={ACTION_LABEL[category]} title={title} icon="edit" onClick={() => actions.onMarkDone(x.id)} />
        : <Btn onClick={() => actions.onChangeStatus(x.id, 'active')}>恢复在用</Btn>}
      <ItemMenu x={x} {...actions} />
    </div>
  </li>;
}

/* 条目管理菜单：编辑、处理记录、暂停、归档、删除；首页与分类列表共用 */
export function ItemMenu({
  x,
  onOpenEdit,
  onHistory,
  onChangeStatus,
  onRemove,
}: {
  x: Item;
  onOpenEdit: (id: number) => void;
  onHistory: (id: number) => void;
  onChangeStatus: (id: number, status: string) => void;
  onRemove: (id: number) => void;
}) {
  const active = isActive(x);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={'更多操作：' + (x.title || '')}><Icon name="more" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>条目操作</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onOpenEdit(x.id)}><Icon name="edit" />编辑条目</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onHistory(x.id)}><Icon name="history" />处理记录</DropdownMenuItem>
        {active && <DropdownMenuItem onSelect={() => onChangeStatus(x.id, 'paused')}><Icon name="pause" />暂停条目</DropdownMenuItem>}
        {x.status !== 'archived' && <DropdownMenuItem onSelect={() => onChangeStatus(x.id, 'archived')}><Icon name="archive" />归档条目</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onRemove(x.id)}><Icon name="trash" />删除条目</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CategoryList({
  items, category, keyword, filter, lifecycle, onKeyword, onFilter, onLifecycle, onOpenAdd, ...actions
}: {
  items: Item[];
  category: string;
  keyword: string;
  filter: string;
  lifecycle: string;
  onKeyword: (value: string) => void;
  onFilter: (value: string) => void;
  onLifecycle: (value: string) => void;
  onOpenAdd: (category?: string) => void;
} & ItemActions) {
  const filterId = useId();
  const def = CATEGORIES[category];
  const [search, setSearch] = useState(keyword);
  const composing = useRef(false);
  useEffect(() => { setSearch(keyword); }, [keyword]);
  let list = items.filter((item) => item.category === category && (lifecycle === 'all' || (item.status || 'active') === lifecycle));
  const query = keyword.trim().toLowerCase();
  if (query) list = list.filter((item) => [item.title, item.provider, item.note]
    .concat(Object.values(item.detail || {}).filter((value) => typeof value !== 'object').map(String)).join(' ').toLowerCase().includes(query));
  if (filter !== 'all') list = list.filter((item) => statusOf(item).key === filter);
  list = [...list].sort((a, b) => !a.nextDate && !b.nextDate ? String(a.title).localeCompare(String(b.title)) : !a.nextDate ? 1 : !b.nextDate ? -1 : a.nextDate.localeCompare(b.nextDate));
  const total = items.filter((item) => item.category === category).length;
  const filterActive = lifecycle !== 'active' || filter !== 'all';

  function resetFilters() {
    setSearch('');
    onKeyword('');
    onFilter('all');
    onLifecycle('active');
  }

  return <div className="grid gap-5">
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-[620px]">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-2" />
        <Input type="text" aria-label="搜索记录" placeholder={category === 'phone' ? '搜索号码、运营商或备注…' : '搜索名称、机构或备注…'}
          value={search}
          onCompositionStart={() => { composing.current = true; }}
          onChange={(event) => {
            setSearch(event.target.value);
            if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) onKeyword(event.target.value);
          }}
          onCompositionEnd={(event) => { composing.current = false; onKeyword(event.currentTarget.value); }}
          className="border-line bg-transparent pl-10 shadow-none" />
      </div>
      <Popover><PopoverTrigger asChild>
        <Button variant="secondary" aria-label={filterActive ? '筛选，已启用' : '筛选'}><Icon name="filter" />筛选{filterActive && <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />}</Button>
      </PopoverTrigger><PopoverContent align="end" className="w-64 space-y-4">
        <div className="space-y-2"><Label htmlFor={filterId + '-status'}>条目状态</Label><SelectField id={filterId + '-status'} label="条目状态" value={lifecycle} onChange={onLifecycle} options={[['all', '全部记录'], ...Object.entries(STATUSES)]} /></div>
        <div className="space-y-2"><Label htmlFor={filterId + '-due'}>到期状态</Label><SelectField id={filterId + '-due'} label="到期状态" value={filter} onChange={onFilter} options={DUE_FILTERS} /></div>
        {filterActive && <Button variant="link" className="h-auto p-0" onClick={resetFilters}>重置筛选</Button>}
      </PopoverContent></Popover>
      <span className="ml-auto hidden text-sm text-ink-2 md:inline">{STATUSES[lifecycle] || '全部记录'} · {list.length === total ? total + ' 条' : list.length + ' / ' + total + ' 条'}</span>
    </div>
    {category === 'asset' && <AssetDistribution items={items} />}
    {list.length ? <div>
      <div className="category-columns hidden border-b border-line pb-4 pt-4 text-[13px] text-ink-2 md:grid">
        <span>{category === 'phone' ? '号码' : category === 'asset' ? '账户' : '名称'}</span>
        <span>{category === 'phone' ? '保活日期' : category === 'asset' ? '当前余额' : '到期日期'}</span>
        <span>{category === 'asset' ? '复核日期' : '每期费用'}</span><span className="w-[156px] pl-3">操作</span>
      </div>
      <ul className="m-0 list-none divide-y divide-line border-b border-line p-0">{list.map((item) => <ItemRow key={item.id} x={item} category={category} {...actions} />)}</ul>
      <p className="m-0 mt-5 flex items-center gap-2 text-xs text-ink-3"><Icon name="edit" className="size-3.5" />点击名称可编辑，更多操作在右侧菜单。</p>
    </div> : <div className="flex min-h-64 flex-col items-center justify-center py-10 text-center">
      <Icon name={category} className="mb-4 size-9 text-brand" />
      <h2 className="m-0 text-lg font-semibold text-ink">{total ? '没有符合条件的记录' : '还没有' + def.label + '记录'}</h2>
      <p className="m-0 mt-2 text-sm text-ink-2">{total ? '换个关键词，或切换状态看看其他记录。' : '记下第一条，往后的安排就有了着落。'}</p>
      {total ? <Btn className="mt-5" onClick={resetFilters}>重置搜索与筛选</Btn> : <Btn variant="primary" className="mt-5" onClick={() => onOpenAdd(category)}><Icon name="plus" />添加{def.label}</Btn>}
    </div>}
  </div>;
}
