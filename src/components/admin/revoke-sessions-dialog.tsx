'use client';

import { LogOut } from 'lucide-react';

import { SecurityActionDialog } from '@/components/admin/security-action-dialog';
import { Button } from '@/components/ui/button';

export function RevokeSessionsDialog({
  userId,
  csrfToken,
}: {
  readonly userId: string;
  readonly csrfToken: string;
}) {
  return (
    <SecurityActionDialog
      title="Revoke sessions"
      description="Every active session for this user will end immediately."
      actionLabel="Revoke sessions"
      endpoint={`/api/users/${userId}/sessions/revoke`}
      csrfToken={csrfToken}
      trigger={
        <Button type="button" variant="outline">
          <LogOut aria-hidden="true" />
          Revoke sessions
        </Button>
      }
    />
  );
}
