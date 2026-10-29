'use strict';

const fs = require('fs');
const path = require('path');
const N = require('./normalize');

/* JSON 文件存储：零依赖，适合个人小规模数据。
   文件格式为 { format, items, users, sessions, verifications }；
   旧版纯数组文件载入时自动按 items 迁移，首次保存后升级为新格式。 */

function blank(items) {
  return {
    format: 'life-hub-store',
    items: Array.isArray(items) ? items : [],
    users: [], sessions: [], verifications: []
  };
}

module.exports = function (opts) {
  const file = opts && opts.file;
  if (!file) throw new Error('json 适配器缺少 file 配置');
  let data = blank();

  function load() {
    if (!fs.existsSync(file)) return blank();
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed)) return blank(parsed); /* 旧格式：仅 items */
      return {
        format: 'life-hub-store',
        items: Array.isArray(parsed.items) ? parsed.items : [],
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        verifications: Array.isArray(parsed.verifications) ? parsed.verifications : []
      };
    } catch (e) {
      try { fs.copyFileSync(file, file + '.corrupt.' + Date.now()); } catch (_) { /* 忽略备份失败 */ }
      return blank();
    }
  }

  function save() {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  function nextId(rows) {
    let max = 0;
    rows.forEach(r => { const n = Number(r.id); if (n > max) max = n; });
    return max + 1;
  }

  function getById(id, userId) {
    const r = data.items.filter(x => Number(x.id) === Number(id) && Number(x.user_id) === Number(userId))[0];
    return r ? N.toItem(r) : null;
  }

  function userRowById(id) {
    return data.users.filter(x => Number(x.id) === Number(id))[0] || null;
  }

  return {
    type: 'json',
    async init() { data = load(); if (!fs.existsSync(file)) save(); },

    async list(userId) {
      return data.items
        .filter(x => Number(x.user_id) === Number(userId))
        .map(N.toItem).sort((a, b) => a.id - b.id);
    },
    async add(item, userId) {
      const row = Object.assign({ id: nextId(data.items), user_id: userId === undefined || userId === null ? null : Number(userId) }, N.toRow(item));
      data.items.push(row); save();
      return N.toItem(row);
    },
    async update(id, patch, userId) {
      const row = data.items.filter(x => Number(x.id) === Number(id) && Number(x.user_id) === Number(userId))[0];
      if (!row) return null;
      Object.assign(row, N.toPatch(patch));
      save();
      return N.toItem(row);
    },
    async remove(id, userId) {
      const i = data.items.findIndex(x => Number(x.id) === Number(id) && Number(x.user_id) === Number(userId));
      if (i < 0) return null;
      const gone = N.toItem(data.items[i]);
      data.items.splice(i, 1); save();
      return gone;
    },
    async addMany(items, userId) {
      const created = items.map(it => {
        const row = Object.assign({ id: nextId(data.items), user_id: userId === undefined || userId === null ? null : Number(userId) }, N.toRow(it));
        data.items.push(row);
        return N.toItem(row);
      });
      save();
      return created;
    },
    async clear(userId) {
      data.items = data.items.filter(x => Number(x.user_id) !== Number(userId));
      save();
    },

    async createUser(u) {
      const ts = N.nowISO();
      const row = { id: nextId(data.users), email: String(u.email), password_hash: String(u.passwordHash), email_verified_at: null, created_at: ts, updated_at: ts };
      data.users.push(row); save();
      return N.toUser(row);
    },
    async findUserByEmail(email) {
      return N.toUser(data.users.filter(x => x.email === String(email))[0] || null);
    },
    async findUserById(id) { return N.toUser(userRowById(id)); },
    async verifyUser(id) {
      const row = userRowById(id);
      if (!row) return;
      const ts = N.nowISO();
      row.email_verified_at = ts; row.updated_at = ts; save();
    },
    async countVerifiedUsers() {
      return data.users.filter(x => x.email_verified_at).length;
    },

    async insertSession(s) {
      data.sessions.push({ token_hash: s.tokenHash, user_id: Number(s.userId), expires_at: s.expiresAt, created_at: s.createdAt || N.nowISO() });
      save();
    },
    async findSession(tokenHash) {
      return N.toSession(data.sessions.filter(x => x.token_hash === tokenHash)[0] || null);
    },
    async touchSession(tokenHash, expiresAt) {
      const row = data.sessions.filter(x => x.token_hash === tokenHash)[0];
      if (row) { row.expires_at = expiresAt; save(); }
    },
    async deleteSession(tokenHash) {
      const before = data.sessions.length;
      data.sessions = data.sessions.filter(x => x.token_hash !== tokenHash);
      if (data.sessions.length !== before) save();
    },

    async insertVerification(v) {
      data.verifications.push({ token_hash: v.tokenHash, user_id: Number(v.userId), expires_at: v.expiresAt, created_at: v.createdAt || N.nowISO() });
      save();
    },
    async findVerification(tokenHash) {
      return N.toSession(data.verifications.filter(x => x.token_hash === tokenHash)[0] || null);
    },
    async deleteVerification(tokenHash) {
      const before = data.verifications.length;
      data.verifications = data.verifications.filter(x => x.token_hash !== tokenHash);
      if (data.verifications.length !== before) save();
    },
    async deleteVerificationsOfUser(userId) {
      const before = data.verifications.length;
      data.verifications = data.verifications.filter(x => Number(x.user_id) !== Number(userId));
      if (data.verifications.length !== before) save();
    },

    async claimLegacyItems(userId) {
      let claimed = 0;
      data.items.forEach(row => {
        if (row.user_id === null || row.user_id === undefined) { row.user_id = Number(userId); claimed++; }
      });
      if (claimed) save();
      return claimed;
    },

    async close() { /* 无连接需关闭 */ },
    describe() { return { type: 'json', file: file }; }
  };
};
