export interface UserSummaryDto {
  readonly publicId: string;
  readonly username: string;
  readonly email: string;
  readonly fullName: string;
  readonly isActive: boolean;
  readonly isDeleted: boolean;
  readonly mustChangePassword: boolean;
  readonly mfaEnrolled: boolean;
  readonly roles: readonly string[];
}

export interface PaginatedUsersDto {
  readonly items: readonly UserSummaryDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface UserDetailDto extends UserSummaryDto {
  readonly permissions: readonly string[];
  readonly isPrivileged: boolean;
}

export interface CreateUserCommand {
  readonly username: string;
  readonly email: string;
  readonly fullName: string;
  readonly rolePublicIds: readonly string[];
  readonly actorPublicId: string;
  readonly requestId: string;
}

export interface UpdateUserCommand {
  readonly targetPublicId: string;
  readonly email?: string;
  readonly fullName?: string;
  readonly isActive?: boolean;
  readonly actorPublicId: string;
  readonly requestId: string;
}

export interface SecurityReasonCommand {
  readonly targetPublicId: string;
  readonly actorPublicId: string;
  readonly reason: string;
  readonly requestId: string;
}

export interface OneTimeCredentialDto {
  readonly temporaryPassword: string;
  readonly targetPublicId: string;
}
