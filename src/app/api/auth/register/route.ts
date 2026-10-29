import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { register } from '@/server/auth/service';
import { clientIp, jsonError, readJson } from '@/server/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const result = await register(getDb(), body.email, body.password, clientIp(req));
    return NextResponse.json({ ok: true, message: result.message }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
