import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { jsonError } from '@/server/api-helpers';

export async function GET() {
  try {
    const db = getDb();
    return NextResponse.json({ ok: true, database: { type: 'sqlite', file: process.env.DB_FILE_NAME ?? 'data/life-hub.db' } });
  } catch (e) {
    return jsonError(e);
  }
}
