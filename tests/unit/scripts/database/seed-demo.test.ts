import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('seed-demo command', () => {
  it('accepts an operational record count from 100 through 500', async () => {
    const { parseDemoSeedArguments } = await import('@/../scripts/database/seed-demo');

    expect(parseDemoSeedArguments(['--count', '100'])).toEqual({ count: 100 });
    expect(parseDemoSeedArguments(['--count', '300'])).toEqual({ count: 300 });
    expect(parseDemoSeedArguments(['--count', '500'])).toEqual({ count: 500 });
    expect(parseDemoSeedArguments(['--', '--count', '300'])).toEqual({ count: 300 });
  });

  it('rejects missing, duplicate, unknown, fractional, and out-of-range counts', async () => {
    const { parseDemoSeedArguments } = await import('@/../scripts/database/seed-demo');

    for (const arguments_ of [
      [],
      ['--count', '99'],
      ['--count', '501'],
      ['--count', '300.5'],
      ['--count', 'not-a-number'],
      ['--count', '300', '--count', '400'],
      ['--records', '300'],
    ]) {
      expect(() => parseDemoSeedArguments(arguments_)).toThrow(
        'Usage: seed-demo --count COUNT (COUNT must be an integer from 100 through 500).',
      );
    }
  });

  it('refuses to seed when the runtime identifies itself as production', async () => {
    const { assertDemoSeedEnvironment } = await import('@/../scripts/database/seed-demo');

    expect(() => assertDemoSeedEnvironment('production')).toThrow(
      'Demo data cannot be seeded when NODE_ENV is production.',
    );
    expect(() => assertDemoSeedEnvironment('development')).not.toThrow();
    expect(() => assertDemoSeedEnvironment('test')).not.toThrow();
  });

  it('splits 300 operational records evenly with representative lifecycle states', async () => {
    const { buildDemoSeedPlan } = await import('@/../scripts/database/seed-demo');

    expect(buildDemoSeedPlan(300, new Date('2026-08-29T08:00:00.000Z'))).toEqual({
      count: 300,
      dispatches: {
        total: 150,
        draft: 15,
        dispatched: 30,
        completed: 90,
        cancelled: 15,
      },
      fuelIssuances: {
        total: 150,
        draft: 15,
        posted: 120,
        voided: 15,
      },
      referenceDate: '2026-08-29',
    });
  });

  it('forwards seed arguments through the executable database command', () => {
    const result = spawnSync('./scripts/database/run.sh', ['seed-demo', '--count', '99'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, FVDMS_CONTAINER: '1', NODE_ENV: 'test' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Usage: seed-demo --count COUNT (COUNT must be an integer from 100 through 500).',
    );
    expect(result.stderr).not.toContain('Unsupported database operation');
  });
});
