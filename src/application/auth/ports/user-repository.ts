export interface UserAuthenticationRecord {
  readonly publicId: string;
  readonly username: string;
  readonly email: string;
  readonly fullName: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  readonly deletedAt: Date | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly isPrivileged: boolean;
  readonly mfaEnrolled: boolean;
}

export interface NewUserRecord {
  readonly publicId: string;
  readonly username: string;
  readonly email: string;
  readonly fullName: string;
  readonly passwordHash: string;
  readonly mustChangePassword: boolean;
  readonly createdAt: Date;
}

export interface UserRepository {
  findForAuthentication(username: string): Promise<UserAuthenticationRecord | null>;
  findByPublicId(publicId: string): Promise<UserAuthenticationRecord | null>;
  list(input: {
    readonly page: number;
    readonly pageSize: number;
    readonly query?: string;
  }): Promise<{ readonly users: readonly UserAuthenticationRecord[]; readonly total: number }>;
  create(user: NewUserRecord): Promise<void>;
  updateIdentity(input: {
    readonly publicId: string;
    readonly email?: string;
    readonly fullName?: string;
    readonly isActive?: boolean;
    readonly updatedAt: Date;
  }): Promise<boolean>;
  updatePassword(input: {
    readonly publicId: string;
    readonly passwordHash: string;
    readonly mustChangePassword: boolean;
    readonly updatedAt: Date;
  }): Promise<boolean>;
  softDelete(publicId: string, deletedAt: Date): Promise<boolean>;
  restoreInactive(publicId: string, updatedAt: Date): Promise<boolean>;
  countActiveUsersWithRole(roleCode: string): Promise<number>;
}
