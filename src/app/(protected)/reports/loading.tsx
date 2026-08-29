import { Card, CardContent } from '@/components/ui/card';

export default function ReportsLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading operational reports</span>
      <div className="space-y-3">
        <div className="h-10 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-5 max-w-2xl animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
            />
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-lg border bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
      <Card>
        <CardContent className="min-h-64 animate-pulse bg-muted/30 motion-reduce:animate-none" />
      </Card>
    </div>
  );
}
