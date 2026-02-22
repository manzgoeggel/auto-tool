import type { Listing } from '@/lib/db/schema';
import type { MarketBenchmark } from '@/lib/types';
import { computeHeuristicScore, computePriceDeltaPercent } from './heuristic';
import { analyzeListingWithAI } from './openai-scorer';
import { calculateImportCosts } from '@/lib/import-costs/calculator';
import { getEurChfRate } from '@/lib/import-costs/exchange-rate';
import { getBenchmark } from '@/lib/db/queries/benchmarks';
import { upsertScore } from '@/lib/db/queries/scores';
import { SCORE_WEIGHTS, CH_RESALE_PREMIUM_FACTOR, getVatRateForCountry, getPorsche911ChResale } from '@/lib/constants';

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
    specScore: 50,
    keySpecs: [] as { spec: string; impact: 'high' | 'medium' | 'low'; note: string }[],
    missingSpecs: [] as string[],
    variantClassification: '',
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

  // Import costs — use per-country VAT rate if available
  const eurChfRate = await getEurChfRate();
  const sourceVatRate = listing.sourceVatRate != null
    ? listing.sourceVatRate
    : getVatRateForCountry(listing.country);
  const importCosts = listing.priceEur
    ? calculateImportCosts({
        priceEur: listing.priceEur,
        isVatDeductible: listing.vatDeductible || false,
        eurChfRate,
        sourceVatRate,
      })
    : null;

  // Estimated CH resale — use real market price table first, then benchmark, then fallback
  const variantHint = aiAnalysis.variantClassification || listing.title || '';
  const realResale = (listing.firstRegistrationYear && listing.mileageKm)
    ? getPorsche911ChResale(variantHint, listing.firstRegistrationYear, listing.mileageKm)
    : null;

  let estimatedResaleMinChf: number;
  let estimatedResaleMaxChf: number;

  if (realResale) {
    // Best case: we have a real CH market price bracket
    estimatedResaleMinChf = realResale.low;
    estimatedResaleMaxChf = realResale.high;
  } else if (benchmark?.estimatedChResaleMedian) {
    // Second: benchmark derived from actual listing medians + CH premium
    estimatedResaleMinChf = Math.round(benchmark.estimatedChResaleMedian * 0.92);
    estimatedResaleMaxChf = Math.round(benchmark.estimatedChResaleMedian * 1.08);
  } else {
    // Last resort: apply CH premium to EUR asking price converted to CHF
    // (circular but better than nothing — clearly labelled as estimate)
    const fallbackMedian = listing.priceEur
      ? Math.round(listing.priceEur * eurChfRate * CH_RESALE_PREMIUM_FACTOR)
      : 0;
    estimatedResaleMinChf = Math.round(fallbackMedian * 0.92);
    estimatedResaleMaxChf = Math.round(fallbackMedian * 1.08);
  }

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
    specScore: aiAnalysis.specScore,
    keySpecs: aiAnalysis.keySpecs,
    missingSpecs: aiAnalysis.missingSpecs,
    variantClassification: aiAnalysis.variantClassification,
  });
}
