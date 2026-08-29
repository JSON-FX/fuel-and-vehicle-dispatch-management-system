import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';

import type {
  FinalizedPrivateExport,
  PrivateExportFile,
  PrivateExportStorage,
} from '@/application/reporting/ports/private-export-storage';
import type { ReportExportSink } from '@/application/reporting/ports/report-exporter';

const storageKeyPattern = /^[0-9a-f]{64}\.xlsx$/;

export class PrivateExportPathError extends Error {
  constructor(message = 'The private export path is invalid.') {
    super(message);
    this.name = 'PrivateExportPathError';
  }
}

export class PrivateExportFileNotFoundError extends Error {
  constructor() {
    super('The private export file is unavailable.');
    this.name = 'PrivateExportFileNotFoundError';
  }
}

export class LocalPrivateExportStorage implements PrivateExportStorage {
  private readonly configuredRoot: string;
  private verifiedRoot: Promise<string> | null = null;

  constructor(root: string) {
    if (root.trim().length === 0) throw new PrivateExportPathError();
    this.configuredRoot = path.resolve(root);
  }

  async createPending(): Promise<ReportExportSink> {
    const root = await this.root();
    const storageKey = `${randomBytes(32).toString('hex')}.xlsx`;
    const temporaryPath = this.containedPath(root, `${storageKey}.tmp`);
    const stream = createWriteStream(temporaryPath, {
      flags: 'wx',
      mode: 0o600,
      autoClose: true,
    });
    return {
      storageKey,
      writable: Writable.toWeb(stream) as WritableStream<Uint8Array>,
    };
  }

  async finalize(storageKey: string): Promise<FinalizedPrivateExport> {
    const root = await this.root();
    const temporaryPath = this.pathFor(root, `${storageKey}.tmp`);
    const finalPath = this.pathFor(root, storageKey);
    await this.requireRegularFile(temporaryPath);
    const { byteLength, sha256 } = await digestFile(temporaryPath);
    await fileSystem.rename(temporaryPath, finalPath);
    await fileSystem.chmod(finalPath, 0o600);
    return { storageKey, byteLength, sha256 };
  }

  async abort(storageKey: string): Promise<void> {
    const root = await this.root();
    await unlinkIfPresent(this.pathFor(root, `${storageKey}.tmp`));
  }

  async open(storageKey: string): Promise<PrivateExportFile> {
    const root = await this.root();
    const exportPath = this.pathFor(root, storageKey);
    let stats;
    try {
      stats = await this.requireRegularFile(exportPath);
    } catch (error) {
      if (isMissing(error)) throw new PrivateExportFileNotFoundError();
      throw error;
    }
    const stream = createReadStream(exportPath, { flags: 'r' });
    return {
      byteLength: stats.size,
      stream: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const root = await this.root();
    await unlinkIfPresent(this.pathFor(root, storageKey));
  }

  async cleanupTemporaryFiles(olderThan: Date, limit: number): Promise<number> {
    const root = await this.root();
    const entries = await fileSystem.readdir(root, { withFileTypes: true });
    let deleted = 0;
    for (const entry of entries) {
      if (deleted >= Math.max(0, Math.min(limit, 100))) break;
      if (!entry.isFile() || !/^[0-9a-f]{64}\.xlsx\.tmp$/.test(entry.name)) continue;
      const candidate = this.containedPath(root, entry.name);
      const stats = await fileSystem.lstat(candidate);
      if (stats.isSymbolicLink() || stats.mtime >= olderThan) continue;
      await unlinkIfPresent(candidate);
      deleted += 1;
    }
    return deleted;
  }

  private async root(): Promise<string> {
    this.verifiedRoot ??= this.verifyRoot();
    return this.verifiedRoot;
  }

  private async verifyRoot(): Promise<string> {
    await fileSystem.mkdir(this.configuredRoot, { recursive: true, mode: 0o700 });
    const stats = await fileSystem.lstat(this.configuredRoot);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new PrivateExportPathError();
    const realRoot = await fileSystem.realpath(this.configuredRoot);
    await fileSystem.chmod(realRoot, 0o700);
    return realRoot;
  }

  private pathFor(root: string, storageKey: string): string {
    const baseKey = storageKey.endsWith('.tmp') ? storageKey.slice(0, -4) : storageKey;
    if (!storageKeyPattern.test(baseKey)) throw new PrivateExportPathError();
    return this.containedPath(root, storageKey);
  }

  private containedPath(root: string, key: string): string {
    const candidate = path.resolve(root, key);
    if (!candidate.startsWith(`${root}${path.sep}`)) throw new PrivateExportPathError();
    return candidate;
  }

  private async requireRegularFile(filePath: string) {
    const stats = await fileSystem.lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new PrivateExportPathError();
    return stats;
  }
}

async function digestFile(filePath: string): Promise<{ byteLength: number; sha256: string }> {
  const digest = createHash('sha256');
  let byteLength = 0;
  for await (const chunk of createReadStream(filePath, { flags: 'r' })) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += bytes.byteLength;
    digest.update(bytes);
  }
  return { byteLength, sha256: digest.digest('hex') };
}

async function unlinkIfPresent(filePath: string): Promise<void> {
  try {
    const stats = await fileSystem.lstat(filePath);
    if (stats.isSymbolicLink()) throw new PrivateExportPathError();
    await fileSystem.unlink(filePath);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

function isMissing(error: unknown): boolean {
  return (error as { code?: unknown }).code === 'ENOENT';
}
