import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.number().int().positive('Valid product ID is required'),
  variantId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20, 'Maximum 20 items per order'),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20, 'Maximum 20 items'),
});

export const createOrderSchema = z.object({
  addressId: z.number().int().positive().optional(),
  shippingAddressSnapshot: z.object({
    fullName: z.string().min(2),
    phoneNumber: z.string().min(10),
    houseBuilding: z.string().min(2),
    streetArea: z.string().min(2),
    city: z.string().min(2),
    state: z.string().min(2),
    postalCode: z.string().min(4),
    country: z.string().default('India'),
  }).optional(),
  paymentMethod: z.enum(['UPI', 'CARD', 'NETBANKING', 'COD']).default('CARD'),
  directBuyItem: z.object({
    productId: z.number().int().positive(),
    variantId: z.number().int().positive().nullable().optional(),
    quantity: z.number().int().min(1).max(20),
  }).optional(),
  couponCode: z.string().trim().max(30).optional(),
});

export const createReviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1, 'Rating must be 1-5 stars').max(5, 'Rating must be 1-5 stars'),
  title: z.string().min(3, 'Review title must be at least 3 characters').max(150),
  comment: z.string().min(10, 'Review comment must be at least 10 characters').max(2000),
});

export const createQuestionSchema = z.object({
  productId: z.number().int().positive(),
  questionText: z.string().min(5, 'Question must be at least 5 characters').max(500),
});

export const createAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  answerText: z.string().min(3, 'Answer must be at least 3 characters').max(1000),
});
