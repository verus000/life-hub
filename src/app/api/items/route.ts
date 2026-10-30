import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { addItem, clearItems, listItems } from '@/server/items/service';
import { jsonError, readJson, requireUser } from '@/server/api-helpers';
import { AppError } from '@/server/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json(await listItems(await getDb(), user.id));
  } catch (e) {
    return jsonError(e, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    if (!body.title) throw new AppError(400, '缺少必填字段 title');
    const item = await addItem(await getDb(), body, user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return jsonError(e, req);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await clearItems(await getDb(), user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e, req);
  }
}
