/**
 * autoscout24.ts
 *
 * Fetches the minimum (cheapest) listing price on AutoScout24.ch for a given
 * brand + model + year combination.
 *
 * Strategy:
 *   1. Build a search URL sorted by price ascending (cheapest first)
 *   2. Fetch page 1 via Bright Data Web Unlocker (Swiss exit node)
 *   3. Try to extract listing data from __NEXT_DATA__ JSON (fastest)
 *   4. Fallback: parse HTML with Cheerio selectors
 *   5. Return the minimum CHF price found + link to that listing
 *
 * This is called at most once per 24h per brand/model/year (cached in DB).
 */

import { load } from 'cheerio';
import { fetchUnblocked } from './fetch-proxy';
import { toAutoscout24BrandSlug, toAutoscout24ModelSlug } from '@/lib/constants';

export interface AS24MinPrice {
  minPriceChf: number;
  listingUrl: string;
}

/**
 * Build an AutoScout24.ch search URL sorted by price ascending.
 */
function buildAutoscout24SearchUrl(
  brand: string,
  model: string | null,
  yearFrom?: number | null,
): string {
  const brandSlug = toAutoscout24BrandSlug(brand);
  const params = new URLSearchParams();

  params.set('make', brandSlug);
  if (model) {
    params.set('model', toAutoscout24ModelSlug(brand, model));
  }
  if (yearFrom) {
    params.set('fregfrom', String(yearFrom));
  }
  params.set('sort', 'price');
  params.set('asc', '1');
  params.set('cy', 'CH');
  // Only show used + new cars, standard condition filter
  params.set('ustate', 'N,U');

  return `https://www.autoscout24.ch/de/lst?${params.toString()}`;
}

/**
 * Parse a Swiss number string (e.g. "45'900" or "45.900") to an integer.
 */
