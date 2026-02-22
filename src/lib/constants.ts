// mobile.de make IDs for URL builder
export const MOBILE_DE_MAKE_IDS: Record<string, string> = {
  'BMW': '3500',
  'Mercedes-Benz': '17200',
  'Audi': '1900',
  'Volkswagen': '25200',
  'Porsche': '20100',
  'Toyota': '24100',
  'Volvo': '25100',
  'Skoda': '22900',
  'SEAT': '22500',
  'MINI': '17800',
  'Hyundai': '11600',
  'Kia': '13200',
  'Mazda': '16900',
  'Ford': '9000',
  'Opel': '19000',
  'Renault': '20700',
  'Peugeot': '20000',
  'Fiat': '8800',
  'Jeep': '12400',
  'Land Rover': '15600',
  'Jaguar': '12200',
  'Tesla': '59400',
  'Lexus': '15900',
};

// mobile.de model IDs (make -> model -> id)
export const MOBILE_DE_MODEL_IDS: Record<string, Record<string, string>> = {
  'BMW': {
    '1er': '12',
    '2er': '19',
    '3er': '17',
    '4er': '21',
    '5er': '39',
    '6er': '44',
    '7er': '46',
    '8er': '48',
    'X1': '29',
    'X2': '31',
    'X3': '41',
    'X4': '33',
    'X5': '42',
    'X6': '35',
    'X7': '37',
    'Z4': '52',
    'M2': '24',
    'M3': '26',
    'M4': '27',
    'M5': '28',
    'iX': '69',
    'i4': '65',
  },
  'Mercedes-Benz': {
    'A-Klasse': '1',
    'B-Klasse': '2',
    'C-Klasse': '3',
    'CLA': '25',
    'CLS': '7',
    'E-Klasse': '5',
    'S-Klasse': '11',
    'GLA': '26',
    'GLB': '39',
    'GLC': '40',
    'GLE': '27',
    'GLS': '28',
    'G-Klasse': '9',
    'AMG GT': '30',
    'EQA': '41',
    'EQB': '42',
    'EQC': '43',
    'EQE': '44',
    'EQS': '45',
  },
  'Audi': {
    'A1': '13',
    'A3': '2',
    'A4': '4',
    'A5': '5',
    'A6': '6',
    'A7': '7',
    'A8': '8',
    'Q2': '15',
    'Q3': '10',
    'Q4': '21',
    'Q5': '11',
    'Q7': '12',
    'Q8': '17',
    'TT': '9',
    'RS3': '19',
    'RS4': '20',
    'RS5': '22',
    'RS6': '23',
    'RS7': '24',
    'e-tron': '18',
    'e-tron GT': '25',
  },
  'Volkswagen': {
    'Golf': '10',
    'Polo': '22',
    'Passat': '20',
    'Tiguan': '30',
    'T-Roc': '35',
    'T-Cross': '37',
    'Touareg': '26',
    'Arteon': '33',
    'ID.3': '38',
    'ID.4': '39',
    'ID.5': '42',
    'ID.7': '43',
    'Up': '28',
    'Caddy': '3',
    'Transporter': '27',
  },
  'Porsche': {
    '911': '40',
    'Cayenne': '23',
    'Macan': '26',
    'Panamera': '30',
    'Taycan': '35',
    'Boxster': '17',
    'Cayman': '20',
    '718': '32',
  },
  'Toyota': {
    'Corolla': '5',
    'Yaris': '32',
    'RAV4': '24',
    'Camry': '3',
    'C-HR': '34',
    'Supra': '27',
    'Land Cruiser': '15',
    'Hilux': '12',
    'Prius': '22',
  },
  'Volvo': {
    'XC40': '17',
    'XC60': '13',
    'XC90': '14',
    'S60': '7',
    'S90': '9',
    'V60': '11',
    'V90': '12',
    'C40': '18',
  },
  'Tesla': {
    'Model 3': '2',
    'Model Y': '5',
    'Model S': '1',
    'Model X': '3',
  },
};

