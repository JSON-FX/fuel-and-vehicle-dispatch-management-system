import { Card, CardContent } from '@/components/ui/card';

export default function DispatchScheduleLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dispatch schedule">
      <div className="h-20 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <Card>
        <CardContent className="min-h-52 animate-pulse bg-muted/30 motion-reduce:animate-none" />
      </Card>
    </div>
  );
}
