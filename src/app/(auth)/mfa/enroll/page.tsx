import { TotpEnrollmentForm } from '@/components/forms/totp-enrollment-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TotpEnrollmentPage() {
  return (
    <Card className="w-full max-w-none">
      <CardHeader>
        <p className="text-sm font-semibold text-warning">Required security step</p>
        <CardTitle>Set up an authenticator</CardTitle>
        <CardDescription>
          Privileged accounts require a time-based one-time password at every sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TotpEnrollmentForm />
      </CardContent>
    </Card>
  );
}
