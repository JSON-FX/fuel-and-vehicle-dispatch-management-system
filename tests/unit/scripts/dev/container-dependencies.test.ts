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

      expect(readFileSync(commandLog, 'utf8')).toContain('docker compose up -d --wait app\n');
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
