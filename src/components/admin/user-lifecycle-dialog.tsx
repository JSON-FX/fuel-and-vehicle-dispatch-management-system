'use client';

import { ArchiveRestore, Trash2 } from 'lucide-react';

import { SecurityActionDialog } from '@/components/admin/security-action-dialog';
import { Button } from '@/components/ui/button';

export function UserLifecycleDialog({
  userId,
  csrfToken,
  deleted,
}: {
  readonly userId: string;
  readonly csrfToken: string;
  readonly deleted: boolean;
}) {
  if (deleted) {
    return (
      <SecurityActionDialog
        title="Restore user"
        description="The account will be restored as inactive. Prior sessions remain revoked."
        actionLabel="Restore user"
        endpoint={`/api/users/${userId}/restore`}
        csrfToken={csrfToken}
        trigger={
          <Button type="button" variant="outline">
            <ArchiveRestore aria-hidden="true" />
            Restore user
          </Button>
        }
      />
    );
  }
  return (
    <SecurityActionDialog
      title="Delete user"
      description="This soft-deletes the account and immediately revokes its sessions."
      actionLabel="Delete user"
      endpoint={`/api/users/${userId}`}
      method="DELETE"
      csrfToken={csrfToken}
      trigger={
        <Button type="button" variant="destructive">
          <Trash2 aria-hidden="true" />
          Delete user
        </Button>
      }
    />
  );
}
