'use client';

/* 总览：优先事项 + 近期安排，支出与资产按需展开。 */

import { CATEGORIES, cycleLabel, dueEntries, isActive, moneyLabel, statusOf, totals } from '@/lib/model';
import type { DueEntry, Item } from '@/lib/types';
import { Btn, DateTile, DoneButton, STATUS_TEXT } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const ACTION_LABEL: Record<string, string> = {
  phone: '记录保活', broadband: '记录续费', parking: '记录缴费', asset: '记录复核',
};

export function Overview({
  items, onMarkDone, onOpenEdit, onOpenAdd, onGotoTab,
}: {
  items: Item[];
  onMarkDone: (id: number) => void;
  onOpenEdit: (id: number) => void;
  onOpenAdd: (category?: string) => void;
  onGotoTab: (tab: string) => void;
  onHistory: (id: number) => void;
  onChangeStatus: (id: number, status: string) => void;
  onRemove: (id: number) => void;
}) {
  const active = items.filter(isActive);
  const due = dueEntries(active);
  const urgent = due.filter((entry) => entry.d <= 0);
  const nextWeek = due.filter((entry) => entry.d > 0 && entry.d <= 7);
  const later = due.filter((entry) => entry.d > 7 && entry.d <= 30);
  const fallback = due.filter((entry) => entry.d > 30).slice(0, 6);
  const priority = urgent.length ? urgent : nextWeek.slice(0, 2);
  const upcoming = urgent.length ? nextWeek : nextWeek.slice(2);
  const overdue = urgent.filter((entry) => entry.d < 0).length;
  const todayCount = urgent.length - overdue;
  const now = new Date();
  const date = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');
  const annual = totals(active.filter((item) => item.category !== 'asset'), true, true);
  const foreign = totals(active.filter((item) => item.category === 'asset' && (item.currency || 'CNY') !== 'CNY'), false, true);
  const cny = active.filter((item) => item.category === 'asset' && (item.currency || 'CNY') === 'CNY')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  function agenda(entries: DueEntry[]) {
    return <ul className="m-0 list-none divide-y divide-line p-0">
      {entries.map((entry) => {
        const item = entry.x;
        const status = statusOf({ nextDate: entry.date } as Item);
        const metadata = item.category === 'asset' ? String(item.detail?.assetType || item.provider || '资产分布')
          : [item.provider, item.category === 'broadband' ? item.detail?.speed : item.category === 'parking' ? item.detail?.slot : '手机号'].filter(Boolean).join(' · ');
        return <li key={item.id + '-' + entry.kind} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-5 sm:py-10">
          <div className="self-start pt-0.5 sm:self-center"><DateTile date={entry.date} tone={status.key} /></div>
          <div className="relative min-w-0 border-l border-line pl-3 sm:pl-14">
            <Icon name={item.category} className="absolute left-4 top-0.5 hidden size-7 text-brand sm:block" />
            <button type="button" className="block break-words text-left text-sm font-semibold leading-5 text-ink outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-brand sm:text-xl sm:leading-7" onClick={() => onOpenEdit(item.id)}>
              {item.title || '(未命名)'}
            </button>
            <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-5 text-ink-2 sm:mt-1 sm:text-base sm:leading-normal">
              {entry.kind === 'contract' ? '合约到期' : metadata || CATEGORIES[item.category].label}
            </p>
            <p className={'m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 sm:mt-1.5 sm:text-base sm:leading-normal ' + STATUS_TEXT[status.key]}>
              <span className={'size-2 shrink-0 rounded-full ' + (entry.d < 0 ? 'bg-danger' : 'bg-sun-shade')} aria-hidden="true" />
              {item.category === 'asset' && entry.d > 0 ? entry.d + ' 天后复核' : status.label}
              {item.category === 'parking' && item.amount !== null && item.amount !== undefined && <span className="text-ink-2"> · {moneyLabel(item.amount, item.currency)}{cycleLabel(item.cycle) ? ' / ' + cycleLabel(item.cycle).replace(/^每/, '') : ''}</span>}
            </p>
          </div>
          <DoneButton label={entry.kind === 'contract' ? '查看合约' : ACTION_LABEL[item.category]} icon="edit" title={item.title} onClick={() => entry.kind === 'contract' ? onOpenEdit(item.id) : onMarkDone(item.id)} />
        </li>;
      })}
    </ul>;
  }

  return <div>
    <section className="mb-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 sm:mb-16 lg:pl-14">
      <p className="order-first m-0 w-full text-sm text-ink-2 sm:hidden">{date} · {now.toLocaleDateString('zh-CN', { weekday: 'long' })}</p>
      <div>
        <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[44px] lg:text-[60px]">今天，轻松一点。</h1>
        <p className="m-0 mt-3 text-sm text-ink-2 sm:text-lg">最近安排，别让重要的事被忘记。</p>
      </div>
      <p className="m-0 hidden text-lg tabular-nums text-ink-2 sm:block">{date} · {now.toLocaleDateString('zh-CN', { weekday: 'long' })}</p>
    </section>

    {due.length ? <>
      <div className={'grid gap-x-10 gap-y-5 sm:gap-y-8 ' + (priority.length && upcoming.length ? 'xl:grid-cols-[1.35fr_1fr]' : '')}>
        {priority.length > 0 && <section aria-label={urgent.length ? '优先处理' : '最近安排'}>
          <div className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-4">
            <h2 className="m-0 text-lg font-semibold text-ink sm:text-[26px]">{urgent.length === 2 ? '先处理这两件' : urgent.length ? '优先处理' : '最近安排'}</h2>
            {overdue > 0 && <span className="flex items-center gap-2 text-[13px] text-danger"><span className="size-2 rounded-full bg-danger" aria-hidden="true" />{overdue} 项逾期</span>}
            {todayCount > 0 && <span className="flex items-center gap-2 text-[13px] text-brand"><span className="size-2 rounded-full bg-sun-shade" aria-hidden="true" />{todayCount} 项今天到期</span>}
          </div>
          {agenda(priority)}
        </section>}
        {upcoming.length > 0 && <section aria-label="接下来 7 天" className="sm:rounded-2xl sm:bg-surface-soft sm:px-6 sm:py-6">
          <h2 className="m-0 border-b border-line pb-4 text-lg font-semibold text-ink sm:text-[26px]">接下来 7 天<span className="ml-2 text-sm font-normal text-ink-3">{upcoming.length}</span></h2>
          {agenda(upcoming)}
        </section>}
      </div>
      {(later.length > 0 || (!priority.length && !upcoming.length && fallback.length > 0)) && <section className="mt-8" aria-label="后续安排">
        <h2 className="m-0 border-b border-line pb-4 text-lg font-semibold text-ink">{later.length ? '接下来 30 天' : '后续安排'}</h2>
        {agenda(later.length ? later : fallback)}
      </section>}
    </> : <section className="flex min-h-64 flex-col items-center justify-center py-10 text-center" aria-label="暂无安排">
      <Icon name="calendar" className="mb-4 size-9 text-brand" />
      <h2 className="m-0 text-lg font-semibold text-ink">{items.length ? '暂时没有到期事项' : '还没有安排'}</h2>
      <p className="m-0 mt-2 text-sm text-ink-2">{items.length ? '有新安排时，随手记下来。' : '记下一个号码，或下一次缴费日期。'}</p>
      <Btn variant="primary" className="mt-5" onClick={() => onOpenAdd()}><Icon name="plus" />添加安排</Btn>
    </section>}

    <Collapsible className="group mt-4 border-y border-line sm:mt-10">
      <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-start rounded-none px-0 py-4 text-base font-semibold text-ink sm:py-6">
        <Icon name="trend" className="size-5 text-ink-2" />支出与资产
        <span className="ml-auto hidden text-xs font-normal text-ink-3 sm:inline">想看时，再展开</span>
        <Icon name="chevron" className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180 sm:ml-2" />
      </Button></CollapsibleTrigger>
      <CollapsibleContent><div className="grid gap-6 pb-6 sm:grid-cols-2">
        <div><p className="m-0 text-sm text-ink-2">年度周期支出</p><p className="m-0 mt-2 text-xl font-semibold text-ink">{annual || '暂无周期支出'}</p><p className="m-0 mt-1 text-xs text-ink-3">按币种分别计算，不含一次性费用</p></div>
        <div><p className="m-0 text-sm text-ink-2">人民币账户余额</p><p className="m-0 mt-2 text-xl font-semibold text-ink">{moneyLabel(cny, 'CNY')}</p>{foreign && <p className="m-0 mt-1 text-xs text-ink-3">另有 {foreign}，单独列示</p>}<Button variant="link" className="mt-2 h-auto p-0 text-sm" onClick={() => onGotoTab('asset')}>查看资产分布<Icon name="arrow" /></Button></div>
      </div></CollapsibleContent>
    </Collapsible>
  </div>;
}
