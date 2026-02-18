"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
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
} from "@/lib/constants";

interface ImportCalculatorProps {
  priceEur: number;
  isVatDeductible: boolean;
  eurChfRate: number;
}

export function ImportCalculator({ priceEur, isVatDeductible, eurChfRate }: ImportCalculatorProps) {
  const [transportCost, setTransportCost] = useState(DEFAULT_TRANSPORT_COST_CHF);
  const [vehicleWeight, setVehicleWeight] = useState(DEFAULT_VEHICLE_WEIGHT_KG);
  const [expanded, setExpanded] = useState(false);

  const breakdown = useMemo(() => {
    const vehiclePriceChf = priceEur * eurChfRate;
    const germanVatDeducted = isVatDeductible
      ? vehiclePriceChf * (GERMAN_VAT_RATE / (1 + GERMAN_VAT_RATE))
      : 0;
    const netPriceChf = vehiclePriceChf - germanVatDeducted;
    const automobileTax = (netPriceChf + transportCost) * AUTOMOBILE_TAX_RATE;
    const customsDuty = (vehicleWeight / 100) * CUSTOMS_DUTY_PER_100KG;
    const inspectionFee = INSPECTION_FEE_CHF;
    const subtotalBeforeVat = netPriceChf + transportCost + automobileTax + customsDuty + inspectionFee;
    const swissVat = subtotalBeforeVat * SWISS_VAT_RATE;
    const totalLandedCostChf = subtotalBeforeVat + swissVat;
    const grandTotalChf = totalLandedCostChf + EMISSION_TEST_CHF + MVI_INSPECTION_CHF;

    return {
      vehiclePriceChf: Math.round(vehiclePriceChf),
      germanVatDeducted: Math.round(germanVatDeducted),
      netPriceChf: Math.round(netPriceChf),
      transportCost,
      automobileTax: Math.round(automobileTax),
      customsDuty: Math.round(customsDuty),
      inspectionFee,
      subtotalBeforeVat: Math.round(subtotalBeforeVat),
      swissVat: Math.round(swissVat),
      totalLandedCostChf: Math.round(totalLandedCostChf),
      grandTotalChf: Math.round(grandTotalChf),
    };
  }, [priceEur, isVatDeductible, eurChfRate, transportCost, vehicleWeight]);

  const rows = [
    { label: `Vehicle price (${formatPrice(priceEur, "EUR")} x ${eurChfRate.toFixed(4)})`, value: breakdown.vehiclePriceChf },
    ...(isVatDeductible
      ? [{ label: "German VAT deducted (19%)", value: -breakdown.germanVatDeducted, highlight: true as const }]
      : []),
    { label: "Net vehicle price", value: breakdown.netPriceChf, bold: true as const },
    { label: "Transport (DE → CH)", value: breakdown.transportCost },
    { label: "Automobile tax (4%)", value: breakdown.automobileTax },
    { label: "Customs duty (CHF 15/100kg)", value: breakdown.customsDuty },
    { label: "Inspection fee", value: breakdown.inspectionFee },
    { label: "Subtotal before VAT", value: breakdown.subtotalBeforeVat },
    { label: "Swiss VAT (8.1%)", value: breakdown.swissVat },
    { label: "Total landed cost", value: breakdown.totalLandedCostChf, bold: true as const },
    { label: "Emission test", value: EMISSION_TEST_CHF },
    { label: "MVI inspection", value: MVI_INSPECTION_CHF },
  ];

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="font-semibold text-sm">Import Cost Calculator</h3>
          <p className="text-2xl font-bold mt-1">
            {formatPrice(breakdown.grandTotalChf, "CHF")}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Adjustable inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Transport cost (CHF)</Label>
              <Input
                type="number"
                value={transportCost}
                onChange={(e) => setTransportCost(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vehicle weight (kg)</Label>
              <Input
                type="number"
                value={vehicleWeight}
                onChange={(e) => setVehicleWeight(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div
                key={row.label}
                className={`flex justify-between text-sm ${
                  "bold" in row && row.bold ? "font-semibold pt-1 border-t" : ""
                }`}
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span
                  className={
                    "highlight" in row && row.highlight
                      ? "text-emerald-600 dark:text-emerald-400"
                      : ""
                  }
                >
                  {row.value < 0 ? "-" : ""}
                  {formatPrice(Math.abs(row.value), "CHF")}
                </span>
              </div>
            ))}

            <div className="flex justify-between text-base font-bold pt-2 border-t-2">
              <span>Grand Total</span>
              <span>{formatPrice(breakdown.grandTotalChf, "CHF")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
