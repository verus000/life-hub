/* 前后端共用的数据校验、备份和去重；不依赖 DOM 或数据库。
   行为与原 public/assets/js/records.js 逐行对应。 */

import type { Item, ItemDetail, ItemInput, ValidatedFields } from './types';

export const CATEGORIES: Record<string, string> = {
  phone: '手机号', broadband: '宽带', parking: '停车费', asset: '资产分布',
};
export const CYCLES: Record<string, string> = {
  weekly: '每周', monthly: '每月', quarterly: '每季', semiannual: '每半年', yearly: '每年', once: '一次性',
};
export const STATUSES: Record<string, string> = {
  active: '在用', paused: '已暂停', archived: '已归档', completed: '已完成',
};

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function knownCode(value: unknown, options: Record<string, string>): string {
  const v = value == null ? '' : String(value);
  return Object.keys(options).find((k) => k === v || options[k] === v) || v || '';
}

export function normalizeDetail(value: ItemDetail | null | undefined): ItemDetail {
  const detail = clone(value || {});
  if (detail.reminderCycle) detail.reminderCycle = knownCode(detail.reminderCycle, CYCLES);
  if (detail.autoRenew) detail.autoRenew = knownCode(detail.autoRenew, { yes: '是', no: '否' });
  return detail;
}

function code(value: unknown, options: Record<string, string>, label: string): string {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  const key = Object.keys(options).find((k) => k === s || options[k] === s);
  if (!key) throw new Error(label + '无效：' + s);
  return key;
}

export function validDate(s: unknown): boolean {
  const str = String(s || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T12:00:00');
  return (
    !isNaN(d.getTime()) &&
    d.getFullYear() === Number(str.slice(0, 4)) &&
    d.getMonth() + 1 === Number(str.slice(5, 7)) &&
    d.getDate() === Number(str.slice(8))
  );
}

function checkObject(o: unknown, depth: number): void {
  if (depth > 20) throw new Error('扩展信息层级过深');
  if (!o || typeof o !== 'object') return;
  Object.keys(o as object).forEach((k) => {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('扩展信息包含非法字段');
    checkObject((o as Record<string, unknown>)[k], depth + 1);
  });
}

export function validate(input: ItemInput, patch?: boolean): ValidatedFields {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('条目必须是对象');
  const out: ValidatedFields = {};
  const strings = ['title', 'provider', 'note', 'startDate', 'nextDate', 'createdAt', 'updatedAt'] as const;
  strings.forEach((k) => {
    if (!own(input, k)) return;
    const v = input[k];
    if (v !== null && typeof v !== 'string') throw new Error(k + ' 必须是文本');
    out[k] = v || '';
  });
  if (out.title !== undefined) out.title = out.title.trim();
  if ((!patch || own(input, 'title')) && !out.title) throw new Error('缺少必填字段 title');
  (['category', 'cycle', 'status'] as const).forEach((k) => {
    if (!own(input, k) && patch) return;
    const maps: Record<string, Record<string, string>> = {
      category: CATEGORIES, cycle: CYCLES, status: STATUSES,
    };
    const defaults: Record<string, string> = { category: 'phone', cycle: '', status: 'active' };
    out[k] = code(input[k], maps[k], k) || defaults[k];
  });
  if (own(input, 'currency') || !patch) {
    out.currency = String(input.currency || 'CNY').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(out.currency)) throw new Error('币种须为三位字母代码');
  }
  if (own(input, 'amount') || !patch) {
    const v = input.amount;
    if (v !== '' && v !== null && v !== undefined && !['number', 'string'].includes(typeof v)) {
      throw new Error('金额必须是数字');
    }
    out.amount = v === '' || v === null || v === undefined ? null : Number(v);
    if (out.amount !== null && !Number.isFinite(out.amount)) throw new Error('金额必须是有限数字');
  }
  (['startDate', 'nextDate'] as const).forEach((k) => {
    if (out[k] && !validDate(out[k])) throw new Error(k + ' 日期无效，请使用 YYYY-MM-DD');
  });
  if (own(input, 'detail') || !patch) {
    const detail = input.detail === undefined ? {} : input.detail;
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new Error('扩展信息必须是对象');
    checkObject(detail, 0);
    out.detail = clone(detail as ItemDetail);
    if (out.detail.reminderCycle) out.detail.reminderCycle = code(out.detail.reminderCycle, CYCLES, '提醒周期');
    if (out.detail.contractDate && !validDate(out.detail.contractDate)) throw new Error('合约到期日无效');
    if (out.detail.reminderAnchor !== undefined && (!Number.isInteger(out.detail.reminderAnchor) || out.detail.reminderAnchor < 1 || out.detail.reminderAnchor > 31)) {
      throw new Error('提醒日期锚点无效');
    }
    if (own(out.detail, 'autoRenew') && out.detail.autoRenew !== '') {
      out.detail.autoRenew = code(out.detail.autoRenew, { yes: '是', no: '否' }, '自动续费');
    }
    if (out.detail.history !== undefined && !Array.isArray(out.detail.history)) throw new Error('处理记录必须是数组');
    if (out.detail.recordKey !== undefined && (typeof out.detail.recordKey !== 'string' || out.detail.recordKey.length > 200)) {
      throw new Error('记录标识无效');
    }
  }
  return out;
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable((v as Record<string, unknown>)[k])).join(',') + '}';
  }
  return JSON.stringify(v) === undefined ? 'null' : JSON.stringify(v);
}

