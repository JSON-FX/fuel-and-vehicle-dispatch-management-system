import { Card, CardContent } from '@/components/ui/card';

export default function BudgetAllocationsLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div>
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="mt-3 h-5 max-w-2xl animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-11 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
            />
          ))}
        </CardContent>
      </Card>
      {[1, 2, 3].map((item) => (
        <Card key={item}>
          <CardContent className="min-h-24 animate-pulse pt-6 motion-reduce:animate-none">
            <div className="h-5 w-44 rounded-md bg-muted" />
            <div className="mt-4 h-4 max-w-2xl rounded-md bg-muted" />
          </CardContent>
        </Card>
      ))}
      <span className="sr-only">Loading budget allocations</span>
    </div>
  );
}
