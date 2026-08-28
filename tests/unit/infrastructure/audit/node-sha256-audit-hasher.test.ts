import { describe, expect, it } from 'vitest';

import {
  buildAuditRecordPreimage,
  NodeSha256AuditHasher,
} from '@/infrastructure/audit/node-sha256-audit-hasher';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const payload = new TextEncoder().encode('{"a":"é","b":1}');
const zeroHash = new Uint8Array(32);

describe('NodeSha256AuditHasher', () => {
  const hasher = new NodeSha256AuditHasher();

  it('builds the exact domain-separated version-one genesis preimage', () => {
    expect(
      hex(
        buildAuditRecordPreimage({
          formatVersion: 1,
          sequence: '1',
          previousHash: zeroHash,
          canonicalPayload: payload,
        }),
      ),
    ).toBe(
      '4656444d532d41554449540100000000000000010000000000000000000000000000000000000000000000000000000000000000000000107b2261223a22c3a9222c2262223a317d',
    );
  });

  it('matches fixed genesis and linked-record SHA-256 vectors', () => {
    const first = hasher.hashRecord({
      formatVersion: 1,
      sequence: '1',
      previousHash: zeroHash,
      canonicalPayload: payload,
    });
    const second = hasher.hashRecord({
      formatVersion: 1,
      sequence: '2',
      previousHash: first,
      canonicalPayload: payload,
    });

    expect(hex(first)).toBe('3407daf450ffa55f4d384bdc9de3b594e9480f7599855e2850bae717a7bf2a60');
    expect(hex(second)).toBe('75fea59a2eeb8d57e598cf91e3a8889880bf6a12be6de6ee7a724008e2ac0e63');
  });

  it('changes when the sequence, link, or exact payload bytes change', () => {
    const baseline = hex(
      hasher.hashRecord({
        formatVersion: 1,
        sequence: '1',
        previousHash: zeroHash,
        canonicalPayload: payload,
      }),
    );

    const mutatedSequence = hex(
      hasher.hashRecord({
        formatVersion: 1,
        sequence: '2',
        previousHash: zeroHash,
        canonicalPayload: payload,
      }),
    );
    const mutatedLink = hex(
      hasher.hashRecord({
        formatVersion: 1,
        sequence: '1',
        previousHash: new Uint8Array(32).fill(1),
        canonicalPayload: payload,
      }),
    );
    const mutatedPayload = hex(
      hasher.hashRecord({
        formatVersion: 1,
        sequence: '1',
        previousHash: zeroHash,
        canonicalPayload: new TextEncoder().encode('{"a":"e","b":1}'),
      }),
    );

    expect(new Set([baseline, mutatedSequence, mutatedLink, mutatedPayload])).toHaveLength(4);
  });

  it('rejects malformed sequence, link, version, and oversized byte lengths', () => {
    expect(() =>
      buildAuditRecordPreimage({
        formatVersion: 1,
        sequence: '0',
        previousHash: zeroHash,
        canonicalPayload: payload,
      }),
    ).toThrowError(/sequence/i);
    expect(() =>
      buildAuditRecordPreimage({
        formatVersion: 1,
        sequence: '1',
        previousHash: new Uint8Array(31),
        canonicalPayload: payload,
      }),
    ).toThrowError(/32 bytes/i);
    expect(() =>
      buildAuditRecordPreimage({
        formatVersion: 2 as 1,
        sequence: '1',
        previousHash: zeroHash,
        canonicalPayload: payload,
      }),
    ).toThrowError(/version/i);
  });

  it('creates a stable delivery fingerprint and detects any changed evidence', () => {
    const recordHash = hasher.hashRecord({
      formatVersion: 1,
      sequence: '1',
      previousHash: zeroHash,
      canonicalPayload: payload,
    });
    const input = {
      sequence: '1',
      eventPublicId: '01900000-0000-7000-8000-000000000301',
      canonicalPayload: payload,
      previousHash: zeroHash,
      recordHash,
    };

    const first = hex(hasher.hashDelivery(input));
    const retry = hex(hasher.hashDelivery(input));
    const changed = hex(hasher.hashDelivery({ ...input, sequence: '2' }));

    expect(retry).toBe(first);
    expect(changed).not.toBe(first);
  });
});
