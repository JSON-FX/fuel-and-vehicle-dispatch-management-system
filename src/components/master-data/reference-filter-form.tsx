import { Search } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export function ReferenceFilterForm({
  action,
  query,
  lifecycle,
  status,
  statuses,
}: {
  readonly action: string;
  readonly query: string;
  readonly lifecycle: string;
  readonly status: string;
  readonly statuses: readonly { readonly value: string; readonly label: string }[];
}) {
  return (
    <Card aria-labelledby="reference-filter-heading">
      <CardContent className="pt-6">
        <form action={action} method="get" className="space-y-4">
          <h2 id="reference-filter-heading" className="font-heading text-lg font-semibold">
            Filter records
          </h2>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
            <div className="space-y-2">
              <label htmlFor="reference-query" className="block text-sm font-semibold">
                Search
              </label>
              <Input id="reference-query" name="query" defaultValue={query} maxLength={150} />
            </div>
            <div className="space-y-2">
              <label htmlFor="reference-status" className="block text-sm font-semibold">
                Operational status
              </label>
              <NativeSelect id="reference-status" name="status" defaultValue={status}>
                <option value="">All statuses</option>
                {statuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <label htmlFor="reference-lifecycle" className="block text-sm font-semibold">
                Record lifecycle
              </label>
              <NativeSelect id="reference-lifecycle" name="lifecycle" defaultValue={lifecycle}>
                <option value="current">Current records</option>
                <option value="deleted">Deleted records</option>
                <option value="all">All records</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit">
              <Search aria-hidden="true" />
              Apply filters
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={action}>Clear filters</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
