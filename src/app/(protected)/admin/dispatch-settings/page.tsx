import { Globe2, ShieldAlert } from 'lucide-react';

import { DispatchScheduleSettingsForm } from '@/components/admin/dispatch-schedule-settings-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import { authorizeDispatchSettingsPageAccess } from '@/lib/dispatch/server-dispatch-access';

export const dynamic = 'force-dynamic';

export default async function DispatchSettingsPage() {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const access = await authorizeDispatchSettingsPageAccess(
    composition,
    session.principal,
    '/admin/dispatch-settings',
  );
  if (access === null) {
    return (
      <Card>
        <CardContent className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-semibold">Dispatch settings access denied</h1>
          <p className="text-muted-foreground">
            Your account cannot view or change the global schedule policy.
          </p>
        </CardContent>
      </Card>
    );
  }
  const [settings, current] = await Promise.all([
    composition.getDispatchScheduleSettings.execute({ context: access }),
    composition.getCurrentPrincipal.execute(bearerToken),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Dispatch settings</h1>
          <Badge>
            <Globe2 className="mr-1 size-3.5" aria-hidden="true" /> Global
          </Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Control how every office handles same-day driver and vehicle schedule conflicts.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Current policy</CardTitle>
          <CardDescription>
            This value is read inside each authoritative dispatch transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Behavior</p>
            <p>
              {settings.policy === 'BLOCK' ? 'Block conflicts' : 'Warn and require acknowledgment'}
            </p>
          </div>
          <div>
            <p className="font-semibold">Last updated</p>
            <p>
              <time dateTime={settings.updatedAt}>
                {new Intl.DateTimeFormat('en-PH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Manila',
                }).format(new Date(settings.updatedAt))}
              </time>
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="font-semibold">Updated by actor</p>
            <p className="font-mono text-xs">
              {settings.updatedByActorPublicId ?? 'Initial system setting'}
            </p>
          </div>
        </CardContent>
      </Card>
      <DispatchScheduleSettingsForm csrfToken={current.csrfToken} settings={settings} />
    </div>
  );
}
