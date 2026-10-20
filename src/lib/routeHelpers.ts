import { NextRequest } from 'next/server';
import { ZodError, ZodType } from 'zod';
import { apiError } from './response';
import { NotFoundError } from '@/src/server/modules/orders/fulfilment';

/** Reads + validates a JSON body. Returns either the parsed data or a ready 4xx response. */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: ReturnType<typeof apiError> }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: apiError('VALIDATION_ERROR', 'Request body must be valid JSON', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = (parsed.error as ZodError).issues[0];
    return {
      ok: false,
      response: apiError('VALIDATION_ERROR', issue?.message || 'Invalid input', 422, (parsed.error as ZodError).issues),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Maps service errors to HTTP: NotFoundError -> 404, anything else -> `fallbackCode` 400. */
export function handleError(err: unknown, fallbackCode: string, fallbackMessage: string) {
  if (err instanceof NotFoundError) return apiError('NOT_FOUND', err.message, 404);
  return apiError(fallbackCode, err instanceof Error ? err.message : fallbackMessage, 400);
}
