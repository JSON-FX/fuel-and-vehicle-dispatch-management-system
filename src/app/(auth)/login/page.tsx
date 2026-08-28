import { LoginForm } from '@/components/forms/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly returnTo?: string | readonly string[] }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <p className="font-heading text-sm font-semibold tracking-wide text-accent uppercase">
          FVDMS
        </p>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Use your assigned account to access fuel and vehicle dispatch operations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm returnTo={returnTo} />
      </CardContent>
    </Card>
  );
}

function safeReturnTo(value: string | readonly string[] | undefined): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return '/account';
  return value;
}
