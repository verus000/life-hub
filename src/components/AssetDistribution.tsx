'use client';

import { colorAt, donutSegments, groupBy } from '@/lib/chart';
import { isActive, money, totals } from '@/lib/model';
import type { Item } from '@/lib/types';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

/* 账户按原币种展示；图形只使用在用人民币账户，默认收起。 */
export function AssetDistribution({ items }: { items: Item[] }) {
  const assets = items.filter((item) => item.category === 'asset' && isActive(item));
  const cny = assets.filter((item) => (item.currency || 'CNY') === 'CNY');
  const foreign = totals(assets.filter((item) => (item.currency || 'CNY') !== 'CNY'), false, true);
  const total = cny.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const data = groupBy(cny, 'detail.assetType');
  const chartTotal = data.reduce((sum, datum) => sum + datum.value, 0);
  const segments = donutSegments(data, 164);

  return <Collapsible className="group rounded-2xl bg-surface-soft">
    <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-start rounded-2xl px-5 py-4 text-base font-semibold text-ink sm:px-6">
      <Icon name="asset" />人民币分布
      <span className="ml-auto hidden text-xs font-normal text-ink-2 sm:inline">仅统计在用人民币账户</span>
      <Icon name="chevron" className="ml-auto transition-transform group-data-[state=open]:rotate-180 sm:ml-2" />
    </Button></CollapsibleTrigger>
    <CollapsibleContent><div className="grid items-center gap-7 px-5 pb-6 sm:px-6 lg:grid-cols-[1fr_164px_1.25fr] lg:gap-10">
      <div>
        <p className="m-0 text-sm text-ink-2">人民币账户余额</p>
        <p className="m-0 mt-2 break-words text-[28px] font-semibold tracking-tight text-ink tabular-nums">CNY {total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className="m-0 mt-2 text-xs text-ink-2">在用账户 · 不作汇率换算</p>
      </div>
      {chartTotal > 0 ? <>
        <svg viewBox="0 0 164 164" width="164" height="164" role="img" aria-label="在用人民币正余额类型分布" className="mx-auto shrink-0">
          {data.length === 1
            ? <circle cx="82" cy="82" r="68.64" fill="none" stroke={colorAt(0)} strokeWidth="18.72" />
            : segments.map((segment, index) => <path key={index} d={segment.d} fill={segment.fill} stroke="var(--color-surface-soft)" strokeWidth="1.5" />)}
          <text x="82" y="78" textAnchor="middle" fill="var(--color-ink-2)" fontSize="13">人民币</text>
          <text x="82" y="98" textAnchor="middle" fill="var(--color-ink-2)" fontSize="13">类型分布</text>
        </svg>
        <div>
          <ul className="m-0 grid list-none gap-3 p-0">
            {data.map((datum, index) => <li key={datum.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorAt(index) }} aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words text-ink-2">{datum.name}</span>
              <span className="text-ink tabular-nums">{money(datum.value, 'CNY')}</span>
              <span className="w-12 text-right text-ink-2 tabular-nums">{(datum.value / chartTotal * 100).toFixed(1)}%</span>
            </li>)}
          </ul>
          {foreign && <p className="m-0 mt-4 border-t border-line pt-3 text-sm text-ink-2">另有 {foreign} · 单独列示</p>}
        </div>
      </> : <div className="py-6 text-sm text-ink-2 lg:col-span-2">
        <p className="m-0">{assets.length ? '暂无可绘图的人民币正余额' : '还没有在用资产记录'}</p>
        {foreign && <p className="m-0 mt-2">另有 {foreign} · 单独列示</p>}
      </div>}
    </div></CollapsibleContent>
  </Collapsible>;
}
