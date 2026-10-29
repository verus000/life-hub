import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { removeItem, updateItem } from '@/server/items/service';
import { jsonError, readJson, requireUser } from '@/server/api-helpers';
import { AppError } from '@/server/errors';

type Params = { params: Promise<{ id: string }> };

function numericId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, '记录不存在');
  return id;
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const body = await readJson(req);
    const expected = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : undefined;
    const item = await updateItem(getDb(), numericId(id), body, user.id, expected);
    return NextResponse.json(item);
  } catch (e) {
    return jsonError(e, req);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const item = await removeItem(getDb(), numericId(id), user.id);
    return NextResponse.json(item);
  } catch (e) {
    return jsonError(e, req);
  }
}
