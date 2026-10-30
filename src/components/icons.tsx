/* 内联 SVG 图标：与原 ui.js ICONS 一致 */

import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
  close: <path d="m6 6 12 12M6 18 18 6" />,
  trash: <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />,
  download: <path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" />,
  upload: <path d="M12 16V4m-4 4 4-4 4 4M5 16v5h14v-5" />,
  logout: <path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h10" />,
  history: <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2" />,
  pause: <path d="M8 5v14M16 5v14" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4" />,
  archive: <><rect x="3" y="3" width="18" height="5" rx="1" /><path d="M5 8v13h14V8m-10 4h6" /></>,
  filter: <path d="M4 6h16M7 12h10m-7 6h4" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10 6h4m-3 12h2" />
    </>
  ),
  broadband: (
    <>
      <path d="M3 8.5a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 3.5a5 5 0 0 1 6 0" />
      <circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  parking: <path d="m5 8 1.5-4h11L19 8m-15 3 1-3h14l1 3v7H4zM6 18v3m12-3v3M4 13h16m-13 3h1m8 0h1" />,
  asset: (
    <>
      <path d="M20 8V5H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V8m17 6h-5v4h5" />
      <path d="M17 16h.1" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-12 0h12M10 21h4" />,
  trend: <path d="m3 16 6-6 4 4 8-10m-6 0h6v6M3 21h18" />,
  layers: <path d="m12 3 10 5-10 5L2 8zm-9 10 9 5 9-5M3 18l9 4 9-4" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M4 11h16m-12 4h3" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
};

export function Icon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.overview}
    </svg>
  );
}

/* 品牌 Logo：轨道表盘的缩小版（270° 轨道弧 + 黄色内核 + 缺口处的卫星点），主页顶部与登录卡片共用 */
export function Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="7" fill="currentColor" />
      <path d="M12 6.5a5.5 5.5 0 1 1-5.5 5.5" stroke="var(--color-surface)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.2" fill="var(--color-sun)" />
      <circle cx="8.1" cy="8.1" r="1.3" fill="var(--color-surface)" />
    </svg>
  );
}

/* 轨道表盘：黄色内核代表“今天”，蓝色进度弧与外圈轨道点代表周期提醒；外圈缓慢旋转，
   减少动效时由 globals.css 的 prefers-reduced-motion 规则停住。颜色与全站 token 同步。 */
export function OrbitArtwork({ className = 'h-48 w-56' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 210" fill="none" aria-hidden="true">
      <circle cx="130" cy="105" r="92" fill="var(--color-brand-soft)" />
      <circle cx="130" cy="105" r="58" stroke="var(--color-sky)" strokeWidth="6" />
      <path d="M130 47a58 58 0 1 1-50.2 87" stroke="var(--color-brand)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="79.8" cy="134" r="6" fill="var(--color-surface)" stroke="var(--color-brand)" strokeWidth="3" />
      <g className="origin-center animate-[spin_48s_linear_infinite] [transform-box:fill-box]">
        <circle cx="130" cy="105" r="80" stroke="var(--color-line-strong)" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
        <path d="M205.2 132.4a80 80 0 0 1-47.8 47.8" stroke="var(--color-lilac-ink)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="191.3" cy="53.6" r="6" fill="var(--color-brand)" />
        <circle cx="54.8" cy="132.4" r="4" fill="var(--color-mint-ink)" />
      </g>
      <circle cx="130" cy="105" r="30" fill="var(--color-sun)" />
      <circle cx="130" cy="105" r="30" stroke="var(--color-sun-shade)" strokeWidth="2" />
      <circle cx="130" cy="105" r="9" fill="var(--color-surface)" />
      <path d="M36 30v20M26 40h20" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="214" cy="178" r="3" fill="var(--color-brand)" opacity=".5" />
    </svg>
  );
}

/* 空状态插画：与原 ui.js 的 dueList 空态一致 */
export function EmptyArtwork() {
  return (
    <svg className="w-28 h-24 mb-1" viewBox="0 0 112 92" fill="none" aria-hidden="true">
      <ellipse cx="55" cy="48" rx="46" ry="35" fill="var(--color-brand-soft)" />
      <circle cx="19" cy="24" r="3" fill="var(--color-sun)" />
      <circle cx="18" cy="66" r="2" fill="var(--color-sky)" />
      <g transform="rotate(-6 55 45)">
        <rect x="27" y="19" width="58" height="57" rx="12" fill="var(--color-surface)" stroke="var(--color-sky)" strokeWidth="1.5" />
        <path d="M28 35h56M40 15v10m32-10v10" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="41" cy="47" r="2" fill="var(--color-sky)" />
        <circle cx="56" cy="47" r="2" fill="var(--color-sky)" />
        <circle cx="71" cy="47" r="2" fill="var(--color-sky)" />
        <circle cx="41" cy="62" r="2" fill="var(--color-sky)" />
        <circle cx="56" cy="62" r="8" fill="var(--color-sun)" />
        <path d="m53 62 2 2 4-4" stroke="var(--color-lemon-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="71" cy="62" r="2" fill="var(--color-sky)" />
      </g>
      <path d="M88 78c-2-10 0-19 7-27" stroke="var(--color-mint-ink)" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M90 64c-7 0-10-4-10-8 6 0 10 2 10 8Zm2-3c0-7 4-11 10-12 0 6-3 10-10 12Z"
        fill="var(--color-mint)"
      />
    </svg>
  );
}
