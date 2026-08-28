import type { PublicId } from '@/domain/shared/value-objects/public-id';
import type { PermissionCode } from '@/domain/user/value-objects/permission-code';

export interface PermissionProperties {
  readonly publicId: PublicId;
  readonly code: PermissionCode;
  readonly name: string;
  readonly isActive: boolean;
}

export class Permission {
  readonly publicId: PublicId;
  readonly code: PermissionCode;
  readonly name: string;
  isActive: boolean;

  constructor(properties: PermissionProperties) {
    this.publicId = properties.publicId;
    this.code = properties.code;
    this.name = properties.name;
    this.isActive = properties.isActive;
  }

  deactivate(): void {
    this.isActive = false;
  }
}
