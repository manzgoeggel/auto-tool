import { NextRequest, NextResponse } from 'next/server';
import { getUnscoredListings, getListingById } from '@/lib/db/queries/listings';
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

    // Score all unscored listings
    const unscored = await getUnscoredListings();

    let scored = 0;
    let errors = 0;

    for (const listing of unscored) {
      try {
        await scoreAndSaveListing(listing, skipAI);
        scored++;
      } catch (err) {
        console.error(`Failed to score listing ${listing.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      benchmarksUpdated,
      totalUnscored: unscored.length,
      scored,
      errors,
    });
  } catch (error) {
    console.error('Scoring failed:', error);
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
  }
}
