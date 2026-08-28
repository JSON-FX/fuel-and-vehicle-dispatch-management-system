import type { ReactNode } from 'react';

export function ReferencePageHeader({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-3xl leading-7 text-muted-foreground">{description}</p>
      </div>
      {action === undefined ? null : <div className="shrink-0">{action}</div>}
    </header>
  );
}
