import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_LABELS, ORDER, categoryAction, formLayout } from '@/lib/categories';
import { collectFormValues, initialFormValues } from '@/lib/item-form';
import { maskIdentifier } from '@/lib/privacy';
import { backup, csvColumns, parseImport, validate } from '@/lib/records';
import { categoryMetadata, complete, reminderCycle } from '@/lib/model';
import { createCalendar } from '@/lib/calendar';
import type { Item } from '@/lib/types';

function card(patch: Partial<Item> = {}): Item {
  return { id: 1, userId: 1, category: 'phone', title: '欧洲旅行卡', provider: '示例服务商',
    amount: null, currency: 'EUR', cycle: '', startDate: '', nextDate: '2027-06-01', status: 'active',
    detail: {}, note: '', createdAt: '2026-10-30', updatedAt: '2026-10-30', ...patch };
}

describe('海外 eSIM 与脱敏信息', () => {
  it('仅凭别名可创建无号码、无日期的卡片，旧手机号分类仍可导入', () => {
    const values = initialFormValues('phone', null);
    values.title = '日本旅行备用卡';
    const draft = validate(collectFormValues('phone', values, null));
    expect(draft.detail?.simType).toBe('esim');
    expect(draft.detail?.phoneNumber).toBe('');
    expect(draft.nextDate).toBe('');
    expect(validate({ title: '+44 ****1234', category: '手机号' }).category).toBe('phone');
    expect(() => validate({ title: '卡片', detail: { phoneNumber: 1234 } } as never)).toThrow('必须是文本');
  });

  it('输入脱敏只保留末四位，重复操作稳定，空输入保持为空', () => {
    expect(maskIdentifier('+44 7700 900123')).toBe('••••0123');
    expect(maskIdentifier('••••0123')).toBe('••••0123');
    expect(maskIdentifier('account-AB1234')).toBe('••••1234');
    expect(maskIdentifier('  ')).toBe('');
  });

  it('编辑旧号码不推断 eSIM 类型，脱敏值和未知扩展字段在保存时保留', () => {
    const old = card({ title: '+44 ****1234', detail: { country: '英国', futureBusiness: { planId: 'demo' }, recordKey: 'stable-key' } });
    const values = initialFormValues('phone', old);
    expect(values['detail.simType']).toBe('');
    values['detail.phoneNumber'] = '••••1234';
    const draft = validate(collectFormValues('phone', values, old));
    expect(draft.title).toBe(old.title);
    expect(draft.detail).toMatchObject({ phoneNumber: '••••1234', futureBusiness: { planId: 'demo' }, recordKey: 'stable-key' });
    expect(parseImport(backup([card(draft as Partial<Item>)])).items[0].detail).toEqual(draft.detail);
  });

  it('CSV 同时有别名和手机号时不互相覆盖，旧表头仍兼容', () => {
    const result = parseImport('名称,手机号,提醒类型,套餐,使用国家 / 覆盖地区\n欧洲卡,+44 ****1234,套餐到期,10GB / 30天,欧洲多国');
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({ title: '欧洲卡', detail: { phoneNumber: '+44 ****1234', reminderKind: 'expiry', coverage: '欧洲多国' } });
    expect(parseImport('手机号,归属国家\n+44 ****1234,英国').items[0].title).toBe('+44 ****1234');
  });

  it('CSV 往返保留脱敏和未知扩展信息，不给其他分类添加空卡片字段', () => {
    const rows = [card({ detail: { phoneNumber: '••••1234', simType: 'esim', future: { key: 'value' } } }), card({ category: 'asset', title: '账户别名', detail: { assetType: '现金' } })];
    const columns = csvColumns();
    const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
    const csv = [columns.map((column) => quote(column.label)).join(','), ...rows.map((row) => columns.map((column) => quote(column.get(row))).join(','))].join('\n');
    const parsed = parseImport(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.items.map((row) => row.detail)).toEqual(rows.map((row) => row.detail));
  });

  it('套餐到期默认一次性，完成后停止提醒；长期保号保持既有周期', () => {
    const expiry = card({ detail: { reminderKind: 'expiry' } });
    expect(reminderCycle(expiry)).toBe('once');
    expect(complete(expiry, { date: '2026-10-30' })).toMatchObject({ status: 'completed', nextDate: '', detail: { history: [{ action: '到期' }] } });
    expect(categoryAction('phone', expiry.detail)).toBe('到期');
    expect(reminderCycle(card({ cycle: 'quarterly' }))).toBe('quarterly');
    expect(categoryMetadata(card({ detail: { simType: 'esim', phoneNumber: '••••1234', coverage: '欧洲多国' } }))).toContain('eSIM · ••••1234');
    expect(createCalendar([expiry]).text).toContain('SUMMARY:到期 · 欧洲旅行卡');
  });
});

describe('分类扩展', () => {
  it('导航顺序、校验标签共用注册表，新分类可使用通用表单与处理文案', () => {
    expect(ORDER).toEqual(Object.keys(CATEGORIES));
    expect(Object.keys(CATEGORY_LABELS)).toEqual(ORDER);
    const future = { key: 'subscription', label: '订阅', unit: '费用', hasCycle: true, hasDue: true,
      fields: [{ key: 'title', label: '名称', type: 'text' as const, required: true }, { key: 'detail.plan', label: '方案', type: 'text' as const }] };
    expect(formLayout(future)).toEqual({ sections: [{ title: '订阅', rows: [['title']] }], more: [['detail.plan']] });
    expect(categoryAction('subscription')).toBe('处理');
  });
});
