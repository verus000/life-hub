/* 分类配置与领域计算：新增一个管理类别只需在这里加配置。
   行为与原 public/assets/js/model.js 逐行对应。 */

import { clone, validDate } from './records';
import type { CompletionValues, DueEntry, Item, ItemDetail, Snapshot, ValidatedFields } from './types';

export const CYCLES: [string, string][] = [
  ['weekly', '每周'], ['monthly', '每月'], ['quarterly', '每季'], ['semiannual', '每半年'],
  ['yearly', '每年'], ['once', '一次性'],
];
const CYCLE_FACTOR: Record<string, number> = { weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, yearly: 1, once: 0 };
const CYCLE_LABEL: Record<string, string> = Object.fromEntries(CYCLES);

export const ASSET_TYPES = ['现金', '银行存款', '证券', '基金', '保险', '公积金', '房产', '其他'];

export const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY', 'GBP', 'TWD', 'KRW', 'SGD', 'AUD', 'CAD', 'THB'];
const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥', USD: '$', HKD: 'HK$', EUR: '€', JPY: '¥', GBP: '£',
  TWD: 'NT$', KRW: '₩', SGD: 'S$', AUD: 'A$', CAD: 'C$', THB: '฿',
};

export const COUNTRIES: [string, string, string][] = [
  ['中国', 'China', '🇨🇳'], ['中国香港', 'Hong Kong', '🇭🇰'], ['中国澳门', 'Macao', '🇲🇴'], ['中国台湾', 'Taiwan', '🇹🇼'],
  ['新加坡', 'Singapore', '🇸🇬'], ['马来西亚', 'Malaysia', '🇲🇾'], ['泰国', 'Thailand', '🇹🇭'], ['日本', 'Japan', '🇯🇵'], ['韩国', 'Korea', '🇰🇷'],
  ['美国', 'United States', '🇺🇸'], ['英国', 'United Kingdom', '🇬🇧'], ['加拿大', 'Canada', '🇨🇦'], ['澳大利亚', 'Australia', '🇦🇺'],
  ['越南', 'Vietnam', '🇻🇳'], ['菲律宾', 'Philippines', '🇵🇭'], ['印尼', 'Indonesia', '🇮🇩'], ['印度', 'India', '🇮🇳'], ['阿联酋', 'UAE', '🇦🇪'],
  ['德国', 'Germany', '🇩🇪'], ['法国', 'France', '🇫🇷'], ['意大利', 'Italy', '🇮🇹'], ['西班牙', 'Spain', '🇪🇸'],
  ['俄罗斯', 'Russia', '🇷🇺'], ['土耳其', 'Turkey', '🇹🇷'], ['埃及', 'Egypt', '🇪🇬'], ['南非', 'South Africa', '🇿🇦'],
  ['巴西', 'Brazil', '🇧🇷'], ['墨西哥', 'Mexico', '🇲🇽'], ['柬埔寨', 'Cambodia', '🇰🇭'], ['老挝', 'Laos', '🇱🇦'],
  ['缅甸', 'Myanmar', '🇲🇲'], ['巴基斯坦', 'Pakistan', '🇵🇰'], ['尼日利亚', 'Nigeria', '🇳🇬'], ['新西兰', 'New Zealand', '🇳🇿'],
];

export const STRATEGY_PRESET = ['每月通话+短信', '季度充值保号', '漫游保活', '仅需接收短信', '每月流量消耗'];

/* ---------- 分类定义：字段驱动表单与列表 ---------- */

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'country' | 'suggest';
  required?: boolean;
  placeholder?: string;
  full?: boolean;
  options?: [string, string][];
  presets?: string[];
  default?: string;
}

export interface CategoryDef {
  key: string;
  label: string;
  unit: string;
  hasCycle: boolean;
  hasDue: boolean;
  fields: FieldDef[];
}

