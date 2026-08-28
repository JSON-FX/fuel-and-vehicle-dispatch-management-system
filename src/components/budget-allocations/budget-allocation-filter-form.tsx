import { Search } from 'lucide-react';
import Link from 'next/link';

import type { BudgetAllocationFilterValues } from '@/lib/budget/page-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export function BudgetAllocationFilterForm({
  values,
}: {
  readonly values: BudgetAllocationFilterValues;
}) {
  return (
    <Card aria-labelledby="budget-filter-heading">
      <CardContent className="pt-6">
        <form action="/budget-allocations" method="get" className="space-y-4">
          <h2 id="budget-filter-heading" className="font-heading text-lg font-semibold">
            Filter budget allocations
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <FilterField id="budget-query" label="PPMP or office">
              <Input id="budget-query" name="query" defaultValue={values.query} maxLength={150} />
            </FilterField>
            <FilterField id="budget-fiscal-year" label="Fiscal year">
              <Input
                id="budget-fiscal-year"
                name="fiscalYear"
                defaultValue={values.fiscalYear}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </FilterField>
            <FilterField id="budget-quarter" label="Quarter">
              <NativeSelect id="budget-quarter" name="quarter" defaultValue={values.quarter}>
                <option value="">All quarters</option>
                {[1, 2, 3, 4].map((quarter) => (
                  <option key={quarter} value={quarter}>
                    Quarter {quarter}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField id="budget-status" label="Allocation status">
              <NativeSelect id="budget-status" name="status" defaultValue={values.status}>
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </NativeSelect>
            </FilterField>
            <FilterField id="budget-lifecycle" label="Record lifecycle">
              <NativeSelect id="budget-lifecycle" name="lifecycle" defaultValue={values.lifecycle}>
                <option value="current">Current records</option>
                <option value="deleted">Deleted records</option>
                <option value="all">All records</option>
              </NativeSelect>
            </FilterField>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit">
              <Search aria-hidden="true" /> Apply filters
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/budget-allocations">Clear filters</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FilterField({
  id,
  label,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
