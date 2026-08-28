'use client';

import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { OneTimeCredentialDialog } from '@/components/admin/one-time-credential-dialog';
import { SecurityActionDialog } from '@/components/admin/security-action-dialog';
import { Button } from '@/components/ui/button';

export function PasswordResetDialog({
  userId,
  csrfToken,
}: {
  readonly userId: string;
  readonly csrfToken: string;
}) {
  const [credential, setCredential] = useState<string | null>(null);
  return (
    <>
      <SecurityActionDialog
        title="Reset password"
        description="This revokes the user's sessions and creates a one-time temporary password."
        actionLabel="Reset password"
        endpoint={`/api/users/${userId}/password-reset`}
        csrfToken={csrfToken}
        trigger={
          <Button type="button" variant="outline">
            <KeyRound aria-hidden="true" />
            Reset password
          </Button>
        }
        onSuccess={(data) =>
          setCredential((data as { temporaryPassword: string }).temporaryPassword)
        }
      />
      <OneTimeCredentialDialog credential={credential} onClose={() => setCredential(null)} />
    </>
  );
}
