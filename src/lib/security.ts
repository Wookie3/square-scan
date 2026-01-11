interface RateLimitEntry {
  count: number
  resetTime: number
}

interface CacheEntry<T> {
  data: T
  expiry: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const cacheStore = new Map<string, CacheEntry<unknown>>()

const RATE_LIMIT_WINDOW = 5 * 60 * 1000 // 5 minutes
const RATE_LIMIT_MAX_REQUESTS = 10 // requests per window

const DEFAULT_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

export function checkRateLimit(ip: string): { limited: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { limited: false }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    return { limited: true, retryAfter }
  }

  entry.count++
  return { limited: false }
}

export function getCachedData<T>(key: string): T | null {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined
  if (!entry) return null

  if (Date.now() > entry.expiry) {
    cacheStore.delete(key)
    return null
  }

  return entry.data
}

export function setCachedData<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
  cacheStore.set(key, {
    data,
    expiry: Date.now() + ttl,
  })
}

export function clearCache(): void {
  cacheStore.clear()
}

export function clearRateLimit(ip?: string): void {
  if (ip) {
    rateLimitStore.delete(ip)
  } else {
    rateLimitStore.clear()
  }
}

export interface SecurityContext {
  ip: string
  apiKey?: string
  referer?: string
}

export function validateSecurityContext(
  context: SecurityContext,
  requiredApiKey?: string,
  allowedReferers?: string[]
): { valid: boolean; error?: string } {
  // Check API key if required
  if (requiredApiKey && context.apiKey !== requiredApiKey) {
    return { valid: false, error: 'Invalid or missing API key' }
  }

  // Check referer if allowed referers are specified
  if (allowedReferers && allowedReferers.length > 0) {
    if (!context.referer) {
      return { valid: false, error: 'Referer header required' }
    }

    const refererValid = allowedReferers.some(allowed => {
      try {
        const refererUrl = new URL(context.referer!)
        const allowedUrl = new URL(allowed)
        return refererUrl.hostname === allowedUrl.hostname
      } catch {
        return false
      }
    })

    if (!refererValid) {
      return { valid: false, error: 'Invalid referer' }
    }
  }

  return { valid: true }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityError'
  }
}
