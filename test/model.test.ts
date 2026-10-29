/* 领域计算回归：周期顺延、完成与撤销（对应原自测的 model 部分） */

import { describe, expect, it } from 'vitest';
import { addMonths, canUndo, complete, dueEntries, shiftNext, statusOf, undo } from '@/lib/model';
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
