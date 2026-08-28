'use client';

import {
  Building2,
  CarFront,
  ChevronDown,
  CircleUserRound,
  FileSearch,
  Fuel,
  IdCard,
  Landmark,
  LockKeyhole,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Shield,
  SlidersHorizontal,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface ProtectedNavigationAccess {
  readonly audit: boolean;
  readonly budget: boolean;
  readonly dispatch: boolean;
  readonly dispatchSettings: boolean;
  readonly drivers: boolean;
  readonly fuel: boolean;
  readonly offices: boolean;
  readonly roles: boolean;
  readonly security: boolean;
  readonly users: boolean;
  readonly vehicles: boolean;
}

interface NavigationItem {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
}

interface NavigationGroup {
  readonly collapsible?: boolean;
  readonly items: readonly NavigationItem[];
  readonly label: string;
}

interface NavigationPanelProps {
  readonly access: ProtectedNavigationAccess;
  readonly collapsed?: boolean;
  readonly logoutControl?: ReactNode;
  readonly onNavigate?: () => void;
  readonly onToggleCollapsed?: () => void;
  readonly pathname: string;
}

export function ProtectedNavigation({
  access,
  children,
}: {
  readonly access: ProtectedNavigationAccess;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className={cn(
        'min-h-dvh bg-background lg:grid lg:transition-[grid-template-columns] lg:duration-200 lg:motion-reduce:transition-none',
        desktopCollapsed
          ? 'lg:grid-cols-[4.5rem_minmax(0,1fr)]'
          : 'lg:grid-cols-[17rem_minmax(0,1fr)]',
      )}
    >
      <aside
        aria-label="Application navigation"
        className="sticky top-0 hidden h-dvh w-full border-r bg-card lg:block"
      >
        <NavigationPanel
          access={access}
          collapsed={desktopCollapsed}
          logoutControl={<LogoutButton iconOnly={desktopCollapsed} />}
          onToggleCollapsed={() => setDesktopCollapsed((current) => !current)}
          pathname={pathname}
        />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Open navigation">
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Primary application destinations and account controls.
              </SheetDescription>
              <NavigationPanel
                access={access}
                logoutControl={<LogoutButton />}
                onNavigate={() => setMobileOpen(false)}
                pathname={pathname}
              />
            </SheetContent>
          </Sheet>
          <BrandLink compact />
        </header>
        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function NavigationPanel({
  access,
  collapsed = false,
  logoutControl,
  onNavigate,
  onToggleCollapsed,
  pathname,
}: NavigationPanelProps) {
  const groups = createNavigationGroups(access);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex min-h-[4.75rem] items-center border-b py-4',
          collapsed ? 'justify-center px-2' : 'gap-2 px-4 pr-16 lg:pr-3',
        )}
      >
        {collapsed ? null : <BrandLink />}
        {onToggleCollapsed === undefined ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="shrink-0"
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
      <nav
        aria-label="Primary navigation"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto py-4',
          collapsed ? 'space-y-2 px-2' : 'space-y-5 px-3',
        )}
      >
        {groups.map((group) =>
          group.collapsible && !collapsed ? (
            <CollapsibleNavigationGroup
              group={group}
              key={group.label}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ) : (
            <NavigationSection
              collapsed={collapsed}
              group={group}
              key={group.label}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ),
        )}
      </nav>
      <div className={cn('space-y-2 border-t', collapsed ? 'p-2' : 'p-3')}>
        <NavigationLink
          collapsed={collapsed}
          item={{ href: '/account', icon: CircleUserRound, label: 'Account' }}
          onNavigate={onNavigate}
          pathname={pathname}
        />
        {logoutControl === undefined ? null : (
          <div
            className={cn(
              collapsed ? 'flex justify-center' : '[&>button]:w-full [&>button]:justify-start',
            )}
          >
            {logoutControl}
          </div>
        )}
      </div>
    </div>
  );
}

function BrandLink({ compact = false }: { readonly compact?: boolean }) {
  return (
    <Link
      href="/account"
      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md font-heading font-semibold"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        <Building2 className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block leading-5">FVDMS</span>
        {compact ? null : (
          <span className="block truncate font-sans text-xs font-normal text-muted-foreground">
            Operations console
          </span>
        )}
      </span>
    </Link>
  );
}

