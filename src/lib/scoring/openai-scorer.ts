import OpenAI from 'openai';
import type { Listing } from '@/lib/db/schema';
import type { AIAnalysis, MarketBenchmark } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeListingWithAI(
  listing: Listing,
  benchmark: MarketBenchmark | null,
  isDeepAnalysis: boolean = false,
): Promise<AIAnalysis> {
  const model = isDeepAnalysis ? 'gpt-4o' : 'gpt-4o-mini';

  const prompt = `You are a car market expert specializing in German-to-Swiss car imports.
Analyze this car listing and provide:
1. A deal quality score (0-100) considering rarity, desirable specs, and value
2. A brief "why it's interesting" explanation (2-3 sentences, in English)
3. Any red flags (list of short strings)
4. Any highlights/value indicators (list of short strings)

Consider:
- Swiss import arbitrage opportunity (cars in CH sell ~10-15% higher)
- VAT recovery potential if MwSt. ausweisbar (19% German VAT deductible)
- Rare specs, desirable option packages
- Low mileage for age
- Private sellers often offer better prices
- Price vs market benchmark

Listing:
- Title: ${listing.title}
- Price: €${listing.priceEur?.toLocaleString('de-DE')}
- Year: ${listing.firstRegistrationYear || 'Unknown'}
- Mileage: ${listing.mileageKm?.toLocaleString('de-DE')} km
- Fuel: ${listing.fuelType || 'Unknown'}
- Transmission: ${listing.transmission || 'Unknown'}
- Power: ${listing.power || 'Unknown'}
- Seller: ${listing.sellerType || 'Unknown'}
- Location: ${listing.location || 'Unknown'}
- VAT deductible: ${listing.vatDeductible ? 'Yes' : 'No'}
- Features: ${(listing.features || []).join(', ') || 'Not specified'}
${benchmark?.medianPriceEur ? `- Market median for similar: €${benchmark.medianPriceEur.toLocaleString('de-DE')}` : '- Market median: No benchmark data available'}
${benchmark?.estimatedChResaleMedian ? `- Swiss resale estimate: CHF ${benchmark.estimatedChResaleMedian.toLocaleString('de-CH')}` : ''}

Respond ONLY with valid JSON in this exact format:
{"score": <number 0-100>, "explanation": "<string>", "redFlags": ["<string>", ...], "highlights": ["<string>", ...]}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty AI response');
    }

    const parsed = JSON.parse(content) as AIAnalysis;

    return {
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      explanation: parsed.explanation || 'No analysis available',
      redFlags: parsed.redFlags || [],
      highlights: parsed.highlights || [],
    };
  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    return {
      score: 50,
      explanation: 'AI analysis unavailable',
      redFlags: [],
      highlights: [],
    };
  }
}
