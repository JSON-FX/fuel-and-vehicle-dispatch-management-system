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
  constructor(message = 'The request conflicts with the current resource state.') {
    super('CONFLICT', message, 409);
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
