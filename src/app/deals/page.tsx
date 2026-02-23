"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Pin,
  Clock,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Check,
  Share2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice, formatMileage, timeAgo } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Deal {
  id: number;
  name: string;
  budgetChf: number;
  brands: string[];
  models: string[];
  yearMin: number | null;
  yearMax: number | null;
  mileageMax: number | null;
  vatOnly: boolean;
  noAccident: boolean;
  shareId: string | null;
  notes: string | null;
  status: string;
  lastSearchAt: string | null;
  lastResultCount: number | null;
  pinnedListingIds: number[];
  createdAt: string;
}

interface DealResult {
  listing: {
    id: number;
    title: string;
    priceEur: number | null;
    mileageKm: number | null;
    firstRegistrationYear: number | null;
    fuelType: string | null;
    transmission: string | null;
    power: string | null;
    sellerType: string | null;
    location: string | null;
    country: string | null;
    listingUrl: string;
    vatDeductible: boolean | null;
    hasAccidentDamage: boolean | null;
  };
  score: {
    combinedScore: number | null;
    totalLandedCostChf: number | null;
    redFlags: string[] | null;
    variantClassification: string | null;
    aiExplanation: string | null;
  } | null;
  dealListing: {
    combinedScore: number | null;
    addedAt: string;
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = score >= 75 ? "#10b981" : score >= 55 ? "#f59e0b" : score >= 35 ? "#6b7280" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width="34" height="34" className="-rotate-90">
        <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

const COUNTRY_FLAG: Record<string, string> = {
  DE: "🇩🇪", AT: "🇦🇹", CH: "🇨🇭", FR: "🇫🇷", IT: "🇮🇹",
  NL: "🇳🇱", BE: "🇧🇪", ES: "🇪🇸", PT: "🇵🇹", PL: "🇵🇱",
};

// ─── Deal Form ────────────────────────────────────────────────────────────────

const KNOWN_BRANDS = [
  "Porsche", "BMW", "Mercedes-Benz", "Audi", "Ferrari", "Lamborghini",
  "McLaren", "Maserati", "Bentley", "Rolls-Royce", "Aston Martin",
  "Jaguar", "Land Rover", "Lotus", "Alpine",
];

const MODELS_BY_BRAND: Record<string, string[]> = {
  Porsche: ["911", "Cayenne", "Panamera", "Macan", "Taycan", "Boxster", "Cayman"],
  BMW: ["M3", "M4", "M5", "M8", "8 Series", "7 Series"],
  "Mercedes-Benz": ["AMG GT", "S-Class", "G-Class", "E-Class", "C-Class"],
  Audi: ["R8", "RS6", "RS7", "RS3", "RS4", "RS5", "Q8", "e-tron GT"],
  Ferrari: ["Roma", "SF90", "F8", "812", "296"],
  Lamborghini: ["Huracan", "Urus", "Revuelto"],
};

interface DealFormProps {
  initial?: Partial<Deal>;
  onSave: (data: DealFormData) => Promise<void>;
  onCancel: () => void;
}

interface DealFormData {
  id?: number;
  name: string;
  budgetChf: number;
  brands: string[];
  models: string[];
  yearMin: number | null;
  yearMax: number | null;
  mileageMax: number | null;
  vatOnly: boolean;
  noAccident: boolean;
  notes: string;
}

function DealForm({ initial, onSave, onCancel }: DealFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [budgetChf, setBudgetChf] = useState(String(initial?.budgetChf ?? ""));
  const [brands, setBrands] = useState<string[]>(initial?.brands ?? []);
  const [models, setModels] = useState<string[]>(initial?.models ?? []);
  const [yearMin, setYearMin] = useState(String(initial?.yearMin ?? ""));
  const [yearMax, setYearMax] = useState(String(initial?.yearMax ?? ""));
  const [mileageMax, setMileageMax] = useState(String(initial?.mileageMax ?? ""));
  const [vatOnly, setVatOnly] = useState(initial?.vatOnly ?? true);
  const [noAccident, setNoAccident] = useState(initial?.noAccident ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const availableModels = brands.flatMap((b) => MODELS_BY_BRAND[b] ?? []);

  function toggleBrand(brand: string) {
    setBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    );
    setModels((prev) =>
      prev.filter((m) => {
        const remaining = brands.includes(brand)
          ? brands.filter((b) => b !== brand)
          : [...brands, brand];
        return remaining.some((b) => MODELS_BY_BRAND[b]?.includes(m));
      }),
    );
  }

  function toggleModel(model: string) {
    setModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !budgetChf) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name,
        budgetChf: parseInt(budgetChf),
        brands,
        models,
        yearMin: yearMin ? parseInt(yearMin) : null,
        yearMax: yearMax ? parseInt(yearMax) : null,
        mileageMax: mileageMax ? parseInt(mileageMax) : null,
        vatOnly,
        noAccident,
        notes,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name + Budget */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Deal-Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. GT3 Projekt" required />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Max. Budget (CHF inkl. Import)</label>
          <Input
            type="number" min={1} value={budgetChf}
            onChange={(e) => setBudgetChf(e.target.value)}
            placeholder="z.B. 180000" required
          />
        </div>
      </div>

      {/* Brands */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Marken</label>
        <div className="flex flex-wrap gap-1.5">
          {KNOWN_BRANDS.map((brand) => (
            <button
              key={brand} type="button"
              onClick={() => toggleBrand(brand)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                brands.includes(brand)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      {/* Models */}
      {availableModels.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Modelle (optional — leer lassen für alle)</label>
          <div className="flex flex-wrap gap-1.5">
            {availableModels.map((model) => (
              <button
                key={model} type="button"
                onClick={() => toggleModel(model)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  models.includes(model)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Year + Mileage */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Baujahr von</label>
          <Input type="number" min={1990} max={2025} value={yearMin} onChange={(e) => setYearMin(e.target.value)} placeholder="2018" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Baujahr bis</label>
          <Input type="number" min={1990} max={2025} value={yearMax} onChange={(e) => setYearMax(e.target.value)} placeholder="2024" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Max. km</label>
          <Input type="number" min={0} value={mileageMax} onChange={(e) => setMileageMax(e.target.value)} placeholder="50000" />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setVatOnly((v) => !v)}
          className={`w-full flex items-center justify-between h-10 px-3 rounded-md border text-sm transition-colors ${
            vatOnly
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Nur MwSt. ausweisbar
          </span>
          {vatOnly && <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setNoAccident((v) => !v)}
          className={`w-full flex items-center justify-between h-10 px-3 rounded-md border text-sm transition-colors ${
            noAccident
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Nur ohne Unfallschäden
          </span>
          {noAccident && <Check className="h-4 w-4" />}
        </button>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notizen (optional)</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ausstattung, Farbe…" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Speichern…" : initial?.id ? "Änderungen speichern" : "Deal erstellen"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({
  result,
  isPinned,
  onTogglePin,
}: {
  result: DealResult;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const l = result.listing;
  const s = result.score;
  const dl = result.dealListing;
  const landed = s?.totalLandedCostChf;
  const score = s?.combinedScore ?? dl.combinedScore;
  const countryCode = (l.country ?? "DE").toUpperCase();
  const flag = COUNTRY_FLAG[countryCode] ?? "🌍";

  return (
    <tr className={`group border-b border-border/40 last:border-0 transition-colors hover:bg-muted/25 ${isPinned ? "bg-amber-500/5" : ""}`}>
      {/* Score */}
      <td className="px-3 py-2.5 text-center w-12">
        {score != null
          ? <ScoreRing score={score} />
          : <span className="text-xs text-muted-foreground">—</span>
        }
      </td>

      {/* Car */}
      <td className="px-3 py-2.5 min-w-[160px] max-w-[260px]">
        <Link
          href={`/listings/${l.id}`}
          className="font-medium text-sm text-foreground hover:underline line-clamp-1 block"
        >
          {s?.variantClassification || l.title}
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground/70 flex-wrap">
          {l.firstRegistrationYear && <span>{l.firstRegistrationYear}</span>}
          {l.mileageKm && <span>{formatMileage(l.mileageKm)}</span>}
          {l.power && <span>{l.power}</span>}
          <span>{flag} {countryCode}</span>
        </div>
        {s?.aiExplanation && s.aiExplanation !== 'AI analysis pending' && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1 italic">{s.aiExplanation}</p>
        )}
      </td>

      {/* Asking price */}
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <span className="tabular-nums font-semibold text-sm">
          {l.priceEur ? formatPrice(l.priceEur, "EUR") : "—"}
        </span>
        {l.vatDeductible && (
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">+VAT</div>
        )}
      </td>

      {/* Landed CHF */}
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <span className="tabular-nums text-sm">
          {landed ? formatPrice(landed, "CHF") : "—"}
        </span>
      </td>

      {/* Flags */}
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          {l.hasAccidentDamage && (
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 rounded px-1">
              <AlertTriangle className="h-3 w-3 inline" />
            </span>
          )}
          {(s?.redFlags?.length ?? 0) > 0 && (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5">
              {s!.redFlags!.length}⚑
            </span>
          )}
          {!l.hasAccidentDamage && !(s?.redFlags?.length) && (
            <span className="text-muted-foreground/25 text-xs">—</span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-2 py-2.5 w-16">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onTogglePin}
            className={`p-1 rounded transition-colors ${isPinned ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/40 hover:text-amber-500"}`}
            title={isPinned ? "Anheftung entfernen" : "Anheften"}
          >
            <Pin className="h-3.5 w-3.5" fill={isPinned ? "currentColor" : "none"} />
          </button>
          <a
            href={l.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </td>
    </tr>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  onEdit,
  onDelete,
  onSearch,
  onTogglePin,
}: {
  deal: Deal;
  onEdit: () => void;
  onDelete: () => void;
  onSearch: () => void;
  onTogglePin: (dealId: number, listingId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DealResult[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  async function triggerSearch(forceRefresh = false) {
    setSearching(true);
    setExpanded(true);
    try {
      const res = await fetch("/api/deals/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal.id, forceRefresh }),
      });
      const data = await res.json();
      if (res.ok) {
        const parts = [`${data.topResults} Treffer`];
        if (data.scraped > 0) parts.push(`${data.scraped} neue Inserate`);
        if (data.aiScored > 0) parts.push(`${data.aiScored} KI-bewertet`);
        toast.success(parts.join(' · '));
        onSearch();
        fetchResults();
      } else {
        toast.error("Suche fehlgeschlagen: " + (data.error || "Unbekannter Fehler"));
      }
    } catch {
      toast.error("Suche fehlgeschlagen");
    } finally {
      setSearching(false);
    }
  }

  async function fetchResults() {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/deals?id=${deal.id}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingResults(false);
    }
  }

  function handleExpand() {
    if (!expanded) {
      setExpanded(true);
      if (results === null) fetchResults();
    } else {
      setExpanded(false);
    }
  }

  async function copyShareLink() {
    if (!deal.shareId) return;
    const url = `${window.location.origin}/share/${deal.shareId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link kopiert!");
  }

  const pinnedIds = deal.pinnedListingIds ?? [];

  const sortedResults = results
    ? [...results].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.listing.id) ? 1 : 0;
        const bPinned = pinnedIds.includes(b.listing.id) ? 1 : 0;
        if (bPinned !== aPinned) return bPinned - aPinned;
        const aScore = a.score?.combinedScore ?? a.dealListing.combinedScore ?? 0;
        const bScore = b.score?.combinedScore ?? b.dealListing.combinedScore ?? 0;
        return bScore - aScore;
      })
    : null;

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{deal.name}</h3>
              <Badge variant="outline" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                {formatPrice(deal.budgetChf, "CHF")} Budget
              </Badge>
              {deal.vatOnly && (
                <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-0.5">
                  <ShieldCheck className="h-3 w-3" />MwSt. ausweisbar
                </Badge>
              )}
              {deal.noAccident && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-border/50 gap-0.5">
                  Kein Unfall
                </Badge>
              )}
            </div>

            {/* Brand/model tags */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {deal.brands.map((b) => (
                <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
              ))}
              {deal.models.map((m) => (
                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
              ))}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
              {deal.yearMin && deal.yearMax && <span>{deal.yearMin}–{deal.yearMax}</span>}
              {deal.yearMin && !deal.yearMax && <span>ab {deal.yearMin}</span>}
              {deal.mileageMax && <span>max. {(deal.mileageMax / 1000).toFixed(0)}k km</span>}
              {deal.lastSearchAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Zuletzt {timeAgo(deal.lastSearchAt)}
                  {deal.lastResultCount != null && ` · ${deal.lastResultCount} Treffer`}
                </span>
              )}
              {!deal.lastSearchAt && <span className="italic text-muted-foreground/50">Noch nicht gesucht</span>}
            </div>

            {deal.notes && (
              <p className="mt-1.5 text-xs text-muted-foreground/70 italic">{deal.notes}</p>
            )}

            {/* Share link */}
            {deal.shareId && (
              <button
                onClick={copyShareLink}
                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="h-3 w-3" />
                <span className="underline underline-offset-2">/share/{deal.shareId}</span>
              </button>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              onClick={() => triggerSearch(false)}
              disabled={searching}
              className="gap-1.5 h-8 px-3"
            >
              {searching
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Search className="h-3.5 w-3.5" />
              }
              {searching ? "Suche läuft…" : "Suchen"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => triggerSearch(true)}
              disabled={searching}
              className="h-8 w-8 p-0"
              title="Neu von mobile.de laden"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExpand} title={expanded ? "Einklappen" : "Ergebnisse anzeigen"}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Archivieren">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Results panel */}
      {expanded && (
        <div className="border-t">
          {loadingResults ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ergebnisse laden…
            </div>
          ) : !sortedResults || sortedResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {deal.lastSearchAt ? "Keine Treffer im Budget." : "Auf «Suchen» klicken, um Deals zu finden."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="h-8 px-3 text-xs font-medium text-muted-foreground text-center">Score</th>
                    <th className="h-8 px-3 text-xs font-medium text-muted-foreground text-left">Fahrzeug</th>
                    <th className="h-8 px-3 text-xs font-medium text-muted-foreground text-right whitespace-nowrap">Preis</th>
                    <th className="h-8 px-3 text-xs font-medium text-muted-foreground text-right whitespace-nowrap">Landed CHF</th>
                    <th className="h-8 px-3 text-xs font-medium text-muted-foreground text-center">Hinweise</th>
                    <th className="h-8 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((result) => (
                    <ResultRow
                      key={result.listing.id}
                      result={result}
                      isPinned={pinnedIds.includes(result.listing.id)}
                      onTogglePin={() => onTogglePin(deal.id, result.listing.id)}
                    />
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/10">
                {sortedResults.length} Inserate · Budget CHF {(deal.budgetChf / 1000).toFixed(0)}k
                {pinnedIds.length > 0 && ` · ${pinnedIds.length} angeheftet`}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/deals");
      if (res.ok) setDeals(await res.json());
    } catch {
      toast.error("Deals konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  async function handleSave(data: DealFormData) {
    const isUpdate = !!data.id;
    const res = await fetch("/api/deals", {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(isUpdate ? "Deal aktualisiert" : "Deal erstellt");
      setDialogOpen(false);
      setEditingDeal(null);
      fetchDeals();
    } else {
      toast.error("Deal konnte nicht gespeichert werden");
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/deals?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deal archiviert");
      fetchDeals();
    } else {
      toast.error("Deal konnte nicht archiviert werden");
    }
  }

  async function handleTogglePin(dealId: number, listingId: number) {
    const res = await fetch("/api/deals/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, listingId }),
    });
    if (res.ok) {
      const { pinnedListingIds } = await res.json();
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, pinnedListingIds } : d)),
      );
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground mt-1">
            Budget und Zielmarken festlegen — die besten Inserate im Importbudget finden.
          </p>
        </div>
        <Button onClick={() => { setEditingDeal(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Deal
        </Button>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditingDeal(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDeal ? "Deal bearbeiten" : "Neuer Deal"}</DialogTitle>
          </DialogHeader>
          <DealForm
            initial={editingDeal ?? undefined}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditingDeal(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Deals list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <TrendingUp className="h-12 w-12 text-muted-foreground/20" />
            <div>
              <p className="font-medium">Noch keine Deals</p>
              <p className="text-sm text-muted-foreground mt-1">
                Erstelle einen Deal, um die besten Inserate im Budget zu finden.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Ersten Deal erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onEdit={() => { setEditingDeal(deal); setDialogOpen(true); }}
              onDelete={() => handleDelete(deal.id)}
              onSearch={fetchDeals}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
