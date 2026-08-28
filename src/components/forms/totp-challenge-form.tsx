'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormStatus } from '@/components/forms/form-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { readApiResponse } from './auth-form-utils';

const schema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.') });
type Values = z.infer<typeof schema>;

export function TotpChallengeForm() {
  const router = useRouter();
  const started = useRef(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void fetch('/api/auth/challenge', { cache: 'no-store' })
      .then((response) => readApiResponse<{ csrfToken: string }>(response))
      .then((result) => setCsrfToken(result.csrfToken))
      .catch((error: unknown) =>
        setRequestError(error instanceof Error ? error.message : 'The challenge expired.'),
      );
  }, []);

  const submit = handleSubmit(async ({ code }) => {
    if (csrfToken === null) return;
    setRequestError(null);
    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ code }),
      });
      await readApiResponse(response);
      router.replace('/account');
      router.refresh();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Verification failed.');
      setFocus('code', { shouldSelect: true });
    }
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <div className="space-y-2">
        <Label htmlFor="totp-code">Authenticator code</Label>
        <Input
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          className="font-mono text-lg tracking-[0.35em] tabular-nums"
          aria-invalid={errors.code === undefined ? undefined : true}
          aria-describedby={errors.code === undefined ? 'totp-help' : 'totp-help totp-code-error'}
          {...register('code')}
        />
        <p id="totp-help" className="text-sm text-muted-foreground">
          Enter the current six-digit code. The challenge expires after a short time.
        </p>
        {errors.code?.message === undefined ? null : (
          <p id="totp-code-error" className="text-sm text-destructive">
            {errors.code.message}
          </p>
        )}
      </div>
      <Button className="w-full" type="submit" disabled={isSubmitting || csrfToken === null}>
        <ShieldCheck aria-hidden="true" />
        {isSubmitting ? 'Verifying…' : 'Verify and continue'}
      </Button>
    </form>
  );
}
