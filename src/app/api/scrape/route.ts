import { NextRequest, NextResponse } from 'next/server';
import { getActiveConfigs, getConfigById } from '@/lib/db/queries/configs';
import { scrapeMobileDe } from '@/lib/scraper/mobile-de';
import { upsertListing } from '@/lib/db/queries/listings';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const configId = body.configId;

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

    const results = [];

    for (const config of configs) {
      try {
        const scrapeResult = await scrapeMobileDe(config, 10);

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
