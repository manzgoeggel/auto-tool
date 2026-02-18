import { NextRequest, NextResponse } from 'next/server';
import { getListingById } from '@/lib/db/queries/listings';
import { getBenchmark } from '@/lib/db/queries/benchmarks';
import { analyzeListingWithAI } from '@/lib/scoring/openai-scorer';
import { upsertScore } from '@/lib/db/queries/scores';

export async function POST(request: NextRequest) {
  try {
    const { listingId } = await request.json();
    if (!listingId) {
      return NextResponse.json({ error: 'Missing listingId' }, { status: 400 });
    }

    const listing = await getListingById(listingId);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const titleParts = listing.title?.split(' ') || [];
    const brand = titleParts[0] || '';
    const model = titleParts.slice(1, 3).join(' ') || '';

    const benchmark =
      listing.firstRegistrationYear && listing.mileageKm
        ? await getBenchmark(
            brand,
            model,
            listing.firstRegistrationYear,
            listing.mileageKm,
            listing.fuelType || undefined,
          )
        : null;

    // Deep analysis with gpt-4o
    const analysis = await analyzeListingWithAI(listing, benchmark, true);

    // Update the score with new AI analysis
    if (listing.score) {
      await upsertScore(listing.id, {
        ...listing.score,
        aiScore: analysis.score,
        combinedScore: Math.round(
          (listing.score.heuristicScore || 50) * 0.7 + analysis.score * 0.3,
        ),
        aiExplanation: analysis.explanation,
        redFlags: analysis.redFlags,
        highlights: analysis.highlights,
      });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis failed:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
