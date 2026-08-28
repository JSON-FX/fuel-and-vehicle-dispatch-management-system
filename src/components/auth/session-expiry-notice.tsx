import { Clock3 } from 'lucide-react';

export function SessionExpiryNotice({ privileged }: { readonly privileged: boolean }) {
  return (
    <p className="flex items-start gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
      <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {privileged
        ? 'This privileged session uses a shorter inactivity limit. Save work before stepping away.'
        : 'Your session closes after extended inactivity. Save work before stepping away.'}
    </p>
  );
}