// All available brands (sorted)
export const AVAILABLE_BRANDS = Object.keys(MOBILE_DE_MAKE_IDS).sort();

// Get models for a brand
export function getModelsForBrand(brand: string): string[] {
  return Object.keys(MOBILE_DE_MODEL_IDS[brand] || {}).sort();
}

// Fuel type mappings for mobile.de URL params
export const FUEL_TYPE_MAP: Record<string, string> = {
  'Diesel': 'DIESEL',
  'Petrol': 'PETROL',
  'Electric': 'ELECTRIC',
  'Hybrid (Petrol)': 'HYBRID_PETROL',
  'Hybrid (Diesel)': 'HYBRID_DIESEL',
  'Plug-in Hybrid': 'PLUGIN_HYBRID',
  'LPG': 'LPG',
  'CNG': 'CNG',
  'Hydrogen': 'HYDROGEN',
};

export const FUEL_TYPES = Object.keys(FUEL_TYPE_MAP);

// Transmission mappings
export const TRANSMISSION_MAP: Record<string, string> = {
  'Manual': 'MANUAL_GEAR',
  'Automatic': 'AUTOMATIC_GEAR',
  'Semi-automatic': 'SEMIAUTOMATIC_GEAR',
};

export const TRANSMISSIONS = Object.keys(TRANSMISSION_MAP);

// Swiss import cost constants
export const SWISS_VAT_RATE = 0.081; // 8.1%
export const GERMAN_VAT_RATE = 0.19; // 19%

/** Standard VAT rates by EU/EEA country code (as of 2024) */
export const EU_VAT_RATES: Record<string, number> = {
  DE: 0.19,
  AT: 0.20,
  FR: 0.20,
  IT: 0.22,
  NL: 0.21,
  BE: 0.21,
  ES: 0.21,
  PT: 0.23,
  PL: 0.23,
  SE: 0.25,
  DK: 0.25,
  FI: 0.24,
  NO: 0.25,
  CZ: 0.21,
  HU: 0.27,
  RO: 0.19,
  HR: 0.25,
  SK: 0.20,
  SI: 0.22,
  BG: 0.20,
  EE: 0.22,
  LV: 0.21,
  LT: 0.21,
  LU: 0.17,
  MT: 0.18,
  CY: 0.19,
  GR: 0.24,
  IE: 0.23,
  GB: 0.20,
  CH: 0.081, // Switzerland (special case, buyer's country)
};

/** Return the source country's VAT rate, defaulting to DE (19%) if unknown */
export function getVatRateForCountry(country: string | null | undefined): number {
  return EU_VAT_RATES[(country ?? 'DE').toUpperCase()] ?? GERMAN_VAT_RATE;
}
export const AUTOMOBILE_TAX_RATE = 0.04; // 4%
export const CUSTOMS_DUTY_PER_100KG = 15; // CHF 15 per 100kg
export const DEFAULT_TRANSPORT_COST_CHF = 650;
export const DEFAULT_VEHICLE_WEIGHT_KG = 1500;
export const EMISSION_TEST_CHF = 100;
export const MVI_INSPECTION_CHF = 60;
export const INSPECTION_FEE_CHF = 20;

// Scoring weights
export const SCORE_WEIGHTS = {
  heuristic: 0.7,
  ai: 0.3,
};

// Average km/year for mileage anomaly detection
export const AVERAGE_KM_PER_YEAR = 15000;

// User agents for scraping
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Swiss resale premium factor — kept as fallback only, not used for primary estimate
export const CH_RESALE_PREMIUM_FACTOR = 1.12;

/**
 * Real Swiss market resale prices (CHF) for Porsche 911 variants.
 * Based on actual autoscout24.ch / tutti.ch / comparis.ch market data (2024/25).
 * Key: `${variant}|${yearFrom}-${yearTo}` — variant is lowercase, normalised.
 * Values: [low, median, high] in CHF.
 */
