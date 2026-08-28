import type { PublicId } from '@/domain/shared/value-objects/public-id';

export interface RoleProperties {
  readonly publicId: PublicId;
  readonly code: string;
  readonly name: string;
  readonly isPrivileged: boolean;
  readonly isActive: boolean;
  readonly isSystem: boolean;
}

export class Role {
  readonly publicId: PublicId;
  readonly code: string;
  readonly name: string;
  readonly isPrivileged: boolean;
  isActive: boolean;
  readonly isSystem: boolean;

  constructor(properties: RoleProperties) {
    this.publicId = properties.publicId;
    this.code = properties.code;
    this.name = properties.name;
    this.isPrivileged = properties.isPrivileged;
    this.isActive = properties.isActive;
    this.isSystem = properties.isSystem;
  }

  deactivate(): void {
    this.isActive = false;
  }
}
