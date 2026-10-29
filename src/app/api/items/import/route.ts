import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { importItems } from '@/server/items/service';
import { jsonError, readJson, requireUser } from '@/server/api-helpers';
import { AppError } from '@/server/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    if (!Array.isArray(body.items)) throw new AppError(400, 'items 必须是数组');
    const result = await importItems(getDb(), body.items, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return jsonError(e, req);
  }
}
