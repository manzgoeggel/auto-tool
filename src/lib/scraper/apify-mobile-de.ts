/**
 * apify-mobile-de.ts
 *
 * Scrapes mobile.de via the Apify `3x1t/mobile-de-scraper-ppr` actor.
 *
 * REAL INPUT SCHEMA (confirmed from live runs):
 *   models            string[]  — ["Porsche|911", "BMW|M3"] — brand|model pairs
 *                                 use brand name only for all models: ["Porsche"]
 *   automaticPaging   boolean   — true = actor paginates automatically
 *   maxItems          integer   — total result cap across all models
 *   searchPageURLMaxItems integer — per-search-URL result cap
 *   searchCategory    string    — "Car"
 *   sort              string    — "Standard" | "Price" | "Mileage" etc.
 *   fuelType          string[]  — [] for all
 *   transmission      string[]  — [] for all
 *   showDamagedVehicles string  — "Any" | "Yes" | "No"
 *   -- also supports URL mode --
 *   start_urls        {url}[]   — mobile.de search URLs (alternative to models)
 *   scrape_page_limit integer   — pages to scrape per start_url
 *
 * REAL OUTPUT SCHEMA (confirmed from live dataset):
 *   id               number   — listing ID (use as externalId)
 *   url              string   — listing detail URL
 *   title            string
 *   brand            string
 *   model            string
 *   previewImage     string   — first image URL
 *   images           string[] — all image URLs
 *   price.total.amount  number — price in EUR
 *   price.total.currency string
 *   attributes       object   — keyed by label, e.g.:
 *     "Mileage"            → "110,000 km"
 *     "First Registration" → "12/2007"
 *     "Power"              → "239 kW (325 hp)"
 *     "Fuel"               → "Petrol"
 *     "Transmission"       → "Automatic"
 *     "Vehicle condition"  → "Used vehicle, Accident-free"
 *     "Colour"             → "Grey Metallic"
 *     "Category"           → "Sports Car/Coupe"
 *   features         string[] — equipment list
 *   description      string
 *   dealerDetails.name        string
 *   dealerDetails.sellerType  string — "Dealer" | "Private"
 *   dealerDetails.address     string — "..., DE-12345 City"
 *   createdDate      string   — ISO timestamp
 *   modifiedDate     string
 *
 * Required env var:
 *   APIFY_TOKEN  — from console.apify.com → Settings → API & Integrations
 */

import { buildSearchUrl } from './url-builder';
import type { SearchConfig } from '@/lib/db/schema';
import type { RawListing } from '@/lib/types/index';

const APIFY_ACTOR = '3x1t~mobile-de-scraper-ppr';
const APIFY_BASE = 'https://api.apify.com/v2';

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN env var is not set');
  return token;
}

// ─── Attribute helpers ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attr(attributes: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    if (attributes[k] != null) return String(attributes[k]);
  }
  return '';
}

function parseMileage(raw: string): number {
  // "110,000 km" → 110000, "103,407 km" → 103407
  const m = raw.replace(/[,.\s]/g, '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseRegistration(raw: string): { year: number; month?: number } {
  // "12/2007" or "01/2007"
  const mmYYYY = raw.match(/(\d{1,2})\/(\d{4})/);
  if (mmYYYY) return { month: parseInt(mmYYYY[1], 10), year: parseInt(mmYYYY[2], 10) };
  const yearOnly = raw.match(/(\d{4})/);
  return { year: yearOnly ? parseInt(yearOnly[1], 10) : 0 };
}

function parsePower(raw: string): string | undefined {
  // "239 kW (325 hp)" — keep as-is; also handle "239kW" or "325 PS"
  if (!raw) return undefined;
  return raw.trim() || undefined;
}

function normaliseFuel(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('electric')) return 'Electric';
  if (lower.includes('plug-in') || lower.includes('plugin')) return 'Plug-in Hybrid';
  if (lower.includes('hybrid')) return 'Hybrid';
  if (lower.includes('diesel')) return 'Diesel';
  if (lower.includes('petrol') || lower.includes('benzin') || lower.includes('gasoline')) return 'Petrol';
  if (lower.includes('cng') || lower.includes('erdgas')) return 'CNG';
  if (lower.includes('lpg') || lower.includes('autogas')) return 'LPG';
  if (lower.includes('hydrogen') || lower.includes('wasser')) return 'Hydrogen';
  return raw || 'Unknown';
}

