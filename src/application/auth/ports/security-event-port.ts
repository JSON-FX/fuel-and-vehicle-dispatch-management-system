export interface SecurityEvent {
  readonly publicId: string;
  readonly type: string;
  readonly actorPublicId: string | null;
  readonly targetPublicId: string | null;
  readonly requestId: string;
  readonly reasonCode: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: Date;
}

export interface SecurityEventPort {
  append(event: SecurityEvent): Promise<void>;
}
