import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { clientIp, jsonError, readJson, setSessionCookie } from '@/server/api-helpers';
import { resetConfigCache } from '@/server/config';
import { forbidden, unauthorized } from '@/server/errors';
import { SESSION_COOKIE } from '@/server/auth/constants';
import { setupEnv } from './helpers';

beforeEach(setupEnv);
afterEach(() => {
  process.env.TRUST_PROXY = 'false';
  resetConfigCache();
});

function request(body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
    ...{ duplex: 'half' },
  });
}

describe('请求体大小限制', () => {
  it('接受恰好 2MB 的 JSON 对象', async () => {
    const note = 'x'.repeat(2 * 1024 * 1024 - Buffer.byteLength('{"note":""}'));
    expect(await readJson(request(JSON.stringify({ note })))).toEqual({ note });
  });

  it('Content-Length 超限时取消读取并返回 413', async () => {
    const req = request('{}', { 'Content-Length': String(2 * 1024 * 1024 + 1) });
    await expect(readJson(req)).rejects.toMatchObject({ status: 413 });
    expect(req.bodyUsed).toBe(true);
  });

  it.each(['', '2'])('不依赖请求头，按实际 UTF-8 字节拒绝超限内容，声明长度=%s', async (length) => {
    const headers: Record<string, string> = length ? { 'Content-Length': length } : {};
    const note = '界'.repeat(700000);
    expect(note.length).toBeLessThan(2 * 1024 * 1024);
    await expect(readJson(request(JSON.stringify({ note }), headers))).rejects.toMatchObject({ status: 413 });
  });

  it('流式读取跨字节的中文，不损坏内容', async () => {
    const bytes = new TextEncoder().encode('{"note":"中文"}');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    expect(await readJson(request(stream))).toEqual({ note: '中文' });
  });

  it('分块累计超限后取消余下数据', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
      cancel() { cancelled = true; },
    });
    await expect(readJson(request(stream))).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });

  it.each(['[]', 'null', '"text"', '{bad'])('拒绝非对象或无效 JSON：%s', async (body) => {
    await expect(readJson(request(body))).rejects.toMatchObject({ status: 400 });
  });
});

describe('代理信任', () => {
  it('默认忽略轮换的 X-Forwarded-For 和 X-Real-IP', () => {
    const keys = ['198.51.100.1', '198.51.100.2'].map((ip) => clientIp(new NextRequest('http://localhost', {
      headers: { 'x-forwarded-for': ip, 'x-real-ip': ip },
    })));
    expect(keys).toEqual(['unknown', 'unknown']);
  });

  it('显式信任代理后取最右侧地址，忽略伪造前缀', () => {
    process.env.TRUST_PROXY = 'true';
    resetConfigCache();
    expect(clientIp(new NextRequest('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.99, 198.51.100.7' },
    }))).toBe('198.51.100.7');
    expect(clientIp(new NextRequest('http://localhost', {
      headers: { 'x-forwarded-for': 'not-an-ip' },
    }))).toBe('unknown');
    expect(clientIp(new NextRequest('http://localhost', {
      headers: { 'x-real-ip': '2001:db8::1' },
    }))).toBe('2001:db8::1');
  });

  it('不因客户端伪造 X-Forwarded-Proto 给 HTTP Cookie 加 Secure', () => {
    const req = new NextRequest('http://localhost', { headers: { 'x-forwarded-proto': 'https' } });
    const res = jsonError(unauthorized());
    setSessionCookie(res, req, 'test-token', 60);
    expect(res.headers.get('set-cookie')).not.toContain('Secure');
  });
});

describe('认证错误响应', () => {
  it('401 响应同时清除无效 Cookie', async () => {
    const req = new NextRequest('http://localhost', { headers: { cookie: SESSION_COOKIE + '=invalid' } });
    const res = jsonError(unauthorized(), req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: '请先登录' });
    expect(res.headers.get('set-cookie')).toContain(SESSION_COOKIE + '=;');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('未激活错误保留前端重发邮件标记', async () => {
    const res = jsonError(forbidden('邮箱尚未验证', 'EMAIL_UNVERIFIED'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: '邮箱尚未验证', needVerify: true });
  });
});
