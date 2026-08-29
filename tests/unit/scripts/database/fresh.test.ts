import { spawnSync } from 'node:child_process';

import { NO_MIGRATIONS } from 'kysely/migration';
import { describe, expect, it, vi } from 'vitest';

describe('fresh database command', () => {
  it('accepts only the exact destructive confirmation token', async () => {
    const { parseFreshArguments } = await import('@/../scripts/database/fresh');

    expect(parseFreshArguments(['--confirm', 'FVDMS_FRESH_DATABASE'])).toEqual({
      confirmed: true,
    });
    expect(parseFreshArguments(['--', '--confirm', 'FVDMS_FRESH_DATABASE'])).toEqual({
      confirmed: true,
    });

    for (const arguments_ of [
      [],
      ['--confirm'],
      ['--confirm', 'wrong'],
      ['--confirm', 'FVDMS_FRESH_DATABASE', '--confirm', 'FVDMS_FRESH_DATABASE'],
      ['--force', 'FVDMS_FRESH_DATABASE'],
    ]) {
      expect(() => parseFreshArguments(arguments_)).toThrow(
        'Usage: fresh --confirm FVDMS_FRESH_DATABASE',
      );
    }
  });

  it('refuses production before database migration begins', async () => {
    const { assertFreshEnvironment } = await import('@/../scripts/database/fresh');

    expect(() => assertFreshEnvironment('production')).toThrow(
      'Database refresh is disabled when NODE_ENV is production.',
    );
    expect(() => assertFreshEnvironment('development')).not.toThrow();
    expect(() => assertFreshEnvironment('test')).not.toThrow();
  });

  it('rolls every migration back before applying the latest schema', async () => {
    const { freshDatabase } = await import('@/../scripts/database/fresh');
    const migrateTo = vi.fn().mockResolvedValue({
      results: [{ migrationName: 'first', direction: 'Down', status: 'Success' }],
    });
    const migrateToLatest = vi.fn().mockResolvedValue({
      results: [{ migrationName: 'first', direction: 'Up', status: 'Success' }],
    });

    await expect(freshDatabase({ migrateTo, migrateToLatest } as never)).resolves.toEqual({
      applied: 1,
      rolledBack: 1,
    });
    expect(migrateTo).toHaveBeenCalledWith(NO_MIGRATIONS);
    expect(migrateToLatest).toHaveBeenCalledOnce();
    expect(migrateTo.mock.invocationCallOrder[0]).toBeLessThan(
      migrateToLatest.mock.invocationCallOrder[0]!,
    );
  });

  it('does not reapply migrations after a rollback failure', async () => {
    const { freshDatabase } = await import('@/../scripts/database/fresh');
    const failure = new Error('rollback failed');
    const migrateToLatest = vi.fn();

    await expect(
      freshDatabase({
        migrateTo: vi.fn().mockResolvedValue({ error: failure }),
        migrateToLatest,
      } as never),
    ).rejects.toBe(failure);
    expect(migrateToLatest).not.toHaveBeenCalled();
  });

  it('forwards the confirmation through the executable database command', () => {
    const result = spawnSync('./scripts/database/run.sh', ['fresh', '--confirm', 'wrong'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, FVDMS_CONTAINER: '1', NODE_ENV: 'test' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: fresh --confirm FVDMS_FRESH_DATABASE');
    expect(result.stderr).not.toContain('Unsupported database operation');
  });

  it('blocks the confirmed executable command in production before connecting', () => {
    const result = spawnSync(
      './scripts/database/run.sh',
      ['fresh', '--confirm', 'FVDMS_FRESH_DATABASE'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, FVDMS_CONTAINER: '1', NODE_ENV: 'production' },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Database refresh is disabled when NODE_ENV is production.');
    expect(result.stderr).not.toContain('ECONNREFUSED');
  });

  it('blocks the package command on the host before Docker starts', () => {
    const result = spawnSync('pnpm', ['db:fresh', '--', '--confirm', 'FVDMS_FRESH_DATABASE'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, FVDMS_CONTAINER: '', NODE_ENV: 'production' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Database refresh is disabled when NODE_ENV is production.');
    expect(result.stderr).not.toContain('Container');
  });
});
