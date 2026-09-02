import { z } from 'zod';

export const addressSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits').max(15),
  houseBuilding: z.string().min(2, 'House / Building details required').max(255),
  streetArea: z.string().min(2, 'Street / Area details required').max(255),
  city: z.string().min(2, 'City required').max(100),
  state: z.string().min(2, 'State required').max(100),
  postalCode: z.string().min(4, 'Valid postal code required').max(20),
  country: z.string().default('India'),
  isDefault: z.boolean().optional().default(false),
});
