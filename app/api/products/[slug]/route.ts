import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { ProductService } from '@/src/server/modules/products/productService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await ProductService.getProductBySlug(slug);
  if (!product) return apiError('NOT_FOUND', 'Product not found', 404);
  return apiSuccess(product);
}
