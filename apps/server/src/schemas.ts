import { z } from 'zod';

export const AddItemActionSchema = z.object({
  type: z.literal('ADD_ITEM'),
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
  modifiers: z.array(z.string()).default([]),
});

export const RemoveItemActionSchema = z.object({
  type: z.literal('REMOVE_ITEM'),
  itemId: z.string().min(1),
});

export const UpdateQuantityActionSchema = z.object({
  type: z.literal('UPDATE_QUANTITY'),
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const ClearCartActionSchema = z.object({
  type: z.literal('CLEAR_CART'),
});

export const OrderActionSchema = z.discriminatedUnion('type', [
  AddItemActionSchema,
  RemoveItemActionSchema,
  UpdateQuantityActionSchema,
  ClearCartActionSchema,
]);

export const ParseOrderResponseSchema = z.object({
  actions: z.array(OrderActionSchema),
  assistantMessage: z.string().min(1),
});

export type ParseOrderResponse = z.infer<typeof ParseOrderResponseSchema>;
