import { ArrowRight, CircleCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function HomePage() {
  return (
    <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="font-heading text-sm font-semibold tracking-wide text-accent uppercase">
            FVDMS
          </p>
          <CardTitle>Fuel and Vehicle Dispatch Management System</CardTitle>
          <CardDescription>
            The secure application foundation is ready for local development and later operational
            modules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border bg-muted px-4 py-3 text-sm">
            <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Foundation ready.</strong> Database readiness is
              available through the health endpoint.
            </span>
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <a href="/api/health">
              View health status
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
