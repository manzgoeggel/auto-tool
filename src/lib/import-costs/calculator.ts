import type { ImportCostBreakdown } from '@/lib/types';
import {
  SWISS_VAT_RATE,
  GERMAN_VAT_RATE,
  AUTOMOBILE_TAX_RATE,
  CUSTOMS_DUTY_PER_100KG,
  DEFAULT_TRANSPORT_COST_CHF,
  DEFAULT_VEHICLE_WEIGHT_KG,
  EMISSION_TEST_CHF,
  MVI_INSPECTION_CHF,
  INSPECTION_FEE_CHF,
} from '@/lib/constants';

export function calculateImportCosts(params: {
  priceEur: number;
  isVatDeductible: boolean;
  eurChfRate: number;
  transportCostChf?: number;
  vehicleWeightKg?: number;
  /** Source country VAT rate (e.g. 0.19 for DE, 0.20 for AT). Defaults to GERMAN_VAT_RATE. */
  sourceVatRate?: number;
}): ImportCostBreakdown {
  const {
    priceEur,
    isVatDeductible,
    eurChfRate,
    transportCostChf = DEFAULT_TRANSPORT_COST_CHF,
    vehicleWeightKg = DEFAULT_VEHICLE_WEIGHT_KG,
    sourceVatRate = GERMAN_VAT_RATE,
  } = params;

  const vehiclePriceChf = priceEur * eurChfRate;

  // If VAT deductible: the listed price includes the source country's VAT.
  // Net = gross / (1 + vatRate), so deduction = gross * (vatRate / (1 + vatRate))
  const germanVatDeducted = isVatDeductible
    ? vehiclePriceChf * (sourceVatRate / (1 + sourceVatRate))
    : 0;

  const netPriceChf = vehiclePriceChf - germanVatDeducted;

  // 4% automobile tax on (net vehicle price + transport)
  const automobileTax = (netPriceChf + transportCostChf) * AUTOMOBILE_TAX_RATE;

  // Customs duty: CHF 15 per 100 kg
  const customsDuty = (vehicleWeightKg / 100) * CUSTOMS_DUTY_PER_100KG;

  // Inspection fee
  const inspectionFee = INSPECTION_FEE_CHF;

  // Subtotal before Swiss VAT
  const subtotalBeforeVat =
    netPriceChf + transportCostChf + automobileTax + customsDuty + inspectionFee;

  // Swiss VAT 8.1% on entire subtotal
  const swissVat = subtotalBeforeVat * SWISS_VAT_RATE;

  const totalLandedCostChf = subtotalBeforeVat + swissVat;

  // Additional registration costs
  const emissionTestChf = EMISSION_TEST_CHF;
  const mviInspectionChf = MVI_INSPECTION_CHF;
  const grandTotalChf = totalLandedCostChf + emissionTestChf + mviInspectionChf;

  return {
    vehiclePriceEur: priceEur,
    vehiclePriceChf: Math.round(vehiclePriceChf),
    germanVatDeducted: Math.round(germanVatDeducted),
    netPriceChf: Math.round(netPriceChf),
    transportCostChf,
    automobileTax: Math.round(automobileTax),
    customsDuty: Math.round(customsDuty),
    inspectionFee,
    subtotalBeforeVat: Math.round(subtotalBeforeVat),
    swissVat: Math.round(swissVat),
    totalLandedCostChf: Math.round(totalLandedCostChf),
    emissionTestChf,
    mviInspectionChf,
    grandTotalChf: Math.round(grandTotalChf),
  };
}
