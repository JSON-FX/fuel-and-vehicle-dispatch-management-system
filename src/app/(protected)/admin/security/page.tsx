import { ShieldCheck } from 'lucide-react';

import { AuthenticationSettingsForm } from '@/components/admin/authentication-settings-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication, hasPermission } from '@/lib/auth/server-authentication';

export default async function SecuritySettingsPage() {
  const { composition, session, bearerToken } = await getServerAuthentication();
  const principal = session.principal;
  if (!hasPermission(principal.permissions, 'auth.settings.manage')) return <DeniedState />;
  const [current, settings] = await Promise.all([
    composition.getCurrentPrincipal.execute(bearerToken),
    composition.getAuthenticationSettings.execute(principal),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Security settings</h1>
          <Badge className="border bg-transparent text-foreground">Global</Badge>
        </div>
        <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">
          Choose whether privileged accounts must use an authenticator code after password sign-in.
        </p>
      </header>
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted">
              <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-2xl">Administrator sign-in</CardTitle>
              <CardDescription>
                This setting applies to every privileged role. Password requirements and account
                throttling remain active in both modes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AuthenticationSettingsForm settings={settings} csrfToken={current.csrfToken} />
        </CardContent>
      </Card>
    </div>
  );
}

function DeniedState() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Your account cannot manage global authentication settings.
        </p>
      </CardContent>
    </Card>
  );
}
