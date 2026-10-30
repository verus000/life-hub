import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Overview } from '@/components/Overview';
import type { Item } from '@/lib/types';

function item(id: number, patch: Partial<Item>): Item {
  return {
    id, userId: 1, category: 'phone', title: '号码 ' + id, provider: '',
    amount: null, currency: 'CNY', cycle: 'monthly', startDate: '',
    nextDate: '', status: 'active', detail: {}, note: '',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    ...patch,
  };
}

function render(items: Item[]) {
  const noop = () => undefined;
  return renderToStaticMarkup(createElement(Overview, {
    items, onMarkDone: noop, onOpenEdit: noop, onOpenAdd: noop,
    onGotoTab: noop, onHistory: noop, onChangeStatus: noop, onRemove: noop,
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 30, 12));
});
afterEach(() => vi.useRealTimers());

it('总览按紧急与近期分组，宽带合约与续费行动保持独立，暂停项不进入待办', () => {
  const html = render([
    item(1, { title: '备用号码', nextDate: '2026-10-28' }),
    item(2, { title: '停车月卡', category: 'parking', nextDate: '2026-10-30' }),
    item(3, { title: '家庭宽带', category: 'broadband', nextDate: '2026-11-18', detail: { contractDate: '2026-11-02' } }),
    item(4, { title: '暂停的号码', nextDate: '2026-10-27', status: 'paused' }),
  ]);
  expect(html).toContain('先处理这两件');
  expect(html).toContain('接下来 7 天');
  expect(html).toContain('aria-label="查看合约：家庭宽带"');
  expect(html).toContain('aria-label="记录续费：家庭宽带"');
  expect(html).not.toContain('暂停的号码');
});

it('没有本周事项时仍展示 30 天内的安排，不误报空状态', () => {
  const html = render([item(1, { title: '下月保活', nextDate: '2026-11-18' })]);
  expect(html).toContain('接下来 30 天');
  expect(html).toContain('下月保活');
  expect(html).not.toContain('暂时没有到期事项');
});

it('只有 30 天后的安排时提供后续列表，无日期与非在用条目不混入列表', () => {
  const html = render([
    item(1, { title: '明年复核', category: 'asset', nextDate: '2027-01-01' }),
    item(2, { title: '无日期账户', category: 'asset' }),
    item(3, { title: '归档号码', nextDate: '2026-10-28', status: 'archived' }),
  ]);
  expect(html).toContain('后续安排');
  expect(html).toContain('明年复核');
  expect(html).not.toContain('无日期账户');
  expect(html).not.toContain('归档号码');
});
