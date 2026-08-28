'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { FormStatus } from '@/components/forms/form-status';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { readApiResponse } from '@/components/forms/auth-form-utils';

export function SecurityActionDialog({
  title,
  description,
  actionLabel,
  endpoint,
  csrfToken,
  trigger,
  onSuccess,
  method = 'POST',
}: {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly endpoint: string;
  readonly csrfToken: string;
  readonly trigger: ReactNode;
  readonly onSuccess?: ((data: unknown) => void) | undefined;
  readonly method?: 'POST' | 'DELETE';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ reason: form.get('reason') }),
      });
      const result = await readApiResponse(response);
      onSuccess?.(result);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          id={`security-action-${endpoint.replaceAll('/', '-')}`}
          className="space-y-3"
          onSubmit={submit}
        >
          <FormStatus message={error} />
          <Label htmlFor={`reason-${endpoint}`}>Reason</Label>
          <textarea
            id={`reason-${endpoint}`}
            name="reason"
            required
            minLength={10}
            maxLength={500}
            className="min-h-24 w-full rounded-md border border-input bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            type="submit"
            form={`security-action-${endpoint.replaceAll('/', '-')}`}
            disabled={pending}
          >
            {pending ? 'Working…' : actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
