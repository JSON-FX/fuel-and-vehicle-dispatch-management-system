import type { PublicId } from '@/domain/shared/value-objects/public-id';
import type { EmailAddress } from '@/domain/user/value-objects/email-address';
import type { Username } from '@/domain/user/value-objects/username';

export interface UserProperties {
  readonly publicId: PublicId;
  readonly username: Username;
  readonly email: EmailAddress;
  readonly fullName: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  readonly requiresMfa: boolean;
  readonly deletedAt: Date | null;
}

export class User {
  readonly publicId: PublicId;
  readonly username: Username;
  readonly email: EmailAddress;
  readonly fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  requiresMfa: boolean;
  deletedAt: Date | null;

  constructor(properties: UserProperties) {
    this.publicId = properties.publicId;
    this.username = properties.username;
    this.email = properties.email;
    this.fullName = properties.fullName;
    this.isActive = properties.isActive;
    this.mustChangePassword = properties.mustChangePassword;
    this.requiresMfa = properties.requiresMfa;
    this.deletedAt = properties.deletedAt;
  }

  canAuthenticate(): boolean {
    return this.isActive && this.deletedAt === null;
  }

  activate(): void {
    if (this.deletedAt === null) this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  softDelete(at: Date): void {
    this.deletedAt = at;
    this.isActive = false;
  }

  restore(): void {
    this.deletedAt = null;
    this.isActive = false;
  }

  markPasswordChanged(): void {
    this.mustChangePassword = false;
  }
}
