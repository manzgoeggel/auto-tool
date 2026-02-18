import type { Listing } from '@/lib/db/schema';
import type { MarketBenchmark } from '@/lib/types';
import { computeHeuristicScore, computePriceDeltaPercent } from './heuristic';
import { analyzeListingWithAI } from './openai-scorer';
import { calculateImportCosts } from '@/lib/import-costs/calculator';
import { getEurChfRate } from '@/lib/import-costs/exchange-rate';
import { getBenchmark } from '@/lib/db/queries/benchmarks';
import { upsertScore } from '@/lib/db/queries/scores';
import { SCORE_WEIGHTS, CH_RESALE_PREMIUM_FACTOR } from '@/lib/constants';

export async function scoreAndSaveListing(
  listing: Listing,
  skipAI: boolean = false,
): Promise<void> {
  // Extract brand/model from title
  const titleParts = listing.title?.split(' ') || [];
  const brand = titleParts[0] || '';
  const model = titleParts.slice(1, 3).join(' ') || '';

  // Get benchmark
  const benchmark = listing.firstRegistrationYear && listing.mileageKm
    ? await getBenchmark(
        brand,
        model,
        listing.firstRegistrationYear,
        listing.mileageKm,
        listing.fuelType || undefined,
      )
    : null;

  // Heuristic score
  const heuristic = computeHeuristicScore(listing, benchmark);

  // AI score (optional)
  let aiAnalysis = {
    score: 50,
    explanation: 'AI analysis pending',
    redFlags: [] as string[],
    highlights: [] as string[],
  };

  if (!skipAI && process.env.OPENAI_API_KEY) {
    aiAnalysis = await analyzeListingWithAI(listing, benchmark);
  }

  // Combined score
  const combinedScore = Math.round(
    heuristic.total * SCORE_WEIGHTS.heuristic +
    aiAnalysis.score * SCORE_WEIGHTS.ai,
  );

  // Price delta
  const priceDeltaPercent = computePriceDeltaPercent(listing, benchmark);

  // Import costs
  const eurChfRate = await getEurChfRate();
  const importCosts = listing.priceEur
    ? calculateImportCosts({
        priceEur: listing.priceEur,
        isVatDeductible: listing.vatDeductible || false,
        eurChfRate,
      })
    : null;

  // Estimated resale (based on benchmark or price + premium)
  const estimatedResaleMedian = benchmark?.estimatedChResaleMedian
    || (listing.priceEur
      ? Math.round(listing.priceEur * eurChfRate * CH_RESALE_PREMIUM_FACTOR)
      : 0);

  const estimatedResaleMinChf = Math.round(estimatedResaleMedian * 0.92);
  const estimatedResaleMaxChf = Math.round(estimatedResaleMedian * 1.08);

  const landedCost = importCosts?.grandTotalChf || 0;
  const estimatedMarginMinChf = estimatedResaleMinChf - landedCost;
  const estimatedMarginMaxChf = estimatedResaleMaxChf - landedCost;

  // Save to DB
  await upsertScore(listing.id, {
    heuristicScore: heuristic.total,
    aiScore: aiAnalysis.score,
    combinedScore,
    priceDeltaPercent,
    estimatedResaleMinChf,
    estimatedResaleMaxChf,
    estimatedMarginMinChf,
    estimatedMarginMaxChf,
    totalLandedCostChf: landedCost,
    aiExplanation: aiAnalysis.explanation,
    redFlags: aiAnalysis.redFlags,
    highlights: aiAnalysis.highlights,
  });
}
