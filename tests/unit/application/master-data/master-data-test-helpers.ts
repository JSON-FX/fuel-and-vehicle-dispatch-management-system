import { vi } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { MasterDataRepositories } from '@/application/master-data/ports/master-data-transaction';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { MasterDataPermissionPolicy } from '@/application/master-data/services/master-data-permission-policy';
import type { DriverRepository } from '@/application/driver/ports/driver-repository';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import type { VehicleRepository } from '@/application/vehicle/ports/vehicle-repository';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const emptyPage = { items: [], nextCursor: null, previousCursor: null } as const;

export function createPrincipal(permissions: readonly string[]): CurrentPrincipal {
  return {
    userPublicId: '01900000-0000-7000-8000-000000000001',
    username: 'system.admin',
    fullName: 'System Administrator',
    roles: ['SYSTEM_ADMIN'],
    permissions,
    isPrivileged: true,
    mustChangePassword: false,
    mfaEnrolled: true,
  };
}

export const requestContext = (permissions: readonly string[]) => ({
  principal: createPrincipal(permissions),
  requestId: 'request-master-data-1',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
});

export function createMasterDataTestDependencies(): {
  readonly dependencies: MasterDataUseCaseDependencies;
  readonly repositories: MasterDataRepositories;
} {
  let nextId = 100;
  const offices: OfficeRepository = {
    findCurrentByPublicId: vi.fn(async () => null),
    findIncludingDeletedByPublicId: vi.fn(async () => null),
    findCurrentByPublicIdForUpdate: vi.fn(async () => null),
    findDeletedByPublicIdForUpdate: vi.fn(async () => null),
    insert: vi.fn(async () => undefined),
    updateDetails: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => undefined),
    softDelete: vi.fn(async () => undefined),
    restore: vi.fn(async () => undefined),
    listAdmin: vi.fn(async () => emptyPage),
    listOperational: vi.fn(async () => emptyPage),
  };
  const drivers: DriverRepository = {
    findCurrentByPublicId: vi.fn(async () => null),
    findIncludingDeletedByPublicId: vi.fn(async () => null),
    findCurrentByPublicIdForUpdate: vi.fn(async () => null),
    findDeletedByPublicIdForUpdate: vi.fn(async () => null),
    insert: vi.fn(async () => undefined),
    updateDetails: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => undefined),
    softDelete: vi.fn(async () => undefined),
    restore: vi.fn(async () => undefined),
    listAdmin: vi.fn(async () => emptyPage),
    listOperational: vi.fn(async () => emptyPage),
  };
  const vehicles: VehicleRepository = {
    findCurrentByPublicId: vi.fn(async () => null),
    findIncludingDeletedByPublicId: vi.fn(async () => null),
    findCurrentByPublicIdForUpdate: vi.fn(async () => null),
    findDeletedByPublicIdForUpdate: vi.fn(async () => null),
    insert: vi.fn(async () => undefined),
    updateDetails: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => undefined),
    softDelete: vi.fn(async () => undefined),
    restore: vi.fn(async () => undefined),
    listAdmin: vi.fn(async () => emptyPage),
    listOperational: vi.fn(async () => emptyPage),
  };
  const repositories: MasterDataRepositories = {
    offices,
    drivers,
    vehicles,
    auditEvents: { append: vi.fn(async () => undefined) },
  };
  const dependencies: MasterDataUseCaseDependencies = {
    transaction: { execute: async (work) => work(repositories) },
    permissions: new MasterDataPermissionPolicy(),
    publicIds: {
      generate: () =>
        PublicId.from(`01900000-0000-7000-8000-${String(nextId++).padStart(12, '0')}`),
    },
    clock: { now: () => new Date('2026-08-28T04:00:00.000Z') },
  };
  return { dependencies, repositories };
}
