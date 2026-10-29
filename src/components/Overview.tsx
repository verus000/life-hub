'use client';

/* 首页总览：到期安排、支出与资产统计、资产分布环形图 */

import { colorAt, donutSegments, groupBy } from '@/lib/chart';
import { CATEGORIES, dueEntries, isActive, money, statusOf, totals } from '@/lib/model';
import type { Item } from '@/lib/types';
import { Badge, Btn } from '@/components/ui';
import { EmptyArtwork, Icon, SunnyArtwork } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const ACTION_LABEL: Record<string, string> = {
  phone: '记录保活',
  broadband: '记录续费',
  parking: '记录缴费',
  asset: '记录复核',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const parts = String(value).split(' · ');
  const m = /^([A-Z]{3}) (.+)$/.exec(parts[0]);
  return (
    <Card className="bg-muted/50 p-5 shadow-none">
      <div className="text-[12px] text-ink-2">{label}</div>
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
      {sub ? <div className="mt-1 text-[12px] text-ink-3">{sub}</div> : null}
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
  dateLabel,
  onMarkDone,
  onOpenEdit,
  onOpenAdd,
  onGotoTab,
}: {
  items: Item[];
  dateLabel: string;
  onMarkDone: (id: number) => void;
  onOpenEdit: (id: number) => void;
  onOpenAdd: (category?: string) => void;
  onGotoTab: (tab: string) => void;
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

  const upcoming = due30.length ? due30 : dueAll.slice(0, 6);

  return (
    <div className="grid gap-6">
      <section className="relative isolate min-h-[230px] overflow-hidden rounded-[28px] bg-hero px-6 py-7 sm:min-h-[210px] sm:px-8 sm:py-8">
        <div className="relative z-10 sm:pr-44">
          <p className="m-0 mb-3 flex items-center gap-2 text-xs font-semibold text-hero-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />{dateLabel}
          </p>
          <h1 className="m-0 text-[25px] font-extrabold leading-[1.4] tracking-wide text-hero-ink sm:text-[32px]">
            把小日子，<br />安排得明明白白。
          </h1>
          <p className="m-0 mt-3 max-w-[calc(100%-4rem)] text-[13px] text-hero-muted sm:max-w-none">
            {overdue.length ? '有 ' + overdue.length + ' 件安排已逾期，可以先从最要紧的开始。'
              : todayCount ? '今天有 ' + todayCount + ' 件小事，按自己的节奏一件件来。'
                : items.length ? '最近的安排都在这里，记下来就不用总惦记。' : '记下一件生活小事，给自己多一点从容。'}
          </p>
        </div>
        <SunnyArtwork className="pointer-events-none absolute -right-8 bottom-0 h-32 w-36 sm:right-3 sm:top-1/2 sm:h-52 sm:w-60 sm:-translate-y-1/2" />
      </section>

      <section aria-label="最近安排">
        {upcoming.length ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3.5">
              <h2 className="m-0 text-lg font-bold text-ink">{due30.length ? '最近安排' : '接下来的安排'}</h2>
              <span className="text-xs text-ink-3">{upcoming.length} 件事{due30.length ? ' · 近 30 天' : ''}</span>
            </div>
            {overdue.length ? (
              <p className="m-0 mb-3 rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">有 {overdue.length} 件事已逾期，可以先处理。</p>
            ) : null}
            <Card className="px-4 sm:px-6">
              {upcoming.map((o) => {
                const x = o.x;
                const st = statusOf({ nextDate: o.date } as Item);
                return (
                  <div key={x.id + '-' + o.kind} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 py-5 border-b border-line last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_auto_auto] sm:gap-4">
                    <span className="category-icon" data-category={x.category}>
                      <Icon name={x.category} className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <strong className="block break-words text-[15px] font-bold text-ink">{x.title || '(未命名)'}</strong>
                      <span className="mt-1 block break-words text-xs text-ink-3">
                        {CATEGORIES[x.category].label}
                        {o.kind === 'contract' ? ' · 合约到期' : ''}
                        {x.provider ? ' · ' + x.provider : ''}
                      </span>
                    </span>
                    <div className="col-start-2 flex flex-wrap items-center justify-between gap-3 sm:contents">
                      <span className="flex flex-col items-start sm:items-end">
                        <Badge tone={st.key}>{st.label}</Badge>
                        <span className="mt-0.5 text-[12px] text-ink-3">{o.date}</span>
                      </span>
                      <Btn
                        variant="soft"
                        className="shrink-0"
                        onClick={() => (o.kind === 'contract' ? onOpenEdit(x.id) : onMarkDone(x.id))}
                      >
                        {o.kind === 'contract' ? '查看合约' : ACTION_LABEL[x.category]}
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        ) : (
          <Card className="flex flex-col items-center px-5 py-10 text-center">
            <EmptyArtwork />
            <span className="text-base font-bold text-ink">{items.length ? '暂时没有到期事项' : '还没有安排'}</span>
            <p className="m-0 mt-1.5 text-[13px] text-ink-3">
              {items.length ? '有新安排时，随手记下来。' : '添加一个号码，或记下下一次缴费日期。'}
            </p>
            <Btn variant="primary" className="mt-4" onClick={() => onOpenAdd()}>
              ＋ 添加事项
            </Btn>
          </Card>
        )}
      </section>

      <Collapsible className="group rounded-2xl border border-border bg-card shadow-xs">
        <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full flex-wrap justify-start rounded-2xl px-5 py-4 text-sm text-foreground sm:px-6">
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

          <div className="rounded-[20px] border border-line p-4 sm:p-5">
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
                  ＋ 添加资产账户
                </Btn>
              </div>
            )}
          </div>
        </div></CollapsibleContent>
      </Collapsible>
    </div>
  );
}
