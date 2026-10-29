/* 生活管理 · 自测脚本
   运行：node tools/selftest.js
   第一部分：用最小 DOM 桩加载前端脚本，模拟用户操作（后端不可用时走本地降级）
   第二部分：启动真实 Node 服务，验证 API 与可配置数据库适配器 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'public', 'assets', 'js');
const FILES = ['records.js', 'store.js', 'model.js', 'chart.js', 'calendar.js', 'ui.js', 'auth.js'];

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { pass++; console.log('  ✓ ' + name); },
    err => { fail++; failures.push(name + ' → ' + err.message); console.log('  ✗ ' + name + '\n      ' + err.message); }
  );
}
function assert(c, m) { if (!c) throw new Error(m || '断言失败'); }
function eq(a, b, m) {
  if (a !== b) throw new Error((m || '') + ' 期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a));
}

/* ================= 第一部分：前端流程 ================= */
function decode(s) {
  const NAMED = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' };
  return String(s).replace(/&(#\d+|[a-z]+);/gi, function (m, code) {
    if (code.charAt(0) === '#') {
      const n = Number(code.slice(1));
      return isNaN(n) ? m : String.fromCharCode(n);
    }
    const k = code.toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAMED, k) ? NAMED[k] : m;
  });
}
function parseControls(html) {
  const map = {}; let m;
  const reInput = /<input[^>]*data-key="([^"]+)"[^>]*>/g;
  while ((m = reInput.exec(html))) {
    const v = /value="([^"]*)"/.exec(m[0]);
    map[m[1]] = { value: v ? decode(v[1]) : '' };
  }
  const reSel = /<select[^>]*data-key="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g;
  while ((m = reSel.exec(html))) {
    const s = /<option value="([^"]*)"[^>]*\sselected/.exec(m[2]);
    map[m[1]] = { value: s ? decode(s[1]) : '' };
  }
  const reTa = /<textarea[^>]*data-key="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g;
  while ((m = reTa.exec(html))) map[m[1]] = { value: decode(m[2]) };
  return map;
}
const els = {};
function makeEl(id) {
  const cls = new Set();
  const el = {
    id, value: '', textContent: '',
    dataset: {}, style: {}, files: null,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
    querySelector(sel) {
      const k = /data-key="([^"]+)"/.exec(sel);
      if (!k) return null;
      if (!this._ctl || this._ctlHtml !== this.innerHTML) {
        this._ctl = parseControls(this.innerHTML || '');
        this._ctlHtml = this.innerHTML;
      }
      return this._ctl[k[1]] || null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}, click() {}, appendChild() {}, remove() {}
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return _html; },
    set(v) { _html = String(v); el._ctlHtml = null; },
    enumerable: true, configurable: true
  });
  return el;
}

