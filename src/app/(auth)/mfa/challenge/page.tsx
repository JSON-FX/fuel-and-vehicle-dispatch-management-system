import { TotpChallengeForm } from '@/components/forms/totp-challenge-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TotpChallengePage() {
  return (
    <Card className="w-full">
      <CardHeader>
        <p className="text-sm font-semibold text-accent">Step 2 of 2</p>
        <CardTitle>Verify your identity</CardTitle>
        <CardDescription>
          Enter the current code from the authenticator linked to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TotpChallengeForm />
      </CardContent>
    </Card>
  );
}
