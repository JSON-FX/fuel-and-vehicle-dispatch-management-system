'use client';

import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { FuelIssuanceDto } from '@/application/fuel/dto/fuel-dtos';
import { FormStatus } from '@/components/forms/form-status';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FuelApiError, readFuelApiResponse } from '@/lib/fuel/fuel-form-response';

export function FuelIssuancePostDialog({
  issuance,
  csrfToken,
}: {
  readonly issuance: FuelIssuanceDto;
  readonly csrfToken: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [issuedLiters, setIssuedLiters] = useState(
    issuance.issuedLiters ?? issuance.requestedLiters ?? '',
  );
  const errorSummary = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function post() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/fuel-issuances/${issuance.publicId}/post`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ issuedLiters }),
      });
      await readFuelApiResponse(response);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof FuelApiError
          ? (caught.fieldErrors.issuedLiters ?? caught.message)
          : caught instanceof Error
            ? caught.message
            : 'The issuance could not be posted.',
      );
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      setPending(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button>
          <Send aria-hidden="true" /> Post issuance
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Post fuel issuance?</AlertDialogTitle>
          <AlertDialogDescription>
            Posting reserves the monthly RIS and creates immutable amount, ledger, and audit
            evidence.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div ref={errorSummary} id="post-error-summary" tabIndex={-1} aria-label="Posting error">
          <FormStatus message={error} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="post-issued-liters">Actual issued liters</Label>
          <Input
            id="post-issued-liters"
            inputMode="decimal"
            value={issuedLiters}
            onChange={(event) => setIssuedLiters(event.target.value)}
            autoFocus
            aria-describedby="post-issued-help"
          />
          <p id="post-issued-help" className="text-sm text-muted-foreground">
            Confirm the actual quantity. The server uses the draft unit price.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep draft</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void post();
            }}
          >
            {pending ? 'Posting…' : 'Post and assign RIS'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
