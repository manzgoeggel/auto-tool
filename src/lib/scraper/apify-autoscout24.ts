/**
 * apify-autoscout24.ts
 *
 * Replaces the Bright Data / Cheerio AutoScout24.ch scraper with the Apify
 * `3x1t/autoscout24-scraper-ppr` actor (Pay-Per-Result).
 *
 * The actor accepts AutoScout24 search page URLs and returns structured
 * listing objects — no HTML parsing required.
 *
 * Required env var:
 *   APIFY_TOKEN  — same token used for the mobile.de actor
 *
 * Apify run-sync endpoint (waits for completion, max 300 s):
 *   POST https://api.apify.com/v2/acts/3x1t~autoscout24-scraper-ppr/run-sync-get-dataset-items
 *
 * We only need the cheapest listing (sorted by price asc) — so we submit one
 * page URL and cap scrape_page_limit at 1. This is the cheapest/fastest call.
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
 * Mirrors the logic in the old autoscout24.ts scraper.
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
    // Price: actor may return it as `price`, `priceChf`, `priceCHF`, `prices.publicPrice`
    const rawPrice: number =
      Number(
        item.price ??
        item.priceChf ??
        item.priceCHF ??
        item.prices?.publicPrice ??
        item.prices?.cash ??
        0,
      );

    if (!rawPrice || rawPrice < 1000) continue;

    // Listing URL
    const listingUrl: string =
      item.url ?? item.link ?? item.detailUrl ?? searchUrl;

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

  console.log(`[apify-as24] Fetching min price via Apify: ${searchUrl}`);

  const input = {
    start_urls: [{ url: searchUrl }],
    scrape_page_limit: 1, // We only need the first page (cheapest-first sort)
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
    console.warn(`[apify-as24] No listings returned for ${brand} ${model ?? 'any'} (year≥${yearFrom ?? 'any'})`);
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