function NavigationSection({
  collapsed,
  group,
  onNavigate,
  pathname,
}: {
  readonly collapsed: boolean;
  readonly group: NavigationGroup;
  readonly onNavigate: (() => void) | undefined;
  readonly pathname: string;
}) {
  return (
    <section
      aria-label={group.label}
      className={cn(collapsed && 'border-t pt-2 first:border-t-0 first:pt-0')}
    >
      <p
        className={cn(
          'px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground',
          collapsed && 'sr-only',
        )}
      >
        {group.label}
      </p>
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavigationLink
            collapsed={collapsed}
            item={item}
            key={item.href}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        ))}
      </div>
    </section>
  );
}

function CollapsibleNavigationGroup({
  group,
  onNavigate,
  pathname,
}: {
  readonly group: NavigationGroup;
  readonly onNavigate: (() => void) | undefined;
  readonly pathname: string;
}) {
  const contentId = useId();
  const containsCurrentPage = group.items.some((item) => isActivePath(pathname, item.href));
  const [open, setOpen] = useState(false);
  const displayedOpen = open || containsCurrentPage;

  return (
    <details
      className="group"
      open={displayedOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        aria-controls={contentId}
        aria-expanded={displayedOpen}
        className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md px-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none [&::-webkit-details-marker]:hidden"
      >
        {group.label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
            displayedOpen && 'rotate-180',
          )}
        />
      </summary>
      <div id={contentId} className="mt-1 space-y-1 pl-3">
        {group.items.map((item) => (
          <NavigationLink
            collapsed={false}
            item={item}
            key={item.href}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        ))}
      </div>
    </details>
  );
}

function NavigationLink({
  collapsed,
  item,
  onNavigate,
  pathname,
}: {
  readonly collapsed: boolean;
  readonly item: NavigationItem;
  readonly onNavigate: (() => void) | undefined;
  readonly pathname: string;
}) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-sm transition-colors duration-200 motion-reduce:transition-none',
        collapsed && 'justify-center px-0',
        active
          ? 'border-accent bg-accent/10 font-semibold text-accent'
          : 'border-transparent text-foreground hover:bg-muted',
      )}
      href={item.href}
      {...(collapsed ? { title: item.label } : {})}
      {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
    >
      <Icon className={cn('shrink-0', collapsed ? 'size-5' : 'size-4')} aria-hidden="true" />
      <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
    </Link>
  );
}

function createNavigationGroups(access: ProtectedNavigationAccess): readonly NavigationGroup[] {
  const groups: NavigationGroup[] = [
    {
      label: 'Operations',
      items: compactItems([
        access.dispatch ? { href: '/dispatches', icon: Route, label: 'Vehicle dispatches' } : null,
        access.fuel ? { href: '/fuel-issuances', icon: Fuel, label: 'Fuel issuances' } : null,
        access.budget
          ? { href: '/budget-allocations', icon: WalletCards, label: 'Budget allocations' }
          : null,
      ]),
    },
    {
      collapsible: true,
      label: 'Master data',
      items: compactItems([
        access.offices ? { href: '/admin/offices', icon: Landmark, label: 'Offices' } : null,
        access.drivers ? { href: '/admin/drivers', icon: IdCard, label: 'Drivers' } : null,
        access.vehicles ? { href: '/admin/vehicles', icon: CarFront, label: 'Vehicles' } : null,
      ]),
    },
    {
      collapsible: true,
      label: 'Administration',
      items: compactItems([
        access.users ? { href: '/admin/users', icon: Users, label: 'Users' } : null,
        access.roles ? { href: '/admin/roles', icon: Shield, label: 'Roles' } : null,
        access.security ? { href: '/admin/security', icon: LockKeyhole, label: 'Security' } : null,
        access.dispatchSettings
          ? {
              href: '/admin/dispatch-settings',
              icon: SlidersHorizontal,
              label: 'Dispatch settings',
            }
          : null,
      ]),
    },
    {
      label: 'Oversight',
      items: compactItems([
        access.audit ? { href: '/audit', icon: FileSearch, label: 'Audit trail' } : null,
      ]),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}

function compactItems(items: readonly (NavigationItem | null)[]): readonly NavigationItem[] {
  return items.filter((item): item is NavigationItem => item !== null);
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/account' && pathname.startsWith(`${href}/`));
}
