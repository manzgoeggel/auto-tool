/**
 * apify-mobile-de.ts
 *
 * Replaces the Bright Data / ScraperAPI scraper with the Apify
 * `3x1t/mobile-de-scraper-ppr` actor (Pay-Per-Result).
 *
 * The actor accepts mobile.de search page URLs via the `start_urls` input
 * and returns structured car listing objects — no HTML parsing required.
 *
 * Required env var:
 *   APIFY_TOKEN  — API token from console.apify.com → Settings → API & Integrations
 *
 * Apify run-sync endpoint (waits for completion, max 300 s):
 *   POST https://api.apify.com/v2/acts/3x1t~mobile-de-scraper-ppr/run-sync-get-dataset-items
 *
 * Input schema (known fields):
 *   start_urls         array of { url: string }   — mobile.de search page URLs
 *   scrape_page_limit  integer                     — max pages per URL to crawl
 *
 * Output schema (fields returned per listing item):
 *   id               string   — mobile.de listing ID (our externalId)
 *   url              string   — listing page URL
 *   title            string   — full listing title
 *   price            number   — price in EUR (may be netto/gross depending on listing)
 *   mileage          number   — km
 *   firstRegistration string  — "MM/YYYY"
 *   power            string   — e.g. "190 PS (140 kW)"
 *   fuelType         string   — e.g. "Benzin", "Diesel", "Elektro"
 *   transmission     string   — e.g. "Automatik", "Schaltgetriebe"
 *   sellerType       string   — "dealer" | "private"
 *   sellerName       string   — dealer name
 *   location         string   — city / region
 *   imageUrl         string   — main photo URL
 *   vatDeductible    boolean  — MwSt. ausweisbar
 *   accidentDamage   boolean  — has accident damage
 *   bodyType         string   — e.g. "Sportwagen/Coupé"
 *   color            string   — exterior colour
 *   description      string   — listing description text
 *   features         string[] — list of equipment/features
 *
 * Note: field names are best-guesses based on the actor's README and
 * common mobile.de data conventions. The adapter below normalises all
 * known variants so the rest of the codebase stays unchanged.
 */

import { buildSearchUrl } from './url-builder';
import type { SearchConfig } from '@/lib/db/schema';
import type { RawListing } from '@/lib/types/index';

const APIFY_ACTOR = '3x1t~mobile-de-scraper-ppr';
const APIFY_BASE = 'https://api.apify.com/v2';

// How many pages the Apify actor should crawl per start URL.
// Each mobile.de page has 20 listings, so 5 pages → up to 100 results.
const DEFAULT_PAGES = 5;

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN env var is not set');
  return token;
}

// ─── Apify item → RawListing normalisation ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseItem(item: Record<string, any>): RawListing | null {
  // Extract listing ID — the actor may return it as `id`, `listingId`, or from `url`
  let externalId: string =
    String(item.id ?? item.listingId ?? item.adId ?? '');

  // Fallback: parse ID from URL
  if (!externalId && item.url) {
    const m = String(item.url).match(/id=(\d+)/);
    if (m) externalId = m[1];
  }
  if (!externalId) return null;

  const listingUrl: string =
    item.url ?? item.link ?? item.detailUrl ?? '';
  if (!listingUrl) return null;

  const title: string = item.title ?? item.name ?? item.headline ?? '';
  if (!title) return null;

  // Price — actor may return gross or net; we store as-is (EUR)
  const priceEur: number =
    Number(item.price ?? item.priceEur ?? item.priceGross ?? 0);

  // Mileage
  const mileageKm: number =
    Number(item.mileage ?? item.mileageKm ?? item.km ?? 0);

  // First registration — "MM/YYYY" or year only
  let firstRegistrationYear = 0;
  let firstRegistrationMonth: number | undefined;
  const regRaw: string = item.firstRegistration ?? item.registration ?? item.year ?? '';
  if (regRaw) {
    const mmYYYY = String(regRaw).match(/(\d{1,2})[\/\-](\d{4})/);
    if (mmYYYY) {
      firstRegistrationMonth = parseInt(mmYYYY[1], 10);
      firstRegistrationYear = parseInt(mmYYYY[2], 10);
    } else {
      const yearOnly = String(regRaw).match(/(\d{4})/);
      if (yearOnly) firstRegistrationYear = parseInt(yearOnly[1], 10);
    }
  }

  // Power — normalise to "190 PS (140 kW)" format
  const power: string | undefined =
    item.power ?? item.enginePower ?? item.ps ?? undefined;

  // Fuel type — normalise German → English
  const fuelRaw: string = item.fuelType ?? item.fuel ?? '';
  const fuelType: string = normaliseFuel(fuelRaw) || 'Unknown';

  // Transmission
  const transmissionRaw: string = item.transmission ?? item.gearbox ?? '';
  const transmission: string = normaliseTransmission(transmissionRaw) || 'Unknown';

  // Seller
  const sellerType: 'dealer' | 'private' =
    String(item.sellerType ?? item.seller ?? 'dealer').toLowerCase().includes('privat')
      ? 'private'
      : 'dealer';
  const sellerName: string | undefined = item.sellerName ?? item.dealerName ?? undefined;

  // Location
  const location: string = item.location ?? item.city ?? item.address ?? '';

  // Country — mobile.de is DE-only
  const country: string = item.country ?? 'DE';

  // Image
  const imageUrl: string | undefined =
    Array.isArray(item.images) && item.images.length > 0
      ? String(item.images[0]?.url ?? item.images[0] ?? '')
      : item.imageUrl ?? item.thumbnail ?? item.mainImage ?? undefined;

  // VAT — actor may return boolean or text signal
  const vatDeductible: boolean =
    item.vatDeductible === true ||
    item.vat === true ||
    String(item.vatDeductible ?? item.vat ?? '').toLowerCase().includes('ausweisbar') ||
    String(item.vatDeductible ?? '').toLowerCase() === 'true';

  // Accident damage
  const hasAccidentDamage: boolean =
    item.accidentDamage === true ||
    item.hasAccidentDamage === true ||
    String(item.accidentDamage ?? item.hasAccidentDamage ?? '').toLowerCase() === 'true';

  // Extras
  const bodyType: string | undefined = item.bodyType ?? item.category ?? undefined;
  const color: string | undefined = item.color ?? item.colour ?? undefined;
  const description: string | undefined = item.description ?? item.text ?? undefined;
  const features: string[] | undefined = Array.isArray(item.features)
    ? item.features.map(String)
    : Array.isArray(item.equipment)
    ? item.equipment.map(String)
    : undefined;

  return {
    externalId,
    title,
    priceEur,
    mileageKm,
    firstRegistrationYear,
    firstRegistrationMonth,
    fuelType,
    transmission,
    power: power ? String(power) : undefined,
    sellerType,
    sellerName,
    location,
    country,
    listingUrl,
    imageUrl: imageUrl || undefined,
    bodyType,
    color,
    features,
    description,
    vatDeductible,
    hasAccidentDamage,
  };
}

