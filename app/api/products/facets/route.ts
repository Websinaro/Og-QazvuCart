import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { DiscoveryService } from '@/src/server/modules/products/discoveryService';

export async function GET(req: NextRequest) {
  return apiSuccess({ brands: await DiscoveryService.brandFacets(req.nextUrl.searchParams.get('category') || undefined) });
}
