import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AdminService } from '@/src/server/modules/admin/adminService';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const products = await AdminService.getAllProducts();
  return apiSuccess(products);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  try {
    const body = await req.json();
    if (!body.name || !body.brand || !body.categoryId || !body.description) {
      return apiError('VALIDATION_ERROR', 'name, brand, categoryId, and description are required', 422);
    }
    const product = await AdminService.createProduct(authUser.userId, {
      name: body.name,
      brand: body.brand,
      categoryId: Number(body.categoryId),
      basePrice: Number(body.basePrice) || 0,
      discountPrice: Number(body.discountPrice) || 0,
      stock: Number(body.stock) || 0,
      description: body.description,
      imageUrl: body.imageUrl,
      isDeal: Boolean(body.isDeal),
      isFeatured: Boolean(body.isFeatured),
    });
    return apiSuccess(product, 201);
  } catch (err) {
    return apiError('CREATE_FAILED', err instanceof Error ? err.message : 'Failed to create product', 400);
  }
}
