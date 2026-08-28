'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormStatus } from '@/components/forms/form-status';
import { PasswordField } from '@/components/forms/password-field';
import { Button } from '@/components/ui/button';

import { nextAuthenticationPath, readApiResponse } from './auth-form-utils';

const schema = z
  .object({
    newPassword: z.string().min(12, 'Use at least 12 characters.').max(128),
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    path: ['confirmation'],
    message: 'The passwords do not match.',
  });
type Values = z.infer<typeof schema>;

export function PasswordChangeForm() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    void loadCsrfToken()
      .then(setCsrfToken)
      .catch((error: unknown) => {
        setRequestError(
          error instanceof Error ? error.message : 'The authentication step expired.',
        );
      });
  }, []);

  const submit = handleSubmit(async ({ newPassword }) => {
    if (csrfToken === null) return;
    setRequestError(null);
    try {
      const response = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ newPassword }),
      });
      const result = await readApiResponse<{ readonly next: string }>(response);
      router.replace(nextAuthenticationPath(result.next, '/account'));
      router.refresh();
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'The password could not be changed.',
      );
    }
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <p id="password-guidance" className="text-sm leading-6 text-muted-foreground">
        Use 12 to 128 characters. Do not include your username or email name.
      </p>
      <PasswordField
        id="new-password"
        label="New password"
        autoComplete="new-password"
        aria-describedby="password-guidance"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmation?.message}
        {...register('confirmation')}
      />
      <Button className="w-full" type="submit" disabled={isSubmitting || csrfToken === null}>
        <KeyRound aria-hidden="true" />
        {isSubmitting ? 'Changing password…' : 'Change password'}
      </Button>
    </form>
  );
}

async function loadCsrfToken(): Promise<string> {
  const challenge = await fetch('/api/auth/challenge', { cache: 'no-store' });
  if (challenge.ok) return (await readApiResponse<{ csrfToken: string }>(challenge)).csrfToken;
  const session = await fetch('/api/me', { cache: 'no-store' });
  return (await readApiResponse<{ csrfToken: string }>(session)).csrfToken;
}
