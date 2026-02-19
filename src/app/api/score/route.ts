import { NextRequest, NextResponse } from 'next/server';
import { getUnscoredListings, getListingById, getAllActiveListings } from '@/lib/db/queries/listings';
import { scoreAndSaveListing } from '@/lib/scoring/combined';
import { updateBenchmarksFromListings } from '@/lib/db/queries/benchmarks';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const listingId = body.listingId;
    const skipAI = body.skipAI === true;

    // Score specific listing
    if (listingId) {
      const listing = await getListingById(listingId);
      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }
      await scoreAndSaveListing(listing, skipAI);
      return NextResponse.json({ success: true, scored: 1 });
    }

    // Update benchmarks first
    const benchmarksUpdated = await updateBenchmarksFromListings();

    // scoreAll=true rescores everything, otherwise only unscored
    const scoreAll = body.scoreAll === true;
    const unscored = scoreAll ? await getAllActiveListings() : await getUnscoredListings();

    let scored = 0;
    let errors = 0;

    // Process in batches of 5 in parallel to speed up scoring
    const BATCH_SIZE = 5;
    for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
      const batch = unscored.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((listing) => scoreAndSaveListing(listing, skipAI)),
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          scored++;
        } else {
          console.error('Failed to score listing:', result.reason);
          errors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      benchmarksUpdated,
      total: unscored.length,
      scored,
      errors,
    });
  } catch (error) {
    console.error('Scoring failed:', error);
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
  }
}
