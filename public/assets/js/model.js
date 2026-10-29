/* 分类配置与领域计算：新增一个管理类别只需在这里加配置 */
window.Model = (function () {

  const CYCLES = [
    ['weekly', '每周'], ['monthly', '每月'], ['quarterly', '每季'], ['semiannual', '每半年'],
    ['yearly', '每年'], ['once', '一次性']
  ];
  const CYCLE_FACTOR = { weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, yearly: 1, once: 0 };
  const CYCLE_LABEL = Object.fromEntries(CYCLES);

  const ASSET_TYPES = ['现金', '银行存款', '证券', '基金', '保险', '公积金', '房产', '其他'];

  const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY', 'GBP', 'TWD', 'KRW', 'SGD', 'AUD', 'CAD', 'THB'];
  const CURRENCY_SYMBOL = {
    CNY: '¥', USD: '$', HKD: 'HK$', EUR: '€', JPY: '¥', GBP: '£',
    TWD: 'NT$', KRW: '₩', SGD: 'S$', AUD: 'A$', CAD: 'C$', THB: '฿'
  };

  const COUNTRIES = [
    ['中国', 'China', '🇨🇳'], ['中国香港', 'Hong Kong', '🇭🇰'], ['中国澳门', 'Macao', '🇲🇴'], ['中国台湾', 'Taiwan', '🇹🇼'],
    ['新加坡', 'Singapore', '🇸🇬'], ['马来西亚', 'Malaysia', '🇲🇾'], ['泰国', 'Thailand', '🇹🇭'], ['日本', 'Japan', '🇯🇵'], ['韩国', 'Korea', '🇰🇷'],
    ['美国', 'United States', '🇺🇸'], ['英国', 'United Kingdom', '🇬🇧'], ['加拿大', 'Canada', '🇨🇦'], ['澳大利亚', 'Australia', '🇦🇺'],
    ['越南', 'Vietnam', '🇻🇳'], ['菲律宾', 'Philippines', '🇵🇭'], ['印尼', 'Indonesia', '🇮🇩'], ['印度', 'India', '🇮🇳'], ['阿联酋', 'UAE', '🇦🇪'],
    ['德国', 'Germany', '🇩🇪'], ['法国', 'France', '🇫🇷'], ['意大利', 'Italy', '🇮🇹'], ['西班牙', 'Spain', '🇪🇸'],
    ['俄罗斯', 'Russia', '🇷🇺'], ['土耳其', 'Turkey', '🇹🇷'], ['埃及', 'Egypt', '🇪🇬'], ['南非', 'South Africa', '🇿🇦'],
    ['巴西', 'Brazil', '🇧🇷'], ['墨西哥', 'Mexico', '🇲🇽'], ['柬埔寨', 'Cambodia', '🇰🇭'], ['老挝', 'Laos', '🇱🇦'],
    ['缅甸', 'Myanmar', '🇲🇲'], ['巴基斯坦', 'Pakistan', '🇵🇰'], ['尼日利亚', 'Nigeria', '🇳🇬'], ['新西兰', 'New Zealand', '🇳🇿']
  ];

  const STRATEGY_PRESET = ['每月通话+短信', '季度充值保号', '漫游保活', '仅需接收短信', '每月流量消耗'];

  /* ---------- 分类定义：字段驱动表单与列表 ---------- */
  const CATEGORIES = {
    phone: {
      key: 'phone', label: '手机号', unit: '月租',
      hasCycle: true, hasDue: true,
      fields: [
        { key: 'title', label: '手机号', type: 'text', required: true, placeholder: '如 +86 13800000000' },
        { key: 'provider', label: '运营商', type: 'text', placeholder: '如 中国移动' },
        { key: 'detail.country', label: '归属国家', type: 'country' },
        { key: 'detail.strategy', label: '保活策略', type: 'suggest', presets: STRATEGY_PRESET },
        { key: 'amount', label: '每期费用', type: 'number' },
        { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map(c => [c, c]), default: 'CNY' },
        { key: 'cycle', label: '缴费周期', type: 'select', options: CYCLES, default: 'monthly' },
        { key: 'detail.reminderCycle', label: '保活周期', type: 'select', options: CYCLES, default: 'monthly' },
        { key: 'startDate', label: '激活日期', type: 'date' },
        { key: 'nextDate', label: '下次保活日期', type: 'date', required: true },
        { key: 'note', label: '备注', type: 'textarea', full: true }
      ]
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
        { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map(c => [c, c]), default: 'CNY' },
        { key: 'cycle', label: '缴费周期', type: 'select', options: CYCLES, default: 'monthly' },
        { key: 'startDate', label: '开通日期', type: 'date' },
        { key: 'nextDate', label: '下次续费日期', type: 'date', required: true },
        { key: 'detail.contractDate', label: '合约到期日', type: 'date' },
        { key: 'detail.autoRenew', label: '自动续费', type: 'select', options: [['yes', '是'], ['no', '否']], default: 'no' },
        { key: 'note', label: '备注', type: 'textarea', full: true }
      ]
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
        { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map(c => [c, c]), default: 'CNY' },
        { key: 'cycle', label: '缴费周期', type: 'select', options: CYCLES, default: 'monthly' },
        { key: 'startDate', label: '起租日期', type: 'date' },
        { key: 'nextDate', label: '到期日期', type: 'date', required: true },
        { key: 'detail.channel', label: '缴费渠道', type: 'text', placeholder: '如 物业小程序' },
        { key: 'note', label: '备注', type: 'textarea', full: true }
      ]
    },
    asset: {
      key: 'asset', label: '资产分布', unit: '余额',
      hasCycle: false, hasDue: false,
      fields: [
        { key: 'title', label: '账户名称', type: 'text', required: true, placeholder: '如 招行储蓄卡' },
        { key: 'provider', label: '机构', type: 'text', placeholder: '如 招商银行' },
        { key: 'detail.assetType', label: '资产类型', type: 'select', options: ASSET_TYPES.map(t => [t, t]), default: '银行存款' },
        { key: 'amount', label: '当前余额', type: 'number', required: true },
        { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map(c => [c, c]), default: 'CNY' },
        { key: 'nextDate', label: '复核日期', type: 'date' },
        { key: 'detail.reminderCycle', label: '复核周期', type: 'select', options: CYCLES, default: 'monthly' },
        { key: 'note', label: '备注', type: 'textarea', full: true }
      ]
    }
  };

  const ORDER = ['phone', 'broadband', 'parking', 'asset'];

  /* ---------- 取值 / 赋值（支持 detail.xxx 路径） ---------- */
  function get(item, path) {
    if (!path) return '';
    if (path.indexOf('detail.') === 0) {
      const k = path.slice(7);
      return item.detail && item.detail[k] !== undefined ? item.detail[k] : '';
    }
    return item[path] !== undefined && item[path] !== null ? item[path] : '';
  }
  function set(item, path, value) {
    if (path.indexOf('detail.') === 0) {
      item.detail = item.detail || {};
      item.detail[path.slice(7)] = value;
    } else {
      item[path] = value;
    }
  }

  /* ---------- 日期与状态 ---------- */
  function todayStr() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + n);
    const p = x => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function diffDays(dateStr) {
    const a = new Date(todayStr() + 'T00:00:00');
    const b = new Date(dateStr + 'T00:00:00');
    if (isNaN(b.getTime())) return null;
    return Math.round((b - a) / 86400000);
  }
  function statusOf(item) {
    if (!item.nextDate) return { key: 'none', label: '未设定日期', days: null };
    const d = diffDays(item.nextDate);
    if (d === null) return { key: 'none', label: '日期无效', days: null };
    if (d < 0) return { key: 'overdue', label: '已逾期 ' + (-d) + ' 天', days: d };
    if (d === 0) return { key: 'today', label: '今日到期', days: d };
    if (d <= 7) return { key: 'soon', label: d + ' 天后到期', days: d };
    return { key: 'fine', label: d + ' 天后到期', days: d };
  }
  function cycleLabel(c) { return CYCLE_LABEL[c] || ''; }
  function annualAmount(item) {
    if (!isActive(item) || item.amount === null || item.amount === undefined) return 0;
    const f = CYCLE_FACTOR[item.cycle] === undefined ? 1 : CYCLE_FACTOR[item.cycle];
    return Number(item.amount) * f;
  }
  function money(n, currency) {
    if (n === null || n === undefined || n === '') return '';
    const sym = CURRENCY_SYMBOL[currency] || '';
    const v = Number(n);
    const txt = Math.abs(v) >= 1000
      ? v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
      : String(Math.round(v * 100) / 100);
    return sym + txt;
  }
  function flagOf(country) {
    const c = COUNTRIES.find(x => x[0] === country);
    return c ? c[2] : '🌐';
  }
  function searchCountries(q) {
    const key = String(q || '').trim().toLowerCase();
    if (!key) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c[0].indexOf(key) >= 0 || c[1].toLowerCase().indexOf(key) >= 0
    );
  }

  function isActive(item) { return !item.status || item.status === 'active'; }
  function reminderCycle(item) {
    return (item.detail && item.detail.reminderCycle) || item.cycle || 'monthly';
  }
  function addMonths(date, months, anchor) {
    if (!Records.validDate(date)) throw new Error('日期无效');
    const d = new Date(date + 'T12:00:00');
    const day = anchor || d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + months);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, end));
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function shiftNext(item, handledDate) {
    const handled = handledDate || todayStr();
    const base = Records.validDate(item.nextDate || '') && item.nextDate >= handled ? item.nextDate : handled;
    const cycle = reminderCycle(item);
    if (cycle === 'once') return '';
    if (cycle === 'weekly') return addDays(base, 7);
    const months = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
    const anchor = base === item.nextDate && item.detail ? Number(item.detail.reminderAnchor) : 0;
    return addMonths(base, months[cycle] || 1, anchor);
  }
  function snapshot(item) {
    return { nextDate: item.nextDate || '', status: item.status || 'active', amount: item.amount === undefined ? null : item.amount,
      reminderAnchor: (item.detail || {}).reminderAnchor || null, lastCompletedAt: (item.detail || {}).lastCompletedAt || '' };
  }
  function complete(item, values) {
    if (!isActive(item)) throw new Error('请先恢复条目再记录处理');
    const date = values.date || todayStr();
    if (!Records.validDate(date) || date > todayStr()) throw new Error('处理日期应为今天或之前的有效日期');
    const amount = values.amount === '' || values.amount === null || values.amount === undefined ? null : Number(values.amount);
    if (amount !== null && (!Number.isFinite(amount) || (item.category !== 'asset' && amount < 0))) throw new Error('请输入有效金额');
    const currency = String(values.currency || item.currency || 'CNY').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('请输入三位字母币种代码');
    const once = reminderCycle(item) === 'once';
    const next = once ? '' : (values.nextDate === undefined ? shiftNext(item, date) : values.nextDate);
    if (next && (!Records.validDate(next) || next <= date)) throw new Error('下次日期应晚于处理日期');
    const detail = Records.clone(item.detail || {});
    const base = item.nextDate && item.nextDate >= date ? item.nextDate : date;
    const calculated = shiftNext(item, date);
    detail.reminderAnchor = next && next !== calculated ? Number(next.slice(8)) :
      (base === item.nextDate && detail.reminderAnchor ? detail.reminderAnchor : Number(base.slice(8)));
    detail.lastCompletedAt = date;
    const patch = { nextDate: next, status: once ? 'completed' : 'active', detail };
    if (item.category === 'asset' && amount !== null) patch.amount = amount;
    const after = Object.assign({}, item, patch);
    const labels = { phone: '保活', broadband: '续费', parking: '缴费', asset: '复核' };
    const entry = { type: 'complete', action: labels[item.category], date, at: new Date().toISOString(), amount,
      currency, note: values.note || '', before: snapshot(item), after: snapshot(after) };
    detail.history = (detail.history || []).concat([entry]);
    return patch;
  }
  function canUndo(item) {
    const history = (item.detail || {}).history || [], entry = history[history.length - 1];
    return !!(entry && entry.type === 'complete' && !entry.undoneAt && JSON.stringify(snapshot(item)) === JSON.stringify(entry.after));
  }
  function undo(item) {
    if (!canUndo(item)) throw new Error('记录已有后续变更，无法撤销；请编辑日期调整');
    const detail = Records.clone(item.detail), entry = detail.history[detail.history.length - 1], before = entry.before;
    entry.undoneAt = new Date().toISOString();
    if (before.reminderAnchor === null) delete detail.reminderAnchor; else detail.reminderAnchor = before.reminderAnchor;
    if (before.lastCompletedAt) detail.lastCompletedAt = before.lastCompletedAt; else delete detail.lastCompletedAt;
    return { nextDate: before.nextDate, status: before.status, amount: before.amount, detail };
  }
  function dueEntries(items) {
    const entries = [];
    items.filter(isActive).forEach(x => {
      if (Records.validDate(x.nextDate || '')) entries.push({ x, date: x.nextDate, kind: 'task', d: diffDays(x.nextDate) });
      const contract = (x.detail || {}).contractDate;
      if (x.category === 'broadband' && Records.validDate(contract || '')) entries.push({ x, date: contract, kind: 'contract', d: diffDays(contract) });
    });
    return entries.sort((a, b) => a.d - b.d);
  }
  function totals(items, annual) {
    const sums = {};
    items.filter(isActive).forEach(x => {
      if (annual && x.cycle === 'once') return;
      const currency = x.currency || 'CNY';
      sums[currency] = (sums[currency] || 0) + (annual ? annualAmount(x) : Number(x.amount) || 0);
    });
    return Object.keys(sums).sort().map(currency => currency + ' ' + money(sums[currency], currency)).join(' · ');
  }

  return {
    CATEGORIES, ORDER, CYCLES, ASSET_TYPES, CURRENCIES, STRATEGY_PRESET, COUNTRIES,
    get, set, todayStr, addDays, diffDays, statusOf, cycleLabel,
    annualAmount, money, flagOf, searchCountries, isActive, reminderCycle, addMonths, shiftNext,
    complete, canUndo, undo, dueEntries, totals
  };
})();
