import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getBasePath, normalizeBasePath, withBasePath } from '@/lib/base-path';
import { Api } from '@/lib/api';
import { middleware } from '@/middleware';
import { clearSessionCookie, setSessionCookie } from '@/server/api-helpers';
import { getAppUrl, resetConfigCache } from '@/server/config';
import { sendVerificationMail } from '@/server/auth/mailer';
import { clearMail, outbox, setupEnv } from './helpers';

beforeEach(() => { setupEnv(); clearMail(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetConfigCache(); });

describe('部署基础路径', () => {
  it.each(['', '/', '/life-hub', '/tools/life-hub/'])('支持根路径和多层子路径：%s', (path) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', path);
    const prefix = path.replace(/\/+$/, '');
    expect(getBasePath()).toBe(prefix);
    expect(withBasePath('/api/items')).toBe(prefix + '/api/items');
  });

  it.each(['life-hub', '//example.test', '/a/../b', '/a?x=1', '/a#hash', '/a\\b'])('拒绝无效前缀：%s', (path) => {
    expect(() => normalizeBasePath(path)).toThrow('NEXT_PUBLIC_BASE_PATH');
  });

  it('接口请求和 401 跳转保留前缀', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/life-hub');
    const location = { href: '' };
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: '请先登录' }), { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', { location });
    await expect(Api.list()).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledWith('/life-hub/api/items', expect.anything());
    expect(location.href).toBe('/life-hub/login');
  });

  it('页面闸门保留 NextURL 的 basePath，公开图片与旧验证链接可用', () => {
    const request = (path: string) => new NextRequest('http://localhost/life-hub' + path, {
      nextConfig: { basePath: '/life-hub', trailingSlash: false },
    });
    for (const path of ['', '/']) {
      const url = new URL(middleware(request(path)).headers.get('location')!);
      expect(url.pathname.replace(/\/+$/, '')).toBe('/life-hub/login');
    }
    expect(middleware(request('/login')).headers.get('location')).toBeNull();
    expect(middleware(request('/images/mint-orbit.png')).headers.get('location')).toBeNull();
    const legacy = new URL(middleware(request('/?verify=token')).headers.get('location')!);
    expect(legacy.pathname.replace(/\/+$/, '')).toBe('/life-hub/verify');
    expect(legacy.search).toBe('?token=token');
  });

  it('创建与清除会话使用相同子路径和 Secure 属性', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/life-hub');
    vi.stubEnv('APP_URL', 'https://example.test/life-hub');
    resetConfigCache();
    const req = new NextRequest('https://example.test/life-hub/api/auth/login');
    const created = NextResponse.json({ ok: true });
    setSessionCookie(created, req, 'test-token', 60);
    const cleared = NextResponse.json({ ok: true });
    clearSessionCookie(cleared, req);
    for (const res of [created, cleared]) {
      expect(res.headers.get('set-cookie')).toContain('Path=/life-hub;');
      expect(res.headers.get('set-cookie')).toContain('Secure');
    }
    expect(cleared.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('激活链接使用完整 APP_URL，默认地址也包含前缀', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/life-hub');
    vi.stubEnv('APP_URL', 'https://example.test/life-hub/');
    resetConfigCache();
    await sendVerificationMail('base@example.test', 'a'.repeat(64));
    expect(outbox().at(-1)?.url).toBe('https://example.test/life-hub/verify?token=' + 'a'.repeat(64));
    vi.stubEnv('APP_URL', '');
    resetConfigCache();
    expect(getAppUrl()).toBe('http://127.0.0.1:3000/life-hub');
  });
});
