import { Search } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export interface AuditFilterValues {
  readonly from: string;
  readonly to: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityPublicId: string;
  readonly actorPublicId: string;
  readonly requestId: string;
}

const filters = [
  { name: 'from', label: 'From', placeholder: '2026-08-28T00:00:00.000Z' },
  { name: 'to', label: 'To', placeholder: '2026-08-28T23:59:59.999Z' },
  { name: 'action', label: 'Action', placeholder: 'auth.login.failed' },
  { name: 'entityType', label: 'Entity type', placeholder: 'user' },
  { name: 'entityPublicId', label: 'Entity public ID', placeholder: 'UUID' },
  { name: 'actorPublicId', label: 'Actor public ID', placeholder: 'UUID' },
  { name: 'requestId', label: 'Request ID', placeholder: 'Request identifier' },
] as const;

export function AuditFilterForm({ values }: { readonly values: AuditFilterValues }) {
  return (
    <Card aria-labelledby="audit-filter-heading">
      <CardContent className="pt-6">
        <form action="/audit" method="get" className="space-y-4">
          <div>
            <h2 id="audit-filter-heading" className="font-heading text-lg font-semibold">
              Filter audit events
            </h2>
            <p id="audit-time-help" className="mt-1 text-sm text-muted-foreground">
              Enter From and To timestamps in exact Coordinated Universal Time format.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filters.map((filter) => {
              const id = `audit-filter-${filter.name}`;
              const isTimestamp = filter.name === 'from' || filter.name === 'to';
              return (
                <div key={filter.name} className="space-y-2">
                  <label htmlFor={id} className="block text-sm font-semibold text-foreground">
                    {filter.label}
                  </label>
                  <Input
                    id={id}
                    name={filter.name}
                    defaultValue={values[filter.name]}
                    placeholder={filter.placeholder}
                    spellCheck={false}
                    aria-describedby={isTimestamp ? 'audit-time-help' : undefined}
                    className="font-mono text-sm"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit">
              <Search aria-hidden="true" />
              Search
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/audit">Clear filters</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
