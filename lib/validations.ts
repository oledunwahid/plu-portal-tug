import { z } from 'zod';

export const createRequestSchema = z.object({
  requestType: z.enum(['NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'UPDATE_FULL']),
  code: z.string().optional(),
  name: z.string().min(1, 'Item name is required'),
  category: z.string().min(1, 'Category is required'),
  department: z.string().min(1, 'Department is required'),
  price: z.number().positive('Price must be a positive number').optional().nullable(),
  folder: z.string().optional(),
  serviceCharge: z.boolean().default(true),
  tax1: z.boolean().default(true),
  tax2: z.boolean().default(true),
  noDiscount: z.boolean().default(true),
  hideReceipt: z.boolean().default(false),
  printers: z.string().min(1, 'At least one printer is required'),
  outlets: z.string().min(1, 'At least one outlet is required'),
  remarks: z.string().optional(),
}).refine(
  (d) => d.requestType === 'NEW_ITEM' || !!d.code,
  { message: 'PLU code is required for update requests', path: ['code'] }
).refine(
  (d) => !['NEW_ITEM', 'UPDATE_PRICE'].includes(d.requestType) || (d.price != null && d.price > 0),
  { message: 'Price is required for this request type', path: ['price'] }
);

export const updateRequestSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  price: z.number().positive().optional().nullable(),
  folder: z.string().optional().nullable(),
  serviceCharge: z.boolean().optional(),
  tax1: z.boolean().optional(),
  tax2: z.boolean().optional(),
  noDiscount: z.boolean().optional(),
  hideReceipt: z.boolean().optional(),
  printers: z.string().optional(),
  outlets: z.string().optional(),
  remarks: z.string().optional().nullable(),
  adminNote: z.string().optional().nullable(),
});

export const createUserSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['CASHIER', 'ADMIN']),
  outlet: z.string().min(1, 'Outlet is required'),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['CASHIER', 'ADMIN']).optional(),
  outlet: z.string().optional(),
  active: z.boolean().optional(),
});
