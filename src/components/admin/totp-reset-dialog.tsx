'use client';

import { ShieldOff } from 'lucide-react';

import { SecurityActionDialog } from '@/components/admin/security-action-dialog';
import { Button } from '@/components/ui/button';

export function TotpResetDialog({
  userId,
  csrfToken,
}: {
  readonly userId: string;
  readonly csrfToken: string;
}) {
  return (
    <SecurityActionDialog
      title="Reset authenticator"
      description="This disables the factor and revokes every active session. Privileged users must enroll again."
      actionLabel="Reset authenticator"
      endpoint={`/api/users/${userId}/totp-reset`}
      csrfToken={csrfToken}
      trigger={
        <Button type="button" variant="outline">
          <ShieldOff aria-hidden="true" />
          Reset MFA
        </Button>
      }
    />
  );
}
