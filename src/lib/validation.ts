import { z } from 'zod'

export const upcSchema = z
  .string()
  .regex(/^[0-9]{12,13}$/, 'UPC must be 12-13 digit numeric string')
  .transform(val => val.padStart(13, '0'))

export const skuSchema = z
  .string()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be less than 50 characters')
  .regex(/^[A-Za-z0-9-_]+$/, 'SKU must contain only alphanumeric characters, hyphens, and underscores')

export const barcodeSchema = upcSchema

export type UPCInput = z.infer<typeof upcSchema>
export type SKUInput = z.infer<typeof skuSchema>