let lastBlob = null;
let confirmRet = true;
let storeBroken = false;
const storeData = {};
const sandbox = {
  console,
  setTimeout: () => 0, clearTimeout: () => {},
  confirm: () => confirmRet,
  alert: () => {},
  localStorage: {
    getItem(k) { return k in storeData ? storeData[k] : null; },
    setItem(k, v) { if (storeBroken) throw new Error('storage disabled'); storeData[k] = String(v); },
    removeItem(k) { delete storeData[k]; }
  },
  Blob: function (parts) { lastBlob = parts.join(''); },
  URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
  document: {
    getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return makeEl('tmp'); },
    readyState: 'complete'
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

async function testFrontend() {
  console.log('\n[一] 前端流程（本地降级模式）\n');

  await t('前端脚本语法正确', () => {
    FILES.concat(['app.js']).forEach(f => {
      const code = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
      try { new vm.Script(code, { filename: f }); }
      catch (e) { throw new Error(f + ' 语法错误：' + e.message); }
    });
  });

  FILES.forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), sandbox, { filename: f });
  });
  const { Store, Model, Charts, UI } = sandbox;

  await t('无后端时降级为本地存储', async () => {
    const r = await Store.init();
    eq(r.mode, 'local', '未探测到 /api 时应降级');
    eq(r.memoryMode, false, '正常环境下 localStorage 可用');
  });

  await t('四个分类配置完整', () => {
    eq(Model.ORDER.length, 4, '分类数量');
    Model.ORDER.forEach(k => {
      const c = Model.CATEGORIES[k];
      assert(c && c.label, k + ' 缺少 label');
      assert(c.fields.some(f => f.key === 'title' && f.required), k + ' 缺少必填标题');
    });
  });

  await t('空数据时总览可渲染', async () => {
    await UI.refresh();
    assert(els.main.innerHTML.length > 50, '总览应有内容');
  });

  const today = Model.todayStr();
  const d = n => Model.addDays(today, n);

  await t('添加手机号并写入存储', async () => {
    UI.state.tab = 'phone';
    UI.openAdd();
    const b = els.formBody;
    b.querySelector('[data-key="title"]').value = '13800000000';
    b.querySelector('[data-key="provider"]').value = '中国移动';
    b.querySelector('[data-key="detail.country"]').value = '中国';
    b.querySelector('[data-key="detail.strategy"]').value = '每月通话+短信';
    b.querySelector('[data-key="amount"]').value = '19';
    b.querySelector('[data-key="cycle"]').value = 'monthly';
    b.querySelector('[data-key="startDate"]').value = d(-300);
    b.querySelector('[data-key="nextDate"]').value = d(3);
    await UI.save();
    const list = await Store.list();
    eq(list.length, 1, '应有 1 条');
    eq(list[0].detail.country, '中国', '国家应写入 detail');
    eq(list[0].amount, 19, '金额应为数字');
  });

  await t('缺少必填项时提示且不写入', async () => {
    UI.state.tab = 'phone';
    UI.openAdd();
    els.formBody.querySelector('[data-key="nextDate"]').value = d(5);
    await UI.save();
    eq((await Store.list()).length, 1, '不应新增');
    assert(els.toast.textContent.indexOf('请填写') >= 0, '应提示必填，实际：' + els.toast.textContent);
  });

  await t('状态判定：逾期 / 今日 / 7 日内 / 正常', () => {
    eq(Model.statusOf({ nextDate: d(-5) }).key, 'overdue');
    eq(Model.statusOf({ nextDate: today }).key, 'today');
    eq(Model.statusOf({ nextDate: d(3) }).key, 'soon');
    eq(Model.statusOf({ nextDate: d(60) }).key, 'fine');
    eq(Model.statusOf({ nextDate: '' }).key, 'none');
  });

  await t('月度周期顺延一个月', () => {
    const next = UI._internal.shiftNext({ cycle: 'monthly', nextDate: today });
    const x = new Date(today + 'T00:00:00'); x.setMonth(x.getMonth() + 1);
    const p = n => String(n).padStart(2, '0');
    eq(next, x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()));
  });

  await t('已逾期项从今天起算顺延', () => {
    const next = UI._internal.shiftNext({ cycle: 'monthly', nextDate: d(-40) });
    assert(Model.diffDays(next) > 0, '顺延后应在未来，实际 ' + next);
  });

  await t('季度周期顺延三个月', () => {
    const next = UI._internal.shiftNext({ cycle: 'quarterly', nextDate: today });
    const gap = Model.diffDays(next);
    assert(gap >= 87 && gap <= 93, '约 90 天，实际 ' + gap);
  });

  async function addItem(cat, values) {
    UI.state.tab = cat;
    UI.openAdd();
    Object.keys(values).forEach(k => {
      const el = els.formBody.querySelector('[data-key="' + k + '"]');
      assert(el, '表单缺少字段 ' + k);
      el.value = values[k];
    });
    await UI.save();
  }

  await t('添加宽带记录', async () => {
    await addItem('broadband', {
      title: '家里电信宽带', provider: '中国电信', 'detail.speed': '500M',
      'detail.address': 'XX 小区 3 栋', amount: '120', cycle: 'monthly',
      startDate: d(-200), nextDate: d(12), 'detail.autoRenew': 'yes'
    });
    const bb = (await Store.list()).filter(x => x.category === 'broadband')[0];
    assert(bb, '应有宽带记录');
    eq(bb.detail.speed, '500M');
    eq(bb.detail.autoRenew, 'yes');
  });

  await t('添加停车费记录', async () => {
    await addItem('parking', {
      title: '粤A12345', provider: 'XX 物业', 'detail.slot': 'B2-128',
      'detail.cardType': '季卡', amount: '900', cycle: 'quarterly',
      startDate: d(-100), nextDate: d(-2), 'detail.channel': '物业小程序'
    });
    const pk = (await Store.list()).filter(x => x.category === 'parking')[0];
    eq(pk.detail.cardType, '季卡');
    eq(Model.statusOf(pk).key, 'overdue', '应为逾期');
  });

  await t('添加资产账户', async () => {
    await addItem('asset', {
      title: '招行储蓄卡', provider: '招商银行', 'detail.assetType': '银行存款',
      amount: '150000', currency: 'CNY', nextDate: d(30)
    });
    await addItem('asset', {
      title: '指数基金', provider: '某基金', 'detail.assetType': '基金',
      amount: '80000', currency: 'CNY', nextDate: ''
    });
    eq((await Store.list()).filter(x => x.category === 'asset').length, 2);
  });

  await t('年度支出按周期折算', async () => {
    const cycle = (await Store.list()).filter(x => x.category !== 'asset');
    const annual = cycle.reduce((s, x) => s + Model.annualAmount(x), 0);
    eq(annual, 19 * 12 + 120 * 12 + 900 * 4, '年化合计');
  });

  await t('资产按类型分组用于饼图', async () => {
    const assets = (await Store.list()).filter(x => x.category === 'asset');
    const g = Charts.groupBy(assets, 'detail.assetType');
    eq(g.length, 2);
    eq(g[0].value, 150000, '金额最大的排第一');
    const svg = Charts.donut(g.map((x, i) => ({ name: x.name, value: x.value, color: Charts.colorAt(i) })));
    assert(svg.indexOf('<path') > 0, '应生成 path');
  });

  await t('关键字搜索命中', async () => {
    UI.state.tab = 'broadband';
    UI.state.keyword = ''; UI.state.filter = 'all';
    UI.search('电信');
    assert(els.listResults.innerHTML.indexOf('家里电信宽带') > 0, '应命中宽带');
    UI.search('不存在的关键字');
    assert(els.listResults.innerHTML.indexOf('没有符合条件') > 0, '无结果应提示');
    UI.search('');
  });

  await t('状态筛选：仅看逾期', async () => {
    UI.state.tab = 'parking';
    UI.state.keyword = '';
    UI.setFilter('overdue');
    assert(els.main.innerHTML.indexOf('粤A12345') > 0, '逾期项应显示');
    UI.setFilter('all');
  });

  await t('编辑记录后字段更新', async () => {
    await UI.refresh();
    const target = UI.state.items.filter(x => x.category === 'phone')[0];
    UI.openEdit(target.id);
    els.formBody.querySelector('[data-key="amount"]').value = '29';
    await UI.save();
    const after = UI.state.items.filter(x => x.id === target.id)[0];
    eq(after.amount, 29);
  });

  await t('删除记录（含二次确认）', async () => {
    const before = UI.state.items.length;
    const target = UI.state.items.filter(x => x.category === 'asset')[0];
    confirmRet = false;
    await UI.remove(target.id);
    eq(UI.state.items.length, before, '取消时不删除');
    confirmRet = true;
    await UI.remove(target.id);
    eq(UI.state.items.length, before - 1, '确认后删除');
  });

  await t('CSV 导出带 BOM 与表头', async () => {
    await UI.refresh();
    UI.state.tab = 'phone';
    UI.exportCSV();
    assert(lastBlob.charCodeAt(0) === 0xFEFF, '应以 BOM 开头');
    assert(lastBlob.indexOf('手机号') > 0, '应含分类表头');
  });

  await t('CSV 解析处理引号与换行', () => {
    const rows = Store.parseCSV('a,b\n"x,1","line1\nline2"\n');
    eq(rows.length, 2);
    eq(rows[1][0], 'x,1');
    eq(rows[1][1], 'line1\nline2');
  });

  await t('导入旧号码应用导出的 CSV', async () => {
    UI.state.tab = 'overview';
    const before = UI.state.items.length;
    const csv = '手机号,归属国家,激活日期,保活策略,下次保活日期,备注,最近更新\n'
      + '13900000001,中国,2025-01-01,每月通话+短信,2026-12-01,旧数据,2026-01-01\n'
      + '13900000002,新加坡,2025-02-01,季度充值保号,2026-11-01,,2026-01-01\n';
    await UI.importCSV(csv);
    eq(UI.state.items.length, before + 2, '应新增 2 条');
    const one = UI.state.items.filter(x => x.title === '13900000001')[0];
    eq(one.detail.country, '中国', '国家应映射');
    eq(one.nextDate, '2026-12-01', '到期日应映射');
  });

  await t('国家模糊搜索支持中英文', () => {
    assert(Model.searchCountries('新').some(c => c[0] === '新加坡'), '中文命中');
    assert(Model.searchCountries('hong').some(c => c[0] === '中国香港'), '英文命中');
  });

  await t('金额格式化带币种符号', () => {
    eq(Model.money(150000, 'CNY'), '¥150,000');
    eq(Model.money(100, 'USD'), '$100');
  });

  await t('存储不可用时降级且不抛错', async () => {
    storeBroken = true;
    const r = await Store.init();
    eq(r.memoryMode, true, '应识别为内存模式');
    UI.state.tab = 'phone';
    UI.openAdd();
    els.formBody.querySelector('[data-key="title"]').value = '13700000000';
    els.formBody.querySelector('[data-key="nextDate"]').value = d(10);
    await UI.save();
    assert(els.toast.textContent.indexOf('内存') >= 0, '应提示存储不可用，实际：' + els.toast.textContent);
    storeBroken = false;
    await Store.init();
  });
}

