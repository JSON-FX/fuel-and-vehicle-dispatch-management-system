import { describe, expect, it } from 'vitest';

import { AuditChainRecord } from '@/domain/audit/entities/audit-chain-record';
import { AuditEvent } from '@/domain/audit/entities/audit-event';
import { DomainError } from '@/domain/shared/errors/domain-error';

const EVENT_ID = '01900000-0000-7000-8000-000000000101';
const ACTOR_ID = '01900000-0000-7000-8000-000000000102';
const ENTITY_ID = '01900000-0000-7000-8000-000000000103';

const validEvent = () => ({
  publicId: EVENT_ID,
  schemaVersion: 1 as const,
  occurredAt: '2026-08-28T00:00:00.000Z',
  actorPublicId: ACTOR_ID,
  action: 'auth.login.failed',
  entity: { type: 'user', publicId: ENTITY_ID },
  requestId: '01900000-0000-7000-8000-000000000104',
  ipAddress: '2001:db8::1',
  userAgent: 'Example browser',
  reasonCode: 'invalid_credentials',
  before: null,
  after: { status: 'locked' },
  metadata: { attemptCount: 3 },
});

describe('AuditEvent', () => {
  it('creates an immutable version-one event with normalized values', () => {
    const event = AuditEvent.create({
      ...validEvent(),
      action: ' AUTH.Login.Failed ',
    });

    expect(event.toPrimitives()).toEqual({
      ...validEvent(),
      action: 'auth.login.failed',
    });
    expect(Object.isFrozen(event.toPrimitives())).toBe(true);
  });

  it.each([
    ['schema version', { schemaVersion: 2 }],
    ['event public ID', { publicId: 'not-a-public-id' }],
    ['actor public ID', { actorPublicId: 'not-a-public-id' }],
    ['entity public ID', { entity: { type: 'user', publicId: 'not-a-public-id' } }],
    ['entity type', { entity: { type: 'User record', publicId: ENTITY_ID } }],
    ['timestamp timezone', { occurredAt: '2026-08-28T08:00:00.000+08:00' }],
    ['timestamp precision', { occurredAt: '2026-08-28T00:00:00Z' }],
    ['request ID', { requestId: '' }],
    ['IP address', { ipAddress: '999.1.1.1' }],
    ['user agent', { userAgent: 'x'.repeat(513) }],
    ['reason code', { reasonCode: 'Internal error: password=secret' }],
  ])('rejects an invalid %s', (_label, patch) => {
    expect(() => AuditEvent.create({ ...validEvent(), ...patch })).toThrow(DomainError);
  });

  it('allows system events and events without an entity or optional context', () => {
    const event = AuditEvent.create({
      ...validEvent(),
      actorPublicId: null,
      entity: null,
      ipAddress: null,
      userAgent: null,
      reasonCode: null,
      before: null,
      after: null,
      metadata: null,
    });

    expect(event.toPrimitives().actorPublicId).toBeNull();
    expect(event.toPrimitives().entity).toBeNull();
  });
});

describe('AuditChainRecord', () => {
  it('keeps exact canonical text and defensive 32-byte hashes', () => {
    const previousHash = new Uint8Array(32);
    const recordHash = new Uint8Array(32).fill(7);
    const record = AuditChainRecord.create({
      sequence: '1',
      sourcePosition: '42',
      sourceEventPublicId: EVENT_ID,
      canonicalPayload: '{"schemaVersion":1}',
      previousHash,
      recordHash,
      chainedAt: '2026-08-28T00:00:01.000Z',
    });

    previousHash[0] = 9;
    recordHash[0] = 9;

    expect(record.previousHash[0]).toBe(0);
    expect(record.recordHash[0]).toBe(7);
    expect(record.sequence).toBe('1');
  });

  it.each([
    ['zero sequence', { sequence: '0' }],
    ['leading-zero source position', { sourcePosition: '042' }],
    ['invalid source event', { sourceEventPublicId: 'event' }],
    ['short previous hash', { previousHash: new Uint8Array(31) }],
    ['short record hash', { recordHash: new Uint8Array(31) }],
    ['non-UTC chained time', { chainedAt: '2026-08-28T08:00:01.000+08:00' }],
  ])('rejects %s', (_label, patch) => {
    expect(() =>
      AuditChainRecord.create({
        sequence: '1',
        sourcePosition: '42',
        sourceEventPublicId: EVENT_ID,
        canonicalPayload: '{"schemaVersion":1}',
        previousHash: new Uint8Array(32),
        recordHash: new Uint8Array(32),
        chainedAt: '2026-08-28T00:00:01.000Z',
        ...patch,
      }),
    ).toThrow(DomainError);
  });
});
