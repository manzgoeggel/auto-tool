const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=CHF';

let cachedRate: { rate: number; fetchedAt: number } | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getEurChfRate(): Promise<number> {
  // Check for manual override
  if (process.env.EUR_CHF_RATE) {
    return parseFloat(process.env.EUR_CHF_RATE);
  }

  // Check memory cache
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_DURATION_MS) {
    return cachedRate.rate;
  }

  try {
    const res = await fetch(FRANKFURTER_URL, {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      throw new Error(`Exchange rate API returned ${res.status}`);
    }

    const data = await res.json();
    const rate = data.rates?.CHF;

    if (!rate || typeof rate !== 'number') {
      throw new Error('Invalid exchange rate data');
    }

    cachedRate = { rate, fetchedAt: Date.now() };
    return rate;
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    // Fallback to reasonable default
    if (cachedRate) return cachedRate.rate;
    return 0.94;
  }
}
