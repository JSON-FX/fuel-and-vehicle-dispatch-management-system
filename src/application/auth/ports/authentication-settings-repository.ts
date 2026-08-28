export interface AuthenticationSettingsRecord {
  readonly mfaRequired: boolean;
  readonly updatedAt: Date;
  readonly updatedByUserPublicId: string | null;
}

export interface AuthenticationSettingsRepository {
  get(): Promise<AuthenticationSettingsRecord>;
  update(input: {
    readonly mfaRequired: boolean;
    readonly updatedAt: Date;
    readonly updatedByUserPublicId: string;
  }): Promise<AuthenticationSettingsRecord>;
}
