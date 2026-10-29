/* 客户端 API 封装：统一错误映射、401 跳转登录、CSV 与下载 */

import { csvColumns } from './records';
import type { Item, ItemInput } from './types';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/' + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiError('无法连接服务，请检查网络后重试', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* 非 JSON 响应按错误处理 */
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: string }).error)
        : '请求失败（' + res.status + '）';
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const Api = {
  me: () => api<{ id: number; email: string; createdAt: string }>('auth/me'),
  logout: () => api<{ ok: boolean }>('auth/logout', { method: 'POST' }),
  list: () => api<Item[]>('items'),
  add: (item: ItemInput) => api<Item>('items', { method: 'POST', body: JSON.stringify(item) }),
  update: (id: number, patch: ItemInput, expectedUpdatedAt?: string) =>
    api<Item>('items/' + id, { method: 'PUT', body: JSON.stringify({ ...patch, expectedUpdatedAt }) }),
  remove: (id: number) => api<Item>('items/' + id, { method: 'DELETE' }),
  importItems: (items: ItemInput[]) =>
    api<{ created: number; skipped: number }>('items/import', { method: 'POST', body: JSON.stringify({ items }) }),
  clear: () => api<{ ok: boolean }>('items', { method: 'DELETE' }),
};

export function toCSV(rows: Item[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const columns = csvColumns();
  return (
    columns.map((c) => esc(c.label)).join(',') +
    '\r\n' +
    rows.map((r) => columns.map((c) => esc(c.get(r))).join(',')).join('\r\n')
  );
}

export function downloadFile(text: string, name: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
