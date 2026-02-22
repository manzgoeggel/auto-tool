import { db } from '../index';
import { deals, dealListings, listings, scores } from '../schema';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import type { Deal, NewDeal } from '../schema';

export type DealInput = {
  name: string;
  budgetChf: number;
  brands?: string[];
  models?: string[];
  yearMin?: number | null;
  yearMax?: number | null;
  mileageMax?: number | null;
  vatOnly?: boolean;
  notes?: string | null;
};

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getAllDeals(): Promise<Deal[]> {
  return db.select().from(deals).where(eq(deals.status, 'active')).orderBy(desc(deals.createdAt));
}

export async function getDealById(id: number): Promise<Deal | null> {
  const rows = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createDeal(input: DealInput): Promise<Deal> {
  const rows = await db
    .insert(deals)
    .values({
      name: input.name,
      budgetChf: input.budgetChf,
      brands: input.brands ?? [],
      models: input.models ?? [],
      yearMin: input.yearMin ?? null,
      yearMax: input.yearMax ?? null,
      mileageMax: input.mileageMax ?? null,
      vatOnly: input.vatOnly ?? false,
      notes: input.notes ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateDeal(id: number, input: Partial<DealInput>): Promise<Deal> {
  const rows = await db
    .update(deals)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();
  return rows[0];
}

export async function archiveDeal(id: number): Promise<void> {
  await db.update(deals).set({ status: 'archived', updatedAt: new Date() }).where(eq(deals.id, id));
}

export async function togglePinListing(dealId: number, listingId: number): Promise<number[]> {
  const deal = await getDealById(dealId);
  if (!deal) throw new Error('Deal not found');
  const pinned = (deal.pinnedListingIds ?? []) as number[];
  const next = pinned.includes(listingId)
    ? pinned.filter((id) => id !== listingId)
    : [...pinned, listingId];
  await db.update(deals).set({ pinnedListingIds: next, updatedAt: new Date() }).where(eq(deals.id, dealId));
  return next;
}

// ── Search results ───────────────────────────────────────────────────────────

/** Replace all deal_listings for a deal with a fresh set of listing IDs */
export async function saveDealResults(
  dealId: number,
  results: Array<{ listingId: number; marginMinChf: number | null; marginMaxChf: number | null; combinedScore: number | null }>,
): Promise<void> {
  // Delete old results
  await db.delete(dealListings).where(eq(dealListings.dealId, dealId));

  if (results.length === 0) return;

  await db.insert(dealListings).values(
    results.map((r) => ({
      dealId,
      listingId: r.listingId,
      marginMinChf: r.marginMinChf,
      marginMaxChf: r.marginMaxChf,
      combinedScore: r.combinedScore,
    })),
  );

  await db.update(deals).set({
    lastSearchAt: new Date(),
    lastResultCount: results.length,
    updatedAt: new Date(),
  }).where(eq(deals.id, dealId));
}

/** Get deal results with full listing + score data, ordered by margin desc */
export async function getDealResults(dealId: number) {
  const rows = await db
    .select()
    .from(dealListings)
    .innerJoin(listings, eq(dealListings.listingId, listings.id))
    .leftJoin(scores, eq(listings.id, scores.listingId))
    .where(eq(dealListings.dealId, dealId))
    .orderBy(desc(dealListings.marginMinChf));

  return rows.map((r) => ({
    listing: r.listings,
    score: r.scores,
    dealListing: r.deal_listings,
  }));
}
