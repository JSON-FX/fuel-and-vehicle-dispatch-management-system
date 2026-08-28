import { Card, CardContent } from '@/components/ui/card';

export default function SecuritySettingsLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div>
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="mt-3 h-5 max-w-2xl animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
      <Card className="max-w-3xl">
        <CardContent className="space-y-5 pt-6">
          <div className="h-16 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-28 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-11 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        </CardContent>
      </Card>
      <span className="sr-only">Loading security settings</span>
    </div>
  );
}
