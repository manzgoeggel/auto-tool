export interface RawListing {
  externalId: string;
  title: string;
  priceEur: number;
  mileageKm: number;
  firstRegistrationYear: number;
  firstRegistrationMonth?: number;
  fuelType: string;
  transmission: string;
  power?: string;
  sellerType: 'dealer' | 'private';
  sellerName?: string;
  location: string;
  listingUrl: string;
  imageUrl?: string;
  bodyType?: string;
  color?: string;
  features?: string[];
  description?: string;
  vatDeductible?: boolean;
  hasAccidentDamage?: boolean;
}

export interface ScoredListing {
  id: number;
  externalId: string;
  title: string;
  priceEur: number;
  mileageKm: number;
  firstRegistrationYear: number;
  firstRegistrationMonth?: number;
  fuelType: string;
  transmission: string;
  power?: string;
  sellerType: string;
  sellerName?: string;
  location: string;
  listingUrl: string;
  imageUrl?: string;
  bodyType?: string;
  color?: string;
  features?: string[];
  description?: string;
  vatDeductible?: boolean;
  hasAccidentDamage?: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
  configId?: number;
  priceHistory?: { date: string; price: number }[];
  // Score fields
  heuristicScore: number;
  aiScore: number;
  combinedScore: number;
  priceDeltaPercent: number;
  estimatedResaleMinChf: number;
  estimatedResaleMaxChf: number;
  estimatedMarginMinChf: number;
  estimatedMarginMaxChf: number;
  totalLandedCostChf: number;
  aiExplanation: string;
  redFlags: string[];
  highlights: string[];
}

export interface SearchConfigInput {
  name: string;
  brands: string[];
  models: string[];
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  priceMin?: number;
  priceMax?: number;
  fuelTypes?: string[];
  transmissions?: string[];
  minExpectedMarginChf?: number;
}

export interface ImportCostBreakdown {
  vehiclePriceEur: number;
  vehiclePriceChf: number;
  germanVatDeducted: number;
  netPriceChf: number;
  transportCostChf: number;
  automobileTax: number;
  customsDuty: number;
  inspectionFee: number;
  subtotalBeforeVat: number;
  swissVat: number;
  totalLandedCostChf: number;
  emissionTestChf: number;
  mviInspectionChf: number;
  grandTotalChf: number;
}

export interface HeuristicFactors {
  priceVsMedian: number;
  listingAge: number;
  sellerType: number;
  mileageAnomaly: number;
  priceDrop: number;
  vatDeductible: number;
  total: number;
}

export interface AIAnalysis {
  score: number;
  explanation: string;
  redFlags: string[];
  highlights: string[];
}

export interface MarketBenchmark {
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  mileageRangeMin: number;
  mileageRangeMax: number;
  fuelType?: string | null;
  medianPriceEur: number | null;
  p25PriceEur: number | null;
  p75PriceEur: number | null;
  sampleSize: number | null;
  estimatedChResaleMedian?: number | null;
}
