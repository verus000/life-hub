import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';

export const metadata: Metadata = { title: '注册 · 生活管理' };

export default function RegisterPage() {
  return <AuthCard />;
}
