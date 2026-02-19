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

// Swiss resale premium factor (cars in CH typically sell ~10-15% higher than DE)
export const CH_RESALE_PREMIUM_FACTOR = 1.12;
