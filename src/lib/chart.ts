/* 轻量环形图数据计算：返回分段几何数据，由 React 组件渲染 SVG。
   groupBy 行为与原 public/assets/js/chart.js 一致。 */

import { get } from './model';
import type { Item } from './types';

export const PALETTE = ['#5271E8', '#78A1EE', '#6BB8A4', '#E5B87E', '#A493D2', '#80B7CE', '#BF927C', '#9CA6BA'];

export function colorAt(i: number): string {
  return PALETTE[i % PALETTE.length];
}

export interface ChartDatum {
  name: string;
  value: number;
}

export function groupBy(items: Item[], path: string): ChartDatum[] {
  const map: Record<string, number> = {};
  items.forEach((it) => {
    const k = String(get(it, path) || '未分类');
    map[k] = (map[k] || 0) + (Number(it.amount) || 0);
  });
  return Object.keys(map)
    .map((k) => ({ name: k, value: map[k] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export interface DonutSegment {
  d: string;
  fill: string;
}

/* 环形图分段路径（不含 total<=0 与单类场景，调用方处理空态） */
export function donutSegments(data: Array<ChartDatum & { color?: string }>, size = 190): DonutSegment[] {
  const R = size / 2 - 4;
  const r = R * 0.76;
  const c = size / 2;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length <= 1 || total <= 0) return [];

  const pt = (ang: number, rad: number): [string, string] => {
    const a = ((ang - 90) * Math.PI) / 180;
    return [(c + rad * Math.cos(a)).toFixed(2), (c + rad * Math.sin(a)).toFixed(2)];
  };

  let ang = 0;
  const out: DonutSegment[] = [];
  data.forEach((d, i) => {
    const sweep = (d.value / total) * 360;
    const large = sweep > 180 ? 1 : 0;
    const s1 = pt(ang, R);
    const s2 = pt(ang + sweep, R);
    const e1 = pt(ang + sweep, r);
    const e2 = pt(ang, r);
    out.push({
      d:
        'M' + s1[0] + ' ' + s1[1] +
        ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + s2[0] + ' ' + s2[1] +
        ' L' + e1[0] + ' ' + e1[1] +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + e2[0] + ' ' + e2[1] +
        ' Z',
      fill: d.color || colorAt(i),
    });
    ang += sweep;
  });
  return out;
}