function normaliseTransmission(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('automatic')) return 'Automatic';
  if (lower.includes('manual') || lower.includes('schalt') || lower.includes('manuell')) return 'Manual';
  if (lower.includes('semi')) return 'Semi-automatic';
  return raw || 'Unknown';
}

// ─── Apify item → RawListing normalisation ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseItem(item: Record<string, any>): RawListing | null {
  // ID — actor returns numeric id
  const externalId = item.id != null ? String(item.id) : '';
  if (!externalId) return null;

  const listingUrl: string = item.url ?? '';
  if (!listingUrl) return null;

  const title: string = item.title ?? '';
  if (!title) return null;

  // Price — nested: price.total.amount
  const priceEur: number =
    Number(item.price?.total?.amount ?? item.price?.amount ?? item.price ?? 0);

  // Attributes object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attributes: Record<string, any> = item.attributes ?? {};

  // Mileage
  const mileageKm = parseMileage(attr(attributes, 'Mileage', 'Kilometerstand', 'km'));

  // First registration
  const regRaw = attr(attributes, 'First Registration', 'Erstzulassung', 'registration');
  const { year: firstRegistrationYear, month: firstRegistrationMonth } = parseRegistration(regRaw);

  // Power
  const power = parsePower(attr(attributes, 'Power', 'Leistung', 'power'));

  // Fuel
  const fuelType = normaliseFuel(attr(attributes, 'Fuel', 'Kraftstoff', 'fuelType'));

  // Transmission
  const transmission = normaliseTransmission(attr(attributes, 'Transmission', 'Getriebe', 'transmission'));

  // Seller
  const sellerTypeRaw: string = item.dealerDetails?.sellerType ?? '';
  const sellerType: 'dealer' | 'private' =
    sellerTypeRaw.toLowerCase().includes('private') ? 'private' : 'dealer';
  const sellerName: string | undefined = item.dealerDetails?.name ?? undefined;

  // Location — dealer address: "Gasstraße 13, DE-44894 Bochum" → extract city
  const addressRaw: string = item.dealerDetails?.address ?? '';
  const cityMatch = addressRaw.match(/DE-\d{5}\s+(.+)$/);
  const location: string = cityMatch ? cityMatch[1] : addressRaw;
  const country = 'DE';

  // Image
  const imageUrl: string | undefined =
    item.previewImage ??
    (Array.isArray(item.images) && item.images.length > 0 ? String(item.images[0]) : undefined);

  // VAT — mobile.de doesn't include VAT status in the Apify output directly.
  // Fall back to checking the URL (we filter with vat=1 in buildSearchUrl)
  // or the attributes for hints.
  const vatAttr = attr(attributes, 'VAT', 'MwSt', 'Mehrwertsteuer', 'VAT deductible');
  const vatDeductible: boolean =
    vatAttr.toLowerCase().includes('deduct') ||
    vatAttr.toLowerCase().includes('ausweisbar') ||
    // If we built the URL with vat=1, assume all returned results are VAT-deductible
    (item.url ? String(item.url).includes('vat=1') : false);

  // Accident damage
  const conditionRaw = attr(attributes, 'Vehicle condition', 'Fahrzeugzustand');
  const hasAccidentDamage: boolean =
    conditionRaw.toLowerCase().includes('accident') &&
    !conditionRaw.toLowerCase().includes('accident-free') &&
    !conditionRaw.toLowerCase().includes('unfallfrei');

  // Extras
  const bodyType: string | undefined = attr(attributes, 'Category', 'Kategorie', 'bodyType') || undefined;
  const color: string | undefined = attr(attributes, 'Colour', 'Farbe', 'color') || undefined;
  const description: string | undefined = item.description ?? undefined;
  const features: string[] | undefined = Array.isArray(item.features) ? item.features.map(String) : undefined;

  return {
    externalId,
    title,
    priceEur,
    mileageKm,
    firstRegistrationYear,
    firstRegistrationMonth,
    fuelType,
    transmission,
    power,
    sellerType,
    sellerName,
    location,
    country,
    listingUrl,
    imageUrl,
    bodyType,
    color,
    features,
    description,
    vatDeductible,
    hasAccidentDamage,
  };
}

