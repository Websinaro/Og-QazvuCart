import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AddressService } from '@/src/server/modules/addresses/addressService';
import { addressSchema } from '@/src/server/validators/address';

const addressUpdateSchema = addressSchema.partial();

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const parsed = addressUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }
    const address = await AddressService.updateAddress(authUser.userId, Number(params.id), parsed.data);
    return apiSuccess(address);
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update address', 400);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const result = await AddressService.deleteAddress(authUser.userId, Number(params.id));
    return apiSuccess(result);
  } catch (err) {
    return apiError('DELETE_FAILED', err instanceof Error ? err.message : 'Failed to delete address', 400);
  }
}
