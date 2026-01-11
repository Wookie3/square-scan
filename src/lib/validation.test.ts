import { describe, it, expect } from 'vitest'
import { upcSchema, skuSchema } from './validation'

describe('upcSchema', () => {
  it('should accept valid 12-digit UPC', () => {
    const result = upcSchema.safeParse('704005630934')
    expect(result.success).toBe(true)
    if (result.success) {
      // 12-digit UPCs are padded to 13 digits
      expect(result.data).toBe('0704005630934')
    }
  })

  it('should accept valid 13-digit UPC', () => {
    const result = upcSchema.safeParse('7040056309347')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('7040056309347')
    }
  })

  it('should pad 12-digit UPC to 13 digits', () => {
    const result = upcSchema.safeParse('123456789012')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('0123456789012')
    }
  })

  it('should reject UPC with letters', () => {
    const result = upcSchema.safeParse('704005630934a')
    expect(result.success).toBe(false)
  })

  it('should reject UPC with special characters', () => {
    const result = upcSchema.safeParse('704005630934!')
    expect(result.success).toBe(false)
  })

  it('should reject UPC with too few digits', () => {
    const result = upcSchema.safeParse('12345678901')
    expect(result.success).toBe(false)
  })

  it('should reject UPC with too many digits', () => {
    const result = upcSchema.safeParse('12345678901234')
    expect(result.success).toBe(false)
  })

  it('should reject empty string', () => {
    const result = upcSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('should reject UPC with spaces', () => {
    const result = upcSchema.safeParse('7040056309 34')
    expect(result.success).toBe(false)
  })
})

describe('skuSchema', () => {
  it('should accept valid SKU with alphanumeric characters', () => {
    const result = skuSchema.safeParse('ABC123')
    expect(result.success).toBe(true)
  })

  it('should accept SKU with hyphens', () => {
    const result = skuSchema.safeParse('ABC-123')
    expect(result.success).toBe(true)
  })

  it('should accept SKU with underscores', () => {
    const result = skuSchema.safeParse('ABC_123')
    expect(result.success).toBe(true)
  })

  it('should accept SKU with mixed characters', () => {
    const result = skuSchema.safeParse('AbC-123_XyZ')
    expect(result.success).toBe(true)
  })

  it('should reject empty string', () => {
    const result = skuSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('should reject SKU with special characters', () => {
    const result = skuSchema.safeParse('ABC@123')
    expect(result.success).toBe(false)
  })

  it('should reject SKU with spaces', () => {
    const result = skuSchema.safeParse('ABC 123')
    expect(result.success).toBe(false)
  })

  it('should reject SKU exceeding 50 characters', () => {
    const result = skuSchema.safeParse('A'.repeat(51))
    expect(result.success).toBe(false)
  })
})
