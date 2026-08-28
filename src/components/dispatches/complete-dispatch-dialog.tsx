'use client';

import { CircleCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import type { DispatchDetailDto } from '@/application/dispatch/dto/dispatch-dtos';
import { calculateDispatchDistance } from '@/components/dispatches/dispatch-draft-form';
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
import {
  DispatchApiError,
  getFreshDispatchCsrfToken,
  readDispatchApiResponse,
} from '@/lib/dispatch/dispatch-form-response';

export function CompleteDispatchDialog({ dispatch }: { readonly dispatch: DispatchDetailDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [odoAfter, setOdoAfter] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const finalInput = useRef<HTMLInputElement>(null);
  const distance = useMemo(
    () => calculateDispatchDistance(dispatch.odoBefore, odoAfter),
    [dispatch.odoBefore, odoAfter],
  );

  async function complete() {
    setError(null);
    setPending(true);
    try {
      const csrfToken = await getFreshDispatchCsrfToken();
      const response = await fetch(`/api/dispatches/${dispatch.publicId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ odoAfter }),
      });
      await readDispatchApiResponse(response);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof DispatchApiError
          ? (caught.fieldErrors.odoAfter ?? caught.message)
          : caught instanceof Error
            ? caught.message
            : 'The dispatch could not be completed.';
      setError(message);
      requestAnimationFrame(() => {
        if (caught instanceof DispatchApiError && caught.fieldErrors.odoAfter !== undefined) {
          finalInput.current?.focus();
        } else {
          errorSummary.current?.focus();
        }
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="w-full">
          <CircleCheck aria-hidden="true" /> Complete dispatch
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complete this dispatch?</AlertDialogTitle>
          <AlertDialogDescription>
            Record the final odometer. Completion makes the dispatch terminal and preserves the
            exact derived distance.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div ref={errorSummary} id="complete-dispatch-error" tabIndex={-1}>
          <FormStatus message={error} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dispatch-odo-after">Final odometer (km)</Label>
          <Input
            ref={finalInput}
            id="dispatch-odo-after"
            inputMode="decimal"
            value={odoAfter}
            onChange={(event) => setOdoAfter(event.target.value)}
            autoFocus
            aria-describedby="dispatch-odo-after-help dispatch-live-distance"
            aria-invalid={error !== null}
          />
          <p id="dispatch-odo-after-help" className="text-sm text-muted-foreground">
            The final reading must be at least {dispatch.odoBefore} km.
          </p>
          <p id="dispatch-live-distance" className="text-sm font-semibold" aria-live="polite">
            {distance === null
              ? 'Enter a valid final reading to calculate distance.'
              : `Distance: ${distance}`}
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep active</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || distance === null}
            onClick={(event) => {
              event.preventDefault();
              void complete();
            }}
          >
            {pending ? 'Completing…' : 'Complete dispatch'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
