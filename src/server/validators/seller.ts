import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === '' ? undefined : v));

// ---------------------------------------------------------------------
// Seller application / profile
// ---------------------------------------------------------------------
export const sellerApplicationSchema = z.object({
  storeName: z.string().trim().min(3, 'Store name must be at least 3 characters').max(60, 'Store name cannot exceed 60 characters'),
  description: optionalText(1000),
  supportEmail: z
    .string()
    .trim()
    .email('Please provide a valid support email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  supportPhone: z
    .string()
    .trim()
    .min(10, 'Support phone must be at least 10 digits')
    .max(15, 'Support phone is too long')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  businessAddress: z.string().trim().min(10, 'Please provide your full business address').max(500),
  taxId: optionalText(30),
});

export const sellerProfileUpdateSchema = sellerApplicationSchema.partial();

// ---------------------------------------------------------------------
// Payout destination
// ---------------------------------------------------------------------
export const payoutDetailsSchema = z
  .object({
    accountHolder: z.string().trim().min(2).max(150).optional(),
    bankName: z.string().trim().min(2).max(150).optional(),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC must look like HDFC0001234')
      .optional(),
    // Omit to keep the stored account number unchanged.
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{6,20}$/, 'Account number must be 6-20 digits')
      .optional(),
    upiId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/, 'UPI ID must look like name@bank')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Provide at least one payout field' });

// ---------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------
const productBase = z.object({
  name: z.string().trim().min(3, 'Product name must be at least 3 characters').max(200),
  brand: z.string().trim().min(1, 'Brand is required').max(100),
  categoryId: z.number().int().positive('Pick a category'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000),
  basePrice: z.number().int().positive('Original price must be greater than 0').max(10_000_000),
  discountPrice: z.number().int().positive('Selling price must be greater than 0').max(10_000_000),
  stock: z.number().int().min(0, 'Stock cannot be negative').max(1_000_000),
  imageUrls: z.array(z.string().url('Image must be a valid URL')).max(8).optional(),
  model: optionalText(100),
  warranty: optionalText(100),
  weight: optionalText(50),
  deliveryFee: z.number().int().min(0).max(5000).optional(),
  estimatedDays: z.number().int().min(1).max(30).optional(),
  variants: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        variantName: z.string().trim().min(1).max(150),
        sku: optionalText(100),
        priceAdjustment: z.number().int().min(-10_000_000).max(10_000_000).default(0),
        stockCount: z.number().int().min(0).max(1_000_000),
      })
    )
    .max(50)
    .optional(),
  specifications: z
    .array(z.object({ key: z.string().trim().min(1).max(150), value: z.string().trim().min(1).max(1000) }))
    .max(50)
    .optional(),
});

export const createProductSchema = productBase.refine((v) => v.discountPrice <= v.basePrice, {
  message: 'Selling price cannot be higher than the original price',
  path: ['discountPrice'],
});

export const updateProductSchema = productBase
  .partial()
  .extend({ status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional() })
  .refine((v) => v.discountPrice === undefined || v.basePrice === undefined || v.discountPrice <= v.basePrice, {
    message: 'Selling price cannot be higher than the original price',
    path: ['discountPrice'],
  });

export const bulkStockSchema = z.object({
  updates: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        stock: z.number().int().min(0).max(1_000_000).optional(),
        variants: z
          .array(z.object({ variantId: z.number().int().positive(), stockCount: z.number().int().min(0).max(1_000_000) }))
          .max(50)
          .optional(),
      })
    )
    .min(1)
    .max(200),
});

// ---------------------------------------------------------------------
// Orders / Q&A
// ---------------------------------------------------------------------
export const sellerOrderUpdateSchema = z
  .object({
    status: z.enum(['PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']).optional(),
    carrier: z.string().trim().max(100).optional(),
    trackingNumber: z.string().trim().max(100).optional(),
  })
  .refine((v) => v.status !== undefined || v.carrier !== undefined || v.trackingNumber !== undefined, {
    message: 'Provide a status, carrier or tracking number',
  });

export const sellerAnswerSchema = z.object({
  answerText: z.string().trim().min(3, 'Answer must be at least 3 characters').max(1000),
});

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export const adminSellerActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(5, 'Give the applicant a reason (min 5 characters)').max(500) }),
  z.object({ action: z.literal('suspend'), reason: z.string().trim().min(5, 'A suspension reason is required').max(500) }),
  z.object({ action: z.literal('reinstate') }),
  z.object({
    action: z.literal('set_commission'),
    // null clears the override (falls back to category / platform default)
    commissionPercent: z.number().min(0).max(100).nullable(),
  }),
]);

export const commissionSettingsSchema = z
  .object({
    defaultCommissionPercent: z.number().min(0).max(100).optional(),
    payoutHoldDays: z.number().int().min(0).max(90).optional(),
    minPayoutAmount: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Provide at least one setting' });

export const categoryCommissionSchema = z.object({
  commissionPercent: z.number().min(0).max(100).nullable(),
});

export const createPayoutSchema = z.object({
  sellerId: z.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
});

export const payoutActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('MARK_PAID'),
    method: z.enum(['BANK_TRANSFER', 'UPI', 'OTHER']),
    reference: z.string().trim().min(3, 'Enter the transfer reference / UTR').max(120),
    notes: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal('MARK_FAILED'), reason: z.string().trim().min(3, 'Enter a failure reason').max(500) }),
]);

export const adjustmentSchema = z.object({
  sellerId: z.number().int().positive(),
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: 'Amount cannot be zero' }),
  reason: z.string().trim().min(5, 'A reason is required (min 5 characters)').max(500),
});
