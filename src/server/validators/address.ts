import { z } from 'zod';

export const addressSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  phoneNumber: z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  houseBuilding: z.string().min(2, 'House / Building details required').max(255),
  streetArea: z.string().min(2, 'Street / Area details required').max(255),
  city: z.string().min(2, 'City required').max(100),
  state: z.string().min(2, 'State required').max(100),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
  country: z.string().default('India'),
  type: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  isDefault: z.boolean().optional().default(false),
});
