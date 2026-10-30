/* 分类注册表：纯配置，前后端、表单、列表与导入共用。 */

export const CYCLES: [string, string][] = [
  ['weekly', '每周'], ['monthly', '每月'], ['quarterly', '每季'], ['semiannual', '每半年'],
  ['yearly', '每年'], ['once', '一次性'],
];

export const ASSET_TYPES = ['现金', '银行存款', '证券', '基金', '保险', '公积金', '房产', '其他'];

export const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY', 'GBP', 'TWD', 'KRW', 'SGD', 'AUD', 'CAD', 'THB'];


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

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'country' | 'suggest';
  required?: boolean;
  placeholder?: string;
  full?: boolean;
  options?: [string, string][];
  presets?: string[];
  default?: string;
  hint?: string;
  sensitive?: boolean;
};

export const MONEY_FIELD = 'amount+currency';
export type FormLayout = { sections: Array<{ title: string; rows: string[][] }>; more: string[][] };

export type CategoryDef = {
  key: string;
  label: string;
  unit: string;
  hasCycle: boolean;
  hasDue: boolean;
  fields: FieldDef[];
  aliases?: string[];
  description?: string;
  action?: string;
  listMeta?: string[];
  form?: FormLayout;
};

export const CATEGORIES: Record<string, CategoryDef> = {
  phone: {
    key: 'phone', label: 'eSIM / 手机卡', unit: '费用',
    aliases: ['手机号', '手机卡', 'eSIM'],
    description: '海外保号、旅行流量，记住用途和提醒就好。',
    action: '保活',
    listMeta: ['provider', 'detail.country', 'detail.simType', 'detail.phoneNumber', 'detail.planName', 'detail.coverage'],
    form: {
      sections: [
        { title: '卡片', rows: [['title'], ['detail.simType', 'detail.reminderKind'], ['provider', 'detail.country'], ['detail.phoneNumber']] },
        { title: '提醒', rows: [['nextDate', 'detail.reminderCycle'], ['detail.strategy']] },
      ],
      more: [['detail.planName', 'detail.coverage'], ['detail.accountNo'], [MONEY_FIELD, 'cycle'], ['startDate'], ['note']],
    },
    hasCycle: true, hasDue: true,
    fields: [
      { key: 'title', label: '名称 / 别名', type: 'text', required: true, placeholder: '如 英国保号卡、欧洲旅行卡', hint: '只填自己能辨认的名称即可，也可直接填脱敏号码。' },
      { key: 'detail.simType', label: '卡片形式', type: 'select', options: [['esim', 'eSIM'], ['physical', '实体 SIM']], default: 'esim' },
      { key: 'detail.reminderKind', label: '提醒类型', type: 'select', options: [['keepalive', '长期保号'], ['expiry', '套餐到期']], default: 'keepalive' },
      { key: 'provider', label: '运营商 / 服务商', type: 'text', placeholder: '填写卡片所属服务商' },
      { key: 'detail.country', label: '发卡国家 / 地区', type: 'country' },
      { key: 'detail.phoneNumber', label: '号码 / 尾号', type: 'text', placeholder: '如 +44 ****1234，或只填 1234', sensitive: true, hint: '选填；没有号码或不想记录真实号码时留空。' },
      { key: 'detail.planName', label: '套餐', type: 'text', placeholder: '如 旅行流量 10GB / 30天' },
      { key: 'detail.coverage', label: '使用国家 / 覆盖地区', type: 'text', placeholder: '如 日本、欧洲多国' },
      { key: 'detail.accountNo', label: '账户标识 / 卡片尾号', type: 'text', sensitive: true, placeholder: '可填别名或脱敏标识' },
      { key: 'detail.strategy', label: '保号方式 / 提醒说明', type: 'suggest', presets: STRATEGY_PRESET },
      { key: 'amount', label: '每期费用', type: 'number' },
      { key: 'currency', label: '币种', type: 'select', options: CURRENCIES.map((c) => [c, c]), default: 'CNY' },
      { key: 'cycle', label: '缴费周期', type: 'select', options: CYCLES },
      { key: 'detail.reminderCycle', label: '保活周期', type: 'select', options: CYCLES, default: 'monthly' },
      { key: 'startDate', label: '激活日期', type: 'date' },
      { key: 'nextDate', label: '提醒日期', type: 'date', hint: '可稍后补充；保号与缴费周期分别设置。' },
      { key: 'note', label: '备注', type: 'textarea', full: true },
    ],
  },
  broadband: {
    key: 'broadband', label: '宽带', unit: '月费',
    description: '续费与合约期限，清清楚楚。', action: '续费',
    listMeta: ['provider', 'detail.speed'],
    form: { sections: [
      { title: '宽带', rows: [['title'], ['provider', 'detail.speed']] },
      { title: '续费', rows: [['nextDate', 'cycle'], [MONEY_FIELD], ['detail.contractDate', 'detail.autoRenew']] },
    ], more: [['detail.address'], ['detail.accountNo', 'startDate'], ['note']] },
    hasCycle: true, hasDue: true,
    fields: [
      { key: 'title', label: '宽带名称', type: 'text', required: true, placeholder: '如 家里电信宽带' },
      { key: 'provider', label: '运营商', type: 'text', placeholder: '如 中国电信' },
      { key: 'detail.speed', label: '带宽', type: 'text', placeholder: '如 500M' },
      { key: 'detail.address', label: '装机地址', type: 'text', full: true, placeholder: '如 某区 / 小区简称，无需完整门牌' },
      { key: 'detail.accountNo', label: '宽带账号', type: 'text', sensitive: true, placeholder: '可填账号别名或仅保留尾号' },
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
    description: '记好缴费日期，出行少一件牵挂。', action: '缴费',
    listMeta: ['provider', 'detail.slot', 'detail.cardType'],
    form: { sections: [
      { title: '车位', rows: [['title'], ['provider', 'detail.slot']] },
      { title: '缴费', rows: [['nextDate', 'cycle'], [MONEY_FIELD, 'detail.cardType']] },
    ], more: [['detail.channel', 'startDate'], ['note']] },
    hasCycle: true, hasDue: true,
    fields: [
      { key: 'title', label: '车牌 / 别名', type: 'text', required: true, placeholder: '如 通勤车、粤A***45' },
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
    description: '定期看一眼，心里更有数。', action: '复核',
    listMeta: ['provider', 'detail.assetType'],
    form: { sections: [
      { title: '账户', rows: [['title'], ['detail.assetType', 'provider']] },
      { title: '余额', rows: [[MONEY_FIELD]] },
    ], more: [['nextDate', 'detail.reminderCycle'], ['note']] },
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

export const ORDER = Object.keys(CATEGORIES);
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(ORDER.map((key) => [key, CATEGORIES[key].label]));

export function categoryAction(category: string, detail: Record<string, unknown> = {}): string {
  if (category === 'phone' && detail.reminderKind === 'expiry') return '到期';
  return CATEGORIES[category]?.action || '处理';
}

export function formLayout(def: CategoryDef): FormLayout {
  return def.form || {
    sections: [{ title: def.label, rows: def.fields.filter((field) => field.required).map((field) => [field.key]) }],
    more: def.fields.filter((field) => !field.required).map((field) => [field.key]),
  };
}
