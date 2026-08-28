import type { ReactNode } from 'react';

import { ProtectedNavigation } from '@/components/navigation/protected-navigation';
import { hasPermission, getServerAuthentication } from '@/lib/auth/server-authentication';

export default async function ProtectedLayout({ children }: { readonly children: ReactNode }) {
  const { session } = await getServerAuthentication();
  const permissions = session.principal.permissions;
  const navigationAccess = {
    audit: hasPermission(permissions, 'audit.read'),
    budget:
      hasPermission(permissions, 'budget.read') || hasPermission(permissions, 'budget.manage'),
    dispatch: hasPermission(permissions, 'dispatch.read'),
    drivers: hasPermission(permissions, 'driver.manage'),
    fuel: hasPermission(permissions, 'fuel.read'),
    offices: hasPermission(permissions, 'office.manage'),
    roles: hasPermission(permissions, 'role.read'),
    security: hasPermission(permissions, 'auth.settings.manage'),
    users: hasPermission(permissions, 'user.read'),
    vehicles: hasPermission(permissions, 'vehicle.manage'),
  };

  return <ProtectedNavigation access={navigationAccess}>{children}</ProtectedNavigation>;
}
