import type { ReactNode } from 'react';

/* 认证页共用薄荷青外壳，内容直接放在页面上，不再使用厚卡片。 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <main className="flex min-h-dvh flex-col px-6">
    <header className="flex items-baseline gap-3 py-6 text-ink sm:px-6">
      <span className="text-2xl font-bold tracking-tight">生活管理</span><span className="text-sm text-ink-3">Life Hub</span>
    </header>
    <div className="grid flex-1 place-items-center py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-9 text-center">
          <h1 className="m-0 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">{title}</h1>
          {subtitle && <p className="m-0 mt-3 text-sm text-ink-2">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
    <footer className="pb-8 text-center text-xs text-ink-3">小事有着落，生活更轻松。</footer>
  </main>;
}
