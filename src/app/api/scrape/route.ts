import { NextRequest, NextResponse } from 'next/server';
import { getActiveConfigs, getConfigById, stampConfigScraped } from '@/lib/db/queries/configs';
import { scrapeMobileDe } from '@/lib/scraper/mobile-de';
import { upsertListing, getExistingExternalIds, getUnscoredListings } from '@/lib/db/queries/listings';
import { scoreAndSaveListing } from '@/lib/scoring/combined';
import { updateBenchmarksFromListings } from '@/lib/db/queries/benchmarks';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const configId = body.configId;
    // Allow caller to control how many pages to fetch (default 50, max 200)
    const maxPages = Math.min(parseInt(body.maxPages || '50', 10), 200);
    const startPage = Math.max(1, parseInt(body.startPage || '1', 10));

    let configs;
    if (configId) {
      const config = await getConfigById(configId);
      if (!config) {
        return NextResponse.json({ error: 'Config not found' }, { status: 404 });
      }
      configs = [config];
    } else {
      configs = await getActiveConfigs();
    }

    if (configs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active configurations to scrape',
        results: [],
      });
    }

    // Load all known IDs once up front so we can skip detail fetches for them
    const existingIds = await getExistingExternalIds();
    console.log(`Loaded ${existingIds.size} existing listing IDs from DB`);

    const results = [];

    for (const config of configs) {
      try {
        const scrapeResult = await scrapeMobileDe(config, maxPages, existingIds, startPage);

        console.log(`\n=== Scraped listings for config "${config.name}" ===`);
        scrapeResult.listings.forEach((l, i) => {
          const isNew = !existingIds.has(l.externalId);
          console.log(`[${i + 1}] ${isNew ? '★ NEW' : '  ↺'} ${l.title}`);
          console.log(`    ID: ${l.externalId}`);
          console.log(`    Price: ${l.priceEur} EUR | Mileage: ${l.mileageKm} km | Year: ${l.firstRegistrationYear}/${l.firstRegistrationMonth}`);
          console.log(`    Fuel: ${l.fuelType} | Transmission: ${l.transmission} | Power: ${l.power}`);
          console.log(`    VAT deductible: ${l.vatDeductible}`);
          console.log('');
        });
        console.log(`=== Total: ${scrapeResult.listings.length} (${scrapeResult.newCount} new, ${scrapeResult.updatedCount} updated) ===\n`);

        let upserted = 0;
        for (const listing of scrapeResult.listings) {
          try {
            await upsertListing(listing, config.id);
            upserted++;
          } catch (err) {
            console.error(`Failed to upsert listing ${listing.externalId}:`, err);
          }
        }

        await stampConfigScraped(config.id);

        results.push({
          configId: config.id,
          configName: config.name,
          totalFound: scrapeResult.listings.length,
          newCount: scrapeResult.newCount,
          updatedCount: scrapeResult.updatedCount,
          upserted,
          startPage,
          pagesScraped: scrapeResult.pagesScraped,
          nextStartPage: startPage + scrapeResult.pagesScraped,
          totalResults: scrapeResult.totalResults,
          errors: scrapeResult.errors,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          configId: config.id,
          configName: config.name,
          error: msg,
        });
      }
    }

    // Auto-score new listings after scraping
    await updateBenchmarksFromListings();
    const toScore = await getUnscoredListings();
    let scored = 0;
    let scoreErrors = 0;
    const SCORE_BATCH = 5;
    for (let i = 0; i < toScore.length; i += SCORE_BATCH) {
      const batch = toScore.slice(i, i + SCORE_BATCH);
      const settled = await Promise.allSettled(batch.map((l) => scoreAndSaveListing(l)));
      for (const r of settled) {
        if (r.status === 'fulfilled') scored++;
        else { scoreErrors++; console.error('[scrape] Score error:', r.reason); }
      }
    }
    console.log(`[scrape] Auto-scored ${scored} new listings (${scoreErrors} errors)`);

    return NextResponse.json({
      success: true,
      results,
      totalConfigs: configs.length,
      scored,
      scoreErrors,
    });
  } catch (error) {
    console.error('Scrape failed:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
