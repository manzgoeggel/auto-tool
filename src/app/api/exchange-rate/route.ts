import { NextResponse } from 'next/server';
import { getEurChfRate } from '@/lib/import-costs/exchange-rate';

export async function GET() {
  try {
    const rate = await getEurChfRate();
    return NextResponse.json({ eurChf: rate });
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: 500 });
  }
}
