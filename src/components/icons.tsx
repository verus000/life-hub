/* 内联 SVG 图标：与原 ui.js ICONS 一致 */

import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
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

/* 品牌 Logo：主页顶部与登录卡片共用 */
export function Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20h-6v-6h-4v6H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* 空状态插画：与原 ui.js 的 dueList 空态一致 */
export function EmptyArtwork() {
  return (
    <svg className="w-28 h-24 mb-1" viewBox="0 0 112 92" fill="none" aria-hidden="true">
      <ellipse cx="55" cy="48" rx="46" ry="35" fill="#F1F9F8" />
      <circle cx="19" cy="24" r="3" fill="#F3E4C8" />
      <circle cx="18" cy="66" r="2" fill="#DCEEF0" />
      <g transform="rotate(-6 55 45)">
        <rect x="27" y="19" width="58" height="57" rx="9" fill="white" stroke="#BBD9E0" strokeWidth="1.5" />
        <path d="M28 35h56M40 15v10m32-10v10" stroke="#BBD9E0" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="41" cy="47" r="2" fill="#DCEBF0" />
        <circle cx="56" cy="47" r="2" fill="#DCEBF0" />
        <circle cx="71" cy="47" r="2" fill="#DCEBF0" />
        <circle cx="41" cy="62" r="2" fill="#DCEBF0" />
        <circle cx="56" cy="62" r="7" fill="#E8F6F1" />
        <path d="m53 62 2 2 4-4" stroke="#8ABBA6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="71" cy="62" r="2" fill="#DCEBF0" />
      </g>
      <path d="M88 78c-2-10 0-19 7-27" stroke="#B7D9C9" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M90 64c-7 0-10-4-10-8 6 0 10 2 10 8Zm2-3c0-7 4-11 10-12 0 6-3 10-10 12Z"
        fill="#D4EBDD"
      />
    </svg>
  );
}
