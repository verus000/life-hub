'use client';

/* 分类列表：搜索与筛选工具栏、条目卡片、更多操作 */

import { useId } from 'react';
import { CATEGORIES, dateLabel, get, isActive, moneyLabel, reminderCycle, statusOf } from '@/lib/model';
import { CYCLES, STATUSES } from '@/lib/records';
import type { Item } from '@/lib/types';
import { Badge, Btn, DateTile, DoneButton, STATUS_TEXT } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { SelectField } from '@/components/ui/select-field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const ACTION_LABEL: Record<string, string> = {
  phone: '记录保活',
  broadband: '记录续费',
  parking: '记录缴费',
  asset: '记录复核',
};
const LIST_META: Record<string, string[]> = {
  phone: ['detail.country', 'provider', 'amount'],
  broadband: ['provider', 'detail.speed', 'amount'],
  parking: ['provider', 'detail.slot', 'detail.cardType', 'amount'],
  asset: ['detail.assetType', 'provider', 'amount'],
};
const DUE_FILTERS: Array<[string, string]> = [
  ['all', '全部到期状态'],
  ['overdue', '已逾期'],
  ['today', '今日到期'],
  ['soon', '7 日内'],
  ['fine', '正常'],
  ['none', '未设日期'],
];

function ItemCard({
  x,
  category,
  onMarkDone,
  onOpenEdit,
  onHistory,
  onChangeStatus,
  onRemove,
}: {
  x: Item;
  category: string;
  onMarkDone: (id: number) => void;
  onOpenEdit: (id: number) => void;
  onHistory: (id: number) => void;
  onChangeStatus: (id: number, status: string) => void;
  onRemove: (id: number) => void;
}) {
  const def = CATEGORIES[category];
  const st = statusOf(x);

  const meta = (LIST_META[category] || [])
    .map((k) => {
      const f = def.fields.find((o) => o.key === k);
      if (!f) return null;
      let v = get(x, k);
      if (v === '' || v === null || v === undefined) return null;
      if (f.type === 'number') v = moneyLabel(Number(v), x.currency);
      if (f.type === 'select') {
        const o = (f.options || []).find((o) => String(o[0]) === String(v));
        v = o ? o[1] : v;
      }
      return String(v);
    })
    .filter(Boolean);

  const extra: string[] = [];
  if (category === 'phone') extra.push('保活：' + (CYCLES[reminderCycle(x)] || '每月'));
  if (category === 'broadband' && (x.detail || {}).contractDate) extra.push('合约到期：' + dateLabel(String(x.detail.contractDate)));
  if ((x.detail || {}).lastCompletedAt) extra.push('最近处理：' + dateLabel(String(x.detail.lastCompletedAt)));

  const active = isActive(x);
  const title = x.title || '(未命名)';

  return (
    <li className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
      <DateTile date={x.nextDate} tone={active ? st.key : 'none'} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* 标题即编辑入口，手机上省掉单独的编辑按钮 */}
          <button type="button" className="break-words text-left text-[15px] font-semibold text-ink outline-none hover:text-brand focus-visible:text-brand" onClick={() => onOpenEdit(x.id)}>
            {title}
          </button>
          {!active ? <Badge tone="none">{STATUSES[x.status || 'active']}</Badge> : null}
        </div>
        {active && (x.nextDate || def.hasDue) ? (
          <div className="mt-0.5 text-[13px] text-ink-3">
            <span className={STATUS_TEXT[st.key]}>{st.label}</span>
            {x.nextDate ? <span className="hidden sm:inline">{' · ' + dateLabel(x.nextDate)}</span> : null}
          </div>
        ) : null}
        {meta.length ? <div className="mt-1 break-words text-[13px] text-ink-2">{meta.join(' · ')}</div> : null}
        {extra.length ? <div className="mt-0.5 text-[13px] text-ink-3">{extra.join(' · ')}</div> : null}
        {x.note ? <div className="mt-0.5 break-words text-[13px] text-ink-3">{x.note}</div> : null}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {active ? (
          <DoneButton label={ACTION_LABEL[category]} title={title} onClick={() => onMarkDone(x.id)} />
        ) : (
          <Btn onClick={() => onChangeStatus(x.id, 'active')}>
            恢复在用
          </Btn>
        )}
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label={'编辑：' + title} onClick={() => onOpenEdit(x.id)}>
          <Icon name="edit" />
        </Button>
        <ItemMenu x={x} onOpenEdit={onOpenEdit} onHistory={onHistory} onChangeStatus={onChangeStatus} onRemove={onRemove} />
      </div>
    </li>
  );
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
  items,
  category,
  keyword,
  filter,
  lifecycle,
  onKeyword,
  onFilter,
  onLifecycle,
  onMarkDone,
  onOpenEdit,
  onOpenAdd,
  onHistory,
  onChangeStatus,
  onRemove,
}: {
  items: Item[];
  category: string;
  keyword: string;
  filter: string;
  lifecycle: string;
  onKeyword: (v: string) => void;
  onFilter: (v: string) => void;
  onLifecycle: (v: string) => void;
  onMarkDone: (id: number) => void;
  onOpenEdit: (id: number) => void;
  onOpenAdd: (category?: string) => void;
  onHistory: (id: number) => void;
  onChangeStatus: (id: number, status: string) => void;
  onRemove: (id: number) => void;
}) {
  const filterId = useId();
  const def = CATEGORIES[category];

  let list = items.filter(
    (x) => x.category === category && (lifecycle === 'all' || (x.status || 'active') === lifecycle),
  );

  const kw = keyword.trim().toLowerCase();
  if (kw) {
    list = list.filter((x) =>
      [x.title, x.provider, x.note]
        .concat(Object.values(x.detail || {}).filter((v) => typeof v !== 'object').map(String))
        .join(' ')
        .toLowerCase()
        .includes(kw),
    );
  }
  if (filter !== 'all') {
    list = list.filter((x) => statusOf(x).key === filter);
  }

  list = [...list].sort((a, b) => {
    const da = a.nextDate;
    const db = b.nextDate;
    if (!da && !db) return String(a.title).localeCompare(String(b.title));
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const categoryTotal = items.filter((x) => x.category === category).length;
  const filterActive = lifecycle !== 'active' || filter !== 'all';

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 basis-[160px]">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            aria-label="搜索记录"
            placeholder="搜索名称、机构或备注…"
            value={keyword}
            onChange={(e) => {
              if (!(e.nativeEvent as InputEvent).isComposing) onKeyword(e.target.value);
            }}
            onCompositionEnd={(e) => onKeyword((e.target as HTMLInputElement).value)}
            className="h-11 border-transparent bg-surface pl-10 shadow-card hover:border-line"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 border-transparent shadow-card" aria-label={filterActive ? '筛选，已启用' : '筛选'}>
              <Icon name="filter" />筛选
              {filterActive && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 space-y-4">
            <div className="space-y-2.5">
              <Label htmlFor={filterId + '-status'}>条目状态</Label>
              <SelectField id={filterId + '-status'} label="条目状态" value={lifecycle} onChange={onLifecycle}
                options={[['all', '全部记录'], ...Object.entries(STATUSES)]} />
            </div>
            {(def.hasDue || category === 'asset') && <div className="space-y-2.5">
              <Label htmlFor={filterId + '-due'}>到期状态</Label>
              <SelectField id={filterId + '-due'} label="到期状态" value={filter} onChange={onFilter} options={DUE_FILTERS} />
            </div>}
          </PopoverContent>
        </Popover>
      </div>

      {list.length ? (
        <Card className="overflow-hidden">
          <ul className="m-0 list-none divide-y divide-line p-0">
            {list.map((x) => (
              <ItemCard
                key={x.id}
                x={x}
                category={category}
                onMarkDone={onMarkDone}
                onOpenEdit={onOpenEdit}
                onHistory={onHistory}
                onChangeStatus={onChangeStatus}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="flex flex-col items-center px-5 py-12 text-center">
          <span className="category-icon mb-2" data-category={category}>
            <Icon name={category} className="w-6 h-6" />
          </span>
          <span className="mt-2 text-base font-bold text-ink">
            {categoryTotal ? '没有符合条件的记录' : '还没有' + def.label + '记录'}
          </span>
          <p className="m-0 mt-1.5 text-sm text-ink-3">{categoryTotal ? '换个关键词，或切换状态看看其他记录。' : '记下第一条，往后的安排就有了着落。'}</p>
          <Btn variant="primary" className="mt-5" onClick={() => onOpenAdd(category)}>
            <Icon name="plus" />添加{def.label}
          </Btn>
        </Card>
      )}
    </div>
  );
}
