import { PasswordChangeForm } from '@/components/forms/password-change-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PasswordChangePage() {
  return (
    <Card className="w-full">
      <CardHeader>
        <p className="text-sm font-semibold text-warning">Required security step</p>
        <CardTitle>Change your password</CardTitle>
        <CardDescription>
          Replace the temporary password before continuing. Existing sessions will be closed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordChangeForm />
      </CardContent>
    </Card>
  );
}
