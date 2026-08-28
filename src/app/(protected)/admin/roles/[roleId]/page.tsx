import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { RolePermissionForm } from '@/components/forms/role-permission-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication, hasPermission } from '@/lib/auth/server-authentication';

export default async function RoleDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly roleId: string }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const roleId = (await params).roleId;
  const [current, role, permissions] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getRole.execute(session.principal, roleId),
    composition.listPermissions.execute(session.principal),
  ]);
  return (
    <div className="space-y-6">
      <Button asChild variant="link">
        <Link href="/admin/roles">
          <ArrowLeft aria-hidden="true" />
          Back to roles
        </Link>
      </Button>
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{role.name}</h1>
          <Badge>{role.isActive ? 'Active' : 'Inactive'}</Badge>
          <Badge>{role.isPrivileged ? 'Privileged' : 'Standard'}</Badge>
        </div>
        <code className="mt-2 block text-sm text-muted-foreground">{role.code}</code>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Role configuration</CardTitle>
          <CardDescription>
            Permission changes take effect after affected sessions are revoked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPermission(session.principal.permissions, 'role.manage') ? (
            <RolePermissionForm
              csrfToken={current.csrfToken}
              permissions={permissions}
              role={role}
              canAssignPrivileged={hasPermission(
                session.principal.permissions,
                'role.assign_privileged',
              )}
            />
          ) : (
            <p className="text-muted-foreground">You can view this role but cannot change it.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
