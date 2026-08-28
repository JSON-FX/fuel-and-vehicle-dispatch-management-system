'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormStatus } from '@/components/forms/form-status';
import { PasswordField } from '@/components/forms/password-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { nextAuthenticationPath, readApiResponse } from './auth-form-utils';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username.').max(100),
  password: z.string().min(1, 'Enter your password.').max(128),
});

type Values = z.infer<typeof schema>;

export function LoginForm({ returnTo = '/account' }: { readonly returnTo?: string }) {
  const router = useRouter();
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    setRequestError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await readApiResponse<{ readonly next: string }>(response);
      router.replace(nextAuthenticationPath(result.next, returnTo));
      router.refresh();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Sign-in failed.');
    }
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormStatus message={requestError} />
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors.username === undefined ? undefined : true}
          aria-describedby={errors.username === undefined ? undefined : 'username-error'}
          {...register('username')}
        />
        {errors.username?.message === undefined ? null : (
          <p id="username-error" className="text-sm text-destructive">
            {errors.username.message}
          </p>
        )}
      </div>
      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        <LogIn aria-hidden="true" />
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
