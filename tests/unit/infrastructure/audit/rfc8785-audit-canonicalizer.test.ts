import { describe, expect, it } from 'vitest';

import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('Rfc8785AuditCanonicalizer', () => {
  const canonicalizer = new Rfc8785AuditCanonicalizer();

  it('uses RFC 8785 UTF-16 property ordering and deterministic string escaping', () => {
    const value = {
      '\u20ac': 'Euro Sign',
      '\r': 'Carriage Return',
      '\ufb33': 'Hebrew Letter Dalet With Dagesh',
      '1': 'One',
      '\ud83d\ude00': 'Emoji: Grinning Face',
      '\u0080': 'Control',
      '\u00f6': 'Latin Small Letter O With Diaeresis',
      escaped: 'line\n"quoted"',
    };

    expect(text(canonicalizer.canonicalize(value, 65_536))).toBe(
      '{"\\r":"Carriage Return","1":"One","escaped":"line\\n\\"quoted\\"","\u0080":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}',
    );
  });

  it('measures the final UTF-8 bytes instead of JavaScript string units', () => {
    const value = { text: 'é' };
    const canonical = canonicalizer.canonicalize(value, 65_536);

    expect(text(canonical)).toBe('{"text":"é"}');
    expect(canonical.byteLength).toBe(13);
    expect(() => canonicalizer.canonicalize(value, 12)).toThrowError(/bytes/i);
  });

  it('validates runtime values again at the infrastructure boundary', () => {
    expect(() => canonicalizer.canonicalize({ amount: 1.5 }, 65_536)).toThrowError(
      /safe integers/i,
    );
    expect(() => canonicalizer.canonicalize({ value: -0 }, 65_536)).toThrowError(/negative zero/i);
    expect(() =>
      canonicalizer.canonicalize(Object.fromEntries([['__proto__', 'unsafe']]), 65_536),
    ).toThrowError(/prototype/i);
  });

  it('accepts exact stored canonical text and rejects rewritten representations', () => {
    const canonical = '{"a":"é","b":1}';

    expect(text(canonicalizer.validateCanonicalText(canonical, 65_536))).toBe(canonical);

    expect(() => canonicalizer.validateCanonicalText('{ "a":"é","b":1}', 65_536)).toThrowError(
      /canonical/i,
    );
    expect(() => canonicalizer.validateCanonicalText('{"b":1,"a":"é"}', 65_536)).toThrowError(
      /canonical/i,
    );
    expect(() => canonicalizer.validateCanonicalText('{"value":-0}', 65_536)).toThrowError(
      /negative zero/i,
    );
    expect(() => canonicalizer.validateCanonicalText('{not-json}', 65_536)).toThrowError(/JSON/i);
  });
});
