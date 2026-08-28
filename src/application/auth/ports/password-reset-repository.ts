export interface PasswordResetRepository {
  record(input: {
    readonly publicId: string;
    readonly actorPublicId: string;
    readonly targetPublicId: string;
    readonly requestId: string;
    readonly reason: string;
    readonly createdAt: Date;
  }): Promise<void>;
}