export const CATEGORIES: Record<string, CategoryDef> = {
  phone: {
    key: 'phone', label: '手机号', unit: '月租',
    hasCycle: true, hasDue: true,
    fields: [
      { key: 'title', label: '手机号', type: 'text', required: true, placeholder: '如 +86 13800000000' },
      { key: 'provider', label: '运营商', type: 'text', placeholder: '如 中国移动' },
      { key: 'detail.country', label: '归属国家', type: 'country' },
      { key: 'detail.strategy', label: '保活策略', type: 'suggest', presets: STRATEGY_PRESET },
      { key: 'amount', label: '每期费用', type: 'number' },
      { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map((c) => [c, c]), default: 'CNY' },
      { key: 'cycle', label: '缴费周期', type: 'select', options: CYCLES, default: 'monthly' },
      { key: 'detail.reminderCycle', label: '保活周期', type: 'select', options: CYCLES, default: 'monthly' },
      { key: 'startDate', label: '激活日期', type: 'date' },
      { key: 'nextDate', label: '下次保活日期', type: 'date', required: true },
      { key: 'note', label: '备注', type: 'textarea', full: true },
    ],
  },
  broadband: {
    key: 'broadband', label: '宽带', unit: '月费',
    hasCycle: true, hasDue: true,
    fields: [
      { key: 'title', label: '宽带名称', type: 'text', required: true, placeholder: '如 家里电信宽带' },
      { key: 'provider', label: '运营商', type: 'text', placeholder: '如 中国电信' },
      { key: 'detail.speed', label: '带宽', type: 'text', placeholder: '如 500M' },
      { key: 'detail.address', label: '装机地址', type: 'text', full: true },
      { key: 'detail.accountNo', label: '宽带账号', type: 'text' },
      { key: 'amount', label: '每期费用', type: 'number' },
      { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map((c) => [c, c]), default: 'CNY' },
      { key: 'cycle', label: '缴费周期', type: 'select', options: CYCLES, default: 'monthly' },
      { key: 'startDate', label: '开通日期', type: 'date' },
      { key: 'nextDate', label: '下次续费日期', type: 'date', required: true },
      { key: 'detail.contractDate', label: '合约到期日', type: 'date' },
      { key: 'detail.autoRenew', label: '自动续费', type: 'select', options: [['yes', '是'], ['no', '否']], default: 'no' },
      { key: 'note', label: '备注', type: 'textarea', full: true },
    ],
  },
  parking: {
    key: 'parking', label: '停车费', unit: '费用',
    hasCycle: true, hasDue: true,
    fields: [
      { key: 'title', label: '车牌号', type: 'text', required: true, placeholder: '如 粤A12345' },
      { key: 'provider', label: '停车场 / 物业', type: 'text' },
      { key: 'detail.slot', label: '车位号', type: 'text', placeholder: '如 B2-128' },
      { key: 'detail.cardType', label: '卡类型', type: 'select', options: [['月卡', '月卡'], ['季卡', '季卡'], ['年卡', '年卡'], ['临停', '临停']], default: '月卡' },
      { key: 'amount', label: '每期费用', type: 'number' },
      { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map((c) => [c, c]), default: 'CNY' },
      { key: 'cycle', label: '缴费周期', type: 'select', options: CYCLES, default: 'monthly' },
      { key: 'startDate', label: '起租日期', type: 'date' },
      { key: 'nextDate', label: '到期日期', type: 'date', required: true },
      { key: 'detail.channel', label: '缴费渠道', type: 'text', placeholder: '如 物业小程序' },
      { key: 'note', label: '备注', type: 'textarea', full: true },
    ],
  },
  asset: {
    key: 'asset', label: '资产分布', unit: '余额',
    hasCycle: false, hasDue: false,
    fields: [
      { key: 'title', label: '账户名称', type: 'text', required: true, placeholder: '如 招行储蓄卡' },
      { key: 'provider', label: '机构', type: 'text', placeholder: '如 招商银行' },
      { key: 'detail.assetType', label: '资产类型', type: 'select', options: ASSET_TYPES.map((t) => [t, t]), default: '银行存款' },
      { key: 'amount', label: '当前余额', type: 'number', required: true },
      { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map((c) => [c, c]), default: 'CNY' },
      { key: 'nextDate', label: '复核日期', type: 'date' },
      { key: 'detail.reminderCycle', label: '复核周期', type: 'select', options: CYCLES, default: 'monthly' },
      { key: 'note', label: '备注', type: 'textarea', full: true },
    ],
  },
};

export const ORDER = ['phone', 'broadband', 'parking', 'asset'];

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
  return (item.detail && item.detail.reminderCycle) || item.cycle || 'monthly';
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
  const labels: Record<string, string> = { phone: '保活', broadband: '续费', parking: '缴费', asset: '复核' };
  const entry = {
    type: 'complete', action: labels[item.category], date, at: new Date().toISOString(), amount,
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

export function totals(items: Item[], annual?: boolean): string {
  const sums: Record<string, number> = {};
  items.filter(isActive).forEach((x) => {
    if (annual && x.cycle === 'once') return;
    const currency = x.currency || 'CNY';
    sums[currency] = (sums[currency] || 0) + (annual ? annualAmount(x) : Number(x.amount) || 0);
  });
  return Object.keys(sums).sort().map((currency) => currency + ' ' + money(sums[currency], currency)).join(' · ');
}