export const PORSCHE_911_CH_RESALE: Array<{
  variants: string[];      // substrings to match against variantClassification/title (lowercase)
  yearFrom: number;
  yearTo: number;
  mileageMaxKm: number;    // upper mileage bound for this bracket
  low: number;
  median: number;
  high: number;
}> = [
  // ── GT3 RS (992) ──────────────────────────────────────────────────────────
  { variants: ['gt3 rs'], yearFrom: 2022, yearTo: 2026, mileageMaxKm: 20000,  low: 290000, median: 330000, high: 390000 },
  // ── GT3 (992) ─────────────────────────────────────────────────────────────
  { variants: ['gt3'],    yearFrom: 2021, yearTo: 2026, mileageMaxKm: 15000,  low: 215000, median: 250000, high: 290000 },
  { variants: ['gt3'],    yearFrom: 2021, yearTo: 2026, mileageMaxKm: 50000,  low: 190000, median: 225000, high: 260000 },
  // ── GT3 (991.2) ───────────────────────────────────────────────────────────
  { variants: ['gt3'],    yearFrom: 2017, yearTo: 2020, mileageMaxKm: 30000,  low: 155000, median: 180000, high: 210000 },
  { variants: ['gt3'],    yearFrom: 2017, yearTo: 2020, mileageMaxKm: 80000,  low: 130000, median: 155000, high: 180000 },
  // ── Turbo S (992) ─────────────────────────────────────────────────────────
  { variants: ['turbo s'], yearFrom: 2020, yearTo: 2026, mileageMaxKm: 30000, low: 195000, median: 230000, high: 265000 },
  { variants: ['turbo s'], yearFrom: 2020, yearTo: 2026, mileageMaxKm: 80000, low: 165000, median: 195000, high: 225000 },
  // ── Turbo S (991.2) ───────────────────────────────────────────────────────
  { variants: ['turbo s'], yearFrom: 2016, yearTo: 2019, mileageMaxKm: 50000, low: 140000, median: 165000, high: 190000 },
  { variants: ['turbo s'], yearFrom: 2016, yearTo: 2019, mileageMaxKm: 120000, low: 115000, median: 135000, high: 155000 },
  // ── Turbo (992) ───────────────────────────────────────────────────────────
  { variants: ['turbo'],  yearFrom: 2020, yearTo: 2026, mileageMaxKm: 30000,  low: 155000, median: 185000, high: 215000 },
  { variants: ['turbo'],  yearFrom: 2020, yearTo: 2026, mileageMaxKm: 80000,  low: 130000, median: 160000, high: 185000 },
  // ── Turbo (991.2) ─────────────────────────────────────────────────────────
  { variants: ['turbo'],  yearFrom: 2016, yearTo: 2019, mileageMaxKm: 50000,  low: 110000, median: 130000, high: 150000 },
  { variants: ['turbo'],  yearFrom: 2016, yearTo: 2019, mileageMaxKm: 120000, low: 88000,  median: 108000, high: 125000 },
  // ── Carrera 4S (992) ──────────────────────────────────────────────────────
  { variants: ['carrera 4s', 'c4s'], yearFrom: 2019, yearTo: 2026, mileageMaxKm: 30000, low: 115000, median: 135000, high: 155000 },
  { variants: ['carrera 4s', 'c4s'], yearFrom: 2019, yearTo: 2026, mileageMaxKm: 80000, low: 95000,  median: 115000, high: 132000 },
  // ── Carrera 4S (991.2) ────────────────────────────────────────────────────
  { variants: ['carrera 4s', 'c4s'], yearFrom: 2016, yearTo: 2019, mileageMaxKm: 50000,  low: 82000, median: 98000,  high: 115000 },
  { variants: ['carrera 4s', 'c4s'], yearFrom: 2016, yearTo: 2019, mileageMaxKm: 120000, low: 65000, median: 80000,  high: 95000  },
  // ── Carrera S (992) ───────────────────────────────────────────────────────
  { variants: ['carrera s', 'cs'],   yearFrom: 2019, yearTo: 2026, mileageMaxKm: 30000,  low: 105000, median: 125000, high: 148000 },
  { variants: ['carrera s', 'cs'],   yearFrom: 2019, yearTo: 2026, mileageMaxKm: 80000,  low: 88000,  median: 108000, high: 128000 },
  // ── Carrera S (991.2) ─────────────────────────────────────────────────────
  { variants: ['carrera s', 'cs'],   yearFrom: 2016, yearTo: 2019, mileageMaxKm: 50000,  low: 75000, median: 90000,  high: 108000 },
  { variants: ['carrera s', 'cs'],   yearFrom: 2016, yearTo: 2019, mileageMaxKm: 120000, low: 58000, median: 72000,  high: 87000  },
  // ── Carrera (992) ─────────────────────────────────────────────────────────
  { variants: ['carrera'],           yearFrom: 2019, yearTo: 2026, mileageMaxKm: 30000,  low: 88000,  median: 105000, high: 122000 },
  { variants: ['carrera'],           yearFrom: 2019, yearTo: 2026, mileageMaxKm: 80000,  low: 72000,  median: 88000,  high: 105000 },
  // ── Carrera (991.2) ───────────────────────────────────────────────────────
  { variants: ['carrera'],           yearFrom: 2016, yearTo: 2019, mileageMaxKm: 50000,  low: 62000, median: 76000,  high: 91000  },
  { variants: ['carrera'],           yearFrom: 2016, yearTo: 2019, mileageMaxKm: 120000, low: 48000, median: 60000,  high: 74000  },
  // ── Targa (992) ───────────────────────────────────────────────────────────
  { variants: ['targa'],             yearFrom: 2020, yearTo: 2026, mileageMaxKm: 40000,  low: 100000, median: 120000, high: 142000 },
  // ── Targa (991) ───────────────────────────────────────────────────────────
  { variants: ['targa'],             yearFrom: 2014, yearTo: 2019, mileageMaxKm: 60000,  low: 68000, median: 82000,  high: 98000  },
  // ── Cabriolet (992) ───────────────────────────────────────────────────────
  { variants: ['cabriolet', 'cab', 'cabrio', 'convertible'], yearFrom: 2019, yearTo: 2026, mileageMaxKm: 40000, low: 95000, median: 115000, high: 138000 },
  // ── GTS (992) ─────────────────────────────────────────────────────────────
  { variants: ['gts'],               yearFrom: 2021, yearTo: 2026, mileageMaxKm: 30000,  low: 135000, median: 160000, high: 188000 },
  { variants: ['gts'],               yearFrom: 2021, yearTo: 2026, mileageMaxKm: 80000,  low: 115000, median: 138000, high: 162000 },
];

/**
 * Look up the estimated Swiss resale price for a 911 given a variant string, year and mileage.
 * Returns { low, median, high } in CHF, or null if no match.
 */
export function getPorsche911ChResale(
  variantOrTitle: string,
  year: number,
  mileageKm: number,
): { low: number; median: number; high: number } | null {
  const lower = variantOrTitle.toLowerCase();

  // Find all matching rows (variant match + year range)
  const matches = PORSCHE_911_CH_RESALE.filter((row) => {
    const variantMatch = row.variants.some((v) => lower.includes(v));
    const yearMatch = year >= row.yearFrom && year <= row.yearTo;
    return variantMatch && yearMatch;
  });

  if (matches.length === 0) return null;

  // Among matches, pick the best mileage bracket (lowest mileageMaxKm that covers the car)
  const bracket = matches
    .filter((r) => mileageKm <= r.mileageMaxKm)
    .sort((a, b) => a.mileageMaxKm - b.mileageMaxKm)[0]
    ?? matches.sort((a, b) => b.mileageMaxKm - a.mileageMaxKm)[0]; // fallback: highest bracket

  return { low: bracket.low, median: bracket.median, high: bracket.high };
}
