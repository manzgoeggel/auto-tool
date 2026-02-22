import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { parseDetailPage } from '@/lib/scraper/detail-parser';
import { fetchUnblocked, CookieJar } from '@/lib/scraper/fetch-proxy';

export const maxDuration = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  try {
    // Only enrich listings not yet visited — country IS NULL is the reliable signal
    // (vatDeductible is now always defaulted to true on insert since we scrape
    // with mwst=true, so it's no longer a useful "not enriched" indicator)
    const needsEnrich = await db
      .select({
        id: listings.id,
        listingUrl: listings.listingUrl,
        externalId: listings.externalId,
      })
      .from(listings)
      .where(isNull(listings.country));

    console.log(`[enrich] ${needsEnrich.length} listings need enrichment`);

    let enriched = 0;
    let errors = 0;

    // One cookie jar for the whole session — improves legitimacy
    const jar = new CookieJar();

    // Process in batches of 3 in parallel
    const BATCH_SIZE = 3;
    for (let i = 0; i < needsEnrich.length; i += BATCH_SIZE) {
      const batch = needsEnrich.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (listing) => {
          try {
            const { html, setCookie } = await fetchUnblocked(listing.listingUrl, {
              cookies: jar.toString(),
              timeoutMs: 90_000,
              retries: 3,
            });

            jar.merge(setCookie);

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

            console.log(
              `[enrich] ✓ ${listing.externalId}: ` +
              `VAT=${detail.vatDeductible}, country=${detail.country ?? 'DE'}`,
            );
            enriched++;
          } catch (err) {
            console.warn(`[enrich] ✗ ${listing.externalId}:`, err);
            errors++;
          }
        }),
      );

      if (i + BATCH_SIZE < needsEnrich.length) {
        await delay(2000 + Math.random() * 2000);
      }
    }

    return NextResponse.json({
      success: true,
      total: needsEnrich.length,
      enriched,
      errors,
    });
  } catch (error) {
    console.error('[enrich] Failed:', error);
    return NextResponse.json({ error: 'Enrich failed' }, { status: 500 });
  }
}
