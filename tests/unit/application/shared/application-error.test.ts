import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  ExternalDependencyError,
  NotFoundError,
  PersistenceError,
  ValidationError,
} from '@/application/shared/errors/application-error';

describe('ApplicationError categories', () => {
  it.each([
    [new AuthenticationError(), 401, 'AUTHENTICATION_REQUIRED'],
    [new AuthorizationError(), 403, 'FORBIDDEN'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError(), 409, 'CONFLICT'],
    [new BusinessRuleError(), 422, 'BUSINESS_RULE_VIOLATION'],
    [new PersistenceError(), 500, 'PERSISTENCE_ERROR'],
    [new ExternalDependencyError(), 503, 'DEPENDENCY_UNAVAILABLE'],
  ])('maps %s to HTTP %i and code %s', (error, status, code) => {
    expect(error.httpStatus).toBe(status);
    expect(error.code).toBe(code);
  });

  it('preserves structured validation details', () => {
    const error = new ValidationError([
      { field: 'issuedLiters', reason: 'Must be greater than zero.' },
    ]);

    expect(error.httpStatus).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([
      { field: 'issuedLiters', reason: 'Must be greater than zero.' },
    ]);
  });
});
