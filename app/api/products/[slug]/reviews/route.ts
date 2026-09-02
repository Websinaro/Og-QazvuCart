import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { ProductService } from '@/src/server/modules/products/productService';
import { ReviewService } from '@/src/server/modules/reviews/reviewService';
import { createReviewSchema } from '@/src/server/validators/ecommerce';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const product = await ProductService.getProductBySlug(params.slug);
  if (!product) return apiError('NOT_FOUND', 'Product not found', 404);

  const reviews = await ReviewService.getProductReviews(product.id);

  let eligibility = { canReview: false, hasPurchased: false, hasReviewed: false };
  const authUser = await getAuthUser(req);
  if (authUser) {
    eligibility = await ReviewService.getEligibility(authUser.userId, product.id);
  }

  return apiSuccess({ reviews, eligibility });
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const product = await ProductService.getProductBySlug(params.slug);
  if (!product) return apiError('NOT_FOUND', 'Product not found', 404);

  try {
    const body = await req.json();
    const parsed = createReviewSchema.safeParse({ ...body, productId: product.id });
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }

    // Eligibility (delivered order containing this product, owned by this
    // user) and the one-review-per-product-per-user rule are both enforced
    // inside ReviewService, backed by a DB unique constraint as a second line
    // of defense against race conditions.
    const review = await ReviewService.createReview(authUser.userId, product.id, parsed.data);
    return apiSuccess({ review }, 201);
  } catch (err) {
    return apiError('REVIEW_FAILED', err instanceof Error ? err.message : 'Failed to submit review', 400);
  }
}
