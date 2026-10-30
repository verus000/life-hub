/* 日期、周期、历史与统计的纯函数；分类配置统一来自 categories.ts。 */

import { clone, validDate } from './records';
import type { CompletionValues, DueEntry, Item, ItemDetail, Snapshot, ValidatedFields } from './types';

import { CATEGORIES, COUNTRIES, CYCLES, categoryAction } from './categories';
export { ASSET_TYPES, CATEGORIES, COUNTRIES, CURRENCIES, CYCLES, ORDER, STRATEGY_PRESET } from './categories';
export type { CategoryDef, FieldDef } from './categories';
export { categoryAction } from './categories';
const CYCLE_FACTOR: Record<string, number> = { weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, yearly: 1, once: 0 };
const CYCLE_LABEL: Record<string, string> = Object.fromEntries(CYCLES);
const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥', USD: '$', HKD: 'HK$', EUR: '€', JPY: '¥', GBP: '£',
  TWD: 'NT$', KRW: '₩', SGD: 'S$', AUD: 'A$', CAD: 'C$', THB: '฿',
};

/* ---------- 取值 / 赋值（支持 detail.xxx 路径） ---------- */

export function get(item: Item, path: string): string | number {
  if (!path) return '';
  if (path.startsWith('detail.')) {
    const k = path.slice(7);
    const v = item.detail && item.detail[k];
    return v === undefined || v === null ? '' : (v as string | number);
  }
  const v = (item as unknown as Record<string, unknown>)[path];
  return v === undefined || v === null ? '' : (v as string | number);
}

export function set(item: Item, path: string, value: unknown): void {
  if (path.startsWith('detail.')) {
    item.detail = item.detail || {};
    (item.detail as Record<string, unknown>)[path.slice(7)] = value;
  } else {
    (item as unknown as Record<string, unknown>)[path] = value;
  }
}

/* ---------- 日期与状态 ---------- */

