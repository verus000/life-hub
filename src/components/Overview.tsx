'use client';

/* 首页总览：到期安排、支出与资产统计、资产分布环形图 */

import { colorAt, donutSegments, groupBy } from '@/lib/chart';
import { CATEGORIES, dueEntries, isActive, money, statusOf, totals } from '@/lib/model';
import type { Item } from '@/lib/types';
import { Badge, Btn } from '@/components/ui';
import { EmptyArtwork, Icon } from '@/components/icons';

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
    <div className="rounded-xl bg-surface border border-line p-4">
      <div className="text-[12px] text-ink-2">{label}</div>
      <div className="mt-1 text-[20px] font-medium text-ink">
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
    </div>
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
        <circle cx={c} cy={c} r={R} fill="none" stroke="#E4E8EE" strokeWidth={R - r} />
      ) : (
        segments.map((s, i) => <path key={i} d={s.d} fill={s.fill} stroke="#FFFFFF" strokeWidth="1.5" />)
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
}: {
  items: Item[];
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

  const annual = totals(cycleItems, true) || '暂无周期支出';
  const cnyAssets = assets.filter((x) => (x.currency || 'CNY') === 'CNY');
  const totalCny = cnyAssets.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const foreign = assets.filter((x) => (x.currency || 'CNY') !== 'CNY');
  const foreignTxt = totals(foreign, false);

  const pieData = groupBy(cnyAssets, 'detail.assetType');
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const upcoming = due30.length ? due30 : dueAll.slice(0, 6);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-surface border border-line p-5">
        {upcoming.length ? (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="m-0 text-[15px] font-medium text-ink">{due30.length ? '近 30 天' : '接下来的安排'}</h2>
              <span className="text-[12px] text-ink-3">{upcoming.length} 件事</span>
            </div>
            {overdue.length ? (
              <p className="m-0 mb-3 text-[13px] text-danger">有 {overdue.length} 件事已逾期，可以先处理。</p>
            ) : null}
            <div className="grid gap-2">
              {upcoming.map((o, i) => {
                const x = o.x;
                const st = statusOf({ nextDate: o.date } as Item);
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-line last:border-b-0">
                    <span className="w-9 h-9 grid place-items-center rounded-[10px] bg-brand-soft text-brand shrink-0">
                      <Icon name={x.category} className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <strong className="block truncate text-[13px] text-ink">{x.title || '(未命名)'}</strong>
                      <span className="block text-[12px] text-ink-3 truncate">
                        {CATEGORIES[x.category].label}
                        {o.kind === 'contract' ? ' · 合约到期' : ''}
                        {x.provider ? ' · ' + x.provider : ''}
                      </span>
                    </span>
                    <span className="flex flex-col items-end shrink-0">
                      <Badge tone={st.key}>{st.label}</Badge>
                      <span className="mt-0.5 text-[12px] text-ink-3">{o.date}</span>
                    </span>
                    <Btn
                      className="shrink-0"
                      onClick={() => (o.kind === 'contract' ? onOpenEdit(x.id) : onMarkDone(x.id))}
                    >
                      {o.kind === 'contract' ? '查看合约' : ACTION_LABEL[x.category]}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <EmptyArtwork />
            <span className="text-[15px] text-ink">{items.length ? '暂时没有到期事项' : '还没有安排'}</span>
            <p className="m-0 mt-1.5 text-[13px] text-ink-3">
              {items.length ? '有新安排时，随手记下来。' : '添加一个号码，或记下下一次缴费日期。'}
            </p>
            <Btn variant="primary" className="mt-4" onClick={() => onOpenAdd()}>
              ＋ 添加事项
            </Btn>
          </div>
        )}
      </section>

      <details className="rounded-2xl bg-surface border border-line">
        <summary className="cursor-pointer select-none px-5 py-4 text-[14px] font-medium text-ink hover:text-brand">
          支出与资产
        </summary>
        <div className="px-5 pb-5 grid gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <StatCard label="年度周期支出" value={annual} sub="按币种分别计算，不含一次性费用" />
            <StatCard
              label="人民币资产"
              value={money(totalCny, 'CNY')}
              sub={foreignTxt ? '另有 ' + foreignTxt : '在用账户的人民币余额'}
            />
          </div>

          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="m-0 text-[15px] font-medium text-ink">资产分布</h2>
                <p className="m-0 text-[12px] text-ink-3">在用人民币账户 · 按类型统计</p>
              </div>
              <button
                className="text-ink-3 hover:text-brand"
                aria-label="查看资产账户"
                onClick={() => onGotoTab('asset')}
              >
                <Icon name="arrow" />
              </button>
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
                <div className="flex-1 min-w-[220px] grid gap-1.5">
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
        </div>
      </details>
    </div>
  );
}
