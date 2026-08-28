import { AlertCircle, CircleCheck } from 'lucide-react';

import { cn } from '@/lib/utils';

export function FormStatus({
  message,
  tone = 'error',
}: {
  readonly message: string | null;
  readonly tone?: 'error' | 'success';
}) {
  return (
    <div
      className={cn(
        'min-h-14 rounded-md border p-3 text-sm',
        message === null && 'invisible',
        tone === 'error'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-success/40 bg-success/5',
      )}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex gap-2">
        {tone === 'error' ? (
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        ) : (
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        )}
        <span>{message ?? 'No message'}</span>
      </div>
    </div>
  );
}
