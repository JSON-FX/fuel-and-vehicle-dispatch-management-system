import { Search, Users } from 'lucide-react';
import Link from 'next/link';

import { UserForm } from '@/components/forms/user-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getServerAuthentication, hasPermission } from '@/lib/auth/server-authentication';

export default async function UsersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly page?: string; readonly query?: string }>;
}) {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const principal = session.principal;
  if (!hasPermission(principal.permissions, 'user.read')) return <DeniedState />;
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const query = params.query?.trim();
  const [current, users, roles] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.listUsers.execute({
      actor: principal,
      page,
      pageSize: 25,
      ...(query ? { query } : {}),
    }),
    hasPermission(principal.permissions, 'role.read')
      ? composition.listRoles.execute(principal)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-2 text-muted-foreground">
            {users.total} account{users.total === 1 ? '' : 's'} found.
          </p>
        </div>
        {hasPermission(principal.permissions, 'user.manage') ? (
          <UserForm csrfToken={current.csrfToken} roles={roles} />
        ) : null}
      </header>
      <form className="flex max-w-xl gap-2" action="/admin/users">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-10"
            type="search"
            name="query"
            defaultValue={query}
            aria-label="Search users"
            placeholder="Search username, name, or email"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {users.items.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <Users className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-lg font-semibold">No users found</h2>
            <p className="text-sm text-muted-foreground">
              Clear the filter or create the first account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className="hidden overflow-x-auto rounded-lg border bg-card sm:block"
            role="region"
            aria-label="User results"
            tabIndex={0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.items.map((user) => (
                  <TableRow key={user.publicId}>
                    <TableCell className="font-mono">{user.username}</TableCell>
                    <TableCell>
                      <div>{user.fullName}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>{user.roles.join(', ') || 'None'}</TableCell>
                    <TableCell>
                      <Badge>
                        {user.isDeleted ? 'Deleted' : user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{user.mfaEnrolled ? 'Enrolled' : 'Not enrolled'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="link">
                        <Link href={`/admin/users/${user.publicId}`}>Manage</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 sm:hidden">
            {users.items.map((user) => (
              <Card key={user.publicId}>
                <CardContent className="space-y-3 pt-6">
                  <div>
                    <h2 className="font-heading font-semibold">{user.fullName}</h2>
                    <p className="font-mono text-sm text-muted-foreground">{user.username}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="font-semibold">Status</dt>
                      <dd>{user.isDeleted ? 'Deleted' : user.isActive ? 'Active' : 'Inactive'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">MFA</dt>
                      <dd>{user.mfaEnrolled ? 'Enrolled' : 'Not enrolled'}</dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/admin/users/${user.publicId}`}>Manage user</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      <nav aria-label="User pagination" className="flex items-center justify-between">
        <Button asChild variant="outline">
          <Link
            aria-disabled={page <= 1}
            href={`/admin/users?page=${Math.max(1, page - 1)}${query ? `&query=${encodeURIComponent(query)}` : ''}`}
          >
            Previous
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button asChild variant="outline">
          <Link
            aria-disabled={page * 25 >= users.total}
            href={`/admin/users?page=${page + 1}${query ? `&query=${encodeURIComponent(query)}` : ''}`}
          >
            Next
          </Link>
        </Button>
      </nav>
    </div>
  );
}

function DeniedState() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Your account does not have permission to view users.
        </p>
      </CardContent>
    </Card>
  );
}
