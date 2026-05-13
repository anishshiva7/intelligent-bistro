import { z } from 'zod';

const CartItemSchema = z.object({
  menuItem: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    category: z.enum(['burgers', 'sandwiches', 'sides', 'drinks', 'desserts']),
    description: z.string(),
    tags: z.array(z.string()),
    popular: z.boolean().optional(),
    imageEmoji: z.string(),
  }),
  quantity: z.number().int().positive(),
  modifiers: z.array(z.string()),
});

export const ParseOrderRequestSchema = z.object({
  message: z.string().min(1).max(500),
  cartItems: z.array(CartItemSchema).default([]),
});
