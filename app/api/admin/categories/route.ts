import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { CategoryService } from '@/src/server/modules/categories/categoryService';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  try {
    const list = await CategoryService.getAllCategoriesForAdmin();
    return apiSuccess(list);
  } catch (err) {
    return apiError('FETCH_FAILED', err instanceof Error ? err.message : 'Failed to load categories', 500);
  }
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  try {
    const body = await req.json();
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return apiError('VALIDATION_ERROR', 'Category name is required', 422);
    }
    const category = await CategoryService.createCategory({
      name: body.name,
      slug: body.slug,
      icon: body.icon || 'Grid3x3',
      imageUrl: body.imageUrl || '',
      description: body.description,
      displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
    });
    return apiSuccess(category, 201);
  } catch (err) {
    return apiError('CREATE_FAILED', err instanceof Error ? err.message : 'Failed to create category', 400);
  }
}
