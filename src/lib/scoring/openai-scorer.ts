import OpenAI from 'openai';
import type { Listing } from '@/lib/db/schema';
import type { AIAnalysis, MarketBenchmark } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Detect the Porsche 911 variant from title
function detectVariant(title: string): string | null {
  const t = title.toUpperCase();
  if (t.includes('GT3 RS')) return 'GT3 RS';
  if (t.includes('GT3')) return 'GT3';
  if (t.includes('GT2 RS')) return 'GT2 RS';
  if (t.includes('GT2')) return 'GT2';
  if (t.includes('TURBO S')) return 'Turbo S';
  if (t.includes('TURBO')) return 'Turbo';
  if (t.includes('GTS')) return 'GTS';
  if (t.includes('TARGA 4S') || t.includes('TARGA4S')) return 'Targa 4S';
  if (t.includes('TARGA 4') || t.includes('TARGA4')) return 'Targa 4';
  if (t.includes('TARGA')) return 'Targa';
  if (t.includes('CARRERA 4S') || t.includes('CARRERA4S')) return 'Carrera 4S';
  if (t.includes('CARRERA 4') || t.includes('CARRERA4')) return 'Carrera 4';
  if (t.includes('CARRERA S')) return 'Carrera S';
  if (t.includes('CARRERA')) return 'Carrera';
  return null;
}

// Per-variant spec knowledge: what matters, what's missing would be a red flag
const VARIANT_SPEC_KNOWLEDGE: Record<string, {
  mustHave: string[];       // Absence is a red flag
  highValue: string[];      // Present = significant value add
  mediumValue: string[];    // Present = nice to have
  badSigns: string[];       // Present = red flag
}> = {
  'GT3': {
    mustHave: ['Scheckheft gepflegt', 'lückenlose Wartungshistorie', 'Porsche Service'],
    highValue: ['Clubsport Paket', 'Liftachse', 'LED-Matrix', 'Carbon-Paket', 'Alcantara', 'Keramikbremse', 'PCCB', 'Chrono Paket', 'Vollschalensitze', 'PDK', 'Schaltgetriebe'],
    mediumValue: ['BOSE', 'Burmester', 'Surround View', 'Sportabgasanlage', 'Sport Design Lenkrad', 'Approved'],
    badSigns: ['Unfall', 'Tieferlegung', 'Chiptuning', 'Leistungssteigerung', 'Folierung', 'tuning'],
  },
  'GT3 RS': {
    mustHave: ['Scheckheft gepflegt', 'Porsche Service'],
    highValue: ['Weissach Paket', 'Carbon-Paket', 'Magnesium-Felgen', 'PCCB', 'Keramikbremse', 'PDK', 'Clubsport'],
    mediumValue: ['Liftachse', 'Chrono Paket', 'Surround View', 'Approved'],
    badSigns: ['Unfall', 'Tieferlegung', 'Chiptuning', 'Tuning', 'Folierung'],
  },
  'GT2 RS': {
    mustHave: ['Scheckheft gepflegt', 'Porsche Service'],
    highValue: ['Weissach Paket', 'Carbon-Paket', 'PCCB', 'Keramikbremse'],
    mediumValue: ['Chrono Paket', 'Approved', 'Liftachse'],
    badSigns: ['Unfall', 'Chiptuning', 'Tuning'],
  },
  'Turbo S': {
    mustHave: ['Scheckheft gepflegt'],
    highValue: ['Keramikbremse', 'PCCB', 'Carbon-Paket', 'Burmester', 'Liftachse', 'Chrono Paket', 'Hinterachslenkung', 'Sport Design'],
    mediumValue: ['Approved', 'Panoramadach', 'Surround View', 'Nightvision', 'Head-Up Display'],
    badSigns: ['Unfall', 'Chiptuning', 'Tuning', 'Tieferlegung'],
  },
  'Turbo': {
    mustHave: ['Scheckheft gepflegt'],
    highValue: ['Keramikbremse', 'PCCB', 'Liftachse', 'Chrono Paket', 'Hinterachslenkung', 'Carbon-Paket'],
    mediumValue: ['Approved', 'Burmester', 'Panoramadach', 'Surround View'],
    badSigns: ['Unfall', 'Chiptuning', 'Tuning'],
  },
  'GTS': {
    mustHave: ['Scheckheft gepflegt'],
    highValue: ['Keramikbremse', 'PCCB', 'Liftachse', 'Chrono Paket', 'Schaltgetriebe', 'PDK', 'Carbon-Paket', 'Clubsport'],
    mediumValue: ['Approved', 'Burmester', 'Hinterachslenkung', 'Approved'],
    badSigns: ['Unfall', 'Tuning', 'Tieferlegung'],
  },
  'Carrera S': {
    mustHave: ['Scheckheft gepflegt'],
    highValue: ['Sport Chrono Paket', 'Keramikbremse', 'PCCB', 'Liftachse', 'PASM', 'Hinterachslenkung', 'Schaltgetriebe'],
    mediumValue: ['Burmester', 'Panoramadach', 'Approved', 'Surround View', 'Head-Up Display'],
    badSigns: ['Unfall', 'Tuning', 'Tieferlegung'],
  },
  'Carrera 4S': {
    mustHave: ['Scheckheft gepflegt'],
    highValue: ['Sport Chrono Paket', 'Keramikbremse', 'PCCB', 'Liftachse', 'PASM', 'Hinterachslenkung'],
    mediumValue: ['Burmester', 'Panoramadach', 'Approved', 'Surround View'],
    badSigns: ['Unfall', 'Tuning', 'Tieferlegung'],
  },
  'Carrera': {
    mustHave: ['Scheckheft gepflegt'],
    highValue: ['Sport Chrono Paket', 'PASM', 'Liftachse', 'Schaltgetriebe', 'Keramikbremse'],
    mediumValue: ['Approved', 'Panoramadach', 'Burmester', 'Surround View'],
    badSigns: ['Unfall', 'Tuning', 'Tieferlegung'],
  },
};

