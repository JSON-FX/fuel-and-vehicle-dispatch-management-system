import { promises as fileSystem } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  LocalPrivateExportStorage,
  PrivateExportPathError,
} from '@/infrastructure/reporting/local-private-export-storage';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fileSystem.rm(root, { recursive: true })));
});

async function root(): Promise<string> {
  const value = await fileSystem.mkdtemp(path.join(tmpdir(), 'fvdms-private-export-'));
  roots.push(value);
  return value;
}

describe('local private export storage', () => {
  it('writes with restrictive permissions, finalizes atomically, and opens without exposing a path', async () => {
    const storageRoot = await root();
    const storage = new LocalPrivateExportStorage(storageRoot);
    const pending = await storage.createPending();
    const writer = pending.writable.getWriter();
    await writer.write(new TextEncoder().encode('private workbook bytes'));
    await writer.close();

    const finalized = await storage.finalize(pending.storageKey);
    expect(finalized).toMatchObject({
      storageKey: pending.storageKey,
      byteLength: 22,
    });
    expect(finalized.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pending.storageKey).toMatch(/^[0-9a-f]{64}\.xlsx$/);
    const mode = (await fileSystem.stat(path.join(storageRoot, pending.storageKey))).mode & 0o777;
    expect(mode).toBe(0o600);

    const opened = await storage.open(pending.storageKey);
    expect(opened).not.toHaveProperty('path');
    const reader = opened.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(next.value);
    }
    expect(Buffer.concat(chunks).toString()).toBe('private workbook bytes');

    await storage.delete(pending.storageKey);
    await expect(storage.delete(pending.storageKey)).resolves.toBeUndefined();
  });

  it('rejects traversal and symlink roots', async () => {
    const storageRoot = await root();
    const storage = new LocalPrivateExportStorage(storageRoot);
    await expect(storage.open('../outside.xlsx')).rejects.toBeInstanceOf(PrivateExportPathError);

    const target = await root();
    const symlink = path.join(tmpdir(), `fvdms-export-link-${Date.now()}`);
    roots.push(symlink);
    await fileSystem.symlink(target, symlink);
    const linkedStorage = new LocalPrivateExportStorage(symlink);
    await expect(linkedStorage.createPending()).rejects.toBeInstanceOf(PrivateExportPathError);
  });

  it('aborts pending files and cleans only stale temporary files within a bound', async () => {
    const storageRoot = await root();
    const storage = new LocalPrivateExportStorage(storageRoot);
    const first = await storage.createPending();
    const second = await storage.createPending();
    await first.writable.getWriter().close();
    await second.writable.getWriter().close();
    await storage.abort(first.storageKey);

    const oldTime = new Date('2026-08-01T00:00:00.000Z');
    await fileSystem.utimes(path.join(storageRoot, `${second.storageKey}.tmp`), oldTime, oldTime);
    await expect(
      storage.cleanupTemporaryFiles(new Date('2026-08-02T00:00:00.000Z'), 1),
    ).resolves.toBe(1);
    await expect(fileSystem.readdir(storageRoot)).resolves.toEqual([]);
  });
});
