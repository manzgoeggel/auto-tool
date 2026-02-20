import { NextRequest, NextResponse } from 'next/server';
import { getListingsWithScores, getTodaysTopDeals, getListingById } from '@/lib/db/queries/listings';

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
