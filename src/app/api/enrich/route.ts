import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseDetailPage } from '@/lib/scraper/detail-parser';

export const maxDuration = 300;

// Per-listing fetch timeout (25s) — ScraperAPI can be slow but shouldn't hang forever
const FETCH_TIMEOUT_MS = 25_000;

function buildProxiedUrl(url: string): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error('SCRAPER_API_KEY is not set');
  return `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&country_code=de`;
}

async function fetchDetail(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(buildProxiedUrl(url), {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'de-DE,de;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function POST() {
  try {
    const allListings = await db.select({
      id: listings.id,
      listingUrl: listings.listingUrl,
      externalId: listings.externalId,
    }).from(listings).where(eq(listings.isActive, true));

    let enriched = 0;
    let errors = 0;

    // Process in batches of 3 in parallel (ScraperAPI concurrency-friendly)
    const BATCH_SIZE = 3;
    for (let i = 0; i < allListings.length; i += BATCH_SIZE) {
      const batch = allListings.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (listing) => {
          try {
            const html = await fetchDetail(listing.listingUrl);
            const detail = parseDetailPage(html);
            await db.update(listings).set({
              vatDeductible: detail.vatDeductible,
              hasAccidentDamage: detail.hasAccidentDamage,
              ...(detail.description ? { description: detail.description } : {}),
              ...(detail.features?.length ? { features: detail.features } : {}),
              ...(detail.sellerName ? { sellerName: detail.sellerName } : {}),
              ...(detail.color ? { color: detail.color } : {}),
              ...(detail.bodyType ? { bodyType: detail.bodyType } : {}),
              ...(detail.country ? { country: detail.country } : {}),
              ...(detail.sourceVatRate != null ? { sourceVatRate: detail.sourceVatRate } : {}),
            }).where(eq(listings.id, listing.id));
            console.log(`Enriched listing ${listing.externalId}: VAT=${detail.vatDeductible}, country=${detail.country ?? 'DE'}`);
            enriched++;
          } catch (err) {
            console.warn(`Failed to enrich ${listing.externalId}:`, err);
            errors++;
          }
        }),
      );
      // Delay between batches to avoid hammering ScraperAPI
      if (i + BATCH_SIZE < allListings.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    return NextResponse.json({
      success: true,
      total: allListings.length,
      enriched,
      errors,
    });
  } catch (error) {
    console.error('Enrich failed:', error);
    return NextResponse.json({ error: 'Enrich failed' }, { status: 500 });
  }
}