function normaliseFuel(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('elektro') || lower.includes('electric')) return 'Electric';
  if (lower.includes('plug-in') || lower.includes('plugin')) return 'Plug-in Hybrid';
  if (lower.includes('hybrid')) return 'Hybrid';
  if (lower.includes('diesel')) return 'Diesel';
  if (lower.includes('benzin') || lower.includes('petrol') || lower.includes('gasoline')) return 'Petrol';
  if (lower.includes('erdgas') || lower.includes('cng')) return 'CNG';
  if (lower.includes('autogas') || lower.includes('lpg')) return 'LPG';
  if (lower.includes('wasser') || lower.includes('hydrogen')) return 'Hydrogen';
  return raw || 'Unknown';
}

function normaliseTransmission(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('automat') || lower.includes('automatic')) return 'Automatic';
  if (lower.includes('manual') || lower.includes('schalt') || lower.includes('manuell')) return 'Manual';
  if (lower.includes('halbaut') || lower.includes('semi')) return 'Semi-automatic';
  return raw || 'Unknown';
}

// ─── Main scrape function ─────────────────────────────────────────────────────

/**
 * Scrape mobile.de via the Apify `3x1t/mobile-de-scraper-ppr` actor.
 *
 * Constructs one search URL per page range using buildSearchUrl(), submits
 * it to Apify, and waits synchronously for results (up to 300 seconds).
 *
 * Returns the same shape as the old scrapeMobileDe() so callers need no changes.
 */
export async function scrapeMobileDeViaApify(
  config: SearchConfig,
  maxPages: number = DEFAULT_PAGES,
  existingIds: Set<string> = new Set(),
  options: { vatOnly?: boolean } = {},
): Promise<{
  listings: RawListing[];
  newCount: number;
  updatedCount: number;
  totalResults?: number;
  pagesScraped: number;
  errors: string[];
}> {
  const token = getApifyToken();
  const errors: string[] = [];

  // Build the first-page search URL — Apify will paginate internally
  const searchUrl = buildSearchUrl(config, 1, options);
  console.log(`[apify] Submitting to Apify actor: ${searchUrl} (max ${maxPages} pages)`);

  const input = {
    start_urls: [{ url: searchUrl }],
    scrape_page_limit: maxPages,
  };

  let rawItems: Record<string, unknown>[] = [];

  try {
    // run-sync-get-dataset-items: starts the actor and streams results back
    // when it finishes. Apify timeout is 300 s for sync runs.
    const endpoint =
      `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items` +
      `?token=${token}&format=json&clean=true`;

    console.log(`[apify] POST ${endpoint.replace(token, '***')}`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      // Node fetch signal for 290-second timeout (Apify allows 300 s)
      signal: AbortSignal.timeout(290_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Apify API ${res.status}: ${body.slice(0, 400)}`);
    }

    rawItems = await res.json() as Record<string, unknown>[];
    console.log(`[apify] Received ${rawItems.length} raw items from actor`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Apify run failed: ${msg}`);
    console.error('[apify] Actor run failed:', msg);
    return {
      listings: [],
      newCount: 0,
      updatedCount: 0,
      pagesScraped: 0,
      errors,
    };
  }

  // Normalise items → RawListing[]
  const allListings: RawListing[] = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    try {
      const listing = normaliseItem(item as Record<string, unknown>);
      if (!listing) continue;
      if (seen.has(listing.externalId)) continue;
      seen.add(listing.externalId);
      allListings.push(listing);
    } catch (err) {
      // Skip unparseable items silently
      console.warn('[apify] Failed to normalise item:', err);
    }
  }

  const newListings = allListings.filter((l) => !existingIds.has(l.externalId));
  const knownListings = allListings.filter((l) => existingIds.has(l.externalId));

  console.log(
    `[apify] Done: ${allListings.length} unique listings ` +
    `(${newListings.length} new, ${knownListings.length} known)`
  );

  return {
    listings: allListings,
    newCount: newListings.length,
    updatedCount: knownListings.length,
    totalResults: rawItems.length,
    pagesScraped: maxPages, // Actor handled pagination internally
    errors,
  };
}
