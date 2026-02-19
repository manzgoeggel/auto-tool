import { NextRequest, NextResponse } from 'next/server';
import { getActiveConfigs, getConfigById } from '@/lib/db/queries/configs';
import { scrapeMobileDe } from '@/lib/scraper/mobile-de';
import { upsertListing, getExistingExternalIds } from '@/lib/db/queries/listings';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const configId = body.configId;
    // Allow caller to control how many pages to fetch (default 20, max 50)
    const maxPages = Math.min(parseInt(body.maxPages || '20', 10), 50);

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
        const scrapeResult = await scrapeMobileDe(config, maxPages, existingIds);

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

        results.push({
          configId: config.id,
          configName: config.name,
          totalFound: scrapeResult.listings.length,
          newCount: scrapeResult.newCount,
          updatedCount: scrapeResult.updatedCount,
          upserted,
          pagesScraped: scrapeResult.pagesScraped,
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

    return NextResponse.json({
      success: true,
      results,
      totalConfigs: configs.length,
    });
  } catch (error) {
    console.error('Scrape failed:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
