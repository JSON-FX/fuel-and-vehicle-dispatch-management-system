import { describe, expect, it } from 'vitest';

import { sanitizeSpreadsheetText } from '@/infrastructure/reporting/spreadsheet-text-sanitizer';

describe('spreadsheet text sanitizer', () => {
  it.each([
    '=SUM(A1:A2)',
    '+1+1',
    '-2+3',
    '@IMPORTXML("x")',
    '\t=CMD()',
    '\r\n+CMD()',
    '  =SUM(A1:A2)',
    '＝SUM(A1:A2)',
    '＋1+1',
    '－2+3',
    '＠IMPORTXML("x")',
  ])('protects dangerous leading content as text: %s', (value) => {
    expect(sanitizeSpreadsheetText(value)).toMatch(/^'/);
  });

  it('normalizes control characters without changing ordinary text', () => {
    expect(sanitizeSpreadsheetText('District\tHospital\nOfficial')).toBe(
      'District Hospital Official',
    );
    expect(sanitizeSpreadsheetText('Provincial Capitol')).toBe('Provincial Capitol');
  });
});
