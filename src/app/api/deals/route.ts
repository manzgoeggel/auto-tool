import { NextRequest, NextResponse } from 'next/server';
import { getAllDeals, getDealById, createDeal, updateDeal, archiveDeal, getDealResults } from '@/lib/db/queries/deals';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const deal = await getDealById(parseInt(id, 10));
      if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const results = await getDealResults(deal.id);
      return NextResponse.json({ deal, results });
    }

    const all = await getAllDeals();
    return NextResponse.json(all);
  } catch (err) {
    console.error('GET /api/deals error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deal = await createDeal(body);
    return NextResponse.json(deal, { status: 201 });
  } catch (err) {
    console.error('POST /api/deals error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...input } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const deal = await updateDeal(id, input);
    return NextResponse.json(deal);
  } catch (err) {
    console.error('PUT /api/deals error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await archiveDeal(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/deals error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
