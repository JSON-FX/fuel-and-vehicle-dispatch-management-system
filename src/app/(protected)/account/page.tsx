import { SessionExpiryNotice } from '@/components/auth/session-expiry-notice';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';

export default async function AccountPage() {
  const { session } = await getServerAuthentication();
  const principal = session.principal;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Your account</h1>
        <p className="mt-2 text-muted-foreground">
          Review your identity, access, and current security requirements.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Identity</CardTitle>
            <CardDescription>Your assigned FVDMS account details.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-muted-foreground">Full name</dt>
                <dd>{principal.fullName}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted-foreground">Username</dt>
                <dd className="font-mono text-sm">{principal.username}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-semibold text-muted-foreground">Roles</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {principal.roles.map((role) => (
                    <Badge key={role}>{role}</Badge>
                  ))}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Security</CardTitle>
            <CardDescription>Controls active for this account and session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{principal.isPrivileged ? 'Privileged account' : 'Standard account'}</Badge>
              <Badge>{principal.mfaEnrolled ? 'MFA enrolled' : 'MFA not required'}</Badge>
              <Badge>
                {principal.mustChangePassword ? 'Password change required' : 'Password current'}
              </Badge>
            </div>
            <SessionExpiryNotice privileged={principal.isPrivileged} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
