import { createApplicationComposition } from '@/infrastructure/composition/root';
import { withApiHandler } from '@/lib/http/with-api-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  const handler = withApiHandler(
    {
      logger: composition.logger,
      publicIdGenerator: composition.publicIdGenerator,
    },
    async () => composition.getHealthStatus.execute(),
    { headers: { 'Cache-Control': 'no-store' } },
  );

  return handler(request);
}
