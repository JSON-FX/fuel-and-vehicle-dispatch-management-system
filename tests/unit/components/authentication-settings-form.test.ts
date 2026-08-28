import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationSettingsForm } from '@/components/admin/authentication-settings-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe('AuthenticationSettingsForm', () => {
  it('renders disabled MFA as the default with a labeled accessible switch', () => {
    const html = renderToStaticMarkup(
      createElement(AuthenticationSettingsForm, {
        settings: {
          mfaRequired: false,
          updatedAt: new Date('2026-08-28T00:00:00.000Z'),
          updatedByUserPublicId: null,
        },
        csrfToken: 'csrf-token',
      }),
    );

    expect(html).toContain('Multi-factor authentication is disabled');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('Require authenticator codes');
    expect(html).toContain('Save security setting');
  });

  it('explains the session impact when MFA is selected', () => {
    const html = renderToStaticMarkup(
      createElement(AuthenticationSettingsForm, {
        settings: {
          mfaRequired: true,
          updatedAt: new Date('2026-08-28T12:00:00.000Z'),
          updatedByUserPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
        },
        csrfToken: 'csrf-token',
      }),
    );

    expect(html).toContain('Multi-factor authentication is enabled');
    expect(html).toContain('checked=""');
    expect(html).toContain('signs out every privileged account');
  });
});
