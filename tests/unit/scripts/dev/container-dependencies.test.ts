import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('container dependency recovery', () => {
  it('allows pnpm to replace a stale named-volume install without a terminal', () => {
    const configured = execFileSync('pnpm', ['config', 'get', 'confirmModulesPurge'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();

    expect(configured).toBe('false');
  });

  it('keeps the pnpm content store outside the bind-mounted source tree', () => {
    const compose = JSON.parse(
      execFileSync('docker', ['compose', 'config', '--format', 'json'], {
        cwd: process.cwd(),
        encoding: 'utf8',
      }),
    ) as {
      services: {
        app: {
          environment: Record<string, string>;
          volumes: Array<{ source: string; target: string; type: string }>;
        };
      };
    };

    expect(compose.services.app.environment.PNPM_CONFIG_STORE_DIR).toBe('/pnpm/store');
    expect(compose.services.app.volumes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'pnpm-store',
          target: '/pnpm/store',
          type: 'volume',
        }),
      ]),
    );
  });

  it('runs a non-routed worker without application or verifier credentials', () => {
    const compose = JSON.parse(
      execFileSync('docker', ['compose', 'config', '--format', 'json'], {
        cwd: process.cwd(),
        encoding: 'utf8',
      }),
    ) as {
      services: Record<
        string,
        {
          environment?: Record<string, string>;
          labels?: Record<string, string>;
          ports?: unknown[];
        }
      >;
    };
    const app = compose.services.app!;
    const worker = compose.services['audit-worker']!;

    expect(worker).toBeDefined();
    expect(worker.environment?.DATABASE_USER).toBe('fvdms_audit_worker');
    expect(worker.environment?.AUDIT_SINK_DATABASE_USER).toBe('fvdms_audit_sink_writer');
    expect(worker.environment?.AUDIT_VERIFIER_DATABASE_PASSWORD).toBeUndefined();
    expect(worker.environment?.AUTH_TOTP_ENCRYPTION_KEYS).toBeUndefined();
    expect(worker.labels?.['traefik.enable']).not.toBe('true');
    expect(worker.ports).toBeUndefined();
    expect(app.environment?.AUDIT_WORKER_DATABASE_PASSWORD).toBeUndefined();
    expect(app.environment?.AUDIT_SINK_DATABASE_PASSWORD).toBeUndefined();
    expect(app.environment?.AUDIT_VERIFIER_DATABASE_PASSWORD).toBeUndefined();
  });

  it('waits for the application container health check before returning', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'fvdms-dev-up-'));
    const commandLog = join(temporaryDirectory, 'commands.log');
    const fakeCommand = join(temporaryDirectory, 'record-command');
    writeFileSync(
      fakeCommand,
      '#!/bin/sh\nprintf "%s %s\\n" "$(basename "$0")" "$*" >> "$COMMAND_LOG"\n',
    );
    chmodSync(fakeCommand, 0o755);

    try {
      for (const command of ['docker', 'pnpm']) {
        const target = join(temporaryDirectory, command);
        writeFileSync(target, readFileSync(fakeCommand));
        chmodSync(target, 0o755);
      }
      execFileSync('sh', ['scripts/dev/up.sh'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          COMMAND_LOG: commandLog,
          PATH: `${temporaryDirectory}:${process.env.PATH ?? ''}`,
        },
      });

      const commands = readFileSync(commandLog, 'utf8').trim().split('\n');
      expect(commands.slice(1)).toEqual([
        'docker compose run --rm --no-deps --user root database-tools chown -R node:node /pnpm/store',
        'pnpm db:bootstrap',
        'pnpm db:migrate',
        'pnpm db:bootstrap',
        'docker compose up -d --wait app audit-worker',
      ]);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
