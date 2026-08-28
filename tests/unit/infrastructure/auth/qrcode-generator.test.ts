import { describe, expect, it } from 'vitest';

import { QrCodeSvgGenerator } from '@/infrastructure/auth/qrcode-generator';

describe('QrCodeSvgGenerator', () => {
  it('creates an in-memory SVG without embedding unsafe markup', async () => {
    const svg = await new QrCodeSvgGenerator().toSvg(
      'otpauth://totp/FVDMS:test?secret=JBSWY3DPEHPK3PXP',
    );

    expect(svg).toMatch(/^<svg/);
    expect(svg).not.toContain('<script');
  });
});
