import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AddressService } from '@/src/server/modules/addresses/addressService';
import { addressSchema } from '@/src/server/validators/address';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const addresses = await AddressService.getAddresses(authUser.userId);
  return apiSuccess(addresses);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const parsed = addressSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }
    const address = await AddressService.createAddress(authUser.userId, parsed.data);
    return apiSuccess(address, 201);
  } catch (err) {
    return apiError('CREATE_FAILED', err instanceof Error ? err.message : 'Failed to create address', 400);
  }
}
