import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { login } from '@/server/auth/service';
import { clientIp, jsonError, readJson, setSessionCookie } from '@/server/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const { user, session } = await login(getDb(), body.email, body.password, clientIp(req));
    const res = NextResponse.json({ ok: true, id: user.id, email: user.email });
    setSessionCookie(res, req, session.token, session.maxAgeSeconds);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
