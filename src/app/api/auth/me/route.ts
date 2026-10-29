import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireUser } from '@/server/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ id: user.id, email: user.email, createdAt: user.createdAt });
  } catch (e) {
    return jsonError(e);
  }
}
