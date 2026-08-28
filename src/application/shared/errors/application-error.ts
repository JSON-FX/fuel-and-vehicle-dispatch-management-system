export interface ErrorDetail {
  readonly field?: string;
  readonly reason: string;
}

export abstract class ApplicationError extends Error {
  protected constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details: readonly ErrorDetail[] = [],
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
  }
}

export class ValidationError extends ApplicationError {
  constructor(details: readonly ErrorDetail[] = []) {
    super('VALIDATION_ERROR', 'The request contains invalid data.', 400, details);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor() {
    super('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  }
}

export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super('INVALID_CREDENTIALS', 'The username or password is invalid.', 401);
  }
}

export class RateLimitedError extends ApplicationError {
  constructor() {
    super('AUTH_RATE_LIMITED', 'Too many authentication attempts. Try again later.', 429);
  }
}

export class SessionExpiredError extends ApplicationError {
  constructor() {
    super('SESSION_EXPIRED', 'The session has expired. Sign in again.', 401);
  }
}

export class ForcedAuthenticationFlowError extends ApplicationError {
  constructor(public readonly next: 'PASSWORD_CHANGE' | 'TOTP_ENROLLMENT' | 'TOTP_VERIFICATION') {
    super('AUTH_FLOW_REQUIRED', 'Complete the required authentication step.', 403);
  }
}

export class CsrfError extends ApplicationError {
  constructor() {
    super('CSRF_INVALID', 'The request could not be verified.', 403);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor() {
    super('FORBIDDEN', 'You are not allowed to perform this action.', 403);
  }
}

export class NotFoundError extends ApplicationError {
  constructor() {
    super('NOT_FOUND', 'The requested resource was not found.', 404);
  }
}

export class ConflictError extends ApplicationError {
  constructor(
    message = 'The request conflicts with the current resource state.',
    details: readonly ErrorDetail[] = [],
  ) {
    super('CONFLICT', message, 409, details);
  }
}

export class BusinessRuleError extends ApplicationError {
  constructor(message = 'A business rule prevents this operation.') {
    super('BUSINESS_RULE_VIOLATION', message, 422);
  }
}

export class PersistenceError extends ApplicationError {
  constructor(cause?: unknown) {
    super('PERSISTENCE_ERROR', 'A persistence operation failed.', 500, [], cause);
  }
}

export class ExternalDependencyError extends ApplicationError {
  constructor(cause?: unknown) {
    super('DEPENDENCY_UNAVAILABLE', 'A required service is unavailable.', 503, [], cause);
  }
}
