import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { checkRateLimit, getCachedData, setCachedData, RateLimitError } from '../lib/security'

const inputSchema = z.object({
  sku: z.coerce.string(),
  apiKey: z.string().optional(),
})

const skuSchema = z
  .string()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be less than 50 characters')
  .regex(/^[A-Za-z0-9-_]+$/, 'SKU must contain only alphanumeric characters, hyphens, and underscores')

export const fetchMarkData = createServerFn({
  method: 'GET',
})
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const input = data
    // const scraperApiKey = process.env.SCRAPER_API_KEY
    const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'
    const cacheTtl = parseInt(process.env.SCRAPER_CACHE_TTL_SECONDS || '21600', 10) * 1000
    const maxTimeout = parseInt(process.env.SCRAPER_TIMEOUT_MS || '30000', 10)

    // Validate SKU format
    const validatedSku = skuSchema.parse(input.sku)

    // Get IP address from request headers
    const ip = '127.0.0.1'

    // Validate security context
    /*
    if (scraperApiKey) {
      const securityResult = validateSecurityContext({
        ip,
        apiKey: input.apiKey,
        referer: undefined,
      }, scraperApiKey)

      if (!securityResult.valid) {
        throw new SecurityError(securityResult.error || 'Security validation failed')
      }
    }
    */

    // Check rate limits
    if (rateLimitEnabled) {
      const rateLimitResult = checkRateLimit(ip)
      if (rateLimitResult.limited) {
        throw new RateLimitError(
          'Rate limit exceeded',
          rateLimitResult.retryAfter
        )
      }
    }

    // Check cache first
    const cacheKey = `scraper:${validatedSku}`
    const cached = getCachedData(cacheKey)
    if (cached) {
      return cached
    }

    const { chromium } = await import('playwright')
    console.log(`Scraping Mark's for SKU: ${validatedSku}`)

    let browser
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Scraper timeout exceeded')), maxTimeout)
    })

    try {
      browser = await Promise.race([
        chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }),
        timeoutPromise,
      ])

      const browserContext = await browser.newContext({
        userAgent: 'Retail-Sync-Pro/1.0 (+https://github.com/yourorg/retail-sync-pro; contact: security@yourdomain.com) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      })

      browserContext.setDefaultTimeout(maxTimeout)
      const page = await browserContext.newPage()

      try {
        const searchUrl = `https://www.marks.com/en/search.html?q=${encodeURIComponent(validatedSku)}`
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: maxTimeout })

        const currentUrl = page.url()
        let result = {
          title: 'Unknown Product',
          price: 'N/A',
          imageUrl: '',
          webLink: currentUrl
        }

        const isPDP = currentUrl.includes('/pdp/') || /\/p\/.*\.html/.test(currentUrl)

        if (isPDP) {
          result.title = (await page.locator('h1.nl-product__title, .product-detail__title').first().textContent() || '').trim()
          result.price = (await page.locator('.nl-price--total, [data-testid="priceTotal"], .product-detail__price').first().textContent() || '').trim()
          result.imageUrl = await page.locator('.snapper_pane img, .product-detail__image img').first().getAttribute('src') || ''
        } else {
          // Search results page logic
          const firstProduct = page.locator('.product-tile, .nl-product-card').first()
          if (await firstProduct.count() > 0) {
            result.title = (await firstProduct.locator('.product-tile__title, .nl-product-card__title').first().textContent() || '').trim()
            result.price = (await firstProduct.locator('.price__current, .nl-product-card__price').first().textContent() || '').trim()
            const img = firstProduct.locator('img').first()
            result.imageUrl = await img.getAttribute('src') || await img.getAttribute('data-src') || ''
            const link = firstProduct.locator('a').first()
            const href = await link.getAttribute('href')
            if (href) {
              result.webLink = href.startsWith('http') ? href : `https://www.marks.com${href}`
            }
          } else {
            // Check for "0 results"
            const bodyText = await page.textContent('body')
            if (bodyText?.includes('0 results') || bodyText?.includes('not find any results')) {
              return null
            }
          }
        }

        if (result.imageUrl && !result.imageUrl.startsWith('http')) {
          result.imageUrl = `https://www.marks.com${result.imageUrl}`
        }

        // Cache the result
        setCachedData(cacheKey, result, cacheTtl)

        return result
      } catch (error) {
        console.error('Scraping error:', error)
        return null
      } finally {
        await browserContext.close()
      }
    } catch (error) {
      console.error('Browser launch error:', error)
      return null
    } finally {
      if (browser) {
        await browser.close().catch(e => console.error('Browser close error:', e))
      }
    }
  })
