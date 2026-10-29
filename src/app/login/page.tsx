import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db';
import { getSessionUser } from '@/server/auth/service';
import { SESSION_COOKIE } from '@/server/auth/constants';

export const metadata: Metadata = { title: '登录 · 生活管理' };

export default async function LoginPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && await getSessionUser(getDb(), token)) redirect('/');
  return <AuthCard />;
}
