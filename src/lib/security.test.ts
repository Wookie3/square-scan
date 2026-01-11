import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  checkRateLimit, 
  getCachedData, 
  setCachedData, 
  validateSecurityContext,
  clearCache,
  clearRateLimit,
  RateLimitError,
  SecurityError 
} from './security'

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearRateLimit()
  })

  it('should allow first request from an IP', () => {
    const result = checkRateLimit('192.168.1.1')
    expect(result.limited).toBe(false)
    expect(result.retryAfter).toBeUndefined()
  })

  it('should allow requests within limit', () => {
    const ip = '192.168.1.1'
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit(ip)
      expect(result.limited).toBe(false)
    }
  })

  it('should block requests exceeding limit', () => {
    const ip = '192.168.1.1'
    // Make 10 requests (at limit)
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip)
    }
    // 11th request should be blocked
    const result = checkRateLimit(ip)
    expect(result.limited).toBe(true)
    expect(result.retryAfter).toBeDefined()
  })

  it('should provide retry-after time in seconds', () => {
    const ip = '192.168.1.1'
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip)
    }
    const result = checkRateLimit(ip)
    expect(result.limited).toBe(true)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('should reset rate limit after window expires', () => {
    const ip = '192.168.1.1'
    // Exhaust limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip)
    }
    // Should be blocked
    expect(checkRateLimit(ip).limited).toBe(true)
    
    // Clear and try again (simulating window expiration)
    clearRateLimit(ip)
    expect(checkRateLimit(ip).limited).toBe(false)
  })

  it('should track different IPs independently', () => {
    const ip1 = '192.168.1.1'
    const ip2 = '192.168.1.2'
    
    // Exhaust limit for IP1
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip1)
    }
    expect(checkRateLimit(ip1).limited).toBe(true)
    
    // IP2 should still be allowed
    expect(checkRateLimit(ip2).limited).toBe(false)
  })
})

describe('Caching', () => {
  beforeEach(() => {
    clearCache()
  })

  it('should cache and retrieve data', () => {
    const key = 'test-key'
    const data = { price: '29.99', title: 'Test Product' }
    
    setCachedData(key, data)
    const retrieved = getCachedData(key)
    
    expect(retrieved).toEqual(data)
  })

  it('should return null for non-existent cache entry', () => {
    const result = getCachedData('non-existent')
    expect(result).toBeNull()
  })

  it('should respect custom TTL', () => {
    vi.useFakeTimers()
    
    const key = 'test-key'
    const data = { price: '29.99' }
    const ttl = 1000 // 1 second
    
    setCachedData(key, data, ttl)
    expect(getCachedData(key)).toEqual(data)
    
    // Advance time past TTL
    vi.advanceTimersByTime(ttl + 100)
    expect(getCachedData(key)).toBeNull()
    
    vi.useRealTimers()
  })

  it('should handle different data types', () => {
    const stringKey = 'string-key'
    const objectKey = 'object-key'
    const arrayKey = 'array-key'
    
    setCachedData(stringKey, 'test-string')
    setCachedData(objectKey, { foo: 'bar' })
    setCachedData(arrayKey, [1, 2, 3])
    
    expect(getCachedData(stringKey)).toBe('test-string')
    expect(getCachedData(objectKey)).toEqual({ foo: 'bar' })
    expect(getCachedData(arrayKey)).toEqual([1, 2, 3])
  })
})

describe('Security Validation', () => {
  it('should accept valid API key', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1', apiKey: 'valid-key' },
      'valid-key'
    )
    expect(result.valid).toBe(true)
  })

  it('should reject missing API key when required', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1' },
      'required-key'
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('API key')
  })

  it('should reject invalid API key', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1', apiKey: 'wrong-key' },
      'valid-key'
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('API key')
  })

  it('should accept when no API key is required', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1' },
      undefined
    )
    expect(result.valid).toBe(true)
  })

  it('should validate referer against allowed list', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1', referer: 'https://example.com/page' },
      undefined,
      ['https://example.com']
    )
    expect(result.valid).toBe(true)
  })

  it('should reject referer not in allowed list', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1', referer: 'https://evil.com/page' },
      undefined,
      ['https://example.com']
    )
    expect(result.valid).toBe(false)
    expect(result.error?.toLowerCase()).toContain('referer')
  })

  it('should require referer when allowed list is provided', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1' },
      undefined,
      ['https://example.com']
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Referer')
  })

  it('should match hostname for referer validation', () => {
    const result = validateSecurityContext(
      { ip: '192.168.1.1', referer: 'https://example.com/any/path?query=1' },
      undefined,
      ['https://example.com']
    )
    expect(result.valid).toBe(true)
  })
})

describe('Custom Error Classes', () => {
  it('should create RateLimitError with retryAfter', () => {
    const error = new RateLimitError('Too many requests', 60)
    expect(error.message).toBe('Too many requests')
    expect(error.name).toBe('RateLimitError')
    expect(error.retryAfter).toBe(60)
  })

  it('should create RateLimitError without retryAfter', () => {
    const error = new RateLimitError('Too many requests')
    expect(error.message).toBe('Too many requests')
    expect(error.retryAfter).toBeUndefined()
  })

  it('should create SecurityError', () => {
    const error = new SecurityError('Unauthorized')
    expect(error.message).toBe('Unauthorized')
    expect(error.name).toBe('SecurityError')
  })

  it('should be instanceof Error', () => {
    const rateError = new RateLimitError('test', 10)
    const secError = new SecurityError('test')
    
    expect(rateError instanceof Error).toBe(true)
    expect(secError instanceof Error).toBe(true)
  })
})
