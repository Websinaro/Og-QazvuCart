import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { DiscoveryService } from '@/src/server/modules/products/discoveryService';

export async function GET(req: NextRequest) {
  return apiSuccess(await DiscoveryService.suggestions(req.nextUrl.searchParams.get('q') || ''));
}
