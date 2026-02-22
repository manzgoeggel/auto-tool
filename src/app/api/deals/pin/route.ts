import { NextRequest, NextResponse } from 'next/server';
import { togglePinListing } from '@/lib/db/queries/deals';

export async function POST(request: NextRequest) {
  try {
    const { dealId, listingId } = await request.json();
    if (!dealId || !listingId) {
      return NextResponse.json({ error: 'dealId and listingId required' }, { status: 400 });
    }
    const pinnedListingIds = await togglePinListing(dealId, listingId);
    return NextResponse.json({ pinnedListingIds });
  } catch (err) {
    console.error('POST /api/deals/pin error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
