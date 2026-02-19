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

  const isPorsche911 = !!(listing.title?.includes('911') || (listing.title?.toLowerCase().includes('porsche') && listing.title?.match(/9[0-9]{2}/)));

  const porsche911Context = isPorsche911 ? `
PORSCHE 911 SPECIFIC KNOWLEDGE:
- Variants by desirability (highest to lowest for resale/import): GT3/GT3 RS > GT2 RS > Turbo S > Turbo > GTS > Carrera S/4S > Carrera/Carrera 4
- Generations: 992 (2019+), 991.2 (2016-2019), 991.1 (2012-2015), 997.2 (2009-2012)
- PDK gearbox is highly desirable; manual commands a premium on older 991/997 models
- Key options that add significant value: Sport Chrono Package, PASM, ceramic brakes (PCCB), lift system, Sport exhaust, carbon interior, rear-axle steering
- Colors with premium: GT Silver, Chalk, Python Green, Shark Blue, Gentian Blue, Miami Blue — standard Silver/Black less desirable
- Low mileage (<30k km) is especially valuable on a 911
- Porsche Approved Certification or full Porsche dealer service history is a strong positive
- VAT deductible on a 911 is an enormous financial advantage (saves €10,000–€30,000+)
- Watch for: modified/tuned cars (lower resale), missing service history, high mileage for age, any accident history
` : '';

  const hasAccidentDamage = (listing as typeof listing & { hasAccidentDamage?: boolean }).hasAccidentDamage;

  const prompt = `You are a specialist in German-to-Swiss car imports with deep Porsche market expertise.
Analyze this listing and return a JSON assessment.
${porsche911Context}
EVALUATION CRITERIA:
- Price vs market: is this cheap, fair, or expensive for what it is?
- VAT deductible (MwSt. ausweisbar): reclaim 19% German VAT — a HUGE advantage, highlight it
- Accident damage: penalise heavily — complicates Swiss import and destroys resale value
- Swiss arbitrage: CH resale is ~10-15% above DE prices
- Mileage for age: lower than average is a strong positive
- Seller type: private sellers often price better than dealers
- Condition indicators: service history, options, color, modifications

Listing details:
- Title: ${listing.title}
- Price: €${listing.priceEur?.toLocaleString('de-DE')}
- Year: ${listing.firstRegistrationYear || 'Unknown'}
- Mileage: ${listing.mileageKm?.toLocaleString('de-DE')} km
- Fuel: ${listing.fuelType || 'Unknown'}
- Transmission: ${listing.transmission || 'Unknown'}
- Power: ${listing.power || 'Unknown'}
- Seller: ${listing.sellerType || 'Unknown'}
- Location: ${listing.location || 'Unknown'}
- VAT deductible: ${listing.vatDeductible ? 'YES — buyer can reclaim German VAT' : 'No'}
- Accident damage detected: ${hasAccidentDamage ? 'YES — major red flag' : 'No'}
- Features/options: ${(listing.features || []).join(', ') || 'Not specified'}
${benchmark?.medianPriceEur ? `- Market median (similar cars): €${benchmark.medianPriceEur.toLocaleString('de-DE')}` : '- Market median: unavailable'}
${benchmark?.estimatedChResaleMedian ? `- Est. Swiss resale value: CHF ${benchmark.estimatedChResaleMedian.toLocaleString('de-CH')}` : ''}

Respond ONLY with valid JSON:
{"score": <0-100>, "explanation": "<2-3 sentences>", "redFlags": ["<concise string>", ...], "highlights": ["<concise string>", ...]}`;

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