async function testImprovements() {
  console.log('\n[新增] 备份、周期与日常处理回归\n');
  storeBroken = false;
  delete sandbox.fetch;
  delete storeData.life_hub_backend_seen_v1;
  storeData.life_hub_items_v1 = '[]';
  vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'store.js'), 'utf8'), sandbox);
  const { Store, Model, UI, Records, CalendarFile } = sandbox;
  await Store.init();
  const today = Model.todayStr();
  const fixtures = [
    { category: 'phone', title: '+65 TEST-001', provider: '测试运营商', amount: 19, currency: 'SGD', cycle: 'monthly', nextDate: Model.addDays(today, 30),
      detail: { country: '新加坡', strategy: '通话,短信\n保活', reminderCycle: 'quarterly', extra: { kept: true } }, note: '含"引号"\n换行' },
    { category: 'broadband', title: '测试宽带', amount: 120, cycle: 'yearly', nextDate: Model.addDays(today, 60),
      detail: { autoRenew: 'yes', contractDate: Model.addDays(today, 365), accountNo: 'TEST-001' } },
    { category: 'parking', title: '测试停车', amount: null, cycle: 'once', status: 'archived', detail: { slot: 'B-01' } },
    { category: 'asset', title: '测试美元账户', amount: 0, currency: 'USD', detail: { assetType: '银行存款' },
      createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2021-01-01T00:00:00.000Z' }
  ];
  let original, csv;
  await t('混合分类 CSV 完整往返，包括扩展字段和特殊文本', async () => {
    await Store.addMany(fixtures);
    original = await Store.list();
    csv = '\uFEFF' + Store.toCSV(original, Records.csvColumns());
    const parsed = Records.parseImport(csv, 'asset');
    eq(parsed.errors.length, 0);
    eq(parsed.items.length, 4);
    parsed.items.forEach((x, i) => eq(Records.fingerprint(x), Records.fingerprint(original[i])));
    await Store.clear();
    UI.state.tab = 'overview';
    await UI.importCSV(csv);
    eq((await Store.list()).length, 4);
    const asset = (await Store.list()).find(x => x.category === 'asset');
    eq(asset.amount, 0); eq(asset.createdAt, fixtures[3].createdAt); eq(asset.updatedAt, fixtures[3].updatedAt);
  });
  await t('重复导入保留现有条目与时间戳', async () => {
    const before = JSON.stringify(await Store.list());
    await UI.importCSV(csv);
    eq(JSON.stringify(await Store.list()), before);
    assert(els.toast.textContent.includes('跳过重复 4'));
  });
  await t('JSON 完整备份保留状态、处理记录与标识', () => {
    const row = Object.assign({}, original[0], { detail: Object.assign({}, original[0].detail, { history: [{ type: 'complete', action: '保活', date: today }] }) });
    const parsed = Records.parseImport(Records.backup([row]));
    eq(parsed.errors.length, 0);
    eq(JSON.stringify(parsed.items[0].detail), JSON.stringify(row.detail));
  });
  await t('兼容旧分类中文周期与自动续费选项', () => {
    const legacy = '分类,宽带名称,每期费用,缴费周期,合约到期日,自动续费\n宽带,旧宽带,120,每月,2027-12-01,是';
    const parsed = Records.parseImport(legacy);
    eq(parsed.errors.length, 0); eq(parsed.items[0].cycle, 'monthly'); eq(parsed.items[0].detail.autoRenew, 'yes');
    eq(parsed.items[0].nextDate, '2027-12-01'); eq(Model.annualAmount(parsed.items[0]), 1440);
  });
  await t('已存储的旧中文选项读取时归一化，不重写原始数据', async () => {
    const saved = storeData.life_hub_items_v1;
    storeData.life_hub_items_v1 = JSON.stringify([{ id: 999, title: '旧数据', category: 'broadband', cycle: '每月', detail: { autoRenew: '是' }, amount: 120 }]);
    const row = (await Store.list())[0];
    eq(row.cycle, 'monthly'); eq(row.detail.autoRenew, 'yes'); eq(Model.annualAmount(row), 1440);
    assert(storeData.life_hub_items_v1.includes('每月'));
    storeData.life_hub_items_v1 = saved;
  });
  await t('非法数据带行号并阻止整批写入', async () => {
    const before = (await Store.list()).length;
    await UI.importCSV('分类,名称,金额,下次到期日\n手机号,有效行,19,2027-12-01\n宽带,坏日期,120,2027-02-30');
    eq((await Store.list()).length, before);
    assert(els.toast.textContent.includes('第 3 行'));
    ['金额,名称\nNaN,测试', '名称,周期\n测试,未知周期', '名称,扩展信息\n测试,[]'].forEach(text => assert(Records.parseImport(text).errors.length));
  });
  await t('CSV 引号不完整时明确报错', () => {
    let threw = false;
    try { Records.parseCSV('a,b\n"缺少结束引号,b'); } catch (e) { threw = e.message.includes('引号'); }
    assert(threw);
  });
  await t('不同标识的同名账户可独立保留，旧格式仍可去重', () => {
    const a = { category: 'asset', title: '同名账户', detail: { recordKey: 'A' } };
    const b = { category: 'asset', title: '同名账户', detail: { recordKey: 'B' } };
    eq(Records.partition([b], [a]).items.length, 1);
    eq(Records.partition([{ category: 'asset', title: '同名账户' }], [a]).skipped, 1);
  });
  await t('月底与闰年顺延使用有效日期', () => {
    eq(Model.addMonths('2027-01-31', 1), '2027-02-28');
    eq(Model.addMonths('2028-01-31', 1), '2028-02-29');
    eq(Model.addMonths('2028-02-29', 12), '2029-02-28');
    eq(Model.addMonths('2027-11-30', 3), '2028-02-29');
    eq(Model.addMonths('2027-02-28', 1, 31), '2027-03-31');
  });
  await t('月末连续处理保留原始日期锚点', () => {
    let row = { category: 'phone', title: '月末', amount: 19, cycle: 'monthly', nextDate: '2030-01-31', detail: {} };
    row = Object.assign({}, row, Model.complete(row, { date: today, amount: '' }));
    eq(row.nextDate, '2030-02-28');
    row = Object.assign({}, row, Model.complete(row, { date: today, amount: '' }));
    eq(row.nextDate, '2030-03-31');
  });
  await t('保活周期独立于缴费周期，合约日期独立于续费', () => {
    const row = Object.assign({}, original[0], { nextDate: '2030-01-31' });
    eq(Model.shiftNext(row, today), '2030-04-30');
    eq(Model.annualAmount(row), 228);
    const broadband = Object.assign({}, original[1], { nextDate: '2030-01-01' });
    eq(Model.complete(broadband, { date: today, amount: 120 }).detail.contractDate, broadband.detail.contractDate);
    eq(Model.dueEntries([broadband]).length, 2);
  });
  await t('一次性事项完成后停止提醒，可撤销恢复', () => {
    const row = { category: 'parking', title: '一次性', amount: 30, cycle: 'once', nextDate: today, detail: {} };
    const done = Object.assign({}, row, Model.complete(row, { date: today, amount: '30', note: '已付' }));
    eq(done.nextDate, ''); eq(done.status, 'completed'); eq(Model.dueEntries([done]).length, 0);
    eq(done.detail.history[0].note, '已付'); assert(Model.canUndo(done));
    const undone = Object.assign({}, done, Model.undo(done));
    eq(undone.nextDate, today); eq(undone.status, 'active'); assert(undone.detail.history[0].undoneAt);
    assert(!Model.canUndo(undone));
  });
  await t('后续日期变更后不能撤销旧处理覆盖新日期', () => {
    const row = { category: 'phone', title: '保护新日期', cycle: 'monthly', nextDate: today, detail: {} };
    const done = Object.assign({}, row, Model.complete(row, { date: today }));
    done.nextDate = Model.addDays(done.nextDate, 1);
    assert(!Model.canUndo(done));
  });
  await t('资产复核保存余额快照，撤销恢复原余额', () => {
    const row = Object.assign({}, original[3], { status: 'active' });
    const done = Object.assign({}, row, Model.complete(row, { date: today, amount: 88.8 }));
    eq(done.amount, 88.8); eq(done.detail.history[0].amount, 88.8);
    eq(Model.undo(done).amount, 0);
  });
  await t('暂停归档退出提醒与统计，恢复后重现', async () => {
    const row = (await Store.list())[0];
    await UI.refresh();
    await UI.changeStatus(row.id, 'paused');
    let updated = (await Store.list()).find(x => x.id === row.id);
    eq(Model.dueEntries([updated]).length, 0); eq(Model.annualAmount(updated), 0);
    await UI.changeStatus(row.id, 'archived');
    UI.state.tab = row.category; UI.setLifecycle('archived');
    assert(els.main.innerHTML.includes(row.title));
    await UI.changeStatus(row.id, 'active');
    updated = (await Store.list()).find(x => x.id === row.id);
    assert(Model.dueEntries([updated]).length > 0); eq(updated.detail.history.length, 3);
    UI.setLifecycle('active');
  });
  await t('编辑保留未知扩展字段与处理记录', async () => {
    await UI.refresh();
    const row = UI.state.items.find(x => x.category === 'phone');
    UI.openEdit(row.id); els.formBody.querySelector('[data-key="note"]').value = '修改备注';
    await UI.save();
    const updated = (await Store.list()).find(x => x.id === row.id);
    eq(updated.detail.extra.kept, true); eq(updated.detail.history.length, 3);
  });
  await t('处理对话框确认后写入历史，撤销可从 UI 完成', async () => {
    await UI.refresh();
    const row = UI.state.items.find(x => x.category === 'phone');
    UI.markDone(row.id);
    eq((await Store.list()).find(x => x.id === row.id).nextDate, row.nextDate);
    els.formBody.querySelector('[data-key="note"]').value = 'UI 测试';
    await UI.save();
    let updated = (await Store.list()).find(x => x.id === row.id);
    eq(updated.detail.history[updated.detail.history.length - 1].note, 'UI 测试');
    await UI.undoLast(row.id);
    updated = (await Store.list()).find(x => x.id === row.id);
    eq(updated.nextDate, row.nextDate);
  });
  await t('总览添加先选分类，导入先预览且取消不写入', async () => {
    UI.state.tab = 'overview'; UI.openAdd();
    assert(els.formBody.innerHTML.includes('选择') || els.modalTitle.textContent.includes('选择'));
    assert(els.formBody.innerHTML.includes('broadband'));
    const before = (await Store.list()).length;
    UI.previewImport('分类,名称\n资产分布,预览账户', 'preview.csv');
    eq((await Store.list()).length, before); assert(els.formBody.innerHTML.includes('预计新增'));
    UI.closeModal(); eq((await Store.list()).length, before);
  });
  await t('日历包含合约提醒、闹铃、转义和 UTF-8 折行', () => {
    const row = { id: 1, category: 'broadband', title: '宽带'.repeat(60), nextDate: Model.addDays(today, 2), note: '一行,分号;\n二行', detail: { contractDate: Model.addDays(today, 4) } };
    const calendar = CalendarFile.create([row, Object.assign({}, row, { status: 'paused' })]);
    eq(calendar.count, 2);
    assert(calendar.text.includes('TRIGGER:-P1D'));
    assert(calendar.text.includes('\\,') && calendar.text.includes('\\;') && calendar.text.includes('\\n'));
    calendar.text.split('\r\n').forEach(line => assert(Buffer.byteLength(line, 'utf8') <= 75, '日历行超过 75 字节'));
    assert(calendar.text.endsWith('END:VCALENDAR\r\n'));
  });
  await t('仅外币与零余额资产不会提示没有资产记录', async () => {
    const saved = UI.state.items;
    UI.state.items = [Object.assign({}, original[3], { amount: 1000 })];
    UI.state.tab = 'overview'; UI.render();
    assert(!els.main.innerHTML.includes('还没有在用资产记录'));
    assert(els.main.innerHTML.includes('USD'));
    UI.state.items = saved;
  });
  await t('API 中断保留数据源，重新打开也不会静默进入本地模式', async () => {
    let reachable = true;
    sandbox.fetch = async url => {
      if (!reachable) throw new Error('连接中断');
      if (url === 'api/health') return { ok: true, json: async () => ({ ok: true, database: { type: 'json' } }) };
      return { ok: true, text: async () => JSON.stringify(original) };
    };
    await Store.init(); eq(Store.mode(), 'api');
    await UI.refresh(); const before = UI.state.items.length;
    reachable = false;
    try { await UI.refresh(); } catch (_) { /* 验证错误状态 */ }
    eq(UI.state.items.length, before); eq(Store.mode(), 'api'); assert(Store.error());
    await Store.init(); eq(Store.mode(), 'offline');
    let blocked = false;
    try { await Store.add({ title: '不应写入本地' }); } catch (_) { blocked = true; }
    assert(blocked);
    reachable = true; await Store.reconnect(); eq(Store.mode(), 'api');
    delete sandbox.fetch; delete storeData.life_hub_backend_seen_v1;
    await Store.init();
  });
  await t('存储不可写时先保留已有数据，再转入内存', async () => {
    const before = await Store.list(); assert(before.length > 0);
    storeBroken = true; await Store.init();
    eq(Store.isMemoryMode(), true); eq((await Store.list()).length, before.length);
    storeBroken = false;
  });
  await t('本地过期编辑不会覆盖其他页面的新改动', async () => {
    const row = (await Store.list())[0];
    await Store.update(row.id, { note: '较新的修改' }, row.updatedAt);
    let blocked = false;
    try { await Store.update(row.id, { note: '旧页面覆盖' }, row.updatedAt); } catch (e) { blocked = e.message.includes('变更'); }
    assert(blocked); eq((await Store.list())[0].note, '较新的修改');
  });
}

