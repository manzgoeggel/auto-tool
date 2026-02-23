/**
 * apify-autoscout24.ts
 *
 * Fetches the minimum listing price on AutoScout24.ch via the Apify
 * `3x1t/autoscout24-scraper-ppr` actor.
 *
 * REAL INPUT SCHEMA (confirmed from live runs):
 *   startUrls             string[]  — plain URL strings (NOT {url} objects!)
 *   lightningMode         boolean   — true (fast mode, confirmed working)
 *   resultLimitPerThread  integer   — max results per URL (use 20 — first page only)
 *   reviewLimit           integer   — 0 (skip reviews)
 *   customRunFailureThresholdPercent integer — 50
 *
 *   NOTE: snake_case variants (start_urls, scrape_page_limit) return 0 results.
 *         Always use camelCase: startUrls, resultLimitPerThread.
 *
 * REAL OUTPUT SCHEMA (confirmed from live dataset):
 *   id               string  — UUID (e.g. "bbf93ddb-bbe1-4244-...")
 *   url              string  — listing detail URL
 *   title            string
 *   brand            string
 *   model            string
 *   previewImage     string
 *   images           string[]
 *   price.total.amount   number — price in local currency (CHF for .ch)
 *   price.total.currency string
 *   attributes       object — keyed by English label:
 *     "Mileage"            → "20 km"
 *     "First Registration" → "12/2025"
 *     "Power"              → "137 kW"
 *     "Fuel"               → "Gasoline"
 *     "Transmission"       → "Automatic"
 *     "Vehicle condition"  → "Used"
 *     "Colour"             → "Green"
 *     "Category"           → "Off-Road/Pick-up"
 *   features         string[]
 *   description      string
 *   dealerDetails.name            string
 *   dealerDetails.sellerType      string — "Dealer" | "Private"
 *   dealerDetails.address         string — "Street, City, CountryCode"
 *   dealerDetails.addressStructured.city string
 *   dealerDetails.addressStructured.countryCode string
 *
 * Required env var:
 *   APIFY_TOKEN  — same token as mobile.de actor
 */

import { toAutoscout24BrandSlug, toAutoscout24ModelSlug } from '@/lib/constants';
import type { AS24MinPrice } from './autoscout24';

const APIFY_ACTOR = '3x1t~autoscout24-scraper-ppr';
const APIFY_BASE = 'https://api.apify.com/v2';

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN env var is not set');
  return token;
}

/**
 * Build an AutoScout24.ch search URL sorted by price ascending.
 */
function buildAs24SearchUrl(
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
  params.set('ustate', 'N,U');

  return `https://www.autoscout24.ch/de/lst?${params.toString()}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMinPrice(items: Record<string, any>[], searchUrl: string): AS24MinPrice | null {
  let cheapest: AS24MinPrice | null = null;

  for (const item of items) {
    // Real output: price.total.amount
    const rawPrice: number = Number(
      item.price?.total?.amount ??
      item.price?.amount ??
      item.price ??
      0,
    );

    if (!rawPrice || rawPrice < 1000) continue;

    const listingUrl: string = item.url ?? searchUrl;

    if (!cheapest || rawPrice < cheapest.minPriceChf) {
      cheapest = { minPriceChf: Math.round(rawPrice), listingUrl };
    }
  }

  return cheapest;
}

/**
 * Fetch the minimum listing price on AutoScout24.ch for a given brand/model/yearFrom
 * via the Apify `3x1t/autoscout24-scraper-ppr` actor.
 *
 * Drop-in replacement for `getMinPriceFromAutoscout24` — same signature, same return type.
 */
export async function getMinPriceViaApify(
  brand: string,
  model: string | null,
  yearFrom?: number | null,
): Promise<AS24MinPrice | null> {
  const token = getApifyToken();
  const searchUrl = buildAs24SearchUrl(brand, model, yearFrom);

  console.log(`[apify-as24] Fetching min price: ${searchUrl}`);

  // IMPORTANT: startUrls must be plain strings (not {url} objects),
  // and lightningMode must be true. snake_case variants return 0 results.
  const input = {
    startUrls: [searchUrl],
    lightningMode: true,
    resultLimitPerThread: 20, // first page only — sorted cheapest-first
    reviewLimit: 0,
    customRunFailureThresholdPercent: 50,
  };

  const endpoint =
    `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items` +
    `?token=${token}&format=json&clean=true`;

  let rawItems: Record<string, unknown>[] = [];

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(290_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Apify API ${res.status}: ${body.slice(0, 400)}`);
    }

    rawItems = await res.json() as Record<string, unknown>[];
    console.log(`[apify-as24] Received ${rawItems.length} items for ${brand} ${model ?? 'any'}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[apify-as24] Actor run failed for ${brand} ${model ?? 'any'}:`, msg);
    return null;
  }

  if (rawItems.length === 0) {
    console.warn(`[apify-as24] No listings for ${brand} ${model ?? 'any'} (year≥${yearFrom ?? 'any'})`);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = extractMinPrice(rawItems as Record<string, any>[], searchUrl);

  if (result) {
    console.log(
      `[apify-as24] Min price for ${brand} ${model ?? 'any'}: ` +
      `CHF ${result.minPriceChf.toLocaleString()} (from ${rawItems.length} listings)`,
    );
  } else {
    console.warn(`[apify-as24] Could not extract price from ${rawItems.length} items`);
  }

  return result;
}
