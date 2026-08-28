import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';

export type MasterDataResource = 'office' | 'driver' | 'vehicle';
export type MasterDataMode = 'admin' | 'operational';
export type MasterDataLifecycle = 'current' | 'deleted' | 'all';
export type CursorDirection = 'next' | 'previous';

export interface MasterDataListQuery {
  readonly mode: MasterDataMode;
  readonly query: string | null;
  readonly lifecycle: MasterDataLifecycle;
  readonly status: string | null;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly previousCursor: string | null;
}

export interface MasterDataRequestContext {
  readonly principal: CurrentPrincipal;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}
