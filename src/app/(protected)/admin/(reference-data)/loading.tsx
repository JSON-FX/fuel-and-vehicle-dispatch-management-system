import { Card, CardContent } from '@/components/ui/card';

export default function ReferenceDataLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div>
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="mt-3 h-5 max-w-xl animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
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
      <span className="sr-only">Loading reference data</span>
    </div>
  );
}