export function fingerprint(item: ItemInput): string {
  const x = validate(item);
  const copy: ValidatedFields & { detail?: ItemDetail } = { ...x };
  delete copy.createdAt;
  delete copy.updatedAt;
  if (copy.detail) {
    const d = { ...copy.detail };
    delete d.recordKey;
    copy.detail = d;
  }
  const filled = copy as Record<string, unknown>;
  ['provider', 'note', 'startDate', 'nextDate'].forEach((k) => {
    filled[k] = filled[k] || '';
  });
  return stable(filled);
}

export function partition(
  incoming: ItemInput[],
  existing: ItemInput[],
): { items: ItemInput[]; skipped: number } {
  const keys = new Set<string>();
  const all = new Set<string>();
  const legacy = new Set<string>();
  function remember(x: ItemInput) {
    const fp = fingerprint(x);
    const key = x.detail && x.detail.recordKey;
    all.add(fp);
    if (key) keys.add(key);
    else legacy.add(fp);
  }
  existing.forEach(remember);
  const items: ItemInput[] = [];
  let skipped = 0;
  incoming.forEach((x) => {
    const fp = fingerprint(x);
    const key = x.detail && x.detail.recordKey;
    if ((key && keys.has(key)) || (key ? legacy.has(fp) : all.has(fp))) {
      skipped++;
      return;
    }
    items.push(x);
    remember(x);
  });
  return { items, skipped };
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  const src = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"' && cur === '') quoted = true;
    else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (quoted) throw new Error('CSV 引号未闭合，请检查文件');
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const ALIASES: Record<string, string> = {
  名称: 'title', 手机号: 'title', 宽带名称: 'title', 车牌号: 'title', 账户名称: 'title',
  机构: 'provider', 运营商: 'provider', '停车场 / 物业': 'provider',
  金额: 'amount', 月租金额: 'amount', 每期费用: 'amount', 当前余额: 'amount', 币种: 'currency',
  周期: 'cycle', 缴费周期: 'cycle', 状态: 'status', 备注: 'note',
  开通日期: 'startDate', 激活日期: 'startDate', 起租日期: 'startDate',
  下次到期日: 'nextDate', 下次保活日期: 'nextDate', 下次续费日期: 'nextDate', 到期日期: 'nextDate', 复核日期: 'nextDate',
  归属国家: 'detail.country', 保活策略: 'detail.strategy', 保活周期: 'detail.reminderCycle', 复核周期: 'detail.reminderCycle',
  带宽: 'detail.speed', 装机地址: 'detail.address', 宽带账号: 'detail.accountNo', 自动续费: 'detail.autoRenew',
  合约到期日: 'detail.contractDate', 车位号: 'detail.slot', 卡类型: 'detail.cardType', 缴费渠道: 'detail.channel',
  资产类型: 'detail.assetType', 创建时间: 'createdAt', 更新时间: 'updatedAt', 记录标识: 'detail.recordKey',
};

export function parseImport(
  text: string,
  fallback?: string,
): { items: ValidatedFields[]; errors: string[]; total: number } {
  const src = String(text).replace(/^\uFEFF/, '').trim();
  if (!src) throw new Error('文件内容为空');
  let raw: unknown[];
  let start = 1;
  if (src[0] === '{' || src[0] === '[') {
    let backup: { format?: string; version?: number; items?: unknown[] } | unknown[] | null;
    try {
      backup = JSON.parse(src);
    } catch {
      throw new Error('JSON 文件格式不正确');
    }
    if (!backup || (!Array.isArray(backup) && ((backup as { format?: string }).format !== 'life-hub-backup' || (backup as { version?: number }).version !== 1))) {
      throw new Error('不支持的备份格式或版本');
    }
    raw = Array.isArray(backup) ? backup : (backup as { items?: unknown[] }).items ?? [];
    if (!Array.isArray(raw)) throw new Error('备份缺少条目数组');
  } else {
    const rows = parseCSV(src);
    const head = (rows.shift() || []).map((h) => h.trim());
    if (new Set(head).size !== head.length) throw new Error('CSV 表头不能重复');
    if (!head.some((h) => ALIASES[h] === 'title')) throw new Error('未识别到名称或手机号等必需表头');
    const guessed = head.includes('手机号') ? 'phone' : head.includes('宽带名称') ? 'broadband' : head.includes('车牌号') ? 'parking' : head.includes('账户名称') ? 'asset' : fallback || 'phone';
    raw = rows.map((cells, index) => {
      const item: ItemInput = { category: guessed, detail: {} };
      try {
        if (cells.length > head.length) throw new Error('列数多于表头，请检查引号');
        const detailIndex = head.indexOf('扩展信息');
        if (detailIndex >= 0 && cells[detailIndex]) item.detail = JSON.parse(cells[detailIndex]) as ItemDetail;
        head.forEach((h, ci) => {
          const val = cells[ci] === undefined ? '' : cells[ci];
          if (h === '分类') {
            item.category = code(val, CATEGORIES, '分类') || guessed;
            return;
          }
          let key = ALIASES[h];
          if (h === '合约到期日' && !head.includes('下次续费日期') && !head.includes('下次到期日')) key = 'nextDate';
          if (!key || (key === 'detail.recordKey' && !val)) return;
          if (key.startsWith('detail.')) {
            item.detail = item.detail || {};
            (item.detail as Record<string, unknown>)[key.slice(7)] = val;
          } else {
            (item as Record<string, unknown>)[key] = val;
          }
        });
        return item;
      } catch (e) {
        return { _importError: '第 ' + (index + 2) + ' 行：' + (e as Error).message };
      }
    });
    start = 2;
  }
  const items: ValidatedFields[] = [];
  const errors: string[] = [];
  raw.forEach((row, i) => {
    try {
      if (row && typeof row === 'object' && '_importError' in row) {
        throw new Error(String((row as { _importError: string })._importError));
      }
      items.push(validate(row as ItemInput));
    } catch (e) {
      const msg = (e as Error).message;
      errors.push(msg.startsWith('第 ') ? msg : '第 ' + (i + start) + ' 行：' + msg);
    }
  });
  return { items, errors, total: raw.length };
}

export function backup(items: Item[]): string {
  return JSON.stringify(
    { format: 'life-hub-backup', version: 1, exportedAt: new Date().toISOString(), items },
    null,
    2,
  );
}

export function csvColumns(): Array<{ label: string; get: (r: Item) => string }> {
  const cols: Array<[string, (r: Item) => string]> = [
    ['分类', (r) => CATEGORIES[r.category] || r.category],
    ['名称', (r) => r.title],
    ['机构', (r) => r.provider],
    ['金额', (r) => (r.amount === null || r.amount === undefined ? '' : String(r.amount))],
    ['币种', (r) => r.currency || 'CNY'],
    ['周期', (r) => CYCLES[r.cycle] || r.cycle || ''],
    ['开通日期', (r) => r.startDate],
    ['下次到期日', (r) => r.nextDate],
    ['状态', (r) => STATUSES[r.status || 'active']],
    ['备注', (r) => r.note],
    ['扩展信息', (r) => JSON.stringify(r.detail || {})],
    ['创建时间', (r) => r.createdAt],
    ['更新时间', (r) => r.updatedAt],
  ];
  return cols.map(([label, get]) => ({ label, get }));
}
