/* 前后端共用的数据校验、备份和去重；不依赖 DOM 或数据库。 */
(function (factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else window.Records = factory();
})(function () {
  'use strict';

  const CATEGORIES = { phone: '手机号', broadband: '宽带', parking: '停车费', asset: '资产分布' };
  const CYCLES = { weekly: '每周', monthly: '每月', quarterly: '每季', semiannual: '每半年', yearly: '每年', once: '一次性' };
  const STATUSES = { active: '在用', paused: '已暂停', archived: '已归档', completed: '已完成' };
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clone = v => JSON.parse(JSON.stringify(v));

  function knownCode(value, options) {
    return Object.keys(options).find(k => k === value || options[k] === value) || value || '';
  }
  function normalizeDetail(value) {
    const detail = clone(value || {});
    if (detail.reminderCycle) detail.reminderCycle = knownCode(detail.reminderCycle, CYCLES);
    if (detail.autoRenew) detail.autoRenew = knownCode(detail.autoRenew, { yes: '是', no: '否' });
    return detail;
  }

  function code(value, options, label) {
    const s = String(value || '').trim();
    if (!s) return '';
    const key = Object.keys(options).find(k => k === s || options[k] === s);
    if (!key) throw new Error(label + '无效：' + s);
    return key;
  }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T12:00:00');
    return !isNaN(d.getTime()) && d.getFullYear() === Number(s.slice(0, 4)) &&
      d.getMonth() + 1 === Number(s.slice(5, 7)) && d.getDate() === Number(s.slice(8));
  }
  function checkObject(o, depth) {
    if (depth > 20) throw new Error('扩展信息层级过深');
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(k => {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('扩展信息包含非法字段');
      checkObject(o[k], depth + 1);
    });
  }
  function validate(input, patch) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('条目必须是对象');
    const out = {};
    const strings = ['title', 'provider', 'note', 'startDate', 'nextDate', 'createdAt', 'updatedAt'];
    strings.forEach(k => {
      if (!own(input, k)) return;
      if (input[k] !== null && typeof input[k] !== 'string') throw new Error(k + ' 必须是文本');
      out[k] = input[k] || '';
    });
    if (own(out, 'title')) out.title = out.title.trim();
    if ((!patch || own(input, 'title')) && !out.title) throw new Error('缺少必填字段 title');
    ['category', 'cycle', 'status'].forEach(k => {
      if (!own(input, k) && patch) return;
      const maps = { category: CATEGORIES, cycle: CYCLES, status: STATUSES };
      out[k] = code(input[k], maps[k], k) || ({ category: 'phone', cycle: '', status: 'active' })[k];
    });
    if (own(input, 'currency') || !patch) {
      out.currency = String(input.currency || 'CNY').trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(out.currency)) throw new Error('币种须为三位字母代码');
    }
    if (own(input, 'amount') || !patch) {
      const v = input.amount;
      if (v !== '' && v !== null && v !== undefined && !['number', 'string'].includes(typeof v)) throw new Error('金额必须是数字');
      out.amount = v === '' || v === null || v === undefined ? null : Number(v);
      if (out.amount !== null && !Number.isFinite(out.amount)) throw new Error('金额必须是有限数字');
    }
    ['startDate', 'nextDate'].forEach(k => {
      if (out[k] && !validDate(out[k])) throw new Error(k + ' 日期无效，请使用 YYYY-MM-DD');
    });
    if (own(input, 'detail') || !patch) {
      const detail = input.detail === undefined ? {} : input.detail;
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new Error('扩展信息必须是对象');
      checkObject(detail, 0);
      out.detail = clone(detail);
      if (out.detail.reminderCycle) out.detail.reminderCycle = code(out.detail.reminderCycle, CYCLES, '提醒周期');
      if (out.detail.contractDate && !validDate(out.detail.contractDate)) throw new Error('合约到期日无效');
      if (out.detail.reminderAnchor !== undefined && (!Number.isInteger(out.detail.reminderAnchor) || out.detail.reminderAnchor < 1 || out.detail.reminderAnchor > 31)) throw new Error('提醒日期锚点无效');
      if (own(out.detail, 'autoRenew') && out.detail.autoRenew !== '') {
        out.detail.autoRenew = code(out.detail.autoRenew, { yes: '是', no: '否' }, '自动续费');
      }
      if (out.detail.history !== undefined && !Array.isArray(out.detail.history)) throw new Error('处理记录必须是数组');
      if (out.detail.recordKey !== undefined && (typeof out.detail.recordKey !== 'string' || out.detail.recordKey.length > 200)) throw new Error('记录标识无效');
    }
    return out;
  }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  function fingerprint(item) {
    const x = validate(item);
    delete x.createdAt; delete x.updatedAt; delete x.detail.recordKey;
    ['provider', 'note', 'startDate', 'nextDate'].forEach(k => { x[k] = x[k] || ''; });
    return stable(x);
  }
  function partition(incoming, existing) {
    const keys = new Set(), all = new Set(), legacy = new Set();
    function remember(x) {
      const fp = fingerprint(x), key = x.detail && x.detail.recordKey;
      all.add(fp);
      if (key) keys.add(key); else legacy.add(fp);
    }
    existing.forEach(remember);
    const items = []; let skipped = 0;
    incoming.forEach(x => {
      const fp = fingerprint(x), key = x.detail && x.detail.recordKey;
      if ((key && keys.has(key)) || (key ? legacy.has(fp) : all.has(fp))) { skipped++; return; }
      items.push(x); remember(x);
    });
    return { items, skipped };
  }
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', quoted = false;
    const src = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
        else cur += ch;
      } else if (ch === '"' && cur === '') quoted = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (quoted) throw new Error('CSV 引号未闭合，请检查文件');
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }
  const ALIASES = {
    '名称': 'title', '手机号': 'title', '宽带名称': 'title', '车牌号': 'title', '账户名称': 'title',
    '机构': 'provider', '运营商': 'provider', '停车场 / 物业': 'provider',
    '金额': 'amount', '月租金额': 'amount', '每期费用': 'amount', '当前余额': 'amount', '币种': 'currency',
    '周期': 'cycle', '缴费周期': 'cycle', '状态': 'status', '备注': 'note',
    '开通日期': 'startDate', '激活日期': 'startDate', '起租日期': 'startDate',
    '下次到期日': 'nextDate', '下次保活日期': 'nextDate', '下次续费日期': 'nextDate', '到期日期': 'nextDate', '复核日期': 'nextDate',
    '归属国家': 'detail.country', '保活策略': 'detail.strategy', '保活周期': 'detail.reminderCycle', '复核周期': 'detail.reminderCycle',
    '带宽': 'detail.speed', '装机地址': 'detail.address', '宽带账号': 'detail.accountNo', '自动续费': 'detail.autoRenew',
    '合约到期日': 'detail.contractDate', '车位号': 'detail.slot', '卡类型': 'detail.cardType', '缴费渠道': 'detail.channel',
    '资产类型': 'detail.assetType', '创建时间': 'createdAt', '更新时间': 'updatedAt', '记录标识': 'detail.recordKey'
  };
  function parseImport(text, fallback) {
    const src = String(text).replace(/^\uFEFF/, '').trim();
    if (!src) throw new Error('文件内容为空');
    let raw, start = 1;
    if (src[0] === '{' || src[0] === '[') {
      let backup;
      try { backup = JSON.parse(src); } catch (_) { throw new Error('JSON 文件格式不正确'); }
      if (!backup || (!Array.isArray(backup) && (backup.format !== 'life-hub-backup' || backup.version !== 1))) throw new Error('不支持的备份格式或版本');
      raw = Array.isArray(backup) ? backup : backup.items;
      if (!Array.isArray(raw)) throw new Error('备份缺少条目数组');
    } else {
      const rows = parseCSV(src), head = (rows.shift() || []).map(h => h.trim());
      if (new Set(head).size !== head.length) throw new Error('CSV 表头不能重复');
      if (!head.some(h => ALIASES[h] === 'title')) throw new Error('未识别到名称或手机号等必需表头');
      const guessed = head.includes('手机号') ? 'phone' : head.includes('宽带名称') ? 'broadband' :
        head.includes('车牌号') ? 'parking' : head.includes('账户名称') ? 'asset' : (fallback || 'phone');
      raw = rows.map((cells, index) => {
        const item = { category: guessed, detail: {} };
        try {
          if (cells.length > head.length) throw new Error('列数多于表头，请检查引号');
          const detailIndex = head.indexOf('扩展信息');
          if (detailIndex >= 0 && cells[detailIndex]) item.detail = JSON.parse(cells[detailIndex]);
          head.forEach((h, ci) => {
            const val = cells[ci] === undefined ? '' : cells[ci];
            if (h === '分类') { item.category = code(val, CATEGORIES, '分类') || guessed; return; }
            let key = ALIASES[h];
            if (h === '合约到期日' && !head.includes('下次续费日期') && !head.includes('下次到期日')) key = 'nextDate';
            if (!key || (key === 'detail.recordKey' && !val)) return;
            if (key.startsWith('detail.')) item.detail[key.slice(7)] = val;
            else item[key] = val;
          });
          return item;
        } catch (e) { return { _importError: '第 ' + (index + 2) + ' 行：' + e.message }; }
      });
      start = 2;
    }
    const items = [], errors = [];
    raw.forEach((row, i) => {
      try { if (row && row._importError) throw new Error(row._importError); items.push(validate(row)); }
      catch (e) { errors.push(e.message.startsWith('第 ') ? e.message : '第 ' + (i + start) + ' 行：' + e.message); }
    });
    return { items, errors, total: raw.length };
  }
  function backup(items) {
    return JSON.stringify({ format: 'life-hub-backup', version: 1, exportedAt: new Date().toISOString(), items }, null, 2);
  }
  function csvColumns() {
    return [
      ['分类', r => CATEGORIES[r.category]], ['名称', r => r.title], ['机构', r => r.provider], ['金额', r => r.amount],
      ['币种', r => r.currency || 'CNY'], ['周期', r => CYCLES[r.cycle] || r.cycle || ''],
      ['开通日期', r => r.startDate], ['下次到期日', r => r.nextDate], ['状态', r => STATUSES[r.status || 'active']],
      ['备注', r => r.note], ['扩展信息', r => JSON.stringify(r.detail || {})],
      ['创建时间', r => r.createdAt], ['更新时间', r => r.updatedAt]
    ].map(c => ({ label: c[0], get: c[1] }));
  }
  return { CATEGORIES, CYCLES, STATUSES, clone, code, knownCode, normalizeDetail, validDate, validate, fingerprint, partition, parseCSV, parseImport, backup, csvColumns };
});
