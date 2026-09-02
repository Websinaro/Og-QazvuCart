import { apiSuccess } from '@/src/lib/response';
import { CategoryService } from '@/src/server/modules/categories/categoryService';

export async function GET() {
  const categories = await CategoryService.getAllCategories();
  return apiSuccess(categories);
}
