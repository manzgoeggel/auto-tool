import { NextRequest, NextResponse } from 'next/server';
import { getDealById, saveDealResults } from '@/lib/db/queries/deals';
import { upsertListing, getExistingExternalIds } from '@/lib/db/queries/listings';
import { scrapeMobileDe } from '@/lib/scraper/mobile-de';
import { scoreAndSaveListing } from '@/lib/scoring/combined';
import { db } from '@/lib/db';
import { listings, scores } from '@/lib/db/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { calculateImportCosts } from '@/lib/import-costs/calculator';
import { getEurChfRate } from '@/lib/import-costs/exchange-rate';
import { getVatRateForCountry } from '@/lib/constants';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { dealId } = await request.json();
    if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 });

    const deal = await getDealById(dealId);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    // Build a synthetic SearchConfig from the deal params
    const syntheticConfig = {
      id: -1,
      name: deal.name,
      brands: (deal.brands ?? []) as string[],
      models: (deal.models ?? []) as string[],
      yearMin: deal.yearMin ?? null,
      yearMax: deal.yearMax ?? null,
      mileageMax: deal.mileageMax ?? null,
      priceMin: null,
      // Convert budget CHF → rough EUR ceiling (budget / 0.95 to leave room for import costs)
      // Import costs are roughly 10-15% on top, so limit to ~85% of budget in EUR
      priceMax: Math.round((deal.budgetChf / 0.95) * 0.82),
      fuelTypes: [],
      transmissions: [],
      minExpectedMarginChf: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(`[Deal ${deal.id}] Searching for "${deal.name}" (budget CHF ${deal.budgetChf}, max EUR price ~${syntheticConfig.priceMax})`);

    // Scrape mobile.de (3 pages max for deals — fast turnaround)
    const existingIds = await getExistingExternalIds();
    const scrapeResult = await scrapeMobileDe(syntheticConfig, 3, existingIds);

    console.log(`[Deal ${deal.id}] Scraped ${scrapeResult.listings.length} listings`);

    // Upsert all found listings into the main listings table
    const listingIds: number[] = [];
    for (const raw of scrapeResult.listings) {
      try {
        const id = await upsertListing(raw);
        listingIds.push(id);
      } catch (err) {
        console.warn(`Failed to upsert listing ${raw.externalId}:`, err);
      }
    }

    // Score all (skip AI for speed — heuristic only)
    const toScore = await db
      .select()
      .from(listings)
      .where(and(eq(listings.isActive, true), inArray(listings.id, listingIds)));

    let scored = 0;
    for (const listing of toScore) {
      try {
        await scoreAndSaveListing(listing, true /* skipAI */);
        scored++;
      } catch (err) {
        console.warn(`Failed to score listing ${listing.id}:`, err);
      }
    }

    console.log(`[Deal ${deal.id}] Scored ${scored} listings`);

    // Fetch scored listings and filter by budget
    const eurChfRate = await getEurChfRate();
    const scoredRows = await db
      .select()
      .from(listings)
      .innerJoin(scores, eq(listings.id, scores.listingId))
      .where(and(eq(listings.isActive, true), inArray(listings.id, listingIds)));

    // Filter: landed cost must fit within budget, apply vatOnly if set
    const withinBudget = scoredRows.filter((r) => {
      if (deal.vatOnly && !r.listings.vatDeductible) return false;
      const landed = r.scores.totalLandedCostChf ?? 0;
      return landed > 0 && landed <= deal.budgetChf;
    });

    // Sort by margin min descending, take top 50
    const top = withinBudget
      .sort((a, b) => (b.scores.estimatedMarginMinChf ?? 0) - (a.scores.estimatedMarginMinChf ?? 0))
      .slice(0, 50);

    // Save as deal results
    await saveDealResults(
      deal.id,
      top.map((r) => ({
        listingId: r.listings.id,
        marginMinChf: r.scores.estimatedMarginMinChf,
        marginMaxChf: r.scores.estimatedMarginMaxChf,
        combinedScore: r.scores.combinedScore,
      })),
    );

    return NextResponse.json({
      success: true,
      scraped: scrapeResult.listings.length,
      scored,
      withinBudget: withinBudget.length,
      topResults: top.length,
    });
  } catch (err) {
    console.error('Deal search failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
