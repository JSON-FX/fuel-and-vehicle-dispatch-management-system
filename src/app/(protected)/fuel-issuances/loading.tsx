import { Card, CardContent } from '@/components/ui/card';

export default function FuelIssuancesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading fuel issuances">
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
