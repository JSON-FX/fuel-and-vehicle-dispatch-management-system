import { Building2, CarFront, FileSearch, IdCard, Landmark, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { LogoutButton } from '@/components/auth/logout-button';
import { hasPermission, getServerAuthentication } from '@/lib/auth/server-authentication';

export default async function ProtectedLayout({ children }: { readonly children: ReactNode }) {
  const { session } = await getServerAuthentication();
  const permissions = session.principal.permissions;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/account"
            className="mr-auto flex min-h-11 items-center gap-2 font-heading font-semibold"
          >
            <Building2 className="size-5 text-accent" aria-hidden="true" />
            <span>FVDMS</span>
          </Link>
          <nav
            aria-label="Primary navigation"
            className="order-3 flex w-full flex-wrap gap-1 sm:order-none sm:w-auto"
          >
            <Link
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-muted"
              href="/account"
            >
              Account
            </Link>
            {hasPermission(permissions, 'user.read') ? (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-muted"
                href="/admin/users"
              >
                <Users className="size-4" aria-hidden="true" />
                Users
              </Link>
            ) : null}
            {hasPermission(permissions, 'role.read') ? (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-muted"
                href="/admin/roles"
              >
                <Shield className="size-4" aria-hidden="true" />
                Roles
              </Link>
            ) : null}
            {hasPermission(permissions, 'office.manage') ? (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-muted"
                href="/admin/offices"
              >
                <Landmark className="size-4" aria-hidden="true" />
                Offices
              </Link>
            ) : null}
            {hasPermission(permissions, 'driver.manage') ? (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-muted"
                href="/admin/drivers"
              >
                <IdCard className="size-4" aria-hidden="true" />
                Drivers
              </Link>
            ) : null}
            {hasPermission(permissions, 'vehicle.manage') ? (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-muted"
                href="/admin/vehicles"
              >
                <CarFront className="size-4" aria-hidden="true" />
                Vehicles
              </Link>
            ) : null}
            {hasPermission(permissions, 'audit.read') ? (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-muted"
                href="/audit"
              >
                <FileSearch className="size-4" aria-hidden="true" />
                Audit trail
              </Link>
            ) : null}
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
