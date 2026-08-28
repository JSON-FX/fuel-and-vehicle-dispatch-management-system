export interface PermissionDto {
  readonly publicId: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface RoleDto {
  readonly publicId: string;
  readonly code: string;
  readonly name: string;
  readonly isPrivileged: boolean;
  readonly isActive: boolean;
  readonly isSystem: boolean;
  readonly permissions: readonly string[];
}

export interface RoleMutationCommand {
  readonly name: string;
  readonly isPrivileged: boolean;
  readonly isActive: boolean;
  readonly permissionPublicIds: readonly string[];
  readonly actorPublicId: string;
  readonly requestId: string;
}
