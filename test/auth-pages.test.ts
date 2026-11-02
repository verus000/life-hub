import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { middleware } from '@/middleware';
import { SESSION_COOKIE } from '@/server/auth/constants';
import type { Db } from '@/server/db';
import { createSession } from '@/server/auth/service';
import { AuthCard } from '@/components/auth/AuthCard';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/register/page';
import HomePage from '@/app/page';
import { GET as me } from '@/app/api/auth/me/route';
import { freshDb, setupEnv } from './helpers';
import { resetConfigCache } from '@/server/config';

const cookie = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => cookie.token === undefined ? undefined : { value: cookie.token } }),
}));

const shared = globalThis as unknown as { __lifeHubDb?: Db };
let db: Db;
beforeEach(async () => {
  setupEnv();
  db = await freshDb();
  shared.__lifeHubDb = db;
  cookie.token = undefined;
});
afterEach(async () => {
  await db.close();
  delete shared.__lifeHubDb;
});

describe('会话页面跳转', () => {
  it('无效 Cookie 不会把登录/注册页跳回首页', async () => {
    cookie.token = 'a'.repeat(64);
    for (const path of ['/login', '/register']) {
      const res = middleware(new NextRequest('http://localhost' + path, {
        headers: { cookie: SESSION_COOKIE + '=' + cookie.token },
      }));
      expect(res.headers.get('location')).toBeNull();
    }
    await expect(HomePage()).rejects.toMatchObject({ digest: expect.stringContaining(';/login;') });
    expect(renderToStaticMarkup(await LoginPage())).toContain('current-password');
    expect(renderToStaticMarkup(await RegisterPage())).toContain('确认密码');
    const res = await me(new NextRequest('http://localhost/api/auth/me', {
      headers: { cookie: SESSION_COOKIE + '=' + cookie.token },
    }));
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('真实有效会话从登录/注册页进入首页，过期后允许重新登录', async () => {
    const now = new Date().toISOString();
    const [user] = await db.insert('users', { email: 'page@example.test', passwordHash: 'unused', emailVerifiedAt: now, createdAt: now, updatedAt: now });
    cookie.token = (await createSession(db, user.id)).token;
    await expect(LoginPage()).rejects.toMatchObject({ digest: expect.stringContaining(';/;') });
    await expect(RegisterPage()).rejects.toMatchObject({ digest: expect.stringContaining(';/;') });
    await db.update('sessions', { expiresAt: '2000-01-01T00:00:00.000Z' }, { userId: user.id });
    expect(renderToStaticMarkup(await LoginPage())).toContain('current-password');
  });

  it('未登录访问首页仍跳登录页', () => {
    expect(new URL(middleware(new NextRequest('http://localhost/')).headers.get('location')!).pathname).toBe('/login');
  });

  it('未登录允许加载登录页装饰，其他静态路径仍受页面闸门保护', () => {
    expect(middleware(new NextRequest('http://localhost/images/mint-orbit.png')).headers.get('location')).toBeNull();
    for (const path of ['/images/private.png', '/images/mint-orbit.png/secret', '/data/life-hub.db']) {
      expect(new URL(middleware(new NextRequest('http://localhost' + path)).headers.get('location')!).pathname).toBe('/login');
    }
  });
});

describe('认证表单', () => {
  it('关闭验证后登录页隐藏重发入口，并告知可直接使用', async () => {
    process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
    resetConfigCache();
    const html = renderToStaticMarkup(await LoginPage());
    expect(html).toContain('无需验证邮箱');
    expect(html).not.toContain('重发验证邮件');
    expect(html).not.toContain('注册后需验证邮箱。');
  });

  it('直接访问注册页显示注册字段', async () => {
    const html = renderToStaticMarkup(await RegisterPage());
    expect(html).toContain('确认密码');
    expect(html).toContain('new-password');
    expect(html).not.toContain('current-password');
  });

  it('重发邮件视图可输入邮箱，无需先填写登录表单', () => {
    const html = renderToStaticMarkup(createElement(AuthCard, { initialView: 'resend' }));
    expect(html).toContain('type="email"');
    expect(html).toContain('发送验证邮件');
    expect(html).not.toContain('type="password"');
  });
});

describe('旧版激活链接', () => {
  it.each([undefined, 'existing-session'])('登录闸门之前兼容旧邮件链接，会话=%s', (token) => {
    const verifyToken = 'b'.repeat(64);
    const req = new NextRequest('http://localhost/?verify=' + verifyToken + '&other=value', {
      headers: token ? { cookie: SESSION_COOKIE + '=' + token } : {},
    });
    const url = new URL(middleware(req).headers.get('location')!);
    expect(url.pathname).toBe('/verify');
    expect(url.searchParams.get('token')).toBe(verifyToken);
    expect(url.searchParams.has('verify')).toBe(false);
    expect(middleware(new NextRequest(url)).headers.get('location')).toBeNull();
  });
});
