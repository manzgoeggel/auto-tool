import { NextRequest, NextResponse } from 'next/server';
import { getListingsWithScores, getTodaysTopDeals, getListingById } from '@/lib/db/queries/listings';
import { db } from '@/lib/db';
import { listings, scores, dealListings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Single listing by ID
    const id = searchParams.get('id');
    if (id) {
      const listing = await getListingById(parseInt(id, 10));
      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }
      return NextResponse.json(listing);
    }

    // Today's top deals
    const onlyToday = searchParams.get('today') === 'true';
    if (onlyToday) {
      const limit = parseInt(searchParams.get('limit') || '15', 10);
      const deals = await getTodaysTopDeals(limit);
      return NextResponse.json(deals);
    }

    // General listings with filters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'combined_score';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const minScore = searchParams.get('minScore') ? parseFloat(searchParams.get('minScore')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!, 10) : undefined;
    const brand = searchParams.get('brand') || undefined;
    const fuelType = searchParams.get('fuelType') || undefined;
    const vatOnly = searchParams.get('vatOnly') === 'true';

    const result = await getListingsWithScores({
      page,
      limit,
      sortBy,
      sortOrder,
      minScore,
      maxPrice,
      brand,
      fuelType,
      vatOnly,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch listings:', error);
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

// PATCH /api/listings?fixVat=true — set vatDeductible=true on all listings
// (all were scraped with mwst=true so all should be VAT deductible)
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('fixVat') !== 'true') {
      return NextResponse.json({ error: 'Pass ?fixVat=true to confirm' }, { status: 400 });
    }
    await db.update(listings).set({ vatDeductible: true }).where(eq(listings.isActive, true));
    return NextResponse.json({ success: true, message: 'All active listings set to vatDeductible=true' });
  } catch (error) {
    console.error('[fixVat] Failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE /api/listings?wipe=true — truncate all listings, scores, and deal results
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('wipe') !== 'true') {
      return NextResponse.json({ error: 'Pass ?wipe=true to confirm' }, { status: 400 });
    }

    // Delete in dependency order: deal_listings → scores → listings
    await db.delete(dealListings);
    await db.delete(scores);
    const deleted = await db.delete(listings);

    console.log('[wipe] All listings, scores and deal results deleted');

    return NextResponse.json({
      success: true,
      message: 'All listings wiped',
      deleted: (deleted as unknown as { rowCount?: number }).rowCount ?? '?',
    });
  } catch (error) {
    console.error('[wipe] Failed:', error);
    return NextResponse.json({ error: 'Wipe failed' }, { status: 500 });
  }
}
