import { NextRequest, NextResponse } from 'next/server';
import { getActiveConfigs } from '@/lib/db/queries/configs';
import { scrapeMobileDe } from '@/lib/scraper/mobile-de';
import { upsertListing } from '@/lib/db/queries/listings';
import { updateBenchmarksFromListings } from '@/lib/db/queries/benchmarks';
import { getUnscoredListings } from '@/lib/db/queries/listings';
import { scoreAndSaveListing } from '@/lib/scoring/combined';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const configs = await getActiveConfigs();

    if (configs.length === 0) {
      return NextResponse.json({ success: true, message: 'No active configs' });
    }

    let totalListings = 0;
    let totalUpserted = 0;
    const errors: string[] = [];

    // Phase 1: Scrape
    for (const config of configs) {
      try {
        const result = await scrapeMobileDe(config, 5); // Limit pages for cron
        totalListings += result.listings.length;

        for (const listing of result.listings) {
          try {
            await upsertListing(listing, config.id);
            totalUpserted++;
          } catch (err) {
            errors.push(`Upsert ${listing.externalId}: ${err}`);
          }
        }
      } catch (err) {
        errors.push(`Scrape ${config.name}: ${err}`);
      }
    }

    // Phase 2: Update benchmarks
    const benchmarks = await updateBenchmarksFromListings();

    // Phase 3: Score unscored listings
    const unscored = await getUnscoredListings();
    let scored = 0;

    for (const listing of unscored) {
      try {
        await scoreAndSaveListing(listing);
        scored++;
      } catch (err) {
        errors.push(`Score ${listing.id}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      configs: configs.length,
      totalListings,
      totalUpserted,
      benchmarksUpdated: benchmarks,
      scored,
      errors: errors.slice(0, 10), // Limit error output
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
