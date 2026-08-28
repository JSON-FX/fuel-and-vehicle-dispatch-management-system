import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { PasswordResetDialog } from '@/components/admin/password-reset-dialog';
import { RevokeSessionsDialog } from '@/components/admin/revoke-sessions-dialog';
import { TotpResetDialog } from '@/components/admin/totp-reset-dialog';
import { UserLifecycleDialog } from '@/components/admin/user-lifecycle-dialog';
import { UserIdentityForm, UserRoleForm } from '@/components/forms/user-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';

export default async function UserDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly userId: string }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const userId = (await params).userId;
  const [current, user, roles] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getUser.execute(session.principal, userId),
    composition.listRoles.execute(session.principal),
  ]);
  const permissions = session.principal.permissions;
  const isSelf = session.principal.userPublicId === user.publicId;
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/admin/users">
          <ArrowLeft aria-hidden="true" />
          Back to users
        </Link>
      </Button>
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{user.fullName}</h1>
          <Badge>{user.isDeleted ? 'Deleted' : user.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
        <p className="mt-2 font-mono text-sm text-muted-foreground">{user.username}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Account details</CardTitle>
            <CardDescription>Identity and activation state.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserIdentityForm user={user} csrfToken={current.csrfToken} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Access roles</CardTitle>
            <CardDescription>Changing roles revokes active sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserRoleForm
              userId={user.publicId}
              csrfToken={current.csrfToken}
              assignedRoleCodes={user.roles}
              roles={roles}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Security actions</CardTitle>
          <CardDescription>
            Every action is recorded. Administrative resets cannot target your own account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {!isSelf && permissions.includes('user.password.reset') ? (
            <PasswordResetDialog userId={user.publicId} csrfToken={current.csrfToken} />
          ) : null}
          {!isSelf && permissions.includes('user.totp.reset') ? (
            <TotpResetDialog userId={user.publicId} csrfToken={current.csrfToken} />
          ) : null}
          {permissions.includes('user.session.revoke') ? (
            <RevokeSessionsDialog userId={user.publicId} csrfToken={current.csrfToken} />
          ) : null}
          {!isSelf && permissions.includes('user.manage') ? (
            <UserLifecycleDialog
              userId={user.publicId}
              csrfToken={current.csrfToken}
              deleted={user.isDeleted}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
