import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { withBasePath } from '@/lib/base-path';

export const metadata: Metadata = {
  title: '生活管理',
  description: '手机号、宽带、停车费、资产分布盘点',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ backgroundImage: `url('${withBasePath('/images/mint-orbit.png')}')` }}>{children}<Toaster /></body>
    </html>
  );
}
