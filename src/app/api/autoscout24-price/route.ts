/**
 * GET/POST /api/autoscout24-price
 *
 * Returns the cached (or freshly fetched) minimum listing price on AutoScout24.ch
 * for a given brand + model + yearFrom combination.
 *
 * Cache TTL: 24 hours (stored in autoscout_prices table).
 *
 * POST body: { brand: string, model?: string | null, yearFrom?: number | null }
 * Response:  { minPriceChf, listingUrl, fetchedAt, cached }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrFetchAutoscoutPrice } from '@/lib/db/queries/autoscout';
import { getMinPriceFromAutoscout24 } from '@/lib/scraper/autoscout24';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, model = null, yearFrom = null } = body as {
      brand: string;
      model?: string | null;
      yearFrom?: number | null;
    };

    if (!brand) {
      return NextResponse.json({ error: 'brand ist erforderlich' }, { status: 400 });
    }

    const result = await getOrFetchAutoscoutPrice(
      brand,
      model ?? null,
      yearFrom ?? null,
      getMinPriceFromAutoscout24,
    );

    if (!result) {
      return NextResponse.json(
        { error: `Keine Inserate auf AutoScout24.ch gefunden für ${brand} ${model ?? ''}` },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/autoscout24-price] Fehler:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
