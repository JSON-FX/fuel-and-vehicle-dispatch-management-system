import type { ReportExportSink } from '@/application/reporting/ports/report-exporter';

export interface FinalizedPrivateExport {
  readonly storageKey: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface PrivateExportFile {
  readonly byteLength: number;
  readonly stream: ReadableStream<Uint8Array>;
}

export interface PrivateExportStorage {
  createPending(): Promise<ReportExportSink>;
  finalize(storageKey: string): Promise<FinalizedPrivateExport>;
  abort(storageKey: string): Promise<void>;
  open(storageKey: string): Promise<PrivateExportFile>;
  delete(storageKey: string): Promise<void>;
  cleanupTemporaryFiles(olderThan: Date, limit: number): Promise<number>;
}