export async function analyzeListingWithAI(
  listing: Listing,
  benchmark: MarketBenchmark | null,
  isDeepAnalysis: boolean = false,
): Promise<AIAnalysis> {
  const model = isDeepAnalysis ? 'gpt-4o' : 'gpt-4o-mini';

  const isPorsche911 = !!(
    listing.title?.includes('911') ||
    (listing.title?.toLowerCase().includes('porsche') && listing.title?.match(/9[0-9]{2}/))
  );

  const variant = isPorsche911 ? detectVariant(listing.title || '') : null;
  const variantSpecs = variant ? VARIANT_SPEC_KNOWLEDGE[variant] : null;

  const hasAccidentDamage = (listing as typeof listing & { hasAccidentDamage?: boolean }).hasAccidentDamage;

  const featuresText = (listing.features || []).join(', ') || 'Not specified';
  const descriptionText = listing.description ? `\n- Description excerpt: ${listing.description.slice(0, 500)}` : '';

  const variantSpecContext = variantSpecs ? `
SPEC ANALYSIS FOR ${variant}:
Must-have indicators (flag absence as red flag): ${variantSpecs.mustHave.join(', ')}
High-value specs (significantly increase desirability/resale): ${variantSpecs.highValue.join(', ')}
Medium-value specs (nice additions): ${variantSpecs.mediumValue.join(', ')}
Red flag specs/modifications (reduce value): ${variantSpecs.badSigns.join(', ')}

For keySpecs: list each detected spec with its impact level and a brief note on why it matters.
For missingSpecs: list any must-have or high-value specs that are NOT present in the features/description.
` : '';

  const porsche911Context = isPorsche911 ? `
PORSCHE 911 KNOWLEDGE:
- Variant hierarchy (resale value): GT3 RS > GT2 RS > GT3 > Turbo S > Turbo > GTS > Targa 4S > Carrera 4S > Carrera S > Carrera 4 > Carrera
- Generations: 992 (2019+), 991.2 (2016-2019), 991.1 (2012-2015), 997.2 (2009-2012)
- Manual gearbox commands a premium on 991.1/997 Carrera models; PDK preferred on GT3/Turbo
- Premium colors (add CHF 5-15k): GT Silbermetallic, Kreidefarbe (Chalk), Python-Grün, Haifischblau, Gentianblau, Miami-Blau, Rubinrot
- Standard colors (no premium): Schwarz, Carrara Weiß, normales Silber
- VAT deductible on a 911 saves €15,000–€40,000 depending on price — enormous advantage
- Full Porsche dealer service history is essential for resale in Switzerland
${variantSpecContext}` : '';

  const prompt = `You are an expert in Porsche vehicles and German-to-Swiss car imports.
Your task is to analyze this listing and classify its specs, then score the overall deal quality.
${porsche911Context}

GENERAL CRITERIA:
- Price vs market benchmark: cheap/fair/expensive?
- VAT deductible: saves 19% German VAT — critical advantage
- Accident damage: destroys Swiss resale value and complicates import
- Swiss arbitrage: CH resale ~10-15% above DE
- Service history completeness

Listing:
- Title: ${listing.title}
- Variant detected: ${variant || 'Unknown/not 911'}
- Price: €${listing.priceEur?.toLocaleString('de-DE')}
- Year: ${listing.firstRegistrationYear || 'Unknown'}
- Mileage: ${listing.mileageKm?.toLocaleString('de-DE')} km
- Fuel: ${listing.fuelType || 'Unknown'}
- Transmission: ${listing.transmission || 'Unknown'}
- Power: ${listing.power || 'Unknown'}
- Color: ${listing.color || 'Unknown'}
- Seller: ${listing.sellerType || 'Unknown'}
- Location: ${listing.location || 'Unknown'}
- VAT deductible: ${listing.vatDeductible ? 'YES — major financial advantage' : 'No'}
- Accident damage: ${hasAccidentDamage ? 'YES — major red flag' : 'No'}
- Features/options: ${featuresText}${descriptionText}
${benchmark?.medianPriceEur ? `- Market median: €${benchmark.medianPriceEur.toLocaleString('de-DE')}` : '- Market median: unavailable'}
${benchmark?.estimatedChResaleMedian ? `- Est. Swiss resale: CHF ${benchmark.estimatedChResaleMedian.toLocaleString('de-CH')}` : ''}

Respond ONLY with valid JSON in exactly this format:
{
  "score": <0-100 overall deal quality>,
  "specScore": <0-100 spec desirability for this variant>,
  "variantClassification": "<exact variant name e.g. 'Porsche 911 GT3 992'>",
  "explanation": "<2-3 sentences on overall deal quality and why>",
  "keySpecs": [
    {"spec": "<spec name>", "impact": "<high|medium|low>", "note": "<why it matters for this variant>"}
  ],
  "missingSpecs": ["<spec that would be expected but is absent>"],
  "highlights": ["<concise positive string>"],
  "redFlags": ["<concise concern string>"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content) as AIAnalysis;

    return {
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      specScore: Math.max(0, Math.min(100, parsed.specScore || 50)),
      explanation: parsed.explanation || 'No analysis available',
      redFlags: parsed.redFlags || [],
      highlights: parsed.highlights || [],
      keySpecs: parsed.keySpecs || [],
      missingSpecs: parsed.missingSpecs || [],
      variantClassification: parsed.variantClassification || variant || '',
    };
  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    return {
      score: 50,
      specScore: 50,
      explanation: 'AI analysis unavailable',
      redFlags: [],
      highlights: [],
      keySpecs: [],
      missingSpecs: [],
      variantClassification: variant || '',
    };
  }
}
