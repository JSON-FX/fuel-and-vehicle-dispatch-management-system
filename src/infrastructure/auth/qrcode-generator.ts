import QRCode from 'qrcode';

import type { QrCodeGenerator } from '@/application/auth/ports/totp-service';

export class QrCodeSvgGenerator implements QrCodeGenerator {
  toSvg(content: string): Promise<string> {
    return QRCode.toString(content, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
    });
  }
}
