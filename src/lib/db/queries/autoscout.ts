/**
 * DB queries for AutoScout24.ch min-price cache.
 *
 * The autoscout_prices table stores the cheapest AS24.ch listing per
 * brand+model+yearFrom combination. We upsert on each fresh fetch and
 * use the fetchedAt timestamp to implement a 24h cache TTL.
 */

import { db } from '../index';
import { autoscoutPrices } from '../schema';
import { and, eq, gte, isNull } from 'drizzle-orm';
import type { AutoscoutPrice } from '../schema';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Look up a cached AutoScout24 min price.
 * Returns null if no cached entry exists OR if the entry is older than 24h.
 */
export async function getCachedAutoscoutPrice(
  brand: string,
  model: string | null,
  yearFrom: number | null,
): Promise<AutoscoutPrice | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);

  const conditions = [
    eq(autoscoutPrices.brand, brand),
    gte(autoscoutPrices.fetchedAt, cutoff),
    // model: match exactly (null vs string)
    model != null ? eq(autoscoutPrices.model, model) : isNull(autoscoutPrices.model),
    // yearFrom: match exactly
    yearFrom != null
      ? eq(autoscoutPrices.yearFrom, yearFrom)
      : isNull(autoscoutPrices.yearFrom),
  ];

  const rows = await db
    .select()
    .from(autoscoutPrices)
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Upsert an AutoScout24 min price into the cache.
 * Uses ON CONFLICT DO UPDATE so this is safe to call repeatedly.
 */
export async function upsertAutoscoutPrice(
  brand: string,
  model: string | null,
  yearFrom: number | null,
  minPriceChf: number,
  listingUrl: string,
): Promise<AutoscoutPrice> {
  // Delete any existing row for this brand+model+yearFrom (simple upsert pattern)
  await db
    .delete(autoscoutPrices)
    .where(
      and(
        eq(autoscoutPrices.brand, brand),
        model != null
          ? eq(autoscoutPrices.model, model)
          : isNull(autoscoutPrices.model),
        yearFrom != null
          ? eq(autoscoutPrices.yearFrom, yearFrom)
          : isNull(autoscoutPrices.yearFrom),
      ),
    );

  const rows = await db
    .insert(autoscoutPrices)
    .values({
      brand,
      model: model ?? '',
      yearFrom: yearFrom ?? null,
      minPriceChf,
      listingUrl,
      fetchedAt: new Date(),
    })
    .returning();

  return rows[0];
}

/**
 * Get or fetch the AutoScout24 min price for a brand+model+yearFrom combo.
 * Returns cached data if within 24h, otherwise fetches fresh data from AS24.ch.
 */
export async function getOrFetchAutoscoutPrice(
  brand: string,
  model: string | null,
  yearFrom: number | null,
  fetchFn: (brand: string, model: string | null, yearFrom: number | null) => Promise<{ minPriceChf: number; listingUrl: string } | null>,
): Promise<{ minPriceChf: number; listingUrl: string; cached: boolean } | null> {
  // Check cache first
  const cached = await getCachedAutoscoutPrice(brand, model, yearFrom);
  if (cached && cached.minPriceChf != null) {
    return {
      minPriceChf: cached.minPriceChf,
      listingUrl: cached.listingUrl ?? '',
      cached: true,
    };
  }

  // Fetch fresh data
  const fresh = await fetchFn(brand, model, yearFrom);
  if (!fresh) return null;

  // Store in cache
  await upsertAutoscoutPrice(brand, model, yearFrom, fresh.minPriceChf, fresh.listingUrl);

  return { ...fresh, cached: false };
}
