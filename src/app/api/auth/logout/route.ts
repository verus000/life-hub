import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { deleteSession } from '@/server/auth/service';
import { clearSessionCookie, jsonError, sessionToken } from '@/server/api-helpers';

export async function POST(req: NextRequest) {
  try {
    await deleteSession(getDb(), sessionToken(req));
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res, req);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