function parseSwissNumber(text: string): number {
  return parseInt(text.replace(/['\s.]/g, ''), 10);
}

/**
 * Try to extract listing prices from AutoScout24's embedded __NEXT_DATA__ JSON.
 * Returns an array of { priceChf, listingUrl } for all listings found on the page.
 */
function extractFromNextData(html: string, baseUrl: string): AS24MinPrice[] {
  try {
    const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return [];

    const json = JSON.parse(match[1]);

    // Try multiple known paths in the Next.js page props
    const pageProps = json?.props?.pageProps;
    if (!pageProps) return [];

    // Path 1: pageProps.listings (array)
    const listings: unknown[] = pageProps.listings ?? pageProps.listingPage?.listings ?? [];
    if (!Array.isArray(listings) || listings.length === 0) return [];

    const results: AS24MinPrice[] = [];
    for (const item of listings) {
      if (typeof item !== 'object' || item === null) continue;
      const l = item as Record<string, unknown>;

      // Price can be in various fields
      const rawPrice =
        (l.price as number | undefined) ??
        (l.priceCHF as number | undefined) ??
        ((l.prices as Record<string, unknown> | undefined)?.publicPrice as number | undefined) ??
        ((l.prices as Record<string, unknown> | undefined)?.cash as number | undefined);

      if (!rawPrice || typeof rawPrice !== 'number') continue;

      // Build listing URL
      let listingUrl = baseUrl;
      const id = (l.id ?? l.guid ?? l.listingId) as string | number | undefined;
      if (id) {
        listingUrl = `https://www.autoscout24.ch/de/auto/-/-/${id}`;
      }
      // If there's a URL field use it
      if (typeof l.url === 'string' && l.url.startsWith('http')) {
        listingUrl = l.url;
      }

      results.push({ minPriceChf: Math.round(rawPrice), listingUrl });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Parse AutoScout24.ch search result HTML with Cheerio as a fallback.
 */
function extractFromHtml(html: string, pageUrl: string): AS24MinPrice[] {
  const $ = load(html);
  const results: AS24MinPrice[] = [];

  // AutoScout24 uses different selectors depending on version/AB test
  // Try multiple strategies in order
  const selectors = [
    'article[data-testid]',
    'article[class*="ListItem"]',
    'div[class*="ListItem"]',
    '[data-testid*="listing"]',
    'article',
  ];

  let $listings = $();
  for (const sel of selectors) {
    $listings = $(sel);
    if ($listings.length > 0) break;
  }

  $listings.each((_, el) => {
    const $el = $(el);

    // Try to find the price
    const priceText =
      $el.find('[data-testid*="price"]').first().text() ||
      $el.find('[class*="Price"]').first().text() ||
      $el.find('[class*="price"]').first().text() ||
      $el.text();

    // Match CHF number patterns: "CHF 45'900", "Fr. 45'900", "45'900 CHF"
    const pricePatterns = [
      /CHF\s*([\d'.\s]+)/i,
      /Fr\.\s*([\d'.\s]+)/i,
      /([\d']+)\s*CHF/i,
      /([\d']+)\s*Fr\./i,
    ];

    let priceChf: number | null = null;
    for (const pattern of pricePatterns) {
      const m = priceText.match(pattern);
      if (m) {
        const parsed = parseSwissNumber(m[1]);
        if (parsed > 1000 && parsed < 10_000_000) {
          priceChf = parsed;
          break;
        }
      }
    }

    if (!priceChf) return;

    // Find listing URL
    let listingUrl = pageUrl;
    const $link = $el.find('a[href*="/auto/"]').first();
    if ($link.length) {
      const href = $link.attr('href') ?? '';
      listingUrl = href.startsWith('http')
        ? href
        : `https://www.autoscout24.ch${href}`;
    }

    results.push({ minPriceChf: priceChf, listingUrl });
  });

  return results;
}

/**
 * Fetch the minimum listing price on AutoScout24.ch for a given brand/model/yearFrom.
 *
 * @param brand    Display name, e.g. "Porsche"
 * @param model    Display name, e.g. "911" (null = any model)
 * @param yearFrom Minimum registration year (optional)
 */
export async function getMinPriceFromAutoscout24(
  brand: string,
  model: string | null,
  yearFrom?: number | null,
): Promise<AS24MinPrice | null> {
  const searchUrl = buildAutoscout24SearchUrl(brand, model, yearFrom);
  console.log(`[AS24] Fetching min price: ${searchUrl}`);

  let html: string;
  try {
    const result = await fetchUnblocked(searchUrl, {
      // Use Swiss exit node so we see CHF prices and CH-specific listings
      timeoutMs: 60_000,
      retries: 3,
    });
    html = result.html;
  } catch (err) {
    console.error(`[AS24] Failed to fetch ${searchUrl}:`, err);
    return null;
  }

  // Check for blocks
  if (html.includes('Just a moment') || html.includes('cf-browser-verification')) {
    console.warn('[AS24] Cloudflare block detected');
    return null;
  }

  if (html.length < 1000) {
    console.warn(`[AS24] Response too short (${html.length} bytes)`);
    return null;
  }

  // Try __NEXT_DATA__ first
  let prices = extractFromNextData(html, searchUrl);

  // Fallback to HTML parsing
  if (prices.length === 0) {
    console.log('[AS24] __NEXT_DATA__ extraction failed, falling back to HTML parse');
    prices = extractFromHtml(html, searchUrl);
  }

  if (prices.length === 0) {
    console.warn(`[AS24] No listings found for ${brand} ${model ?? 'any'} (year≥${yearFrom ?? 'any'})`);
    // Log a snippet of the HTML for debugging
    console.log('[AS24] HTML snippet:', html.slice(0, 500));
    return null;
  }

  // Since we sorted by price ascending, the first result should be cheapest.
  // But take the minimum across all found listings to be safe.
  const cheapest = prices.reduce((min, cur) =>
    cur.minPriceChf < min.minPriceChf ? cur : min
  );

  console.log(
    `[AS24] Min price for ${brand} ${model ?? 'any'}: CHF ${cheapest.minPriceChf.toLocaleString()} ` +
    `(from ${prices.length} listings parsed)`
  );

  return cheapest;
}
