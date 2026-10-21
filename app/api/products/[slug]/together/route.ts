import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { db } from '@/src/db';
import { products } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { DiscoveryService } from '@/src/server/modules/products/discoveryService';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (!p) return apiError('NOT_FOUND', 'Product not found', 404);
  return apiSuccess({ products: await DiscoveryService.frequentlyBoughtTogether(p.id) });
}
