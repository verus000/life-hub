import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';

export const metadata: Metadata = { title: '登录 · 生活管理' };

export default function LoginPage() {
  return <AuthCard />;
}
