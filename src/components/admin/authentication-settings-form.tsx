'use client';

import { Save, ShieldCheck, ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { AuthenticationSettingsRecord } from '@/application/auth/ports/authentication-settings-repository';
import { FormStatus } from '@/components/forms/form-status';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { readApiResponse } from '@/components/forms/auth-form-utils';

interface UpdateResult {
  readonly settings: AuthenticationSettingsRecord;
  readonly reauthenticationRequired: boolean;
  readonly revokedSessionCount: number;
}

export function AuthenticationSettingsForm({
  settings,
  csrfToken,
}: {
  readonly settings: AuthenticationSettingsRecord;
  readonly csrfToken: string;
}) {
  const router = useRouter();
  const [savedValue, setSavedValue] = useState(settings.mfaRequired);
  const [mfaRequired, setMfaRequired] = useState(settings.mfaRequired);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const changed = mfaRequired !== savedValue;
  const Icon = mfaRequired ? ShieldCheck : ShieldOff;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed) return;
    setPending(true);
    setStatus(null);

    try {
      const response = await fetch('/api/authentication-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ mfaRequired }),
      });
      const result = await readApiResponse<UpdateResult>(response);
      setSavedValue(result.settings.mfaRequired);
      setMfaRequired(result.settings.mfaRequired);
      if (result.reauthenticationRequired) {
        router.replace('/login');
        router.refresh();
        return;
      }
      setStatus({ message: 'Authentication settings saved.', tone: 'success' });
      router.refresh();
    } catch (error) {
      setStatus({
        message:
          error instanceof Error ? error.message : 'Authentication settings could not be saved.',
        tone: 'error',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <FormStatus message={status?.message ?? null} tone={status?.tone ?? 'error'} />
      <div className="rounded-lg border bg-muted/30 p-4 sm:p-5">
        <Label
          htmlFor="mfa-required"
          className="flex min-h-14 cursor-pointer items-center justify-between gap-4"
        >
          <span className="flex min-w-0 items-start gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <span>
              <span className="block text-base">Require authenticator codes</span>
              <span
                id="mfa-required-description"
                className="mt-1 block font-normal leading-6 text-muted-foreground"
              >
                Privileged accounts must enroll and enter a current code after password sign-in.
              </span>
            </span>
          </span>
          <span className="relative flex h-11 w-14 shrink-0 items-center justify-center">
            <input
              id="mfa-required"
              type="checkbox"
              role="switch"
              checked={mfaRequired}
              aria-checked={mfaRequired}
              aria-describedby="mfa-required-description"
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
              onChange={(event) => {
                setMfaRequired(event.currentTarget.checked);
                setStatus(null);
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none h-7 w-12 rounded-full border border-input bg-background transition-colors duration-200 after:absolute after:top-3 after:left-2 after:size-5 after:rounded-full after:border after:border-input after:bg-card after:shadow-sm after:transition-transform after:duration-200 after:content-[''] peer-checked:border-accent peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:after:transition-none"
            />
          </span>
        </Label>
      </div>
      <div className="rounded-md border p-4">
        <p className="font-semibold">
          Multi-factor authentication is {mfaRequired ? 'enabled' : 'disabled'}
        </p>
        <p className="mt-1 leading-6 text-muted-foreground">
          {mfaRequired
            ? 'Enabling this setting signs out every privileged account. Each administrator must complete MFA at the next sign-in.'
            : 'Username and password are sufficient. Existing authenticator enrollments remain stored for later use.'}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Last changed{' '}
          <time dateTime={settings.updatedAt.toISOString()}>{formatDate(settings.updatedAt)}</time>
        </p>
        <Button type="submit" disabled={!changed || pending}>
          <Save aria-hidden="true" />
          {pending ? 'Saving…' : 'Save security setting'}
        </Button>
      </div>
    </form>
  );
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(value);
}
