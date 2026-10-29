import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import VerifyPage from '@/app/verify/page';

const lifecycle = vi.hoisted(() => ({ effects: [] as Array<() => (() => void) | void> }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  /* 先渲染组件，再重放同一个已提交 effect 的启动/清理，模拟 StrictMode。 */
  useEffect: (effect: () => (() => void) | void) => { lifecycle.effects.push(effect); },
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ token: 'd'.repeat(64) }),
}));

afterEach(() => {
  lifecycle.effects.length = 0;
  vi.unstubAllGlobals();
});

it('激活页在 StrictMode 重放 effect 时只消费一次令牌', async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ email: 'verify@example.test' }) }));
  vi.stubGlobal('fetch', fetch);
  renderToStaticMarkup(createElement(VerifyPage));
  expect(lifecycle.effects).toHaveLength(1);
  const cleanup = lifecycle.effects[0]();
  if (cleanup) cleanup();
  const replayCleanup = lifecycle.effects[0]();
  await Promise.resolve();
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith('/api/auth/verify?token=' + 'd'.repeat(64));
  if (replayCleanup) replayCleanup();
});
