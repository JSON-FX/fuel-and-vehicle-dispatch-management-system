import { Card, CardContent } from '@/components/ui/card';

export default function DispatchesLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading vehicle dispatches</span>
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <Card>
        <CardContent className="space-y-3 pt-6">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-11 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
