import { db } from '../index';
import { marketBenchmarks, listings } from '../schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { CH_RESALE_PREMIUM_FACTOR } from '@/lib/constants';
import type { Listing } from '../schema';

export async function getBenchmark(
  brand: string,
  model: string,
  year: number,
  mileageKm: number,
  fuelType?: string,
) {
  const conditions = [
    sql`${marketBenchmarks.brand} ILIKE ${brand}`,
    sql`${marketBenchmarks.model} ILIKE ${'%' + model + '%'}`,
    lte(marketBenchmarks.yearFrom, year),
    gte(marketBenchmarks.yearTo, year),
    lte(marketBenchmarks.mileageRangeMin, mileageKm),
    gte(marketBenchmarks.mileageRangeMax, mileageKm),
  ];

  if (fuelType) {
    conditions.push(eq(marketBenchmarks.fuelType, fuelType));
  }

  const results = await db
    .select()
    .from(marketBenchmarks)
    .where(and(...conditions))
    .limit(1);

  return results[0] || null;
}

export async function updateBenchmarksFromListings() {
  // Get all active listings grouped by brand, approximate model, year range, mileage range
  const activeListings = await db
    .select()
    .from(listings)
    .where(eq(listings.isActive, true));

  if (activeListings.length === 0) return 0;

  // Group listings by brand + model pattern + year bucket + mileage bucket
  const groups = new Map<string, Listing[]>();

  for (const listing of activeListings) {
    if (!listing.priceEur || !listing.firstRegistrationYear || !listing.mileageKm) continue;

    // Extract brand from title (first word usually)
    const titleParts = listing.title?.split(' ') || [];
    const brand = titleParts[0] || 'Unknown';
    const model = titleParts.slice(1, 3).join(' ') || 'Unknown';

    // Year bucket: 3-year ranges
    const yearBucket = Math.floor(listing.firstRegistrationYear / 3) * 3;

    // Mileage bucket: 50k ranges
    const mileageBucket = Math.floor(listing.mileageKm / 50000) * 50000;

    const key = `${brand}|${model}|${yearBucket}|${mileageBucket}|${listing.fuelType || 'any'}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(listing);
  }

  let updated = 0;

  for (const [key, groupListings] of groups) {
    if (groupListings.length < 3) continue; // Need at least 3 for meaningful stats

    const [brand, model, yearBucketStr, mileageBucketStr, fuelType] = key.split('|');
    const yearBucket = parseInt(yearBucketStr);
    const mileageBucket = parseInt(mileageBucketStr);

    const prices = groupListings
      .map((l) => l.priceEur!)
      .sort((a, b) => a - b);

    const median = prices[Math.floor(prices.length / 2)];
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p75 = prices[Math.floor(prices.length * 0.75)];

    const chResaleMedian = Math.round(median * CH_RESALE_PREMIUM_FACTOR);

    // Upsert benchmark
    await db
      .insert(marketBenchmarks)
      .values({
        brand,
        model,
        yearFrom: yearBucket,
        yearTo: yearBucket + 2,
        mileageRangeMin: mileageBucket,
        mileageRangeMax: mileageBucket + 49999,
        fuelType: fuelType === 'any' ? null : fuelType,
        medianPriceEur: median,
        p25PriceEur: p25,
        p75PriceEur: p75,
        sampleSize: prices.length,
        estimatedChResaleMedian: chResaleMedian,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    updated++;
  }

  return updated;
}
