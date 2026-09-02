import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AddressService } from '@/src/server/modules/addresses/addressService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const address = await AddressService.setDefault(authUser.userId, Number(id));
    return apiSuccess(address);
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to set default address', 400);
  }
}
