'use client';

/* 首页总览：到期安排、支出与资产统计、资产分布环形图 */

import { colorAt, donutSegments, groupBy } from '@/lib/chart';
import { CATEGORIES, dueEntries, isActive, money, statusOf, totals } from '@/lib/model';
import type { Item } from '@/lib/types';
import { Btn, DateTile, DoneButton, STATUS_TEXT } from '@/components/ui';
import { EmptyArtwork, Icon, OrbitArtwork } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ItemMenu } from '@/components/CategoryList';

const ACTION_LABEL: Record<string, string> = {
  phone: '记录保活',
  broadband: '记录续费',
  parking: '记录缴费',
  asset: '记录复核',
};
const CATEGORY_TEXT: Record<string, string> = {
  phone: 'text-brand',
  broadband: 'text-mint-ink',
  parking: 'text-lemon-ink',
  asset: 'text-lilac-ink',
};
const DUE_GROUPS = [
  { key: 'overdue', label: '已逾期', className: 'text-danger', test: (d: number) => d < 0 },
  { key: 'today', label: '今天', className: 'text-warn', test: (d: number) => d === 0 },
  { key: 'week', label: '7 天内', className: 'text-brand', test: (d: number) => d > 0 && d <= 7 },
  { key: 'month', label: '30 天内', className: 'text-ink-2', test: (d: number) => d > 7 },
];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const parts = String(value).split(' · ');
  const m = /^([A-Z]{3}) (.+)$/.exec(parts[0]);
  return (
    <Card className="bg-muted/50 p-5 shadow-none">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className="mt-1 text-[24px] font-bold text-ink">
        {m ? (
          <>
            <span className="text-[13px] text-ink-3 mr-1.5">{m[1]}</span>
            {m[2]}
          </>
        ) : (
          parts[0]
        )}
      </div>
      {parts.length > 1 ? <div className="mt-0.5 text-[13px] text-ink-2">{parts.slice(1).join(' · ')}</div> : null}
      {sub ? <div className="mt-1 text-[13px] text-ink-3">{sub}</div> : null}
    </Card>
  );
}

function Donut({ data, size = 164 }: { data: Array<{ name: string; value: number }>; size?: number }) {
  const colored = data.map((d, i) => ({ ...d, color: colorAt(i) }));
  const segments = donutSegments(colored, size);
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = size / 2 - 4;
  const r = R * 0.76;
  const c = size / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="资产分布环形图">
      {segments.length === 0 && colored.length === 1 ? (
        <circle cx={c} cy={c} r={(R + r) / 2} fill="none" stroke={colored[0].color} strokeWidth={R - r} />
      ) : segments.length === 0 ? (
        <circle cx={c} cy={c} r={R} fill="none" stroke="var(--color-line)" strokeWidth={R - r} />
      ) : (
        segments.map((s, i) => <path key={i} d={s.d} fill={s.fill} stroke="var(--color-surface)" strokeWidth="1.5" />)
      )}
    </svg>
  );
}

