/* 数据访问：后端、本浏览器与内存模式。连接失败不会静默切换数据源。 */
window.Store = (function () {
  const KEY = 'life_hub_items_v1';
  const SEEN = 'life_hub_backend_seen_v1';
  let mode = 'local', dbInfo = null, memory = [], memoryMode = false, lastError = '';

  async function fetchTimed(path, options) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try { return await fetch(path, Object.assign({}, options, controller ? { signal: controller.signal } : {})); }
    finally { if (timer !== null) clearTimeout(timer); }
  }
  function notifyUnauthorized() {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('lifehub:unauthorized'));
      }
    } catch (e) { /* 事件派发失败不影响原错误 */ }
  }
  async function callApi(path, options) {
    try {
      const res = await fetchTimed('api/' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch (_) { throw new Error('服务响应格式不正确，请重试'); }
      if (!res.ok) {
        if (res.status === 401) notifyUnauthorized();
        throw new Error((data && data.error) || '请求失败（' + res.status + '）');
      }
      lastError = '';
      return data;
    } catch (e) {
      lastError = e.name === 'AbortError' ? '服务请求超时，请重试' : e.name === 'TypeError' ? '无法连接服务，请重试' : (e.message || '无法连接服务');
      throw new Error(lastError);
    }
  }
  async function detect() {
    if (typeof fetch !== 'function') return null;
    try {
      const res = await fetchTimed('api/health', { cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json();
      return j && j.ok && j.database ? j.database : null;
    } catch (_) { return null; }
  }
  function remember() {
    try { localStorage.setItem(SEEN, '1'); } catch (_) { /* 内存模式仍可连接后端 */ }
  }
  function seenBackend() {
    try { return localStorage.getItem(SEEN) === '1'; } catch (_) { return false; }
  }
  function canPersist() {
    try { localStorage.setItem('__probe__', '1'); localStorage.removeItem('__probe__'); return true; }
    catch (_) { return false; }
  }
  function read() {
    if (memoryMode) return Records.clone(memory);
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) throw new Error('不是数组');
      return arr;
    } catch (_) { throw new Error('浏览器数据读取失败，请保留浏览器存储并检查备份'); }
  }
  function write(list) {
    if (memoryMode) { memory = Records.clone(list); return false; }
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (_) { memoryMode = true; memory = Records.clone(list); return false; }
  }
  function nextId(list) { return list.reduce((max, x) => Math.max(max, Number(x.id) || 0), 0) + 1; }
  function newKey() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function normalize(x) {
    return {
      id: x.id, category: x.category || 'phone', title: x.title || '', provider: x.provider || '',
      amount: x.amount === '' || x.amount === null || x.amount === undefined ? null : Number(x.amount),
      currency: x.currency || 'CNY', cycle: Records.knownCode(x.cycle, Records.CYCLES), startDate: x.startDate || '', nextDate: x.nextDate || '',
      status: Records.knownCode(x.status, Records.STATUSES) || 'active', detail: Records.normalizeDetail(x.detail), note: x.note || '',
      createdAt: x.createdAt || '', updatedAt: x.updatedAt || ''
    };
  }
  function prepare(item, id) {
    const row = normalize(Object.assign({}, Records.validate(item), { id }));
    const now = new Date().toISOString();
    row.createdAt = row.createdAt || now; row.updatedAt = row.updatedAt || now;
    row.detail.recordKey = row.detail.recordKey || newKey();
    return row;
  }
  function ensureConnected() {
    if (mode === 'offline') throw new Error('服务未连接，请先重试连接；数据源未切换');
  }

  const store = {
    mode: () => mode, dbInfo: () => dbInfo, isMemoryMode: () => memoryMode, error: () => lastError,
    async init() {
      dbInfo = await detect();
      if (dbInfo) { mode = 'api'; lastError = ''; remember(); }
      else if (seenBackend()) { mode = 'offline'; lastError = '暂时无法连接数据库，请重试连接'; }
      else {
        mode = 'local';
        if (!memoryMode && !canPersist()) {
          try { memory = read(); }
          catch (e) {
            if (e.message.includes('数据读取失败')) throw e;
            memory = [];
          }
          memoryMode = true;
        }
      }
      return { mode, memoryMode, database: dbInfo };
    },
    async reconnect() {
      const local = mode === 'local' ? read() : [];
      const info = await detect();
      if (!info) throw new Error('暂时无法连接服务，请确认服务已启动后重试');
      let result = { created: 0, skipped: 0 };
      if (local.length) result = await callApi('items/import', { method: 'POST', body: JSON.stringify({ items: local }) });
      dbInfo = info; mode = 'api'; lastError = ''; remember();
      return result;
    },
    async list() {
      ensureConnected();
      if (mode === 'api') return (await callApi('items')).map(normalize);
      return read().map(normalize);
    },
    async add(item) {
      ensureConnected();
      const input = Records.validate(item);
      if (mode === 'api') return { data: normalize(await callApi('items', { method: 'POST', body: JSON.stringify(input) })), persisted: true };
      const list = read(), row = prepare(input, nextId(list));
      list.push(row);
      return { data: row, persisted: write(list) };
    },
    async addMany(items) {
      ensureConnected();
      const incoming = items.map(x => Records.validate(x));
      if (mode === 'api') {
        const res = await callApi('items/import', { method: 'POST', body: JSON.stringify({ items: incoming }) });
        return { data: incoming, created: res.created, skipped: res.skipped || 0, persisted: true };
      }
      const list = read(), batch = Records.partition(incoming, list);
      const created = batch.items.map(it => { const row = prepare(it, nextId(list)); list.push(row); return row; });
      return { data: created, created: created.length, skipped: batch.skipped, persisted: created.length ? write(list) : !memoryMode };
    },
    async update(id, patch, expectedUpdatedAt) {
      ensureConnected();
      const input = Records.validate(patch, true);
      if (mode === 'api') return { data: normalize(await callApi('items/' + id, { method: 'PUT', body: JSON.stringify(Object.assign({}, input, { expectedUpdatedAt })) })), persisted: true };
      const list = read(), i = list.findIndex(x => String(x.id) === String(id));
      if (i < 0) throw new Error('记录不存在，请刷新后重试');
      if (expectedUpdatedAt !== undefined && list[i].updatedAt !== expectedUpdatedAt) throw new Error('记录已在其他页面变更，请刷新后重试');
      const stamp = Math.max(Date.now(), (Date.parse(list[i].updatedAt) || 0) + 1);
      const row = normalize(Object.assign({}, list[i], input, { id: list[i].id, updatedAt: new Date(stamp).toISOString() }));
      list[i] = row;
      return { data: row, persisted: write(list) };
    },
    async remove(id) {
      ensureConnected();
      if (mode === 'api') return { data: normalize(await callApi('items/' + id, { method: 'DELETE' })), persisted: true };
      const list = read(), i = list.findIndex(x => String(x.id) === String(id));
      if (i < 0) throw new Error('记录不存在，请刷新后重试');
      const gone = list.splice(i, 1)[0];
      return { data: gone, persisted: write(list) };
    },
    async clear() {
      ensureConnected();
      if (mode === 'api') { await callApi('items', { method: 'DELETE' }); return { persisted: true }; }
      return { persisted: write([]) };
    },
    toCSV(rows, columns) {
      const esc = v => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      return columns.map(c => esc(c.label)).join(',') + '\r\n' + rows.map(r => columns.map(c => esc(c.get(r))).join(',')).join('\r\n');
    },
    parseCSV: Records.parseCSV
  };
  return store;
})();
