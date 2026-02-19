import type { HeuristicFactors, MarketBenchmark } from '@/lib/types';
import type { Listing } from '@/lib/db/schema';
import { AVERAGE_KM_PER_YEAR } from '@/lib/constants';

export function computeHeuristicScore(
  listing: Listing & { hasAccidentDamage?: boolean | null },
  benchmark: MarketBenchmark | null,
): HeuristicFactors {
  const priceVsMedian = scorePriceVsMedian(listing, benchmark);
  const listingAge = scoreListingAge(listing);
  const sellerTypeScore = scoreSellerType(listing);
  const mileageAnomaly = scoreMileageAnomaly(listing);
  const priceDrop = scorePriceDrop(listing);
  const vatDeductibleScore = scoreVatDeductible(listing);
  // Accident damage: hard penalty of -40 points
  const accidentPenalty = listing.hasAccidentDamage ? -40 : 0;

  const total = Math.max(
    0,
    Math.min(
      100,
      priceVsMedian + listingAge + sellerTypeScore + mileageAnomaly + priceDrop + vatDeductibleScore + accidentPenalty,
    ),
  );

  return {
    priceVsMedian,
    listingAge,
    sellerType: sellerTypeScore,
    mileageAnomaly,
    priceDrop,
    vatDeductible: vatDeductibleScore,
    total,
  };
}

// Price vs Median: 0-30 points
function scorePriceVsMedian(listing: Listing, benchmark: MarketBenchmark | null): number {
  if (!benchmark || !listing.priceEur || !benchmark.medianPriceEur) return 15;

  const price = listing.priceEur;
  const median = benchmark.medianPriceEur;
  const p25 = benchmark.p25PriceEur ?? median * 0.85;

  if (price <= p25) return 30;
  if (price <= median * 0.9) return 25;
  if (price <= median * 0.95) return 20;
  if (price <= median) return 12;
  if (price <= median * 1.05) return 5;
  return 0;
}

// Listing Age: 0-15 points
function scoreListingAge(listing: Listing): number {
  if (!listing.firstSeenAt) return 8; // Unknown, give neutral

  const hoursOld =
    (Date.now() - new Date(listing.firstSeenAt).getTime()) / (1000 * 60 * 60);

  if (hoursOld < 6) return 15;
  if (hoursOld < 24) return 12;
  if (hoursOld < 72) return 8; // 3 days
  if (hoursOld < 168) return 4; // 7 days
  return 0;
}

// Seller Type: 0-10 points
function scoreSellerType(listing: Listing): number {
  if (listing.sellerType === 'private') return 10;
  if (listing.vatDeductible) return 8;
  return 4;
}

// Mileage Anomaly: -5 to 15 points
function scoreMileageAnomaly(listing: Listing): number {
  if (!listing.mileageKm || !listing.firstRegistrationYear) return 0;

  const currentYear = new Date().getFullYear();
  const age = currentYear - listing.firstRegistrationYear;
  if (age <= 0) return 5; // New car

  const kmPerYear = listing.mileageKm / age;

  if (kmPerYear < 8000) return 15; // Very low mileage
  if (kmPerYear < 10000) return 10;
  if (kmPerYear < 12000) return 5;
  if (kmPerYear <= AVERAGE_KM_PER_YEAR) return 0; // Normal
  if (kmPerYear > 25000) return -5; // Very high mileage
  return -2;
}

// Price Drop: 0-15 points
function scorePriceDrop(listing: Listing): number {
  const history = (listing.priceHistory || []) as { date: string; price: number }[];
  if (history.length < 2) return 0;

  const firstPrice = history[0].price;
  const currentPrice = listing.priceEur || history[history.length - 1].price;

  if (!firstPrice || !currentPrice) return 0;

  const dropPercent = ((firstPrice - currentPrice) / firstPrice) * 100;

  if (dropPercent > 15) return 15;
  if (dropPercent > 10) return 10;
  if (dropPercent > 5) return 5;
  return 0;
}

// VAT Deductible: 0-15 points
function scoreVatDeductible(listing: Listing): number {
  return listing.vatDeductible ? 15 : 0;
}

export function computePriceDeltaPercent(
  listing: Listing,
  benchmark: MarketBenchmark | null,
): number {
  if (!benchmark || !listing.priceEur || !benchmark.medianPriceEur) return 0;
  return ((listing.priceEur - benchmark.medianPriceEur) / benchmark.medianPriceEur) * 100;
}
