export type RateLimitBucketType = 'ACCOUNT' | 'SOURCE' | 'TOTP';

export interface RateLimitKeyGenerator {
  forAccount(normalizedUsername: string): Uint8Array;
  forSource(sourceAddress: string): Uint8Array;
  forTotp(challengePublicId: string): Uint8Array;
}

export interface RateLimitRecord {
  readonly bucketType: RateLimitBucketType;
  readonly bucketKey: Uint8Array;
  readonly windowStartedAt: Date;
  readonly failureCount: number;
  readonly lockedUntil: Date | null;
}

export interface RateLimitRepository {
  find(bucketType: RateLimitBucketType, bucketKey: Uint8Array): Promise<RateLimitRecord | null>;
  recordFailure(input: {
    readonly bucketType: RateLimitBucketType;
    readonly bucketKey: Uint8Array;
    readonly now: Date;
    readonly windowSeconds: number;
    readonly lockSeconds: number;
    readonly maximumFailures: number;
  }): Promise<RateLimitRecord>;
  clear(bucketType: RateLimitBucketType, bucketKey: Uint8Array): Promise<void>;
}
