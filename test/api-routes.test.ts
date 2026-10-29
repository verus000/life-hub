import { afterEach, beforeEach, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createDbAt, type Db } from '@/server/db';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { GET as verify } from '@/app/api/auth/verify/route';
import { GET as me } from '@/app/api/auth/me/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as list, POST as add } from '@/app/api/items/route';
import { POST as importItems } from '@/app/api/items/import/route';
import { clearMail, setupEnv, verifyTokenFromOutbox } from './helpers';

const shared = globalThis as unknown as { __lifeHubDb?: Db };
let db: Db;
beforeEach(() => {
  setupEnv();
  process.env.BCRYPT_ROUNDS = '4';
  clearMail();
  db = createDbAt(':memory:');
  shared.__lifeHubDb = db;
});
afterEach(() => {
  db.$client.close();
  delete shared.__lifeHubDb;
});

function request(path: string, body?: object, cookie = '', extra: Record<string, string> = {}) {
  return new NextRequest('http://localhost' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

it('Route Handler 往返注册、激活、登录、鉴权导入和登出', async () => {
  const credentials = { email: 'routes@example.test', password: 'test-password-123' };
  expect((await register(request('/api/auth/register', credentials))).status).toBe(201);
  const unverified = await login(request('/api/auth/login', credentials));
  expect(unverified.status).toBe(403);
  expect(await unverified.json()).toMatchObject({ needVerify: true });

  const activated = await verify(request('/api/auth/verify?token=' + verifyTokenFromOutbox()));
  expect(activated.status).toBe(200);
  expect(activated.headers.get('set-cookie')).toContain('HttpOnly');
  const loggedIn = await login(request('/api/auth/login', credentials));
  expect(loggedIn.status).toBe(200);
  const cookie = loggedIn.headers.get('set-cookie')!.split(';')[0];
  expect((await me(request('/api/auth/me', undefined, cookie))).status).toBe(200);
  expect((await list(request('/api/items'))).status).toBe(401);

  const added = await add(request('/api/items', { title: '空金额账户', category: 'asset', amount: null }, cookie));
  expect(added.status).toBe(201);
  expect(await added.json()).toMatchObject({ amount: null });
  const batch = Array.from({ length: 2500 }, (_, i) => ({ category: 'asset', title: '接口导入-' + i }));
  const imported = await importItems(request('/api/items/import', { items: batch }, cookie));
  expect(imported.status).toBe(201);
  expect(await imported.json()).toEqual({ created: 2500, skipped: 0 });
  expect((await (await list(request('/api/items', undefined, cookie))).json()).length).toBe(2501);

  const oversized = await add(request('/api/items', { title: '超限', note: 'x'.repeat(2 * 1024 * 1024) }, cookie));
  expect(oversized.status).toBe(413);
  expect(await oversized.json()).toEqual({ error: '请求体过大（上限 2MB）' });
  const loggedOut = await logout(request('/api/auth/logout', {}, cookie));
  expect(loggedOut.status).toBe(200);
  expect(loggedOut.headers.get('set-cookie')).toContain('Max-Age=0');
  const stale = await me(request('/api/auth/me', undefined, cookie));
  expect(stale.status).toBe(401);
  expect(stale.headers.get('set-cookie')).toContain('Max-Age=0');
});

it('直连时不断伪造不同代理头仍触发同一个登录限流桶', async () => {
  const statuses: number[] = [];
  for (let n = 0; n < 22; n++) {
    const res = await login(request('/api/auth/login', { email: 'missing@example.test', password: 'wrong-password' }, '', {
      'x-forwarded-for': '198.51.100.' + (n + 1),
      'x-real-ip': '203.0.113.' + (n + 1),
    }));
    statuses.push(res.status);
  }
  expect(statuses[0]).toBe(401);
  expect(statuses.at(-1)).toBe(429);
});