export function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* 业务日期展示为“2026年10月20日”，直接拆字符串，避免时区偏移；非法值原样返回。 */
export function dateLabel(dateStr: string): string {
  if (!validDate(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return y + '年' + Number(m) + '月' + Number(d) + '日';
}

export function diffDays(dateStr: string): number | null {
  const a = new Date(todayStr() + 'T00:00:00');
  const b = new Date(dateStr + 'T00:00:00');
  if (isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export interface StatusInfo {
  key: 'none' | 'overdue' | 'today' | 'soon' | 'fine';
  label: string;
  days: number | null;
}

export function statusOf(item: Item): StatusInfo {
  if (!item.nextDate) return { key: 'none', label: '未设定日期', days: null };
  const d = diffDays(item.nextDate);
  if (d === null) return { key: 'none', label: '日期无效', days: null };
  if (d < 0) return { key: 'overdue', label: '已逾期 ' + -d + ' 天', days: d };
  if (d === 0) return { key: 'today', label: '今日到期', days: d };
  if (d <= 7) return { key: 'soon', label: d + ' 天后到期', days: d };
  return { key: 'fine', label: d + ' 天后到期', days: d };
}

export function cycleLabel(c: string): string {
  return CYCLE_LABEL[c] || '';
}

export function annualAmount(item: Item): number {
  if (!isActive(item) || item.amount === null || item.amount === undefined) return 0;
  const f = CYCLE_FACTOR[item.cycle] === undefined ? 1 : CYCLE_FACTOR[item.cycle];
  return Number(item.amount) * f;
}

export function money(n: number | null | undefined, currency?: string): string {
  if (n === null || n === undefined || (n as unknown) === '') return '';
  const sym = CURRENCY_SYMBOL[currency || ''] || '';
  const v = Number(n);
  const txt =
    Math.abs(v) >= 1000
      ? v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
      : String(Math.round(v * 100) / 100);
  return sym + txt;
}

/* 展示用金额：符号唯一时只显示符号；无符号或与其他币种共用符号（如 JPY 的 ¥）时补币种代码，CNY 视为默认币种。 */
export function moneyLabel(n: number | null | undefined, currency?: string): string {
  const code = currency || 'CNY';
  const txt = money(n, code);
  if (!txt) return '';
  const sym = CURRENCY_SYMBOL[code];
  const shared = !!sym && code !== 'CNY' && Object.keys(CURRENCY_SYMBOL).some((k) => k !== code && CURRENCY_SYMBOL[k] === sym);
  return !sym || shared ? code + ' ' + txt : txt;
}

export function flagOf(country: string): string {
  const c = COUNTRIES.find((x) => x[0] === country);
  return c ? c[2] : '🌐';
}

export function searchCountries(q: string): [string, string, string][] {
  const key = String(q || '').trim().toLowerCase();
  if (!key) return COUNTRIES;
  return COUNTRIES.filter((c) => c[0].indexOf(key) >= 0 || c[1].toLowerCase().indexOf(key) >= 0);
}

export function isActive(item: Item): boolean {
  return !item.status || item.status === 'active';
}

export function reminderCycle(item: Item): string {
  return item.detail?.reminderCycle || (item.category === 'phone' && item.detail?.reminderKind === 'expiry' ? 'once' : item.cycle) || 'monthly';
}

export function addMonths(date: string, months: number, anchor?: number): string {
  if (!validDate(date)) throw new Error('日期无效');
  const d = new Date(date + 'T12:00:00');
  const day = anchor || d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, end));
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function shiftNext(item: Item, handledDate?: string): string {
  const handled = handledDate || todayStr();
  const base = validDate(item.nextDate || '') && item.nextDate >= handled ? item.nextDate : handled;
  const cycle = reminderCycle(item);
  if (cycle === 'once') return '';
  if (cycle === 'weekly') return addDays(base, 7);
  const months: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
  const anchor = base === item.nextDate && item.detail ? Number(item.detail.reminderAnchor) : 0;
  return addMonths(base, months[cycle] || 1, anchor || undefined);
}

function snapshot(item: Item): Snapshot {
  return {
    nextDate: item.nextDate || '',
    status: item.status || 'active',
    amount: item.amount === undefined ? null : item.amount,
    reminderAnchor: (item.detail || {}).reminderAnchor || null,
    lastCompletedAt: (item.detail || {}).lastCompletedAt || '',
  };
}

export function complete(item: Item, values: CompletionValues): ValidatedFields {
  if (!isActive(item)) throw new Error('请先恢复条目再记录处理');
  const date = values.date || todayStr();
  if (!validDate(date) || date > todayStr()) throw new Error('处理日期应为今天或之前的有效日期');
  const amount = values.amount === '' || values.amount === null || values.amount === undefined ? null : Number(values.amount);
  if (amount !== null && (!Number.isFinite(amount) || (item.category !== 'asset' && amount < 0))) throw new Error('请输入有效金额');
  const currency = String(values.currency || item.currency || 'CNY').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('请输入三位字母币种代码');
  const once = reminderCycle(item) === 'once';
  const next = once ? '' : values.nextDate === undefined ? shiftNext(item, date) : values.nextDate;
  if (next && (!validDate(next) || next <= date)) throw new Error('下次日期应晚于处理日期');
  const detail = clone(item.detail || {});
  const base = item.nextDate && item.nextDate >= date ? item.nextDate : date;
  const calculated = shiftNext(item, date);
  detail.reminderAnchor = next && next !== calculated ? Number(next.slice(8)) : base === item.nextDate && detail.reminderAnchor ? detail.reminderAnchor : Number(base.slice(8));
  detail.lastCompletedAt = date;
  const patch: ValidatedFields & { amount?: number | null } = { nextDate: next, status: once ? 'completed' : 'active', detail };
  if (item.category === 'asset' && amount !== null) patch.amount = amount;
  const after: Item = { ...item, ...patch } as Item;
  const entry = {
    type: 'complete', action: categoryAction(item.category, item.detail), date, at: new Date().toISOString(), amount,
    currency, note: values.note || '', before: snapshot(item), after: snapshot(after),
  };
  detail.history = (detail.history || []).concat([entry]);
  return patch;
}

export function canUndo(item: Item): boolean {
  const history = (item.detail || {}).history || [];
  const entry = history[history.length - 1];
  return !!(entry && entry.type === 'complete' && !entry.undoneAt && JSON.stringify(snapshot(item)) === JSON.stringify(entry.after));
}

export function undo(item: Item): ValidatedFields {
  if (!canUndo(item)) throw new Error('记录已有后续变更，无法撤销；请编辑日期调整');
  const detail = clone(item.detail as ItemDetail);
  const entry = detail.history![detail.history!.length - 1];
  /* canUndo 已校验该条目为 complete 类型，before/after 必然存在 */
  const before = entry.before as Snapshot;
  entry.undoneAt = new Date().toISOString();
  if (before.reminderAnchor === null) delete detail.reminderAnchor;
    else detail.reminderAnchor = before.reminderAnchor;
  if (before.lastCompletedAt) detail.lastCompletedAt = before.lastCompletedAt;
    else delete detail.lastCompletedAt;
  return { nextDate: before.nextDate, status: before.status, amount: before.amount, detail };
}

export function dueEntries(items: Item[]): DueEntry[] {
  const entries: DueEntry[] = [];
  items.filter(isActive).forEach((x) => {
    if (validDate(x.nextDate || '')) entries.push({ x, date: x.nextDate, kind: 'task', d: diffDays(x.nextDate) ?? Infinity });
    const contract = (x.detail || {}).contractDate;
    if (x.category === 'broadband' && validDate(contract || '')) {
      entries.push({ x, date: contract as string, kind: 'contract', d: diffDays(contract as string) ?? Infinity });
    }
  });
  return entries.sort((a, b) => a.d - b.d);
}

export function totals(items: Item[], annual?: boolean, currencyCodes = false): string {
  const sums: Record<string, number> = {};
  items.filter(isActive).forEach((x) => {
    if (annual && x.cycle === 'once') return;
    const currency = x.currency || 'CNY';
    sums[currency] = (sums[currency] || 0) + (annual ? annualAmount(x) : Number(x.amount) || 0);
  });
  return Object.keys(sums).sort().map((currency) => currencyCodes
    ? currency + ' ' + sums[currency].toLocaleString('zh-CN', { maximumFractionDigits: 2 })
    : moneyLabel(sums[currency], currency)).join(' · ');
}

export function categoryMetadata(item: Item): string {
  const def = CATEGORIES[item.category];
  return (def?.listMeta || ['provider']).map((key) => {
    const value = String(get(item, key));
    const field = def?.fields.find((candidate) => candidate.key === key);
    return field?.options?.find(([code]) => code === value)?.[1] || value;
  }).filter(Boolean).join(' · ');
}
