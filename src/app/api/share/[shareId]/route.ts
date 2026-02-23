import { NextRequest, NextResponse } from 'next/server';
import { getDealByShareId, getDealResults } from '@/lib/db/queries/deals';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  try {
    const { shareId } = await params;
    const deal = await getDealByShareId(shareId);
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const results = await getDealResults(deal.id);
    return NextResponse.json({ deal, results });
  } catch (err) {
    console.error('[api/share]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
