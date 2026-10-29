/* 界面渲染与交互 */
window.UI = (function () {

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, m => ESC_MAP[m]); }
  function $(id) { return document.getElementById(id); }

  const ICONS = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 6h4m-3 12h2"/>',
    broadband: '<path d="M3 8.5a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 3.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none"/>',
    parking: '<path d="m5 8 1.5-4h11L19 8m-15 3 1-3h14l1 3v7H4zM6 18v3m12-3v3M4 13h16m-13 3h1m8 0h1"/>',
    asset: '<path d="M20 8V5H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V8m17 6h-5v4h5"/><path d="M17 16h.1"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-12 0h12M10 21h4"/>',
    trend: '<path d="m3 16 6-6 4 4 8-10m-6 0h6v6M3 21h18"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8zm-9 10 9 5 9-5M3 18l9 4 9-4"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-12 4h3"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>'
  };
  function icon(name) { return '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + (ICONS[name] || ICONS.overview) + '</svg>'; }
  function categoryIcon(category) { return '<span class="category-icon icon-' + category + '">' + icon(category) + '</span>'; }

  function renderPageHeading() {
    const labels = { overview: '最近的安排', phone: '我的手机号', broadband: '我的宽带', parking: '停车缴费', asset: '我的资产' };
    const descriptions = { overview: '保活、续费、缴费，都在这里。', phone: '查看号码与下次保活时间。',
      broadband: '续费时间、合约期限与宽带信息，集中管理。', parking: '记录车位信息，安排下一次缴费。', asset: '按账户查看资产，定期复核余额。' };
    const date = new Date();
    const day = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    $('pageHeading').innerHTML = '<div>' +
      '<h1>' + esc(labels[state.tab]) + '</h1><p>' + esc(descriptions[state.tab]) + '</p></div>' +
      '<div class="page-date">' + icon('calendar') + '<span>' + esc(day) + '</span></div>';
  }

  const ACTION_LABEL = {
    phone: '记录保活', broadband: '记录续费', parking: '记录缴费', asset: '记录复核'
  };
  const LIST_META = {
    phone: ['detail.country', 'provider', 'amount', 'nextDate'],
    broadband: ['provider', 'detail.speed', 'amount', 'nextDate'],
    parking: ['provider', 'detail.slot', 'detail.cardType', 'amount', 'nextDate'],
    asset: ['detail.assetType', 'provider', 'amount', 'nextDate']
  };

  let state = { tab: 'overview', items: [], keyword: '', filter: 'all', lifecycle: 'active' };
  let busy = false, pendingImport = null, modalReturnFocus = null;

  function find(id) { return state.items.find(x => String(x.id) === String(id)); }
  async function run(task) {
    if (busy) return;
    busy = true; $('btnSave').disabled = true;
    try { return await task(); }
    catch (e) { toast(e.message || '操作失败，请重试'); }
    finally { busy = false; $('btnSave').disabled = false; renderStorage(); }
  }
  function persistedHint(result) { return result.persisted ? '' : '（仅保存在内存，刷新后会丢失）'; }
  function renderStorage() {
    const box = $('storageStatus'), mode = Store.mode(), error = Store.error();
    let text = mode === 'api' ? '已连接数据库' :
      mode === 'offline' ? '暂时无法连接，请重试' : Store.isMemoryMode() ? '记录暂存于内存，请及时备份' : '保存在此浏览器';
    if (error) text += ' · ' + error;
    box.title = text + (mode === 'api' ? '（' + ((Store.dbInfo() || {}).type || '') + '）' : mode === 'local' ? '；与数据库中的记录分开保存' : '');
    box.className = 'storage-status' + (error || mode === 'offline' || Store.isMemoryMode() ? ' warning' : '');
    box.innerHTML = '<span class="connection-dot" aria-hidden="true"></span><span class="storage-copy">' + esc(text) + '</span>' +
      (mode !== 'api' || error ? '<button class="connection-retry" onclick="UI.reconnect()">' + (mode === 'local' ? '连接服务' : '重试') + '</button>' : '');
  }
  function reconnect() {
    if (Store.mode() === 'local' && state.items.length && !confirm('将本浏览器记录合并到服务端，重复记录会跳过。继续？')) return Promise.resolve();
    return run(async () => {
      const result = await Store.reconnect();
      await refresh();
      toast('已连接数据库' + (result.created ? '，合并 ' + result.created + ' 条' : ''));
    });
  }

  /* ---------- 提示 ---------- */
  let toastTimer = null;
  function toast(msg) {
    try {
      const box = $('toast');
      if (!box) return;
      box.textContent = msg;
      box.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => box.classList.remove('show'), 2200);
    } catch (e) { /* 提示失败不影响主流程 */ }
  }

  /* ---------- 标签页 ---------- */
  function renderTabs() {
    const tabs = [{ key: 'overview', label: '最近' }].concat(
      Model.ORDER.map(k => ({
        key: k,
        label: k === 'asset' ? '资产' : Model.CATEGORIES[k].label
      }))
    );
    $('tabs').innerHTML = tabs.map(t =>
      '<button class="tab' + (state.tab === t.key ? ' active' : '') + '"' + (state.tab === t.key ? ' aria-current="page"' : '') + ' onclick="UI.setTab(\'' + t.key + '\')">' +
      '<span class="tab-label">' + esc(t.label) + '</span></button>'
    ).join('');
  }

  function setTab(key) { state.tab = key; state.keyword = ''; state.filter = 'all'; state.lifecycle = 'active'; render(); }

  /* ---------- 总览 ---------- */
  function renderOverview() {
    const items = state.items.filter(Model.isActive);
    const cycleItems = items.filter(x => x.category !== 'asset');
    const assets = items.filter(x => x.category === 'asset');

    const dueAll = Model.dueEntries(items);
    const due30 = dueAll.filter(o => o.d <= 30);
    const overdue = dueAll.filter(o => o.d < 0);

    const annual = Model.totals(cycleItems, true) || '暂无周期支出';
    const cnyAssets = assets.filter(x => (x.currency || 'CNY') === 'CNY');
    const totalCny = cnyAssets.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const foreign = assets.filter(x => (x.currency || 'CNY') !== 'CNY');
    const foreignTxt = Model.totals(foreign, false);

    const pieData = Charts.groupBy(cnyAssets, 'detail.assetType')
      .map((d, i) => ({ name: d.name, value: d.value, color: Charts.colorAt(i) }));
    const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

    const upcoming = due30.length ? due30 : dueAll.slice(0, 6);
    let html = '<section class="card due-card' + (upcoming.length ? '' : ' is-empty') + '">' +
      (upcoming.length ? '<div class="section-head"><h2>' + (due30.length ? '近 30 天' : '接下来的安排') + '</h2><span class="hint">' + upcoming.length + ' 件事</span></div>' : '') +
      (overdue.length ? '<p class="due-note">有 ' + overdue.length + ' 件事已逾期，可以先处理。</p>' : '') +
      '<div class="due-list">' + dueList(upcoming) + '</div></section>';

    html += '<details class="overview-details"><summary>支出与资产<span class="menu-caret" aria-hidden="true"></span></summary><div class="overview-detail-body">' +
      '<div class="stats">' + stat('年度周期支出', annual, '按币种分别计算，不含一次性费用') +
      stat('人民币资产', Model.money(totalCny, 'CNY'), foreignTxt ? '另有 ' + foreignTxt : '在用账户的人民币余额') + '</div>';

    html += '<div class="card asset-card"><div class="section-head"><div><h2>资产分布</h2><p>在用人民币账户 · 按类型统计</p></div>' +
      '<button class="text-button" onclick="UI.setTab(\'asset\')" aria-label="查看资产账户">' + icon('arrow') + '</button></div>' +
      (pieTotal
        ? '<div class="pie-wrap"><div class="donut-visual">' + Charts.donut(pieData, { size: 164 }) +
          '<div class="donut-center"><span>合计</span><strong>' + esc(Model.money(pieTotal, 'CNY')) + '</strong></div></div>' +
          '<div class="pie-legend">' + pieLegend(pieData, pieTotal) + '</div></div>'
        : '<div class="empty asset-empty"><span class="empty-symbol">' + icon('asset') + '</span><span class="big">' + (assets.length ? '暂无可绘图的人民币正余额' : '还没有在用资产记录') +
          '</span><p>' + (foreign.length ? '外币账户：' + esc(foreignTxt) : '添加账户，清晰了解你的资产构成') + '</p><button class="btn btn-sm" onclick="UI.openAdd(\'asset\')">＋ 添加资产账户</button></div>') +
      '</div>';

    html += '</div></details>';
    $('main').innerHTML = html;
  }

  function stat(label, value, sub, alert, glyph, unit, className) {
    const parts = String(value).split(' · ');
    const money = /^([A-Z]{3}) (.+)$/.exec(parts[0]);
    const primary = money ? '<span class="value-currency">' + esc(money[1]) + '</span>' + esc(money[2]) : esc(parts[0]);
    return '<div class="stat ' + (className || '') + (alert ? ' alert' : '') + '"><div class="stat-head"><span class="label">' + esc(label) +
      '</span>' + (glyph ? '<span class="stat-icon icon-' + glyph + '">' + icon(glyph) + '</span>' : '') + '</div><div class="value">' + primary + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div>' +
      (parts.length > 1 ? '<div class="stat-secondary">' + esc(parts.slice(1).join(' · ')) + '</div>' : '') +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function dueList(rows) {
    if (!rows.length) return '<div class="empty empty-schedule">' +
      '<svg class="empty-artwork" viewBox="0 0 112 92" fill="none" aria-hidden="true">' +
      '<ellipse cx="55" cy="48" rx="46" ry="35" fill="#F1F9F8"/><circle cx="19" cy="24" r="3" fill="#F3E4C8"/><circle cx="18" cy="66" r="2" fill="#DCEEF0"/>' +
      '<g transform="rotate(-6 55 45)"><rect x="27" y="19" width="58" height="57" rx="9" fill="white" stroke="#BBD9E0" stroke-width="1.5"/>' +
      '<path d="M28 35h56M40 15v10m32-10v10" stroke="#BBD9E0" stroke-width="1.5" stroke-linecap="round"/>' +
      '<circle cx="41" cy="47" r="2" fill="#DCEBF0"/><circle cx="56" cy="47" r="2" fill="#DCEBF0"/><circle cx="71" cy="47" r="2" fill="#DCEBF0"/>' +
      '<circle cx="41" cy="62" r="2" fill="#DCEBF0"/><circle cx="56" cy="62" r="7" fill="#E8F6F1"/><path d="m53 62 2 2 4-4" stroke="#8ABBA6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="71" cy="62" r="2" fill="#DCEBF0"/></g><path d="M88 78c-2-10 0-19 7-27" stroke="#B7D9C9" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M90 64c-7 0-10-4-10-8 6 0 10 2 10 8Zm2-3c0-7 4-11 10-12 0 6-3 10-10 12Z" fill="#D4EBDD"/></svg>' +
      '<span class="big">' + (state.items.length ? '暂时没有到期事项' : '还没有安排') + '</span>' +
      '<p>' + (state.items.length ? '有新安排时，随手记下来。' : '添加一个号码，或记下下一次缴费日期。') + '</p>' +
      '<button class="btn btn-primary" onclick="UI.openAdd()">＋ 添加事项</button></div>';
    return rows.map(o => {
      const x = o.x;
      const st = Model.statusOf({ nextDate: o.date });
      return '<div class="due-row">' + categoryIcon(x.category) +
        '<span class="due-name"><strong>' + esc(x.title || '(未命名)') + '</strong>' +
        '<span>' + esc(Model.CATEGORIES[x.category].label) + (o.kind === 'contract' ? ' · 合约到期' : '') + (x.provider ? ' · ' + esc(x.provider) : '') + '</span></span>' +
        '<span class="due-info"><span class="badge ' + st.key + '">' + esc(st.label) + '</span><span class="due-date">' + esc(o.date) + '</span></span>' +
        '<button class="btn btn-sm" onclick="UI.' + (o.kind === 'contract' ? 'openEdit' : 'markDone') + '(' + x.id + ')">' +
        (o.kind === 'contract' ? '查看合约' : esc(ACTION_LABEL[x.category])) + '</button></div>';
    }).join('');
  }
  function pieLegend(data, total) {
    return data.map(d =>
      '<div class="legend-row"><span class="legend-dot" style="background:' + d.color + '"></span>' +
      '<span class="legend-name">' + esc(d.name) + '<small>' + esc(Model.money(d.value, 'CNY')) + '</small></span>' +
      '<span class="legend-pct">' + (d.value / total * 100).toFixed(1) + '%</span></div>'
    ).join('');
  }
  /* ---------- 分类列表 ---------- */
  function renderList(cat, updateResults) {
    const def = Model.CATEGORIES[cat];
    let list = state.items.filter(x => x.category === cat && (state.lifecycle === 'all' || (x.status || 'active') === state.lifecycle));

    const kw = state.keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(x =>
        [x.title, x.provider, x.note].concat(Object.values(x.detail || {}))
          .filter(v => typeof v !== 'object').join(' ').toLowerCase().indexOf(kw) >= 0);
    }
    if (state.filter !== 'all') {
      list = list.filter(x => Model.statusOf(x).key === state.filter);
    }

    list.sort((a, b) => {
      const da = a.nextDate, db = b.nextDate;
      if (!da && !db) return String(a.title).localeCompare(String(b.title));
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : da > db ? 1 : 0;
    });

    const toolbar = '<div class="toolbar">' +
      '<label class="search-field" for="searchInput">' + icon('search') + '<input id="searchInput" type="text" aria-label="搜索记录" placeholder="搜索名称、机构或备注…" value="' + esc(state.keyword) + '" oninput="if(!event.isComposing) UI.search(this.value)" oncompositionend="UI.search(this.value)"></label>' +
      '<details class="filter-menu"><summary class="btn btn-quiet" role="button">筛选' + (state.lifecycle !== 'active' || state.filter !== 'all' ? '<span class="filter-indicator" aria-label="已启用筛选"></span>' : '') + '</summary><div class="dropdown-panel">' +
      '<label>条目状态<select aria-label="条目状态" onchange="UI.setLifecycle(this.value)">' +
      Object.entries(Object.assign({ all: '全部记录' }, Records.STATUSES)).map(([key, label]) => '<option value="' + key + '"' + (state.lifecycle === key ? ' selected' : '') + '>' + esc(label) + '</option>').join('') + '</select></label>' +
      (def.hasDue || cat === 'asset'
        ? '<label>到期状态<select aria-label="到期状态" onchange="UI.setFilter(this.value)">' +
          ['all:全部到期状态', 'overdue:已逾期', 'today:今日到期', 'soon:7 日内', 'fine:正常', 'none:未设日期']
            .map(o => {
              const p = o.split(':');
              return '<option value="' + p[0] + '"' + (state.filter === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
            }).join('') + '</select></label>'
        : '') +
      '</div></details></div>';

    let content;
    if (!list.length) {
      content = '<div class="empty list-empty"><span class="empty-symbol">' + icon(cat) + '</span><span class="big">' +
        (state.items.filter(x => x.category === cat).length ? '没有符合条件的记录' : '还没有' + esc(def.label) + '记录') +
        '</span><p>可添加记录，或切换条目状态查看暂停和归档记录</p><button class="btn" onclick="UI.openAdd()">＋ 添加' + esc(def.label) + '</button></div>';
    } else {
      content = '<div class="list">' + list.map(x => itemCard(x, cat, def)).join('') + '</div>';
    }
    const results = document.getElementById('listResults');
    if (updateResults && results) results.innerHTML = content;
    else $('main').innerHTML = toolbar + '<div id="listResults">' + content + '</div>';
  }

  function itemCard(x, cat, def) {
    const st = Model.statusOf(x);
    const meta = (LIST_META[cat] || []).map(k => {
      const f = def.fields.filter(o => o.key === k)[0];
      if (!f) return '';
      let v = Model.get(x, k);
      if (v === '' || v === null || v === undefined) return '';
      if (f.type === 'number') v = Model.money(v, x.currency);
      if (f.type === 'select') {
        const o = (f.options || []).filter(o => o[0] === v)[0];
        v = o ? o[1] : v;
      }
      if (k === 'detail.country') v = Model.flagOf(v) + ' ' + v;
      return '<span>' + esc(f.label) + '：<b>' + esc(v) + '</b></span>';
    }).filter(Boolean).join('');

    let badge = Model.isActive(x) && (def.hasDue || x.nextDate)
      ? '<span class="badge ' + st.key + '">' + esc(st.label) + '</span>'
      : '<span class="badge">' + esc(Records.STATUSES[x.status || 'active']) + '</span>';
    const extra = [];
    if (cat === 'phone') extra.push('保活：' + (Records.CYCLES[Model.reminderCycle(x)] || '每月'));
    if (cat === 'broadband' && (x.detail || {}).contractDate) extra.push('合约到期：' + x.detail.contractDate);
    if ((x.detail || {}).lastCompletedAt) extra.push('最近处理：' + x.detail.lastCompletedAt);

    return '<div class="item ' + (Model.isActive(x) ? st.key : 'inactive') + '">' + categoryIcon(cat) +
      '<div class="item-main">' +
        '<div class="item-title">' + esc(x.title || '(未命名)') + badge + '</div>' +
        (meta ? '<div class="item-meta">' + meta + '</div>' : '') +
        (extra.length ? '<div class="item-note">' + esc(extra.join(' · ')) + '</div>' : '') +
        (x.note ? '<div class="item-note">' + esc(x.note) + '</div>' : '') +
      '</div>' +
      '<div class="item-actions">' +
        (Model.isActive(x) ? '<button class="btn btn-sm btn-done" onclick="UI.markDone(' + x.id + ')">' + esc(ACTION_LABEL[cat]) + '</button>' :
          '<button class="btn btn-sm" onclick="UI.changeStatus(' + x.id + ',\'active\')">恢复在用</button>') +
        '<button class="btn btn-sm" onclick="UI.openEdit(' + x.id + ')">编辑</button>' +
        '<details class="item-menu"><summary class="btn more-button" role="button" aria-label="更多操作：' + esc(x.title) + '" title="更多操作">' + icon('more') + '</summary><div class="dropdown-panel">' +
        '<button onclick="UI.history(' + x.id + ')">处理记录</button>' +
        (Model.isActive(x) ? '<button onclick="UI.changeStatus(' + x.id + ',\'paused\')">暂停条目</button>' : '') +
        (x.status !== 'archived' ? '<button onclick="UI.changeStatus(' + x.id + ',\'archived\')">归档条目</button>' : '') +
        '<button class="danger-menu-item" onclick="UI.remove(' + x.id + ')">删除条目</button>' +
        '</div></details>' +
      '</div>' +
    '</div>';
  }

  function search(v) { state.keyword = v; renderList(state.tab, true); }
  function setFilter(v) { state.filter = v; renderList(state.tab); }
  function setLifecycle(v) { state.lifecycle = v; renderList(state.tab); }

  function showModal(mode, title, html, label) {
    if (!$('mask').classList.contains('show')) modalReturnFocus = document.activeElement;
    $('formBody').dataset.mode = mode;
    $('modalTitle').textContent = title;
    if (html !== undefined) $('formBody').innerHTML = html;
    $('btnSave').style.display = label === false ? 'none' : '';
    $('btnSave').textContent = label || '保存';
    $('btnSave').disabled = false;
    $('mask').classList.add('show');
    const first = $('formBody').querySelector('input,select,textarea,button');
    if (first && first.focus) first.focus();
  }

  /* ---------- 表单 ---------- */
  function buildForm(cat, item) {
    const def = Model.CATEGORIES[cat];
    const isEdit = !!item;
    $('modalTitle').textContent = (isEdit ? '编辑' : '添加') + def.label;
    $('formBody').dataset.cat = cat;
    $('formBody').dataset.id = isEdit ? item.id : '';

    const primaryKeys = {
      phone: ['title', 'provider', 'detail.country', 'detail.strategy', 'nextDate', 'detail.reminderCycle'],
      broadband: ['title', 'amount', 'cycle', 'nextDate', 'detail.contractDate'],
      parking: ['title', 'provider', 'detail.slot', 'amount', 'cycle', 'nextDate'],
      asset: ['title', 'detail.assetType', 'amount', 'currency']
    };
    const renderField = f => {
      let val = isEdit ? Model.get(item, f.key) : (f.default || '');
      if (isEdit && !val && f.key === 'detail.reminderCycle') val = Model.reminderCycle(item);
      if (!val && f.key === 'currency') val = 'CNY';
      const cls = 'field' + (f.full ? ' full' : '');
      const req = f.required ? ' <span class="req">*</span>' : '';
      let ctrl = '';

      if (f.type === 'select') {
        ctrl = '<select data-key="' + f.key + '">' +
          '<option value="">请选择</option>' +
          (val && !(f.options || []).some(o => String(o[0]) === String(val)) ? '<option value="' + esc(val) + '" selected>' + esc(val) + '</option>' : '') +
          (f.options || []).map(o =>
            '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'
          ).join('') + '</select>';
      } else if (f.type === 'textarea') {
        ctrl = '<textarea data-key="' + f.key + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(val) + '</textarea>';
      } else if (f.type === 'country') {
        ctrl = '<div class="suggest"><input type="text" data-key="' + f.key + '" autocomplete="off" ' +
          'placeholder="输入中文或英文过滤" value="' + esc(val) + '" ' +
          'oninput="UI.pickCountry(this)" onfocus="UI.pickCountry(this)">' +
          '<div class="suggest-list" data-for="' + f.key + '" style="display:none"></div></div>';
      } else if (f.type === 'suggest') {
        ctrl = '<input type="text" data-key="' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '">' +
          '<div class="quick">' + (f.presets || []).map(p =>
            '<button type="button" class="chip" onclick="UI.fill(this,\'' + esc(f.key) + '\',\'' + esc(p) + '\')">' + esc(p) + '</button>'
          ).join('') + '</div>';
      } else if (f.type === 'date') {
        ctrl = '<input type="date" data-key="' + f.key + '" value="' + esc(val) + '">' +
          '<div class="quick">' +
            [7, 30, 90].map(n =>
              '<button type="button" class="chip" onclick="UI.shift(this,\'' + esc(f.key) + '\',' + n + ')">+' + n + '天</button>'
            ).join('') +
            '<button type="button" class="chip" onclick="UI.today(this,\'' + esc(f.key) + '\')">今天</button>' +
          '</div>';
      } else if (f.type === 'number') {
        ctrl = '<input type="number" step="0.01" data-key="' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '">';
      } else {
        ctrl = '<input type="text" data-key="' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '">';
      }

      const inputId = 'field-' + f.key.replace(/\./g, '-');
      ctrl = ctrl.replace(/<(input|select|textarea)\b/, '<$1 id="' + inputId + '"');
      return '<div class="' + cls + '"><label for="' + inputId + '">' + esc(f.label) + req + '</label>' + ctrl + '</div>';
    };
    const primary = def.fields.filter(f => f.required || primaryKeys[cat].includes(f.key));
    const extra = def.fields.filter(f => !primary.includes(f));
    const extraLabels = { phone: '费用、激活日期与备注', broadband: '运营商、地址与其他信息', parking: '卡片、缴费渠道与备注', asset: '机构、复核日期与备注' };
    const html = '<div class="form-grid">' + primary.map(renderField).join('') + '</div>' +
      (extra.length ? '<details class="form-extra"><summary>' + esc(extraLabels[cat]) + '<span class="menu-caret" aria-hidden="true"></span></summary><div class="form-grid">' + extra.map(renderField).join('') + '</div></details>' : '');

    $('formBody').innerHTML = html + (cat === 'broadband' && isEdit && !Object.prototype.hasOwnProperty.call(item.detail || {}, 'contractDate') ?
      '<p class="hint">旧记录的到期日期保留在“下次续费日期”，请核对并补充独立的合约到期日。</p>' : '');
  }

  function pickCountry(input) {
    const key = input.dataset.key;
    const box = document.querySelector('.suggest-list[data-for="' + key + '"]');
    if (!box) return;
    const hits = Model.searchCountries(input.value);
    if (!hits.length) { box.style.display = 'none'; return; }
    box.innerHTML = hits.slice(0, 40).map(c =>
      '<div class="suggest-item" onclick="UI.chooseCountry(this,\'' + esc(key) + '\',\'' + esc(c[0]) + '\')">' +
      '<span>' + c[2] + '</span><span>' + esc(c[0]) + '</span><span class="sub">' + esc(c[1]) + '</span></div>'
    ).join('');
    box.style.display = 'block';
  }
  function chooseCountry(el, key, name) {
    const body = $('formBody');
    const input = body.querySelector('[data-key="' + key + '"]');
    if (input) input.value = name;
    const box = body.querySelector('.suggest-list[data-for="' + key + '"]');
    if (box) box.style.display = 'none';
  }
  function fill(btn, key, value) {
    const input = $('formBody').querySelector('[data-key="' + key + '"]');
    if (input) input.value = value;
  }
  function shift(btn, key, days) {
    const input = $('formBody').querySelector('[data-key="' + key + '"]');
    if (!input) return;
    const base = input.value || Model.todayStr();
    input.value = Model.addDays(base, days);
  }
  function today(btn, key) {
    const input = $('formBody').querySelector('[data-key="' + key + '"]');
    if (input) input.value = Model.todayStr();
  }

  function openAdd(category) {
    if (!category && state.tab === 'overview') {
      showModal('choose', '选择要添加的分类', '<div class="category-picker">' + Model.ORDER.map(k =>
        '<button class="btn" onclick="UI.openAdd(\'' + k + '\')">' + categoryIcon(k) + '<span>' + esc(Model.CATEGORIES[k].label) + '</span>' + icon('arrow') + '</button>').join('') + '</div>', false);
      return;
    }
    const cat = category || state.tab;
    buildForm(cat, null);
    showModal('edit', '添加' + Model.CATEGORIES[cat].label);
  }
  function openEdit(id) {
    const x = state.items.filter(i => String(i.id) === String(id))[0];
    if (!x) return;
    buildForm(x.category, x);
    showModal('edit', '编辑' + Model.CATEGORIES[x.category].label);
  }
  function closeModal(force) {
    if (busy && !force) return;
    $('mask').classList.remove('show');
    pendingImport = null;
    if (modalReturnFocus && modalReturnFocus.isConnected && modalReturnFocus.focus) modalReturnFocus.focus();
  }

  function save() {
    const body = $('formBody');
    if (body.dataset.mode === 'complete') return saveCompletion();
    if (body.dataset.mode === 'import') return commitImport();
    if (body.dataset.mode !== 'edit') return Promise.resolve();
    const cat = body.dataset.cat;
    const id = body.dataset.id;
    const def = Model.CATEGORIES[cat];
    const existing = id ? find(id) : null;
    const draft = { category: cat, detail: Records.clone((existing || {}).detail || {}) };

    try {
      def.fields.forEach(f => {
        const el = body.querySelector('[data-key="' + f.key + '"]');
        if (!el) return;
        let v = el.value;
        if (f.type === 'number') v = (v === '' || v === null) ? null : Number(v);
        Model.set(draft, f.key, v);
        if (f.required && !(f.key === 'nextDate' && existing && !Model.isActive(existing)) && (v === '' || v === null || v === undefined)) {
          throw new Error('请填写「' + f.label + '」');
        }
      });
    } catch (err) {
      toast(err && err.message ? err.message : '保存失败');
      return Promise.resolve();
    }

    return run(async () => {
      Records.validate(Object.assign({}, existing, draft));
      if (existing && draft.nextDate !== existing.nextDate) delete draft.detail.reminderAnchor;
      const result = id ? await Store.update(id, draft, existing.updatedAt) : await Store.add(draft);
      closeModal(true);
      await refresh();
      toast((id ? '已保存修改' : '已添加「' + draft.title + '」') + persistedHint(result));
    });
  }

  /* ---------- 续期 ---------- */
  function shiftNext(item) {
    return Model.shiftNext(item);
  }
  function control(key, label, type, value) {
    return '<div class="field"><label for="action-' + key + '">' + esc(label) + '</label><input id="action-' + key + '" data-key="' + key +
      '" type="' + type + '"' + (type === 'number' ? ' step="0.01"' : '') + ' value="' + esc(value === null || value === undefined ? '' : value) + '"></div>';
  }
  function markDone(id) {
    const x = find(id);
    if (!x || !Model.isActive(x)) return;
    const once = Model.reminderCycle(x) === 'once';
    const html = '<p>' + esc(x.title) + ' · ' + (Records.CYCLES[Model.reminderCycle(x)] || '') + '</p>' +
      '<div class="form-grid">' + control('date', '实际处理日期', 'date', Model.todayStr()) +
      control('amount', x.category === 'asset' ? '复核后余额' : '本次实际费用（可留空）', 'number', x.category === 'phone' ? null : x.amount) +
      control('currency', '币种', 'text', x.currency || 'CNY') +
      (once ? '' : control('nextDate', '下次日期（留空停止提醒）', 'date', shiftNext(x))) +
      '<div class="field full"><label for="action-note">处理备注</label><textarea id="action-note" data-key="note"></textarea></div></div>' +
      '<p class="hint">' + (once ? '一次性事项完成后移入“已完成”，停止提醒。' : '请核对下次日期；月底会顺延到目标月的最后一个有效日期。') +
      (x.category === 'broadband' ? '合约到期日保持独立，请续约后在编辑中更新。' : '') + '</p>';
    $('formBody').dataset.id = id;
    showModal('complete', ACTION_LABEL[x.category], html, '确认并记录');
  }
  function saveCompletion() {
    return run(async () => {
      const body = $('formBody'), x = find(body.dataset.id);
      if (!x) throw new Error('记录不存在，请刷新后重试');
      const values = {};
      ['date', 'amount', 'currency', 'nextDate', 'note'].forEach(k => {
        const el = body.querySelector('[data-key="' + k + '"]');
        if (el) values[k] = el.value;
      });
      if (!values.date) throw new Error('请填写实际处理日期');
      const result = await Store.update(x.id, Model.complete(x, values), x.updatedAt);
      closeModal(true); await refresh();
      toast('已记录，可在处理记录中查看或撤销' + persistedHint(result));
    });
  }
  function history(id) {
    const x = find(id);
    if (!x) return;
    const entries = ((x.detail || {}).history || []).slice().reverse();
    const html = '<p>' + esc(x.title) + '</p>' + (Model.canUndo(x) ?
      '<button class="btn" onclick="UI.undoLast(' + x.id + ')">撤销最近一次处理</button>' : '') +
      (entries.length ? entries.map(e => '<article class="history-entry"><strong>' + esc(e.action || '处理') +
        (e.undoneAt ? '（已撤销）' : '') + '</strong><div>' + esc(e.date || (e.at || '').slice(0, 10)) +
        (e.amount !== null && e.amount !== undefined ? ' · ' + esc((e.currency || x.currency || 'CNY') + ' ' + Model.money(e.amount, e.currency || x.currency)) : '') +
        '</div>' + (e.type === 'complete' ? '<div>下次日期：' + esc((e.before || {}).nextDate || '未设置') + ' → ' + esc((e.after || {}).nextDate || '停止提醒') + '</div>' : '') +
        (e.note ? '<p>' + esc(e.note) + '</p>' : '') + '</article>').join('') : '<div class="empty">还没有处理记录</div>') +
      '<p class="hint">可撤销最新一次处理。后续日期、金额或状态已有变更时，请通过编辑调整。</p>';
    showModal('history', '处理记录', html, false);
  }
  function undoLast(id) {
    return run(async () => {
      const x = find(id);
      if (!x) throw new Error('记录不存在');
      const result = await Store.update(id, Model.undo(x), x.updatedAt);
      closeModal(true); await refresh();
      toast('已撤销最近一次处理' + persistedHint(result));
    });
  }
  function changeStatus(id, status) {
    return run(async () => {
      const x = find(id);
      if (!x || !Records.STATUSES[status]) throw new Error('记录或状态无效');
      const detail = Records.clone(x.detail || {});
      detail.history = (detail.history || []).concat([{ type: 'status', action: Records.STATUSES[status], at: new Date().toISOString() }]);
      const result = await Store.update(id, { status, detail }, x.updatedAt);
      await refresh();
      toast('状态：' + Records.STATUSES[status] + '，可在条目状态筛选中查看' + persistedHint(result));
    });
  }

  function remove(id) {
    const x = state.items.filter(i => String(i.id) === String(id))[0];
    if (!x) return;
    if (!confirm('确定删除「' + (x.title || '未命名') + '」？此操作不可撤销。')) return Promise.resolve();
    return run(async () => { const r = await Store.remove(id); await refresh(); toast('已删除' + persistedHint(r)); });
  }

  function wipe() {
    if (!confirm('将清空全部数据，建议先下载完整备份。确定继续？')) return Promise.resolve();
    return run(async () => { const r = await Store.clear(); await refresh(); toast('已清空' + persistedHint(r)); });
  }

  /* ---------- 备份与导入 ---------- */
  function columnsOf() { return Records.csvColumns(); }
  function genericColumns() { return Records.csvColumns(); }
  function download(text, name, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body && document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCSV() {
    const cat = state.tab === 'overview' ? null : state.tab;
    const rows = cat ? state.items.filter(x => x.category === cat) : state.items;
    if (!rows.length) { toast('暂无数据可导出'); return; }
    download('\uFEFF' + Store.toCSV(rows, Records.csvColumns()), '生活管理_' + (cat ? Model.CATEGORIES[cat].label : '全部') + '_' + Model.todayStr() + '.csv', 'text/csv;charset=utf-8');
    toast('已导出 ' + rows.length + ' 条，包含扩展信息和处理记录');
  }
  function exportBackup() {
    download(Records.backup(state.items), '生活管理_完整备份_' + Model.todayStr() + '.json', 'application/json;charset=utf-8');
    toast('已备份全部 ' + state.items.length + ' 条记录');
  }
  function checkedImport(text) {
    const parsed = Records.parseImport(text, state.tab === 'overview' ? 'phone' : state.tab);
    if (parsed.errors.length) throw new Error(parsed.errors.slice(0, 3).join('；') + (parsed.errors.length > 3 ? '；共 ' + parsed.errors.length + ' 处错误' : ''));
    if (!parsed.items.length) throw new Error('没有可导入的条目');
    return parsed;
  }
  function previewImport(text, filename) {
    try {
      const parsed = checkedImport(text), batch = Records.partition(parsed.items, state.items);
      pendingImport = parsed.items;
      const html = '<p>' + esc(filename || '导入文件') + '</p><p>共 ' + parsed.total + ' 条：预计新增 <b>' + batch.items.length + '</b> 条，跳过重复 <b>' + batch.skipped + '</b> 条。</p>' +
        '<p class="hint">合并后保留现有记录。完整备份中的分类、状态、扩展信息和处理记录会一起导入。</p><div class="import-preview">' +
        batch.items.slice(0, 8).map(x => '<div>' + esc(Records.CATEGORIES[x.category]) + ' · ' + esc(x.title) + '</div>').join('') +
        (batch.items.length > 8 ? '<p>另有 ' + (batch.items.length - 8) + ' 条</p>' : '') + '</div>';
      showModal('import', '确认导入', html, '合并导入');
    } catch (e) { toast(e.message); }
  }
  async function importItems(items) {
    const result = await Store.addMany(items);
    closeModal(true); await refresh();
    toast('已导入 ' + result.created + ' 条，跳过重复 ' + result.skipped + ' 条' + persistedHint(result));
    return result;
  }
  function commitImport() {
    return run(async () => {
      if (!pendingImport) throw new Error('请重新选择导入文件');
      return importItems(pendingImport);
    });
  }
  function importCSV(text) {
    return run(async () => importItems(checkedImport(text).items));
  }
  function exportCalendar() {
    const entries = Model.dueEntries(state.items).filter(o => o.d >= 0);
    const html = '<p>可导出今天及未来的 ' + entries.length + ' 项在用提醒，包括保活、缴费、资产复核和宽带合约到期。</p>' +
      '<p>下载后导入手机或电脑的日历，检查日历中的提醒设置。文件包含提前一天的提醒，是否通知由日历应用及系统权限决定。</p>' +
      '<p class="hint">这是当前日期的快照。修改日期、暂停或归档后，请在日历中移除旧事项并重新导入。过期事项仍可在本应用中处理。</p>' +
      '<button class="btn btn-primary" onclick="UI.downloadCalendar()">下载提醒日历</button>';
    showModal('calendar', '导出日历提醒', html, false);
  }
  function downloadCalendar() {
    const result = CalendarFile.create(state.items);
    if (!result.count) { toast('没有今天或未来的在用提醒'); return; }
    download(result.text, '生活管理_提醒_' + Model.todayStr() + '.ics', 'text/calendar;charset=utf-8');
    toast('已导出 ' + result.count + ' 项，请导入日历并检查通知设置');
  }

  /* ---------- 主流程 ---------- */
  async function refresh() {
    try { state.items = await Store.list(); render(); }
    catch (e) { renderStorage(); throw e; }
  }
  function render() {
    renderStorage();
    renderTabs();
    renderPageHeading();
    if (state.tab === 'overview') renderOverview();
    else renderList(state.tab);
  }

  return {
    state: state, setTab: setTab, render: render, refresh: refresh, renderStorage, reconnect,
    search: search, setFilter: setFilter, setLifecycle,
    openAdd: openAdd, openEdit: openEdit, closeModal: closeModal, save: save,
    markDone: markDone, remove: remove, wipe: wipe, history, undoLast, changeStatus,
    pickCountry: pickCountry, chooseCountry: chooseCountry, fill: fill, shift: shift, today: today,
    exportCSV: exportCSV, importCSV: importCSV, exportBackup, previewImport, exportCalendar, downloadCalendar, toast: toast,
    _internal: { shiftNext: shiftNext, esc: esc, columnsOf: columnsOf, genericColumns: genericColumns }
  };
})();

