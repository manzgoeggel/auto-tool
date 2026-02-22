import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listings, scores } from "@/lib/db/schema";
import { eq, and, isNotNull, gte, lte, sql } from "drizzle-orm";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand") || "";
    const yearMin = searchParams.get("yearMin") ? parseInt(searchParams.get("yearMin")!) : null;
    const yearMax = searchParams.get("yearMax") ? parseInt(searchParams.get("yearMax")!) : null;
    const vatOnly = searchParams.get("vatOnly") === "true";
    const maxPriceEur = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) : null;
    const maxMileage = searchParams.get("maxMileage") ? parseInt(searchParams.get("maxMileage")!) : null;

    const conditions = [
      eq(listings.isActive, true),
      isNotNull(listings.priceEur),
      isNotNull(listings.mileageKm),
    ];

    if (brand) conditions.push(sql`${listings.title} ILIKE ${'%' + brand + '%'}`);
    if (yearMin) conditions.push(gte(listings.firstRegistrationYear, yearMin));
    if (yearMax) conditions.push(lte(listings.firstRegistrationYear, yearMax));
    if (vatOnly) conditions.push(eq(listings.vatDeductible, true));
    if (maxPriceEur) conditions.push(lte(listings.priceEur, maxPriceEur));
    if (maxMileage) conditions.push(lte(listings.mileageKm, maxMileage));

    const rows = await db
      .select({
        id: listings.id,
        title: listings.title,
        priceEur: listings.priceEur,
        mileageKm: listings.mileageKm,
        year: listings.firstRegistrationYear,
        vatDeductible: listings.vatDeductible,
        listingUrl: listings.listingUrl,
        combinedScore: scores.combinedScore,
      })
      .from(listings)
      .leftJoin(scores, eq(listings.id, scores.listingId))
      .where(and(...conditions))
      .limit(3000);

    const points = rows
      .filter((r) => r.priceEur != null && r.mileageKm != null)
      // Clip extreme outliers for cleaner chart
      .filter((r) => r.priceEur! <= 500_000 && r.mileageKm! <= 400_000)
      .map((r) => ({
        id: r.id,
        title: r.title ?? "",
        priceEur: r.priceEur!,
        mileageKm: r.mileageKm!,
        year: r.year,
        vatDeductible: r.vatDeductible ?? false,
        listingUrl: r.listingUrl,
        combinedScore: r.combinedScore ?? null,
      }));

    // Compute stats
    const prices = [...points].map((p) => p.priceEur).sort((a, b) => a - b);
    const scored = points.filter((p) => p.combinedScore != null);
    const vatCount = points.filter((p) => p.vatDeductible).length;

    const stats = {
      count: points.length,
      medianPriceEur: prices.length ? Math.round(percentile(prices, 50)) : 0,
      p25PriceEur: prices.length ? Math.round(percentile(prices, 25)) : 0,
      p75PriceEur: prices.length ? Math.round(percentile(prices, 75)) : 0,
      avgScore: scored.length
        ? Math.round(scored.reduce((s, p) => s + p.combinedScore!, 0) / scored.length)
        : null,
      vatCount,
    };

    return NextResponse.json({ points, stats });
  } catch (err) {
    console.error("[api/market]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
