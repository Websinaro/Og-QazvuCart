import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { ProductService } from '@/src/server/modules/products/productService';
import { QuestionService } from '@/src/server/modules/questions/questionService';
import { createQuestionSchema } from '@/src/server/validators/ecommerce';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await ProductService.getProductBySlug(slug);
  if (!product) return apiError('NOT_FOUND', 'Product not found', 404);

  const questions = await QuestionService.getProductQuestions(product.id);
  return apiSuccess({ questions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const product = await ProductService.getProductBySlug(slug);
  if (!product) return apiError('NOT_FOUND', 'Product not found', 404);

  try {
    const body = await req.json();
    const parsed = createQuestionSchema.safeParse({ ...body, productId: product.id });
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }
    const question = await QuestionService.askQuestion(authUser.userId, product.id, parsed.data.questionText);
    return apiSuccess({ question }, 201);
  } catch (err) {
    return apiError('QUESTION_FAILED', err instanceof Error ? err.message : 'Failed to submit question', 400);
  }
}
