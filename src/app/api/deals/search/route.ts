import { NextRequest, NextResponse } from 'next/server';
import { getDealById, saveDealResults } from '@/lib/db/queries/deals';
import { upsertListing, getExistingExternalIds } from '@/lib/db/queries/listings';
import { scrapeMobileDeViaApify } from '@/lib/scraper/apify-mobile-de';
import { scoreAndSaveListing } from '@/lib/scoring/combined';
import { updateBenchmarksFromListings } from '@/lib/db/queries/benchmarks';
import { getOrFetchAutoscoutPrice } from '@/lib/db/queries/autoscout';
import { getMinPriceFromAutoscout24 } from '@/lib/scraper/autoscout24';
import { db } from '@/lib/db';
import { listings, scores } from '@/lib/db/schema';
import { eq, and, lte, gte, isNotNull, desc, sql, or, inArray } from 'drizzle-orm';

export const maxDuration = 300;

export type AS24PriceMap = Record<string, { minPriceChf: number; listingUrl: string } | null>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dealId } = body;
    // forceRefresh=true scrapes more pages (10 vs 5)
    const forceRefresh = body.forceRefresh === true;

    if (!dealId) return NextResponse.json({ error: 'dealId erforderlich' }, { status: 400 });

    const deal = await getDealById(dealId);
    if (!deal) return NextResponse.json({ error: 'Deal nicht gefunden' }, { status: 404 });

    console.log(`[Deal ${deal.id}] Suche nach "${deal.name}" (Budget CHF ${deal.budgetChf})`);

    // ── Step 1: Query existing DB listings matching deal criteria ─────────────
    const dbConditions = [
      eq(listings.isActive, true),
      isNotNull(scores.totalLandedCostChf),
      lte(scores.totalLandedCostChf, deal.budgetChf),
    ];

    const brands = (deal.brands ?? []) as string[];
    const models = (deal.models ?? []) as string[];
    if (brands.length > 0) {
      const brandConditions = brands.map((b) => sql`${listings.title} ILIKE ${'%' + b + '%'}`);
      dbConditions.push(brandConditions.length === 1 ? brandConditions[0] : or(...brandConditions)!);
    }
    if (models.length > 0) {
      const modelConditions = models.map((m) => sql`${listings.title} ILIKE ${'%' + m + '%'}`);
      dbConditions.push(modelConditions.length === 1 ? modelConditions[0] : or(...modelConditions)!);
    }
    if (deal.yearMin) dbConditions.push(gte(listings.firstRegistrationYear, deal.yearMin));
    if (deal.yearMax) dbConditions.push(lte(listings.firstRegistrationYear, deal.yearMax));
    if (deal.mileageMax) dbConditions.push(lte(listings.mileageKm, deal.mileageMax));
    if (deal.vatOnly) dbConditions.push(eq(listings.vatDeductible, true));
    if (deal.noAccident) dbConditions.push(eq(listings.hasAccidentDamage, false));

    const existingRows = await db
      .select()
      .from(listings)
      .innerJoin(scores, eq(listings.id, scores.listingId))
      .where(and(...dbConditions))
      .orderBy(desc(scores.combinedScore))
      .limit(200);

    console.log(`[Deal ${deal.id}] ${existingRows.length} passende Inserate in DB gefunden`);

    // ── Step 2: Scrape mobile.de for fresh listings ───────────────────────────
    const scrapePages = forceRefresh ? 10 : 5;
    let scraped = 0;
    const newIds: number[] = [];
    {
      console.log(`[Deal ${deal.id}] Suche auf mobile.de (${scrapePages} Seiten, Preislimit ~${Math.round((deal.budgetChf / 0.95) * 0.82).toLocaleString()}€)…`);

      const syntheticConfig = {
        id: -1,
        name: deal.name,
        brands,
        models,
        yearMin: deal.yearMin ?? null,
        yearMax: deal.yearMax ?? null,
        mileageMax: deal.mileageMax ?? null,
        priceMin: null,
        priceMax: Math.round((deal.budgetChf / 0.95) * 0.82),
        fuelTypes: [],
        transmissions: [],
        minExpectedMarginChf: null,
        isActive: true,
        lastScrapedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingIds = await getExistingExternalIds();
      const scrapeResult = await scrapeMobileDeViaApify(
        syntheticConfig,
        scrapePages,
        existingIds,
        { vatOnly: deal.vatOnly ?? true },
      );
      scraped = scrapeResult.listings.length;

      for (const raw of scrapeResult.listings) {
        try {
          const id = await upsertListing(raw);
          newIds.push(id);
        } catch { /* skip */ }
      }
    }

    // ── Step 3: Score new listings (heuristic first, then AI) ─────────────────
    let aiScored = 0;
    if (newIds.length > 0) {
      await updateBenchmarksFromListings();
      const toScore = await db
        .select()
        .from(listings)
        .where(and(eq(listings.isActive, true), inArray(listings.id, newIds)));
      for (const l of toScore) {
        try { await scoreAndSaveListing(l, true /* skipAI */); } catch { /* skip */ }
      }
      console.log(`[Deal ${deal.id}] AI-Bewertung für ${toScore.length} neue Inserate…`);
      const aiResults = await Promise.allSettled(
        toScore.map((l) => scoreAndSaveListing(l, false))
      );
      aiScored = aiResults.filter((r) => r.status === 'fulfilled').length;
    }

    // ── Step 4: Re-query all matching listings ────────────────────────────────
    const allRows = await db
      .select()
      .from(listings)
      .innerJoin(scores, eq(listings.id, scores.listingId))
      .where(and(...dbConditions))
      .orderBy(desc(scores.combinedScore))
      .limit(200);

    // AI-score top existing listings that only have heuristic scores (up to 10 more)
    const needsAi = allRows
      .filter((r) => r.scores.aiScore == null && !newIds.includes(r.listings.id))
      .slice(0, 10);
    if (needsAi.length > 0) {
      console.log(`[Deal ${deal.id}] AI-Bewertung für ${needsAi.length} weitere Inserate aus DB…`);
      const more = await Promise.allSettled(
        needsAi.map((r) => scoreAndSaveListing(r.listings, false))
      );
      aiScored += more.filter((r) => r.status === 'fulfilled').length;
    }

    // ── Step 5: Final query with fresh scores, take top 50 ────────────────────
    const finalRows = await db
      .select()
      .from(listings)
      .innerJoin(scores, eq(listings.id, scores.listingId))
      .where(and(...dbConditions))
      .orderBy(desc(scores.combinedScore))
      .limit(50);

    await saveDealResults(
      deal.id,
      finalRows.map((r) => ({
        listingId: r.listings.id,
        marginMinChf: r.scores.estimatedMarginMinChf,
        marginMaxChf: r.scores.estimatedMarginMaxChf,
        combinedScore: r.scores.combinedScore,
      })),
    );

    // ── Step 6: Fetch AutoScout24.ch min prices for each brand+model combo ────
    // Build unique brand/model pairs from the deal definition and results
    const as24Keys = new Set<string>();

    // From deal brands/models definition
    if (brands.length > 0) {
      for (const brand of brands) {
        if (models.length > 0) {
          for (const model of models) {
            as24Keys.add(`${brand}||${model}`);
          }
        } else {
          as24Keys.add(`${brand}||`);
        }
      }
    }

    // Also add brand+model combos from actual result listings (title-based extraction is imprecise,
    // so we rely on the deal's brand/model definition as the primary source)

    const autoscoutPrices: AS24PriceMap = {};

    if (as24Keys.size > 0) {
      console.log(`[Deal ${deal.id}] Fetching AS24.ch prices for ${as24Keys.size} brand/model combos…`);

      const as24Fetches = Array.from(as24Keys).map(async (key) => {
        const [brand, model] = key.split('||');
        const mapKey = model ? `${brand}/${model}` : brand;
        try {
          const result = await getOrFetchAutoscoutPrice(
            brand,
            model || null,
            deal.yearMin ?? null,
            getMinPriceFromAutoscout24,
          );
          autoscoutPrices[mapKey] = result
            ? { minPriceChf: result.minPriceChf, listingUrl: result.listingUrl }
            : null;
          if (result) {
            console.log(
              `[Deal ${deal.id}] AS24 ${mapKey}: CHF ${result.minPriceChf.toLocaleString()} ` +
              `(${result.cached ? 'cached' : 'fresh'})`
            );
          }
        } catch (err) {
          console.error(`[Deal ${deal.id}] AS24 fetch failed for ${mapKey}:`, err);
          autoscoutPrices[mapKey] = null;
        }
      });

      await Promise.allSettled(as24Fetches);
    }

    return NextResponse.json({
      success: true,
      fromDb: existingRows.length,
      scraped,
      aiScored,
      topResults: finalRows.length,
      autoscoutPrices,
    });
  } catch (err) {
    console.error('Deal-Suche fehlgeschlagen:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
