'use client';

import { Ban } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { readFuelApiResponse } from '@/lib/fuel/fuel-form-response';

export function FuelIssuanceVoidDialog({
  issuance,
  csrfToken,
}: {
  readonly issuance: FuelIssuanceDto;
  readonly csrfToken: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const errorSummary = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function voidIssuance() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/fuel-issuances/${issuance.publicId}/void`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ reason }),
      });
      await readFuelApiResponse(response);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The issuance could not be voided.');
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      setPending(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Ban aria-hidden="true" /> Void issuance
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void posted fuel issuance?</AlertDialogTitle>
          <AlertDialogDescription>
            The original issuance remains unchanged. A positive adjustment will compensate its
            ledger quantity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div ref={errorSummary} id="void-error-summary" tabIndex={-1} aria-label="Voiding error">
          <FormStatus message={error} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="void-reason">Reason</Label>
          <Textarea
            id="void-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={10}
            maxLength={500}
            autoFocus
            aria-describedby="void-reason-help"
          />
          <p id="void-reason-help" className="text-sm text-muted-foreground">
            Provide 10 to 500 characters for the audit record.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep posted</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending || reason.trim().length < 10}
            onClick={(event) => {
              event.preventDefault();
              void voidIssuance();
            }}
          >
            {pending ? 'Voiding…' : 'Void and compensate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
