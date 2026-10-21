import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { DiscoveryService } from '@/src/server/modules/products/discoveryService';

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return apiSuccess({ products: await DiscoveryService.compare(ids) });
}
