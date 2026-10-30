/* 领域计算回归：周期顺延、完成与撤销（对应原自测的 model 部分） */

import { describe, expect, it } from 'vitest';
import { addMonths, canUndo, complete, dateLabel, dueEntries, moneyLabel, shiftNext, statusOf, totals, undo } from '@/lib/model';
import type { Item } from '@/lib/types';

function item(patch: Partial<Item> = {}): Item {
  return {
    id: 1, userId: 1, category: 'phone', title: '13800000000', provider: '', amount: 19, currency: 'CNY',
    cycle: 'monthly', startDate: '', nextDate: '2027-01-31', status: 'active', detail: {}, note: '',
    createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    ...patch,
  };
}

describe('周期顺延', () => {
  it('月底顺延到目标月最后有效日期', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(shiftNext(item({ nextDate: '2027-01-31' }))).toBe('2027-02-28');
  });

  it('周度加 7 天，一次性返回空串', () => {
    expect(shiftNext(item({ detail: { reminderCycle: 'weekly' } }))).toBe('2027-02-07');
    expect(shiftNext(item({ detail: { reminderCycle: 'once' } }))).toBe('');
  });

  it('锚点日期在短月收缩', () => {
    expect(addMonths('2027-03-31', 1, 31)).toBe('2027-04-30');
  });
});

describe('状态判断', () => {
  it('按剩余天数分档', () => {
    const st = statusOf(item({ nextDate: '2000-01-01' }));
    expect(st.key).toBe('overdue');
    expect(statusOf(item({ nextDate: '' })).key).toBe('none');
  });
});

describe('展示格式', () => {
  it('业务日期按本地日历拆分，非法值原样返回', () => {
    expect(dateLabel('2026-01-05')).toBe('2026年1月5日');
    expect(dateLabel('2026-12-31')).toBe('2026年12月31日');
    expect(dateLabel('')).toBe('');
    expect(dateLabel('下周')).toBe('下周');
  });

  it('金额只在符号缺失或共用时补币种代码', () => {
    expect(moneyLabel(4800, 'CNY')).toBe('¥4,800');
    expect(moneyLabel(3, 'USD')).toBe('$3');
    expect(moneyLabel(500, 'JPY')).toBe('JPY ¥500');
    expect(moneyLabel(10, 'XYZ')).toBe('XYZ 10');
    expect(moneyLabel(null, 'CNY')).toBe('');
  });

  it('周期支出合计按币种分开且不重复代码', () => {
    const rows = [item({ amount: 100, cycle: 'yearly' }), item({ id: 2, amount: 3, currency: 'USD', cycle: 'monthly' })];
    expect(totals(rows, true)).toBe('¥100 · $36');
    expect(totals(rows, true, true)).toBe('CNY 100 · USD 36');
    expect(totals([item({ amount: -1500, currency: 'USD' }), item({ amount: 50, currency: 'SGD' })], false, true)).toBe('SGD 50 · USD -1,500');
  });
});

describe('记录处理与撤销', () => {
  it('完成写入历史并可撤销', () => {
    const x = item();
    const patch = complete(x, { date: '2026-01-31', amount: '19', currency: 'CNY', note: '' });
    expect(patch.nextDate).toBe('2027-02-28');
    expect(patch.status).toBe('active');
    const after = { ...x, ...patch } as Item;
    expect(after.detail.history!.length).toBe(1);
    expect(canUndo(after)).toBe(true);

    const undoPatch = undo(after);
    expect(undoPatch.nextDate).toBe('2027-01-31');
    const undone = { ...after, ...undoPatch } as Item;
    expect(undone.detail.history!.at(-1)!.undoneAt).toBeTruthy();
    expect(canUndo(undone)).toBe(false);
  });

  it('一次性事项完成后进入 completed', () => {
    const x = item({ detail: { reminderCycle: 'once' } });
    const patch = complete(x, { date: '2026-01-31', currency: 'CNY' });
    expect(patch.status).toBe('completed');
    expect(patch.nextDate).toBe('');
  });

  it('处理日期不能晚于今天', () => {
    expect(() => complete(item(), { date: '2999-01-01', currency: 'CNY' })).toThrow();
  });
});

describe('dueEntries', () => {
  it('包含任务与宽带合约到期', () => {
    const entries = dueEntries([
      item({ nextDate: '2027-01-01' }),
      item({ category: 'broadband', nextDate: '2027-03-01', detail: { contractDate: '2027-02-01' } }),
    ]);
    expect(entries.length).toBe(3);
    expect(entries.some((e) => e.kind === 'contract')).toBe(true);
  });
});
