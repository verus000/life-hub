/* Route Handler 公共助手：统一错误映射、会话 Cookie、客户端 IP */

import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { getDb } from './db';
import { AppError } from './errors';
import { getSessionUser } from './auth/service';
import { SESSION_COOKIE } from './auth/constants';
import type { PublicUser } from './auth/service';
import { getAppUrl, loadConfig } from './config';

export function jsonError(e: unknown, req?: NextRequest): NextResponse {
  if (e instanceof AppError) {
    const res = NextResponse.json(
      { error: e.message, ...(e.code === 'EMAIL_UNVERIFIED' ? { needVerify: true } : {}) },
      { status: e.status },
    );
    if (e.status === 401 && req?.cookies.has(SESSION_COOKIE)) clearSessionCookie(res, req);
    return res;
  }
  console.error('[未处理错误]', e);
  return NextResponse.json({ error: '服务内部错误，请稍后重试' }, { status: 500 });
}

function cookieSecure(req: NextRequest): boolean {
  if (loadConfig().TRUST_PROXY && req.headers.get('x-forwarded-proto')?.split(',').at(-1)?.trim() === 'https') return true;
  return /^https:/i.test(getAppUrl());
}

export function setSessionCookie(res: NextResponse, req: NextRequest, token: string, maxAgeSeconds: number): void {
  const parts = [
    SESSION_COOKIE + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + maxAgeSeconds,
  ];
  if (cookieSecure(req)) parts.push('Secure');
  res.headers.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: NextResponse, req: NextRequest): void {
  const parts = [SESSION_COOKIE + '=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (cookieSecure(req)) parts.push('Secure');
  res.headers.append('Set-Cookie', parts.join('; '));
}

export function sessionToken(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export async function requireUser(req: NextRequest): Promise<PublicUser> {
  const user = await getSessionUser(getDb(), sessionToken(req));
  if (!user) throw new AppError(401, '请先登录');
  return user;
}

export function clientIp(req: NextRequest): string {
  /* NextRequest 不提供 socket 地址；直连模式共用限流桶，不接受客户端自报身份。
     仅在可信代理覆盖/追加来源地址、且应用端口不可直连时开启 TRUST_PROXY。 */
  if (!loadConfig().TRUST_PROXY) return 'unknown';
  const raw = req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
    || req.headers.get('x-real-ip')?.trim() || '';
  return isIP(raw) ? raw : 'unknown';
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new AppError(400, '请求需要 Content-Type: application/json');
  }
  const tooLarge = () => new AppError(413, '请求体过大（上限 2MB）');
  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) {
    await req.body?.cancel();
    throw tooLarge();
  }
  try {
    const reader = req.body?.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY_BYTES) {
            await reader.cancel();
            throw tooLarge();
          }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError(400, '请求体必须是 JSON 对象');
    }
    return data as Record<string, unknown>;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, '请求体不是有效的 JSON');
  }
}
