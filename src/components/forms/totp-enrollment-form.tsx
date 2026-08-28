'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldPlus } from 'lucide-react';
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
interface Enrollment {
  readonly manualSecret: string;
  readonly qrSvg: string;
}

export function TotpEnrollmentForm() {
  const router = useRouter();
  const started = useRef(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void beginEnrollment()
      .then(({ csrfToken: token, enrollment: result }) => {
        setCsrfToken(token);
        setEnrollment(result);
      })
      .catch((error: unknown) =>
        setRequestError(error instanceof Error ? error.message : 'Enrollment could not start.'),
      );
  }, []);

  const submit = handleSubmit(async ({ code }) => {
    if (csrfToken === null) return;
    setRequestError(null);
    try {
      const response = await fetch('/api/auth/mfa/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ code }),
      });
      await readApiResponse(response);
      router.replace('/account');
      router.refresh();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'The code could not be confirmed.');
    }
  });

  return (
    <div className="space-y-6">
      <FormStatus message={requestError} />
      {enrollment === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          Preparing secure enrollment…
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <figure className="rounded-md border bg-white p-4 text-center">
            <div
              role="img"
              aria-label="QR code for the FVDMS authenticator account"
              className="mx-auto max-w-60"
              dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
            />
            <figcaption className="mt-2 text-sm text-slate-700">
              Scan with your authenticator application.
            </figcaption>
          </figure>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Manual setup key</p>
              <code className="mt-2 block break-all rounded-md border bg-muted p-3 font-mono text-sm select-all">
                {enrollment.manualSecret}
              </code>
              <p className="mt-2 text-sm text-muted-foreground">
                Sensitive. This key appears only during enrollment.
              </p>
            </div>
            <form className="space-y-4" noValidate onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="enrollment-code">Authenticator code</Label>
                <Input
                  id="enrollment-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="font-mono text-lg tracking-[0.35em] tabular-nums"
                  aria-invalid={errors.code === undefined ? undefined : true}
                  {...register('code')}
                />
                {errors.code?.message === undefined ? null : (
                  <p className="text-sm text-destructive">{errors.code.message}</p>
                )}
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                <ShieldPlus aria-hidden="true" />
                {isSubmitting ? 'Confirming…' : 'Confirm enrollment'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

async function beginEnrollment(): Promise<{ csrfToken: string; enrollment: Enrollment }> {
  const challenge = await fetch('/api/auth/challenge', { cache: 'no-store' });
  const { csrfToken } = await readApiResponse<{ csrfToken: string }>(challenge);
  const response = await fetch('/api/auth/mfa/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: '{}',
  });
  return { csrfToken, enrollment: await readApiResponse<Enrollment>(response) };
}