/* ================= 第二部分：后端与数据库 ================= */
const { load } = require(path.join(ROOT, 'src', 'config'));
const { create: createDb } = require(path.join(ROOT, 'src', 'db'));
const { createServer, serveStatic } = require(path.join(ROOT, 'src', 'http'));
const { createAuth } = require(path.join(ROOT, 'src', 'auth'));
const makeRoutes = require(path.join(ROOT, 'src', 'routes'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lifehub-test-'));
const ENV_KEYS = ['DB_TYPE', 'DB_FILE', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_SSL',
  'PORT', 'HOST', 'MAIL_MODE', 'APP_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
  'SESSION_TTL_DAYS', 'BCRYPT_ROUNDS', 'COOKIE_NAME'];
function cleanEnv() { ENV_KEYS.forEach(k => delete process.env[k]); }

function cookieOf(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const raw = (list || []).filter(Boolean)[0] || '';
  return raw.split(';')[0];
}

async function registerVerifiedUser(base, auth, email, password) {
  const reg = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  if (!reg.ok) throw new Error('注册失败：' + (await reg.text()));
  const mail = auth.outbox[auth.outbox.length - 1];
  const m = /verify=([a-f0-9]{64})/.exec(mail.text + ' ' + (mail.url || ''));
  if (!m) throw new Error('未能在邮件中找到激活令牌');
  const ver = await fetch(base + '/api/auth/verify?token=' + m[1]);
  if (!ver.ok) throw new Error('激活失败：' + (await ver.text()));
  return cookieOf(ver);
}

async function crudSuite(db, label) {
  const user = await db.createUser({
    email: 'crud-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '@test.local',
    passwordHash: 'not-real-hash'
  });
  const uid = user.id;

  await t(label + '：新增并往返 detail / 日期 / 金额', async () => {
    const a = await db.add({
      category: 'phone', title: '13800000000', amount: '19', cycle: 'monthly',
      startDate: '2025-01-01', nextDate: '2026-12-01', detail: { country: '中国' }
    }, uid);
    assert(a.id, '应返回自增 id');
    eq(a.detail.country, '中国', 'detail 应还原为对象');
    eq(a.startDate, '2025-01-01', 'start_date 映射为 startDate');
    eq(a.nextDate, '2026-12-01', 'next_date 映射为 nextDate');
    eq(a.amount, 19, 'amount 应为数字');
    eq(a.currency, 'CNY', '默认币种');
  });

  await t(label + '：列表与部分更新（不清空 detail）', async () => {
    const list = await db.list(uid);
    eq(list.length, 1);
    const u = await db.update(list[0].id, { nextDate: '2027-01-01', amount: 29 }, uid);
    eq(u.nextDate, '2027-01-01');
    eq(u.amount, 29);
    eq(u.detail.country, '中国', '未传 detail 时应保留原值');
  });

  await t(label + '：批量导入与删除', async () => {
    const many = await db.addMany([
      { category: 'asset', title: '招行', amount: '1000', detail: { assetType: '银行存款' } },
      { category: 'asset', title: '基金', amount: '500' }
    ], uid);
    eq(many.length, 2);
    eq((await db.list(uid)).length, 3);
    const gone = await db.remove(many[0].id, uid);
    assert(gone && gone.title === '招行', '删除应返回被删对象');
    eq((await db.list(uid)).length, 2);
    await db.clear(uid);
    eq((await db.list(uid)).length, 0);
  });

  await t(label + '：空金额与空日期存储为 null / 空串', async () => {
    const a = await db.add({ category: 'asset', title: '现金', amount: '', nextDate: '' }, uid);
    eq(a.amount, null, '空金额应为 null');
    eq(a.nextDate, '', '空日期应为空串');
    await db.clear(uid);
  });
}

async function startServer(type, file) {
  cleanEnv();
  if (type) process.env.DB_TYPE = type;
  if (file) process.env.DB_FILE = file;
  process.env.MAIL_MODE = 'console';
  process.env.APP_URL = 'http://127.0.0.1';
  const cfg = load();
  const db = createDb(cfg.database);
  await db.init();
  const auth = createAuth(db, cfg.auth);
  const server = createServer(cfg, db, makeRoutes(db, auth));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, db, auth, base: 'http://127.0.0.1:' + server.address().port };
}

function rawGet(base, rawPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(base);
    const req = http.request({
      host: u.hostname, port: u.port, path: rawPath, method: 'GET'
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body: body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function testBackend() {
  console.log('\n[二] 后端服务与可配置数据库\n');

  await t('配置：默认类型为 sqlite', () => {
    cleanEnv();
    eq(load().database.type, 'sqlite');
  });

  await t('配置：环境变量可覆盖类型与文件', () => {
    const f = path.join(TMP, 'override.json');
    process.env.DB_TYPE = 'json';
    process.env.DB_FILE = f;
    const cfg = load();
    eq(cfg.database.type, 'json');
    eq(cfg.database.json.file, f, '绝对路径应保持不变');
  });

  await t('配置：非法数据库类型报错', () => {
    process.env.DB_TYPE = 'oracle';
    let threw = false;
    try { load(); } catch (e) { threw = e.message.indexOf('不支持') >= 0; }
    assert(threw, '应提示不支持的类型');
  });

  await t('配置：服务端口可被 PORT 覆盖', () => {
    cleanEnv();
    process.env.PORT = '9123';
    eq(load().server.port, 9123);
  });

  await t('配置：认证环境变量读取与默认控制台邮件模式', () => {
    cleanEnv();
    let a = load().auth;
    eq(a.mailMode, 'console', '未配置 SMTP 时应为控制台模式');
    eq(a.sessionTtlDays, 7);
    process.env.MAIL_MODE = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'noreply@example.com';
    process.env.SMTP_PASS = 'secret';
    process.env.SMTP_FROM = '生活管理 <noreply@example.com>';
    process.env.SESSION_TTL_DAYS = '30';
    process.env.BCRYPT_ROUNDS = '11';
    a = load().auth;
    eq(a.mailMode, 'smtp');
    eq(a.smtp.host, 'smtp.example.com');
    eq(a.smtp.port, 465);
    eq(a.smtp.from, '生活管理 <noreply@example.com>');
    eq(a.sessionTtlDays, 30);
    eq(a.bcryptRounds, 11);
    cleanEnv();
  });

  await t('认证：smtp 模式缺少 SMTP_HOST 时快速失败', () => {
    cleanEnv();
    process.env.MAIL_MODE = 'smtp';
    let threw = false;
    try { createAuth({ createUser: async () => ({}) }, load().auth); }
    catch (e) { threw = e.message.indexOf('SMTP_HOST') >= 0; }
    assert(threw, '应提示缺少 SMTP_HOST');
  });

  await t('适配器：缺失驱动时给出安装命令', async () => {
    cleanEnv();
    let msg = '';
    try { const db = createDb({ type: 'mysql', mysql: {} }); await db.init(); }
    catch (e) { msg = e.message; }
    assert(msg.indexOf('npm i mysql2') >= 0, 'MySQL 实际：' + msg);
    msg = '';
    try { const db = createDb({ type: 'postgres', postgres: {} }); await db.init(); }
    catch (e) { msg = e.message; }
    assert(msg.indexOf('npm i pg') >= 0, 'Postgres 实际：' + msg);
  });

  await t('适配器：不支持的类型报错', () => {
    let threw = false;
    try { createDb({ type: 'mongo' }); } catch (e) { threw = e.message.indexOf('不支持') >= 0; }
    assert(threw, '应拒绝不支持的类型');
  });

  const jsonDb = createDb({ type: 'json', json: { file: path.join(TMP, 'suite.json') } });
  await jsonDb.init();
  await crudSuite(jsonDb, 'JSON 适配器');
  await jsonDb.close();

  const sqliteDb = createDb({ type: 'sqlite', sqlite: { file: path.join(TMP, 'suite.db') } });
  await sqliteDb.init();
  await crudSuite(sqliteDb, 'SQLite 适配器');
  await sqliteDb.close();

  await t('JSON 适配器：数据落盘且可重新载入（含用户隔离）', async () => {
    const file = path.join(TMP, 'persist.json');
    const a = createDb({ type: 'json', json: { file: file } });
    await a.init();
    const u = await a.createUser({ email: 'persist@test.local', passwordHash: 'x' });
    await a.add({ category: 'phone', title: '落盘测试', nextDate: '2027-05-05' }, u.id);
    await a.close();
    assert(fs.existsSync(file), '应生成数据文件');
    const b = createDb({ type: 'json', json: { file: file } });
    await b.init();
    const list = await b.list(u.id);
    eq(list.length, 1, '重新载入应有 1 条');
    eq(list[0].title, '落盘测试');
    const other = await b.createUser({ email: 'persist2@test.local', passwordHash: 'x' });
    eq((await b.list(other.id)).length, 0, '其他用户不应看到他人数据');
    await b.clear(u.id);
    await b.close();
  });

  const { server, db, auth, base } = await startServer('json', path.join(TMP, 'api.json'));
  const H = extra => Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  let cookieA = '', cookieB = '';

  await t('API：健康检查返回数据库信息', async () => {
    const r = await fetch(base + '/api/health');
    const j = await r.json();
    eq(j.ok, true);
    eq(j.database.type, 'json', '应报告当前数据库类型');
  });

  await t('API：未登录访问业务接口返回 401', async () => {
    const r = await fetch(base + '/api/items');
    eq(r.status, 401);
    const w = await fetch(base + '/api/items', {
      method: 'POST', headers: H(), body: JSON.stringify({ title: 'x' })
    });
    eq(w.status, 401);
  });

  /* 预置一条无归属的历史数据（user_id 为空），验证首个激活用户自动认领 */
  await db.add({ category: 'phone', title: '历史遗留记录', nextDate: '2027-01-01' });

  await t('认证：注册 → 验证邮件 → 激活 → 自动登录', async () => {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: H(),
      body: JSON.stringify({ email: 'owner@example.com', password: 'password123' })
    });
    eq(reg.status, 201);
    eq(auth.outbox.length, 1, '控制台模式应捕获验证邮件');
    const m = /verify=([a-f0-9]{64})/.exec(auth.outbox[0].text);
    assert(m, '邮件应包含激活令牌');
    const ver = await fetch(base + '/api/auth/verify?token=' + m[1]);
    eq(ver.status, 200);
    const j = await ver.json();
    eq(j.email, 'owner@example.com');
    eq(j.claimed, 1, '首个激活用户应认领 1 条历史数据');
    cookieA = cookieOf(ver);
    assert(/^life_hub_session=/.test(cookieA), '应签发会话 Cookie');
    const me = await (await fetch(base + '/api/auth/me', { headers: { Cookie: cookieA } })).json();
    eq(me.email, 'owner@example.com');
  });

  await t('认证：激活链接一次性，第二个用户注册后数据隔离', async () => {
    cookieB = await registerVerifiedUser(base, auth, 'b@example.com', 'password123');
    const aList = await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json();
    assert(aList.some(x => x.title === '历史遗留记录'), '首个用户应看到被认领的历史数据');
    const bList = await (await fetch(base + '/api/items', { headers: { Cookie: cookieB } })).json();
    eq(bList.length, 0, '第二个用户不应看到他人数据');
    const add = await fetch(base + '/api/items', {
      method: 'POST', headers: H({ Cookie: cookieB }),
      body: JSON.stringify({ category: 'asset', title: 'B 的账户', amount: 10 })
    });
    eq(add.status, 201);
    const aAgain = await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json();
    assert(!aAgain.some(x => x.title === 'B 的账户'), 'B 的数据不应泄露给 A');
  });

  await t('认证：登录、错误密码与登出', async () => {
    const bad = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: H(),
      body: JSON.stringify({ email: 'owner@example.com', password: 'wrong-pass' })
    });
    eq(bad.status, 401);
    const ok = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: H(),
      body: JSON.stringify({ email: 'owner@example.com', password: 'password123' })
    });
    eq(ok.status, 200);
    const fresh = cookieOf(ok);
    const me = await fetch(base + '/api/auth/me', { headers: { Cookie: fresh } });
    eq(me.status, 200);
    const out = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: fresh } });
    eq(out.status, 200);
    const after = await fetch(base + '/api/auth/me', { headers: { Cookie: fresh } });
    eq(after.status, 401, '登出后旧会话应失效');
    const other = await fetch(base + '/api/auth/me', { headers: { Cookie: cookieA } });
    eq(other.status, 200, '登出不应影响其他会话');
  });

  await t('认证：未激活登录受限、可重发、重复注册与弱密码被拒', async () => {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: H(),
      body: JSON.stringify({ email: 'unverified@example.com', password: 'password123' })
    });
    eq(reg.status, 201);
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: H(),
      body: JSON.stringify({ email: 'unverified@example.com', password: 'password123' })
    });
    eq(login.status, 403, '未验证用户登录应返回 403');
    assert((await login.json()).needVerify, '应标记需要验证');
    const before = auth.outbox.length;
    const resend = await fetch(base + '/api/auth/resend', {
      method: 'POST', headers: H(), body: JSON.stringify({ email: 'unverified@example.com' })
    });
    eq(resend.status, 200);
    eq(auth.outbox.length, before + 1, '应重发验证邮件');
    const dup = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: H(),
      body: JSON.stringify({ email: 'owner@example.com', password: 'password12345' })
    });
    eq(dup.status, 400, '已验证邮箱重复注册应被拒');
    const weak = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: H(), body: JSON.stringify({ email: 'bad', password: '123' })
    });
    eq(weak.status, 400, '非法邮箱与弱密码应被拒');
  });

  /* 清空首个用户的既有数据，进入通用 CRUD 用例 */
  await fetch(base + '/api/items', { method: 'DELETE', headers: { Cookie: cookieA } });

  await t('API：新增与列表', async () => {
    const r = await fetch(base + '/api/items', {
      method: 'POST', headers: H({ Cookie: cookieA }),
      body: JSON.stringify({ category: 'phone', title: '13900000000', amount: 19, nextDate: '2027-01-01', detail: { country: '中国' } })
    });
    eq(r.status, 201, '应返回 201');
    const created = await r.json();
    assert(created.id, '应返回 id');
    const list = await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json();
    eq(list.length, 1);
    eq(list[0].detail.country, '中国', 'detail 应还原为对象');
    global.__id = created.id;
  });

  await t('API：更新与删除', async () => {
    const id = global.__id;
    const u = await (await fetch(base + '/api/items/' + id, {
      method: 'PUT', headers: H({ Cookie: cookieA }),
      body: JSON.stringify({ nextDate: '2027-06-06' })
    })).json();
    eq(u.nextDate, '2027-06-06');
    const del = await fetch(base + '/api/items/' + id, { method: 'DELETE', headers: { Cookie: cookieA } });
    eq(del.status, 200);
    eq((await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).length, 0);
  });

  await t('API：批量导入', async () => {
    const r = await fetch(base + '/api/items/import', {
      method: 'POST', headers: H({ Cookie: cookieA }),
      body: JSON.stringify({ items: [{ category: 'asset', title: 'A', amount: 100 }, { category: 'asset', title: 'B', amount: 200 }] })
    });
    eq(r.status, 201);
    eq((await r.json()).created, 2);
    eq((await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).length, 2);
  });

  await t('API：缺少 title 时返回 400', async () => {
    const r = await fetch(base + '/api/items', {
      method: 'POST', headers: H({ Cookie: cookieA }),
      body: JSON.stringify({ category: 'phone' })
    });
    eq(r.status, 400);
    assert((await r.json()).error, '应返回错误信息');
  });

  await t('API：重复和并发导入不会重复新增', async () => {
    const request = items => fetch(base + '/api/items/import', {
      method: 'POST', headers: H({ Cookie: cookieA }), body: JSON.stringify({ items })
    }).then(r => r.json());
    const duplicates = await request([{ category: 'asset', title: 'A', amount: 100 }, { category: 'asset', title: 'B', amount: 200 }]);
    eq(duplicates.created, 0); eq(duplicates.skipped, 2);
    const item = { category: 'asset', title: '并发账户', detail: { recordKey: 'concurrent-test' } };
    const results = await Promise.all([request([item]), request([item])]);
    eq(results.reduce((n, r) => n + r.created, 0), 1);
    eq(results.reduce((n, r) => n + r.skipped, 0), 1);
  });

  await t('API：整批校验失败时不写入前面的有效条目', async () => {
    const before = (await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).length;
    const res = await fetch(base + '/api/items/import', {
      method: 'POST', headers: H({ Cookie: cookieA }),
      body: JSON.stringify({ items: [{ title: '应回滚的有效行' }, { title: '无效日期', nextDate: '2027-02-30' }] })
    });
    eq(res.status, 400); assert((await res.json()).error.includes('第 2 条'));
    eq((await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).length, before);
  });

  await t('API：恢复保留创建时间、状态、历史及独立提醒字段', async () => {
    const entry = { category: 'phone', title: '恢复记录', status: 'paused', createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2021-01-01T00:00:00.000Z', detail: { recordKey: 'restore-test', reminderCycle: 'quarterly', history: [{ type: 'complete', action: '保活', date: '2020-12-01' }] } };
    const res = await fetch(base + '/api/items/import', {
      method: 'POST', headers: H({ Cookie: cookieA }), body: JSON.stringify({ items: [entry] })
    });
    eq(res.status, 201);
    const row = (await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).find(x => x.title === entry.title);
    eq(row.createdAt, entry.createdAt); eq(row.updatedAt, entry.updatedAt); eq(row.status, 'paused');
    eq(row.detail.reminderCycle, 'quarterly'); eq(row.detail.history[0].action, '保活');
    const duplicate = await fetch(base + '/api/items/import', {
      method: 'POST', headers: H({ Cookie: cookieA }), body: JSON.stringify({ items: [Object.assign({}, entry, { title: '不覆盖现有' })] })
    });
    eq((await duplicate.json()).skipped, 1);
    const unchanged = (await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).find(x => x.id === row.id);
    eq(unchanged.title, entry.title);
  });

  await t('API：拒绝非法分类、金额和空白名称', async () => {
    for (const input of [{ title: '   ' }, { title: '错误分类', category: 'unknown' }, { title: '金额', amount: 'Infinity' }]) {
      const res = await fetch(base + '/api/items', {
        method: 'POST', headers: H({ Cookie: cookieA }), body: JSON.stringify(input)
      });
      eq(res.status, 400); assert((await res.json()).error);
    }
  });

  await t('API：过期和并发编辑返回 409，不覆盖较新内容', async () => {
    const row = (await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json())[0];
    const update = note => fetch(base + '/api/items/' + row.id, {
      method: 'PUT', headers: H({ Cookie: cookieA }), body: JSON.stringify({ note, expectedUpdatedAt: row.updatedAt })
    });
    const responses = await Promise.all([update('新修改一'), update('新修改二')]);
    eq(responses.filter(r => r.status === 200).length, 1);
    eq(responses.filter(r => r.status === 409).length, 1);
    const winner = await responses.find(r => r.status === 200).json();
    const stale = await update('旧页面覆盖');
    eq(stale.status, 409);
    const latest = (await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).find(x => x.id === row.id);
    eq(latest.note, winner.note);
  });

  await t('API：非法 JSON 返回 400', async () => {
    const r = await fetch(base + '/api/items', {
      method: 'POST', headers: H({ Cookie: cookieA }),
      body: '{ 不是 JSON'
    });
    eq(r.status, 400);
  });

  await t('API：未知接口返回 404', async () => {
    const r = await fetch(base + '/api/nope', { headers: { Cookie: cookieA } });
    eq(r.status, 404);
  });

  await t('API：清空数据', async () => {
    await fetch(base + '/api/items', { method: 'DELETE', headers: { Cookie: cookieA } });
    eq((await (await fetch(base + '/api/items', { headers: { Cookie: cookieA } })).json()).length, 0);
  });

  await t('HTTP：根路径返回前端首页', async () => {
    const r = await fetch(base + '/');
    eq(r.status, 200);
    const body = await r.text();
    assert(body.indexOf('生活管理') >= 0, '应包含应用标题');
  });

  await t('HTTP：静态资源可访问', async () => {
    const r = await fetch(base + '/assets/js/store.js');
    eq(r.status, 200);
    assert(r.headers.get('content-type').indexOf('javascript') >= 0, 'MIME 应为 javascript');
  });

  await t('HTTP：静态服务对越权路径返回 403', async () => {
    const res = {
      status: 0, body: '',
      writeHead(c) { res.status = c; },
      end(b) { if (b) res.body += b; }
    };
    await serveStatic(res, '/%2e%2e/config.json');
    eq(res.status, 403, '越权路径应被拒绝');
  });

  await t('HTTP：项目文件不通过静态目录泄露', async () => {
    const a = await rawGet(base, '/%2e%2e/server.js');
    assert(a.body.indexOf('createServer') < 0, '不应泄露 server.js 内容');
    const b = await rawGet(base, '/%2e%2e/config.json');
    assert(b.body.indexOf('"database"') < 0, '不应泄露 config.json 内容');
  });

  await new Promise(r => server.close(r));
  await db.close();

  await t('SQLite 模式下服务同样可用', async () => {
    const s = await startServer('sqlite', path.join(TMP, 'api.db'));
    const h = await (await fetch(s.base + '/api/health')).json();
    eq(h.database.type, 'sqlite');
    const ck = await registerVerifiedUser(s.base, s.auth, 'sqlite-owner@example.com', 'password123');
    const c = await (await fetch(s.base + '/api/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ck },
      body: JSON.stringify({ category: 'broadband', title: '电信', amount: 120, cycle: 'monthly', nextDate: '2027-03-01' })
    })).json();
    assert(c.id, '应写入成功');
    eq((await (await fetch(s.base + '/api/items', { headers: { Cookie: ck } })).json()).length, 1);
    await new Promise(r => s.server.close(r));
    await s.db.close();
  });

  cleanEnv();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 忽略清理失败 */ }
}

async function main() {
  console.log('\n生活管理 · 自测');
  await testFrontend();
  await testImprovements();
  await testBackend();
  console.log('\n结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  if (failures.length) {
    console.log('\n失败明细：');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('测试脚本异常：', e); process.exit(1); });
