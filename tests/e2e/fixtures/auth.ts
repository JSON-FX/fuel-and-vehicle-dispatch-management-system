import * as OTPAuth from 'otpauth';
import type { Page } from '@playwright/test';

export const credentials = {
  standard: { username: 'dispatch.e2e', password: 'StandardPassword123!' },
  forced: {
    username: 'forced.e2e',
    password: 'TemporaryPassword123!',
    replacement: 'ReplacementPassword123!',
  },
  enrollment: { username: 'enrollment.e2e', password: 'PrivilegedPassword123!' },
  administrator: {
    username: 'admin.e2e',
    password: 'AdministratorPassword123!',
    secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  },
  viewer: { username: 'viewer.e2e', password: 'ViewerPassword123!' },
} as const;

export async function login(
  page: Page,
  account: { readonly username: string; readonly password: string; readonly secret?: string },
  totpOffsetMs = 0,
) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(account.username);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname !== '/login');
  if (account.secret !== undefined) {
    await page.waitForURL('**/mfa/challenge');
    await page.getByLabel('Authenticator code').fill(currentTotp(account.secret, totpOffsetMs));
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await page.waitForURL('**/account');
  }
}

export function currentTotp(secret: string, offsetMs = 0): string {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  return totp.generate({ timestamp: Date.now() + offsetMs });
}
