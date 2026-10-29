import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '生活管理',
  description: '手机号、宽带、停车费、资产分布盘点',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
