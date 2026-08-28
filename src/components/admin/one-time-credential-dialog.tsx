'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function OneTimeCredentialDialog({
  credential,
  onClose,
}: {
  readonly credential: string | null;
  readonly onClose: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (credential === null) return;
    await navigator.clipboard.writeText(credential);
    setCopied(true);
  }

  return (
    <AlertDialog
      open={credential !== null}
      onOpenChange={(open) => {
        if (!open && acknowledged) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Copy the temporary password now</AlertDialogTitle>
          <AlertDialogDescription>
            This password will not be shown again. Send it through an approved secure channel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-muted p-3">
          <code className="block break-all font-mono text-base select-all">{credential}</code>
        </div>
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy password'}
        </Button>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          I have stored or delivered this password securely.
        </label>
        <AlertDialogFooter>
          <AlertDialogAction disabled={!acknowledged} onClick={onClose}>
            Close credential
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