export function Overview({
  items,
  onMarkDone,
  onOpenEdit,
  onOpenAdd,
  onGotoTab,
  onHistory,
  onChangeStatus,
  onRemove,
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
  const cycleItems = active.filter((x) => x.category !== 'asset');
  const assets = active.filter((x) => x.category === 'asset');

  const dueAll = dueEntries(active);
  const due30 = dueAll.filter((o) => o.d <= 30);
  const overdue = dueAll.filter((o) => o.d < 0);
  const todayCount = dueAll.filter((o) => o.d === 0).length;

  const annual = totals(cycleItems, true) || '暂无周期支出';
  const cnyAssets = assets.filter((x) => (x.currency || 'CNY') === 'CNY');
  const totalCny = cnyAssets.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const foreign = assets.filter((x) => (x.currency || 'CNY') !== 'CNY');
  const foreignTxt = totals(foreign, false);

  const pieData = groupBy(cnyAssets, 'detail.assetType');
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const groups = due30.length
    ? DUE_GROUPS.map((g) => ({ ...g, entries: due30.filter((o) => g.test(o.d)) })).filter((g) => g.entries.length)
    : [{ key: 'later', label: '接下来', className: 'text-ink-2', entries: dueAll.slice(0, 6) }].filter((g) => g.entries.length);
  const counters = [
    { label: '已逾期', count: overdue.length, className: 'bg-danger-soft text-danger' },
    { label: '今天到期', count: todayCount, className: 'bg-lemon text-lemon-ink' },
    { label: '7 天内', count: dueAll.filter((o) => o.d > 0 && o.d <= 7).length, className: 'bg-brand-soft text-brand' },
  ];
  const now = new Date();

  return (
    <div className="grid gap-7">
      {/* 今日面板：大号日期 + 三个计数，数字为 0 时退成灰色 */}
      <section className="relative overflow-hidden rounded-[20px] bg-surface p-5 shadow-card sm:p-7">
        <OrbitArtwork className="pointer-events-none absolute -right-3 -top-2 h-24 w-28 sm:right-6 sm:top-1/2 sm:h-40 sm:w-44 sm:-translate-y-1/2" />
        <div className="relative flex items-end gap-3 pr-24 sm:pr-0">
          <span className="text-[44px] font-bold leading-[0.9] tracking-tight text-ink tabular-nums sm:text-[56px]">{now.getDate()}</span>
          <div className="min-w-0 pb-0.5">
            <h1 className="m-0 text-[15px] font-semibold text-ink sm:text-base">
              {now.getMonth() + 1}月 · {now.toLocaleDateString('zh-CN', { weekday: 'long' })}
            </h1>
            <p className="m-0 text-[13px] text-ink-3 sm:text-sm">
              {overdue.length ? '先处理逾期的，再看今天的。'
                : todayCount ? '今天有要办的小事，按自己的节奏来。'
                  : due30.length ? '近 30 天的安排都在下面。'
                    : items.length ? '近 30 天没有到期安排，轻松一下。' : '记下一件生活小事，给自己多一点从容。'}
            </p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2.5 sm:mt-6 sm:max-w-[440px]">
          {counters.map((c) => (
            <div key={c.label} className={'rounded-2xl px-3.5 py-3 ' + (c.count ? c.className : 'bg-surface-soft text-ink-3')}>
              <div className="text-2xl font-bold leading-none tabular-nums">{c.count}</div>
              <div className="mt-1.5 text-xs font-medium">{c.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="最近安排" className="grid gap-5">
        {groups.length ? groups.map((g) => (
          <div key={g.key}>
            <h2 className={'m-0 mb-2 flex items-center gap-2 px-1 text-sm font-semibold ' + g.className}>
              {g.label}<span className="font-normal text-ink-3">{g.entries.length}</span>
            </h2>
            <Card className="overflow-hidden">
              <ul className="m-0 list-none divide-y divide-line p-0">
                {g.entries.map((o) => {
                  const x = o.x;
                  const st = statusOf({ nextDate: o.date } as Item);
                  const title = x.title || '(未命名)';
                  return (
                    <li key={x.id + '-' + o.kind} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                      <DateTile date={o.date} tone={st.key} />
                      <div className="min-w-0 flex-1">
                        <button type="button" className="block break-words text-left text-[15px] font-semibold text-ink outline-none hover:text-brand focus-visible:text-brand" onClick={() => onOpenEdit(x.id)}>
                          {title}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-3">
                          <span className={'inline-flex items-center gap-1 ' + CATEGORY_TEXT[x.category]}>
                            <Icon name={x.category} className="size-3.5" />{CATEGORIES[x.category].label}
                          </span>
                          {o.kind === 'contract' || x.provider ? <><span aria-hidden="true">·</span><span>{o.kind === 'contract' ? '合约到期' : x.provider}</span></> : null}
                          <span aria-hidden="true">·</span>
                          <span className={STATUS_TEXT[st.key]}>{st.label}</span>
                        </div>
                      </div>
                      {o.kind === 'contract'
                        ? <DoneButton label="查看合约" icon="edit" title={title} onClick={() => onOpenEdit(x.id)} />
                        : <DoneButton label={ACTION_LABEL[x.category]} title={title} onClick={() => onMarkDone(x.id)} />}
                      <ItemMenu x={x} onOpenEdit={onOpenEdit} onHistory={onHistory} onChangeStatus={onChangeStatus} onRemove={onRemove} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )) : (
          <Card className="flex flex-col items-center px-5 py-10 text-center">
            <EmptyArtwork />
            <span className="text-base font-bold text-ink">{items.length ? '暂时没有到期事项' : '还没有安排'}</span>
            <p className="m-0 mt-1.5 text-[13px] text-ink-3">
              {items.length ? '有新安排时，随手记下来。' : '添加一个号码，或记下下一次缴费日期。'}
            </p>
            <Btn variant="primary" className="mt-4" onClick={() => onOpenAdd()}>
              <Icon name="plus" />添加事项
            </Btn>
          </Card>
        )}
      </section>

      <Collapsible className="group rounded-2xl bg-card shadow-card">
        <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full flex-wrap justify-start rounded-2xl px-5 py-4 text-sm font-semibold text-foreground sm:px-6">
          <Icon name="trend" className="h-4 w-4 text-brand" />支出与资产
          <span className="ml-auto text-xs font-normal text-ink-3">想看时，再展开</span>
          <Icon name="chevron" className="h-4 w-4 group-data-[state=open]:rotate-180" />
        </Button></CollapsibleTrigger>
        <CollapsibleContent><div className="px-5 pb-5 grid gap-4 sm:px-6 sm:pb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <StatCard label="年度周期支出" value={annual} sub="按币种分别计算，不含一次性费用" />
            <StatCard
              label="人民币资产"
              value={money(totalCny, 'CNY')}
              sub={foreignTxt ? '另有 ' + foreignTxt : '在用账户的人民币余额'}
            />
          </div>

          <div className="rounded-2xl bg-surface-soft p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="m-0 text-[15px] font-medium text-ink">资产分布</h2>
                <p className="m-0 text-[12px] text-ink-3">在用人民币账户 · 按类型统计</p>
              </div>
              <Button variant="ghost" size="icon"
                aria-label="查看资产账户"
                onClick={() => onGotoTab('asset')}
              >
                <Icon name="arrow" />
              </Button>
            </div>
            {pieTotal > 0 ? (
              <div className="flex flex-wrap items-center gap-6">
                <div className="relative shrink-0">
                  <Donut data={pieData} />
                  <div className="absolute inset-0 grid place-content-center text-center pointer-events-none">
                    <span className="text-[11px] text-ink-3">合计</span>
                    <strong className="text-[15px] font-medium text-ink">{money(pieTotal, 'CNY')}</strong>
                  </div>
                </div>
                <div className="flex-1 min-w-0 basis-[220px] grid gap-1.5">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2.5 text-[13px]">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorAt(i) }} />
                      <span className="flex-1 text-ink">
                        {d.name}
                        <small className="ml-2 text-[12px] text-ink-3">{money(d.value, 'CNY')}</small>
                      </span>
                      <span className="text-ink-2">{((d.value / pieTotal) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="w-12 h-12 grid place-items-center rounded-full bg-surface-soft text-ink-3">
                  <Icon name="asset" className="w-6 h-6" />
                </span>
                <span className="mt-2 text-[15px] text-ink">
                  {assets.length ? '暂无可绘图的人民币正余额' : '还没有在用资产记录'}
                </span>
                <p className="m-0 mt-1.5 text-[13px] text-ink-3">
                  {foreign.length ? '外币账户：' + foreignTxt : '添加账户，清晰了解你的资产构成'}
                </p>
                <Btn className="mt-4" onClick={() => onOpenAdd('asset')}>
                  <Icon name="plus" />添加资产账户
                </Btn>
              </div>
            )}
          </div>
        </div></CollapsibleContent>
      </Collapsible>
    </div>
  );
}
