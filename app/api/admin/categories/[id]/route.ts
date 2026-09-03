import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { CategoryService } from '@/src/server/modules/categories/categoryService';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return apiError('VALIDATION_ERROR', 'Invalid category id', 422);

  try {
    const body = await req.json();
    const category = await CategoryService.updateCategory(categoryId, {
      name: body.name,
      slug: body.slug,
      icon: body.icon,
      imageUrl: body.imageUrl,
      description: body.description,
      displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
    });
    return apiSuccess(category);
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update category', 400);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return apiError('VALIDATION_ERROR', 'Invalid category id', 422);

  try {
    const result = await CategoryService.deleteOrArchiveCategory(categoryId);
    return apiSuccess(result);
  } catch (err) {
    return apiError('DELETE_FAILED', err instanceof Error ? err.message : 'Failed to delete category', 400);
  }
}
