'use strict';

const { randomUUID } = require('crypto');
const Records = require('../../public/assets/js/records');

/* 数据库行（snake_case）与应用对象（camelCase）之间的映射 */

const COLUMNS = ['id', 'user_id', 'category', 'title', 'provider', 'amount', 'currency',
  'cycle', 'start_date', 'next_date', 'status', 'detail', 'note', 'created_at', 'updated_at'];

const WRITE_COLUMNS = COLUMNS.filter(c => c !== 'id');

function parseDetail(v) {
  if (v === null || v === undefined || v === '') return {};
  if (typeof v === 'object') return v;
  try { const o = JSON.parse(v); return (o && typeof o === 'object') ? o : {}; }
  catch (e) { return {}; }
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

let lastTimestamp = 0;
function nowISO() {
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
  return new Date(lastTimestamp).toISOString();
}

/* 应用对象 → 数据库行（新增时用） */
function toRow(input) {
  const ts = nowISO();
  const detail = Object.assign({}, (input.detail && typeof input.detail === 'object') ? input.detail : {});
  if (!detail.recordKey) detail.recordKey = randomUUID();
  return {
    category: input.category || 'phone',
    title: input.title || '',
    provider: input.provider || '',
    amount: toNumber(input.amount),
    currency: input.currency || 'CNY',
    cycle: input.cycle || '',
    start_date: input.startDate || '',
    next_date: input.nextDate || '',
    status: input.status || 'active',
    detail: JSON.stringify(detail),
    note: input.note || '',
    created_at: input.createdAt || ts,
    updated_at: input.updatedAt || ts
  };
}

/* 部分更新：只覆盖传入字段 */
function toPatch(input) {
  const row = {};
  const map = {
    category: 'category', title: 'title', provider: 'provider', currency: 'currency',
    cycle: 'cycle', status: 'status', note: 'note'
  };
  Object.keys(map).forEach(k => {
    if (input[k] !== undefined) row[map[k]] = input[k];
  });
  if (input.startDate !== undefined) row.start_date = input.startDate || '';
  if (input.nextDate !== undefined) row.next_date = input.nextDate || '';
  if (input.amount !== undefined) row.amount = toNumber(input.amount);
  if (input.detail !== undefined) {
    row.detail = JSON.stringify((input.detail && typeof input.detail === 'object') ? input.detail : {});
  }
  row.updated_at = nowISO();
  return row;
}

/* 数据库行 → 应用对象 */
function toItem(row) {
  return {
    id: Number(row.id),
    userId: (row.user_id === null || row.user_id === undefined) ? null : Number(row.user_id),
    category: row.category || 'phone',
    title: row.title || '',
    provider: row.provider || '',
    amount: toNumber(row.amount),
    currency: row.currency || 'CNY',
    cycle: Records.knownCode(row.cycle, Records.CYCLES),
    startDate: row.start_date || '',
    nextDate: row.next_date || '',
    status: Records.knownCode(row.status, Records.STATUSES) || 'active',
    detail: Records.normalizeDetail(parseDetail(row.detail)),
    note: row.note || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

/* 用户 / 会话行 → 应用对象（认证存储共用） */
function toUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email || '',
    passwordHash: row.password_hash || '',
    emailVerifiedAt: row.email_verified_at || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function toSession(row) {
  if (!row) return null;
  return {
    tokenHash: row.token_hash || '',
    userId: Number(row.user_id),
    expiresAt: row.expires_at || '',
    createdAt: row.created_at || ''
  };
}

module.exports = { COLUMNS, WRITE_COLUMNS, toRow, toPatch, toItem, toUser, toSession, toNumber, nowISO };
