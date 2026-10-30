import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { jsonError } from '@/server/api-helpers';

export async function GET() {
  try {
    const db = await getDb();
    await db.ping();
    return NextResponse.json({ ok: true, database: { type: db.dialect } });
  } catch (e) {
    return jsonError(e);
  }
}
