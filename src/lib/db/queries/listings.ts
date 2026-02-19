import { db } from '../index';
import { listings, scores } from '../schema';
import { eq, desc, and, gte, lte, sql, isNotNull } from 'drizzle-orm';
import type { RawListing } from '@/lib/types';

export async function upsertListing(listing: RawListing, configId?: number) {
  const existing = await db
    .select()
    .from(listings)
    .where(eq(listings.externalId, listing.externalId))
    .limit(1);

  if (existing.length > 0) {
    const old = existing[0];
    const priceHistory = (old.priceHistory || []) as { date: string; price: number }[];

    // Track price change
    if (old.priceEur !== listing.priceEur && listing.priceEur) {
      priceHistory.push({
        date: new Date().toISOString().split('T')[0],
        price: listing.priceEur,
      });
    }

    await db
      .update(listings)
      .set({
        title: listing.title,
        priceEur: listing.priceEur,
        mileageKm: listing.mileageKm,
        fuelType: listing.fuelType,
        transmission: listing.transmission,
        power: listing.power,
        sellerType: listing.sellerType,
        sellerName: listing.sellerName,
        location: listing.location,
        imageUrl: listing.imageUrl,
        vatDeductible: listing.vatDeductible,
        hasAccidentDamage: listing.hasAccidentDamage ?? false,
        priceHistory,
        lastSeenAt: new Date(),
        isActive: true,
      })
      .where(eq(listings.externalId, listing.externalId));

    return existing[0].id;
  }

  const result = await db
    .insert(listings)
    .values({
      externalId: listing.externalId,
      configId,
      title: listing.title,
      priceEur: listing.priceEur,
      mileageKm: listing.mileageKm,
      firstRegistrationYear: listing.firstRegistrationYear,
      firstRegistrationMonth: listing.firstRegistrationMonth,
      fuelType: listing.fuelType,
      transmission: listing.transmission,
      power: listing.power,
      sellerType: listing.sellerType,
      sellerName: listing.sellerName,
      location: listing.location,
      listingUrl: listing.listingUrl,
      imageUrl: listing.imageUrl,
      bodyType: listing.bodyType,
      color: listing.color,
      features: listing.features,
      description: listing.description,
      vatDeductible: listing.vatDeductible,
      hasAccidentDamage: listing.hasAccidentDamage ?? false,
      priceHistory: listing.priceEur
        ? [{ date: new Date().toISOString().split('T')[0], price: listing.priceEur }]
        : [],
    })
    .returning({ id: listings.id });

  return result[0].id;
}

export async function getListingsWithScores(filters: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  minScore?: number;
  maxPrice?: number;
  brand?: string;
  fuelType?: string;
  onlyActive?: boolean;
}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'combined_score',
    sortOrder = 'desc',
    minScore,
    maxPrice,
    brand,
    fuelType,
    onlyActive = true,
  } = filters;

  const offset = (page - 1) * limit;

  const conditions = [];
  if (onlyActive) conditions.push(eq(listings.isActive, true));
  if (minScore !== undefined) conditions.push(gte(scores.combinedScore, minScore));
  if (maxPrice !== undefined) conditions.push(lte(listings.priceEur, maxPrice));
  if (brand) conditions.push(sql`${listings.title} ILIKE ${'%' + brand + '%'}`);
  if (fuelType) conditions.push(eq(listings.fuelType, fuelType));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderColumn = sortBy === 'price' ? listings.priceEur
    : sortBy === 'mileage' ? listings.mileageKm
    : sortBy === 'year' ? listings.firstRegistrationYear
    : sortBy === 'first_seen' ? listings.firstSeenAt
    : scores.combinedScore;

  const orderDir = sortOrder === 'asc' ? sql`ASC NULLS LAST` : sql`DESC NULLS LAST`;

  const results = await db
    .select()
    .from(listings)
    .leftJoin(scores, eq(listings.id, scores.listingId))
    .where(whereClause)
    .orderBy(sql`${orderColumn} ${orderDir}`)
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .leftJoin(scores, eq(listings.id, scores.listingId))
    .where(whereClause);

  return {
    listings: results.map((r) => ({
      listings: r.listings,
      score: r.scores,
    })),
    total: Number(countResult[0].count),
    page,
    limit,
    totalPages: Math.ceil(Number(countResult[0].count) / limit),
  };
}

export async function getTodaysTopDeals(limit = 15) {
  const results = await db
    .select()
    .from(listings)
    .innerJoin(scores, eq(listings.id, scores.listingId))
    .where(and(eq(listings.isActive, true), isNotNull(scores.combinedScore)))
    .orderBy(desc(scores.combinedScore))
    .limit(limit);

  return results.map((r) => ({
    ...r.listings,
    score: r.scores,
  }));
}

export async function getListingById(id: number) {
  const results = await db
    .select()
    .from(listings)
    .leftJoin(scores, eq(listings.id, scores.listingId))
    .where(eq(listings.id, id))
    .limit(1);

  if (results.length === 0) return null;

  return {
    ...results[0].listings,
    score: results[0].scores,
  };
}

export async function getUnscoredListings() {
  const result = await db
    .select()
    .from(listings)
    .leftJoin(scores, eq(listings.id, scores.listingId))
    .where(and(eq(listings.isActive, true), sql`${scores.id} IS NULL`));

  return result.map((r) => r.listings);
}

export async function getAllActiveListings() {
  return db.select().from(listings).where(eq(listings.isActive, true));
}
