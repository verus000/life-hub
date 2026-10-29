/* Route Handler 公共助手：统一错误映射、会话 Cookie、客户端 IP */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from './db';
import { AppError } from './errors';
import { getSessionUser } from './auth/service';
import { SESSION_COOKIE } from './auth/constants';
import type { PublicUser } from './auth/service';
import { getAppUrl } from './config';

export function jsonError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error('[未处理错误]', e);
  return NextResponse.json({ error: '服务内部错误，请稍后重试' }, { status: 500 });
}

function cookieSecure(req: NextRequest): boolean {
  if (req.headers.get('x-forwarded-proto') === 'https') return true;
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
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new AppError(400, '请求需要 Content-Type: application/json');
  }
  try {
    const data = await req.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError(400, '请求体必须是 JSON 对象');
    }
    return data as Record<string, unknown>;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, '请求体不是有效的 JSON');
  }
}