// ─── Build Apify input from SearchConfig ──────────────────────────────────────

/**
 * Build the Apify actor input from a SearchConfig.
 *
 * Strategy: use URL mode (start_urls) so all our existing filters (year, price,
 * mileage, fuel, transmission, VAT) are preserved exactly as before.
 * Set automaticPaging=true so the actor paginates itself, and cap with maxItems.
 */
function buildApifyInput(
  config: SearchConfig,
  maxItems: number,
  options: { vatOnly?: boolean } = {},
): Record<string, unknown> {
  // Use page 1 as the seed URL — actor will paginate automatically
  const seedUrl = buildSearchUrl(config, 1, options);

  return {
    start_urls: [{ url: seedUrl }],
    automaticPaging: true,
    scrape_page_limit: Math.ceil(maxItems / 20) + 1, // safety buffer
    maxItems,
    searchPageURLMaxItems: maxItems,
    searchCategory: 'Car',
    searchTerms: [],
    models: [],
    sort: 'Standard',
    fuelType: [],
    transmission: [],
    vehicleType: [],
    exteriorColor: [],
    showDamagedVehicles: 'No',
    reviewLimit: 0,
  };
}

// ─── Main scrape function ─────────────────────────────────────────────────────

/**
 * Scrape mobile.de via the Apify `3x1t/mobile-de-scraper-ppr` actor.
 *
 * Uses URL mode with automaticPaging=true so the actor handles pagination
 * internally. maxPages controls how many pages worth of results to fetch
 * (each page = 20 listings).
 *
 * Returns the same shape as the old scrapeMobileDe() so callers need no changes.
 */
export async function scrapeMobileDeViaApify(
  config: SearchConfig,
  maxPages: number = 5,
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
  const maxItems = maxPages * 20;

  const input = buildApifyInput(config, maxItems, options);

  console.log(
    `[apify] Submitting to actor (maxItems=${maxItems}, ` +
    `scrape_page_limit=${input.scrape_page_limit}, url=${(input.start_urls as {url:string}[])[0].url})`,
  );

  let rawItems: Record<string, unknown>[] = [];

  try {
    const endpoint =
      `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items` +
      `?token=${token}&format=json&clean=true`;

    console.log(`[apify] POST ${endpoint.replace(token, '***')}`);

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
    console.log(`[apify] Received ${rawItems.length} raw items from actor`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Apify run failed: ${msg}`);
    console.error('[apify] Actor run failed:', msg);
    return { listings: [], newCount: 0, updatedCount: 0, pagesScraped: 0, errors };
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
      console.warn('[apify] Failed to normalise item:', err);
    }
  }

  const newListings = allListings.filter((l) => !existingIds.has(l.externalId));
  const knownListings = allListings.filter((l) => existingIds.has(l.externalId));

  console.log(
    `[apify] Done: ${allListings.length} unique listings ` +
    `(${newListings.length} new, ${knownListings.length} known)`,
  );

  return {
    listings: allListings,
    newCount: newListings.length,
    updatedCount: knownListings.length,
    totalResults: rawItems.length,
    pagesScraped: Math.ceil(allListings.length / 20),
    errors,
  };
}

// Keep default export alias for any direct imports
export default scrapeMobileDeViaApify;
