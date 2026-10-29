/* 领域逻辑回归：校验、去重、导入解析（对应原自测的 records 部分） */

import { describe, expect, it } from 'vitest';
import { parseImport, partition, validate, backup, csvColumns } from '@/lib/records';

describe('validate 校验', () => {
  it('缺少 title 报错，空白 title 报错', () => {
    expect(() => validate({ category: 'phone' })).toThrow('缺少必填字段 title');
    expect(() => validate({ category: 'phone', title: '   ' })).toThrow('缺少必填字段 title');
  });

  it('非法分类、币种与金额被拒绝', () => {
    expect(() => validate({ title: 'x', category: 'unknown' })).toThrow('category无效');
    expect(() => validate({ title: 'x', currency: '人民币' })).toThrow('币种');
    expect(() => validate({ title: 'x', amount: 'Infinity' })).toThrow('金额');
  });

  it('无效日期与非法 detail 字段被拒绝', () => {
    expect(() => validate({ title: 'x', nextDate: '2027-02-30' })).toThrow('日期无效');
    expect(() => validate({ title: 'x', detail: { constructor: 1 } as never })).toThrow('非法字段');
    expect(() => validate({ title: 'x', detail: { reminderCycle: '每天' } })).toThrow('提醒周期');
  });

  it('空金额归一为 null，默认值填充正确', () => {
    const v = validate({ title: '现金', amount: '' });
    expect(v.amount).toBeNull();
    expect(v.category).toBe('phone');
    expect(v.status).toBe('active');
    expect(v.currency).toBe('CNY');
  });

  it('补丁模式不强制 title，未传字段不出现', () => {
    const v = validate({ note: 'hi' }, true);
    expect(v.note).toBe('hi');
    expect('title' in v).toBe(false);
  });
});

describe('partition 去重', () => {
  it('按 recordKey 与内容指纹跳过重复', () => {
    const existing = [{ category: 'asset', title: 'A', amount: 100, detail: { recordKey: 'k1' } }];
    const incoming = [
      { category: 'asset', title: 'A', amount: 100, detail: { recordKey: 'k1' } },
      { category: 'asset', title: 'A', amount: 100 },
      { category: 'asset', title: 'B', amount: 200 },
    ];
    const r = partition(incoming, existing as never[]);
    /* recordKey 命中跳过 1 条；同内容无 key 的也按指纹跳过 */
    expect(r.skipped).toBe(2);
    expect(r.items.length).toBe(1);
    expect(r.items[0].title).toBe('B');
  });
});

describe('parseImport 导入', () => {
  it('解析 CSV 并按表头推断分类', () => {
    const csv = '手机号,运营商,金额,下次保活日期\n13900000000,中国移动,19,2027-01-01';
    const r = parseImport(csv);
    expect(r.errors.length).toBe(0);
    expect(r.items.length).toBe(1);
    expect(r.items[0].category).toBe('phone');
    expect(r.items[0].amount).toBe(19);
  });

  it('解析完整备份 JSON', () => {
    const json = backup([
      {
        id: 1, userId: null, category: 'asset', title: '招行', provider: '', amount: 1000, currency: 'CNY',
        cycle: '', startDate: '', nextDate: '', status: 'active', detail: { assetType: '银行存款' },
        note: '', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
    const r = parseImport(json);
    expect(r.items.length).toBe(1);
    expect(r.items[0].title).toBe('招行');
  });

  it('错误行进入 errors 而不是中断整批', () => {
    const csv = '手机号,下次保活日期\n13800000000,2027-01-01\n13811111111,2027-02-30';
    const r = parseImport(csv);
    expect(r.items.length).toBe(1);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toContain('第 3 行');
  });

  it('未识别表头直接报错', () => {
    expect(() => parseImport('a,b\n1,2')).toThrow('表头');
  });
});

describe('csvColumns', () => {
  it('包含全部导出列', () => {
    const cols = csvColumns().map((c) => c.label);
    expect(cols).toContain('分类');
    expect(cols).toContain('扩展信息');
    expect(cols).toContain('更新时间');
  });
});
