import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { AuthService } from '@/src/server/modules/auth/authService';
import { SellerAccountService } from '@/src/server/modules/sellers/sellerAccountService';
import { registerSchema } from '@/src/server/validators/auth';
import { sellerApplicationSchema } from '@/src/server/validators/seller';
import { setAuthCookies } from '@/src/lib/sessionService';

/**
 * One-step "create an account AND apply to sell".
 *
 * Body: the normal register fields plus `store: { storeName, businessAddress, ... }`.
 * The new account is a plain CUSTOMER; it only becomes a SELLER when an admin
 * approves the application.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const account = registerSchema.safeParse(body);
    if (!account.success) {
      return apiError('VALIDATION_ERROR', account.error.issues[0]?.message || 'Invalid input', 422, account.error.issues);
    }
    const store = sellerApplicationSchema.safeParse(body?.store);
    if (!store.success) {
      return apiError('VALIDATION_ERROR', store.error.issues[0]?.message || 'Invalid store details', 422, store.error.issues);
    }

    // Check this BEFORE creating the account so a taken store name doesn't leave a half-finished signup.
    if (await SellerAccountService.isStoreNameTaken(store.data.storeName)) {
      return apiError('STORE_NAME_TAKEN', 'A store with this name already exists. Please choose another name.', 409);
    }

    const { user, accessToken, refreshToken } = await AuthService.register(account.data);

    let seller;
    try {
      seller = await SellerAccountService.apply(user.id, store.data);
    } catch (err) {
      // Account exists but the application failed: they're not signed in yet,
      // so tell them to log in and finish applying from /sell.
      return apiError(
        'APPLY_FAILED',
        `Your account was created, but the seller application failed: ${err instanceof Error ? err.message : 'unknown error'}. Log in and apply again from the Sell page.`,
        400
      );
    }

    const response = apiSuccess({ user, seller }, 201);
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    return apiError('REGISTER_FAILED', err instanceof Error ? err.message : 'Registration failed', 400);
  }
}
