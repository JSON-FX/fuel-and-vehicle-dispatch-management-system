import { Shield } from 'lucide-react';
import Link from 'next/link';

import { RolePermissionForm } from '@/components/forms/role-permission-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getServerAuthentication, hasPermission } from '@/lib/auth/server-authentication';

export default async function RolesPage() {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const principal = session.principal;
  if (!hasPermission(principal.permissions, 'role.read')) return <DeniedState />;
  const [current, roles, permissions] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.listRoles.execute(principal),
    composition.listPermissions.execute(principal),
  ]);
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Roles and permissions
          </h1>
          <p className="mt-2 text-muted-foreground">
            {roles.length} role{roles.length === 1 ? '' : 's'} in the access catalog.
          </p>
        </div>
        {hasPermission(principal.permissions, 'role.manage') ? (
          <RolePermissionForm
            csrfToken={current.csrfToken}
            permissions={permissions}
            canAssignPrivileged={hasPermission(principal.permissions, 'role.assign_privileged')}
          />
        ) : null}
      </header>
      {roles.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <Shield className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-lg font-semibold">No roles available</h2>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className="hidden overflow-x-auto rounded-lg border bg-card sm:block"
            role="region"
            aria-label="Role results"
            tabIndex={0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.publicId}>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>
                      <code>{role.code}</code>
                    </TableCell>
                    <TableCell>
                      <Badge>
                        {role.isSystem ? 'Seeded' : 'Custom'} ·{' '}
                        {role.isPrivileged ? 'Privileged' : 'Standard'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{role.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell>{role.permissions.length}</TableCell>
                    <TableCell>
                      <Button asChild variant="link">
                        <Link href={`/admin/roles/${role.publicId}`}>Manage</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 sm:hidden">
            {roles.map((role) => (
              <Card key={role.publicId}>
                <CardContent className="space-y-3 pt-6">
                  <div>
                    <h2 className="font-heading font-semibold">{role.name}</h2>
                    <code className="text-xs text-muted-foreground">{role.code}</code>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{role.isActive ? 'Active' : 'Inactive'}</Badge>
                    <Badge>{role.isPrivileged ? 'Privileged' : 'Standard'}</Badge>
                    <Badge>{role.permissions.length} permissions</Badge>
                  </div>
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/admin/roles/${role.publicId}`}>Manage role</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function DeniedState() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Your account does not have permission to view roles.
        </p>
      </CardContent>
    </Card>
  );
}
