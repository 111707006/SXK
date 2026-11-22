import { describe, it, expect, afterEach } from 'vitest';

/**
 * `SERVICE_RELATIONS` 接進 `server.ts`（#118）：A 開著卻沒開身分開關或 `A_COMPANIES`，程序起不來。
 * 值的細節（認不得、B 不生效）見 `serviceRelationsSwitch.test.ts`。每一條各載一次 server.ts（`vi.resetModules`）。
 */

const KEYS = ['SERVICE_RELATIONS', 'A_PHONE_IDENTITY', 'A_COMPANIES'] as const;
afterEach(() => {
  for (const k of KEYS) process.env[k] = '';
});

async function boot(env: Partial<Record<(typeof KEYS)[number], string>>) {
  const { vi } = await import('vitest');
  vi.resetModules();
  for (const k of KEYS) process.env[k] = env[k] ?? '';
  return import('../server');
}

describe('SERVICE_RELATIONS 接進 server.ts', () => {
  it('沒開身分開關：起不來', async () => {
    await expect(boot({ SERVICE_RELATIONS: '1', A_COMPANIES: '1' })).rejects.toThrow(/SERVICE_RELATIONS=1 需要同時開 身分開關/);
  }, 60_000);

  it('沒開 A_COMPANIES：起不來', async () => {
    await expect(boot({ SERVICE_RELATIONS: '1', A_PHONE_IDENTITY: '1' })).rejects.toThrow(/A_COMPANIES=1/);
  }, 60_000);

  it('認不得的值：起不來', async () => {
    await expect(boot({ SERVICE_RELATIONS: 'on' })).rejects.toThrow(/SERVICE_RELATIONS 認不得/);
  }, 60_000);
});
