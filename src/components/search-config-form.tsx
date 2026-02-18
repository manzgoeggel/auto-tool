"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { AVAILABLE_BRANDS, getModelsForBrand, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants";

interface SearchConfigFormProps {
  initialData?: {
    id?: number;
    name: string;
    brands: string[];
    models: string[];
    yearMin?: number | null;
    yearMax?: number | null;
    mileageMax?: number | null;
    priceMin?: number | null;
    priceMax?: number | null;
    fuelTypes: string[];
    transmissions: string[];
    minExpectedMarginChf?: number | null;
  };
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function SearchConfigForm({ initialData, onSubmit, onCancel }: SearchConfigFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [brands, setBrands] = useState<string[]>(initialData?.brands || []);
  const [models, setModels] = useState<string[]>(initialData?.models || []);
  const [yearMin, setYearMin] = useState(initialData?.yearMin?.toString() || "");
  const [yearMax, setYearMax] = useState(initialData?.yearMax?.toString() || "");
  const [mileageMax, setMileageMax] = useState(initialData?.mileageMax?.toString() || "");
  const [priceMin, setPriceMin] = useState(initialData?.priceMin?.toString() || "");
  const [priceMax, setPriceMax] = useState(initialData?.priceMax?.toString() || "");
  const [fuelTypes, setFuelTypes] = useState<string[]>(initialData?.fuelTypes || []);
  const [transmissions, setTransmissions] = useState<string[]>(initialData?.transmissions || []);
  const [minMargin, setMinMargin] = useState(initialData?.minExpectedMarginChf?.toString() || "");
  const [loading, setLoading] = useState(false);

  const availableModels = brands.flatMap((b) => getModelsForBrand(b));

  const toggleItem = (
    item: string,
    list: string[],
    setter: (v: string[]) => void,
  ) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        id: initialData?.id,
        name,
        brands,
        models,
        yearMin: yearMin ? parseInt(yearMin) : undefined,
        yearMax: yearMax ? parseInt(yearMax) : undefined,
        mileageMax: mileageMax ? parseInt(mileageMax) : undefined,
        priceMin: priceMin ? parseInt(priceMin) : undefined,
        priceMax: priceMax ? parseInt(priceMax) : undefined,
        fuelTypes,
        transmissions,
        minExpectedMarginChf: minMargin ? parseInt(minMargin) : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Configuration Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. BMW 3er Diesel DE"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Brands</Label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_BRANDS.map((brand) => (
            <Badge
              key={brand}
              variant={brands.includes(brand) ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => toggleItem(brand, brands, setBrands)}
            >
              {brand}
              {brands.includes(brand) && <X className="ml-1 h-3 w-3" />}
            </Badge>
          ))}
        </div>
      </div>

      {brands.length > 0 && availableModels.length > 0 && (
        <div className="space-y-2">
          <Label>Models (leave empty for all)</Label>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {availableModels.map((model) => (
              <Badge
                key={model}
                variant={models.includes(model) ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => toggleItem(model, models, setModels)}
              >
                {model}
                {models.includes(model) && <X className="ml-1 h-3 w-3" />}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="yearMin">Year from</Label>
          <Input
            id="yearMin"
            type="number"
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
            placeholder="2018"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="yearMax">Year to</Label>
          <Input
            id="yearMax"
            type="number"
            value={yearMax}
            onChange={(e) => setYearMax(e.target.value)}
            placeholder="2024"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mileageMax">Max Mileage (km)</Label>
        <Input
          id="mileageMax"
          type="number"
          value={mileageMax}
          onChange={(e) => setMileageMax(e.target.value)}
          placeholder="150000"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priceMin">Min Price (EUR)</Label>
          <Input
            id="priceMin"
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="5000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceMax">Max Price (EUR)</Label>
          <Input
            id="priceMax"
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="50000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Fuel Types</Label>
        <div className="flex flex-wrap gap-1.5">
          {FUEL_TYPES.map((ft) => (
            <Badge
              key={ft}
              variant={fuelTypes.includes(ft) ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => toggleItem(ft, fuelTypes, setFuelTypes)}
            >
              {ft}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Transmissions</Label>
        <div className="flex flex-wrap gap-1.5">
          {TRANSMISSIONS.map((tr) => (
            <Badge
              key={tr}
              variant={transmissions.includes(tr) ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => toggleItem(tr, transmissions, setTransmissions)}
            >
              {tr}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="minMargin">Min Expected Margin (CHF)</Label>
        <Input
          id="minMargin"
          type="number"
          value={minMargin}
          onChange={(e) => setMinMargin(e.target.value)}
          placeholder="3000"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !name}>
          {loading ? "Saving..." : initialData?.id ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
