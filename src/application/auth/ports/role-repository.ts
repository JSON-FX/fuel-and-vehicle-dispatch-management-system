import type { RoleDto } from '@/application/auth/dto/role-administration-dtos';

export interface RoleRepository {
  list(): Promise<readonly RoleDto[]>;
  findByPublicId(publicId: string): Promise<RoleDto | null>;
  findByPublicIds(publicIds: readonly string[]): Promise<readonly RoleDto[]>;
  create(input: {
    readonly publicId: string;
    readonly code: string;
    readonly name: string;
    readonly isPrivileged: boolean;
    readonly createdAt: Date;
  }): Promise<void>;
  update(input: {
    readonly publicId: string;
    readonly name?: string;
    readonly isPrivileged?: boolean;
    readonly isActive?: boolean;
    readonly updatedAt: Date;
  }): Promise<boolean>;
  replaceUserRoles(userPublicId: string, rolePublicIds: readonly string[], at: Date): Promise<void>;
  userPublicIdsForRole(rolePublicId: string): Promise<readonly string[]>;
}
