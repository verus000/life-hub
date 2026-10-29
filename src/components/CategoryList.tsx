'use client';

/* 分类列表：搜索与筛选工具栏、条目卡片、更多操作 */

import { useState } from 'react';
import { CATEGORIES, get, isActive, money, reminderCycle, statusOf } from '@/lib/model';
import { CYCLES, STATUSES } from '@/lib/records';
import type { Item } from '@/lib/types';
import { Badge, Btn } from '@/components/ui';
import { Icon } from '@/components/icons';

const ACTION_LABEL: Record<string, string> = {
  phone: '记录保活',
  broadband: '记录续费',
  parking: '记录缴费',
  asset: '记录复核',
};
const LIST_META: Record<string, string[]> = {
  phone: ['detail.country', 'provider', 'amount', 'nextDate'],
  broadband: ['provider', 'detail.speed', 'amount', 'nextDate'],
  parking: ['provider', 'detail.slot', 'detail.cardType', 'amount', 'nextDate'],
  asset: ['detail.assetType', 'provider', 'amount', 'nextDate'],
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
  const [menuOpen, setMenuOpen] = useState(false);
  const def = CATEGORIES[category];
  const st = statusOf(x);

  const meta = (LIST_META[category] || [])
    .map((k) => {
      const f = def.fields.find((o) => o.key === k);
      if (!f) return null;
      let v = get(x, k);
      if (v === '' || v === null || v === undefined) return null;
      if (f.type === 'number') v = money(Number(v), x.currency);
      if (f.type === 'select') {
        const o = (f.options || []).find((o) => String(o[0]) === String(v));
        v = o ? o[1] : v;
      }
      if (k === 'detail.country') v = String(v);
      return (
        <span key={k} className="text-ink-3">
          {f.label}：<b className="text-ink-2 font-medium">{String(v)}</b>
        </span>
      );
    })
    .filter(Boolean);

  const extra: string[] = [];
  if (category === 'phone') extra.push('保活：' + (CYCLES[reminderCycle(x)] || '每月'));
  if (category === 'broadband' && (x.detail || {}).contractDate) extra.push('合约到期：' + x.detail.contractDate);
  if ((x.detail || {}).lastCompletedAt) extra.push('最近处理：' + String(x.detail.lastCompletedAt));

  const active = isActive(x);

  return (
    <div className="flex gap-3.5 p-4 rounded-2xl bg-surface border border-line">
      <span className="w-10 h-10 shrink-0 grid place-items-center rounded-[10px] bg-brand-soft text-brand">
        <Icon name={category} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <strong className="text-[14px] text-ink truncate">{x.title || '(未命名)'}</strong>
          {active && (def.hasDue || x.nextDate) ? (
            <Badge tone={st.key}>{st.label}</Badge>
          ) : (
            <Badge tone="none">{STATUSES[x.status || 'active']}</Badge>
          )}
        </div>
        {meta.length ? <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px]">{meta}</div> : null}
        {extra.length ? <div className="mt-1 text-[12px] text-ink-3">{extra.join(' · ')}</div> : null}
        {x.note ? <div className="mt-1 text-[12px] text-ink-3">{x.note}</div> : null}
      </div>
      <div className="flex items-start gap-2 shrink-0">
        {active ? (
          <Btn className="h-8 px-3 bg-brand-soft border-brand-soft text-brand hover:brightness-95" onClick={() => onMarkDone(x.id)}>
            {ACTION_LABEL[category]}
          </Btn>
        ) : (
          <Btn className="h-8 px-3" onClick={() => onChangeStatus(x.id, 'active')}>
            恢复在用
          </Btn>
        )}
        <Btn className="h-8 px-3" onClick={() => onOpenEdit(x.id)}>
          编辑
        </Btn>
        <div className="relative">
          <button
            className="w-8 h-8 grid place-items-center rounded-[10px] text-ink-3 hover:bg-surface-soft hover:text-ink"
            aria-label={'更多操作：' + (x.title || '')}
            title="更多操作"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
          >
            <Icon name="more" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-36 py-1 rounded-[10px] bg-surface border border-line shadow-lg">
              <button className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-surface-soft" onMouseDown={() => onHistory(x.id)}>
                处理记录
              </button>
              {active ? (
                <button className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-surface-soft" onMouseDown={() => onChangeStatus(x.id, 'paused')}>
                  暂停条目
                </button>
              ) : null}
              {x.status !== 'archived' ? (
                <button className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-surface-soft" onMouseDown={() => onChangeStatus(x.id, 'archived')}>
                  归档条目
                </button>
              ) : null}
              <button className="w-full text-left px-3 py-2 text-[13px] text-danger hover:bg-danger-soft" onMouseDown={() => onRemove(x.id)}>
                删除条目
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [filterOpen, setFilterOpen] = useState(false);
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
      <div className="flex gap-2.5 items-center flex-wrap">
        <label className="flex flex-1 min-w-[220px] items-center gap-2 h-9 px-3 rounded-[10px] bg-surface border border-line text-ink-3">
          <Icon name="search" className="w-4 h-4" />
          <input
            type="text"
            aria-label="搜索记录"
            placeholder="搜索名称、机构或备注…"
            value={keyword}
            onChange={(e) => {
              if (!(e.nativeEvent as InputEvent).isComposing) onKeyword(e.target.value);
            }}
            onCompositionEnd={(e) => onKeyword((e.target as HTMLInputElement).value)}
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-ink placeholder:text-ink-3"
          />
        </label>
        <div className="relative">
          <Btn variant="quiet" onClick={() => setFilterOpen((v) => !v)} onBlur={() => setTimeout(() => setFilterOpen(false), 150)}>
            筛选
            {filterActive ? <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-label="已启用筛选" /> : null}
          </Btn>
          {filterOpen && (
            <div className="absolute right-0 top-11 z-20 w-52 p-3 grid gap-2.5 rounded-[10px] bg-surface border border-line shadow-lg">
              <label className="grid gap-1 text-[12px] text-ink-2">
                条目状态
                <select
                  aria-label="条目状态"
                  value={lifecycle}
                  onChange={(e) => onLifecycle(e.target.value)}
                  className="min-h-[34px] px-2 rounded-lg border border-line-strong bg-white text-[13px] text-ink"
                >
                  <option value="all">全部记录</option>
                  {Object.entries(STATUSES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {def.hasDue || category === 'asset' ? (
                <label className="grid gap-1 text-[12px] text-ink-2">
                  到期状态
                  <select
                    aria-label="到期状态"
                    value={filter}
                    onChange={(e) => onFilter(e.target.value)}
                    className="min-h-[34px] px-2 rounded-lg border border-line-strong bg-white text-[13px] text-ink"
                  >
                    {DUE_FILTERS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {list.length ? (
        <div className="grid gap-2.5">
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
        </div>
      ) : (
        <div className="flex flex-col items-center py-10 rounded-2xl bg-surface border border-line text-center">
          <span className="w-12 h-12 grid place-items-center rounded-full bg-surface-soft text-ink-3">
            <Icon name={category} className="w-6 h-6" />
          </span>
          <span className="mt-2 text-[15px] text-ink">
            {categoryTotal ? '没有符合条件的记录' : '还没有' + def.label + '记录'}
          </span>
          <p className="m-0 mt-1.5 text-[13px] text-ink-3">可添加记录，或切换条目状态查看暂停和归档记录</p>
          <Btn className="mt-4" onClick={() => onOpenAdd()}>
            ＋ 添加{def.label}
          </Btn>
        </div>
      )}
    </div>
  );
}
