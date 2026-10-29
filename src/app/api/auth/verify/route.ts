import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { verify } from '@/server/auth/service';
import { jsonError, setSessionCookie } from '@/server/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    const result = await verify(getDb(), token);
    const res = NextResponse.json({ ok: true, email: result.email, claimed: result.claimed });
    setSessionCookie(res, req, result.session.token, result.session.maxAgeSeconds);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
