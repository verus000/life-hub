import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { resend } from '@/server/auth/service';
import { clientIp, jsonError, readJson } from '@/server/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const result = await resend(getDb(), body.email, clientIp(req));
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    return jsonError(e);
  }
}
