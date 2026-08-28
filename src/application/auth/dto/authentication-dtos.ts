export interface CurrentPrincipal {
  readonly userPublicId: string;
  readonly username: string;
  readonly fullName: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly isPrivileged: boolean;
  readonly mustChangePassword: boolean;
  readonly mfaEnrolled: boolean;
}

export function createCurrentPrincipal(principal: CurrentPrincipal): CurrentPrincipal {
  return Object.freeze({
    ...principal,
    roles: Object.freeze([...principal.roles]),
    permissions: Object.freeze([...principal.permissions]),
  });
}

export interface LoginCommand {
  readonly username: string;
  readonly password: string;
  readonly sourceAddress: string;
  readonly requestId: string;
}

export type AuthenticationFlow =
  'AUTHENTICATED' | 'PASSWORD_CHANGE' | 'TOTP_ENROLLMENT' | 'TOTP_VERIFICATION';

export type AuthenticationChallengeType = Exclude<AuthenticationFlow, 'AUTHENTICATED'>;

export interface IssuedBrowserCredential {
  readonly bearerToken: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

export interface LoginResult {
  readonly next: AuthenticationFlow;
  readonly credential: IssuedBrowserCredential;
  readonly principal?: CurrentPrincipal;
}

export interface SessionAuthenticationResult {
  readonly sessionPublicId: string;
  readonly csrfTokenHash: Uint8Array;
  readonly principal: CurrentPrincipal;
}

export interface ChallengeAuthenticationResult {
  readonly challengePublicId: string;
  readonly userPublicId: string;
  readonly username: string;
  readonly csrfTokenHash: Uint8Array;
  readonly type: AuthenticationChallengeType;
}

export interface CurrentAuthenticationDto {
  readonly principal: CurrentPrincipal;
  readonly csrfToken: string;
}

export interface CurrentChallengeDto {
  readonly type: AuthenticationChallengeType;
  readonly csrfToken: string;
}

export interface TotpEnrollmentResult {
  readonly factorPublicId: string;
  readonly manualSecret: string;
  readonly enrollmentUri: string;
  readonly qrSvg: string;
}
