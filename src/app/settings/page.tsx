"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Play, Trash2, ToggleLeft, ToggleRight, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchConfigForm } from "@/components/search-config-form";
import { toast } from "sonner";

interface Config {
  id: number;
  name: string;
  brands: string[];
  models: string[];
  yearMin: number | null;
  yearMax: number | null;
  mileageMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  fuelTypes: string[];
  transmissions: string[];
  minExpectedMarginChf: number | null;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Config | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      }
    } catch {
      toast.error("Failed to load configurations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const isUpdate = !!data.id;
    const res = await fetch("/api/config", {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success(isUpdate ? "Configuration updated" : "Configuration created");
      setDialogOpen(false);
      setEditingConfig(null);
      fetchConfigs();
    } else {
      toast.error("Failed to save configuration");
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/config?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Configuration deleted");
      fetchConfigs();
    } else {
      toast.error("Failed to delete");
    }
  };

  const handleToggle = async (config: Config) => {
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, isActive: !config.isActive }),
    });
    fetchConfigs();
  };

  const handleScrape = async (configId?: number) => {
    setScraping(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configId ? { configId } : {}),
      });
      const data = await res.json();
      if (res.ok) {
        const totalFound = data.results?.reduce(
          (sum: number, r: { totalFound?: number }) => sum + (r.totalFound || 0),
          0,
        );
        toast.success(`Scrape complete: ${totalFound} listings found`);
      } else {
        toast.error("Scrape failed: " + (data.error || "Unknown error"));
      }
    } catch {
      toast.error("Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch("/api/enrich", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Enriched ${data.enriched}/${data.total} listings with detail page data`);
      } else {
        toast.error("Enrichment failed");
      }
    } catch {
      toast.error("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  const handleScore = async () => {
    setScoring(true);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Scoring complete: ${data.scored} listings scored`);
      } else {
        toast.error("Scoring failed");
      }
    } catch {
      toast.error("Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage search configurations and trigger scraping runs.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditingConfig(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Config
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? "Edit Configuration" : "New Search Configuration"}
              </DialogTitle>
            </DialogHeader>
            <SearchConfigForm
              initialData={
                editingConfig
                  ? {
                      id: editingConfig.id,
                      name: editingConfig.name,
                      brands: editingConfig.brands || [],
                      models: editingConfig.models || [],
                      yearMin: editingConfig.yearMin,
                      yearMax: editingConfig.yearMax,
                      mileageMax: editingConfig.mileageMax,
                      priceMin: editingConfig.priceMin,
                      priceMax: editingConfig.priceMax,
                      fuelTypes: editingConfig.fuelTypes || [],
                      transmissions: editingConfig.transmissions || [],
                      minExpectedMarginChf: editingConfig.minExpectedMarginChf,
                    }
                  : undefined
              }
              onSubmit={handleSubmit}
              onCancel={() => {
                setDialogOpen(false);
                setEditingConfig(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleScrape()}
            disabled={scraping || configs.filter((c) => c.isActive).length === 0}
          >
            {scraping ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {scraping ? "Scraping..." : "Run Scraper (All Configs)"}
          </Button>
          <Button variant="outline" onClick={handleEnrich} disabled={enriching}>
            {enriching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {enriching ? "Enriching..." : "Enrich Listings (VAT + Details)"}
          </Button>
          <Button variant="outline" onClick={handleScore} disabled={scoring}>
            {scoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scoring ? "Scoring..." : "Score Unscored Listings"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Search Configurations</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-24" />
              </Card>
            ))}
          </div>
        ) : configs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                No configurations yet. Create one to start scanning for deals.
              </p>
            </CardContent>
          </Card>
        ) : (
          configs.map((config) => (
            <Card key={config.id} className={!config.isActive ? "opacity-60" : undefined}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{config.name}</h3>
                      <Badge variant={config.isActive ? "default" : "secondary"}>
                        {config.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(config.brands || []).map((b) => (
                        <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                      ))}
                      {(config.models || []).map((m) => (
                        <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {config.yearMin && config.yearMax && (
                        <span>{config.yearMin} - {config.yearMax}</span>
                      )}
                      {config.mileageMax && (
                        <span>max {(config.mileageMax / 1000).toFixed(0)}k km</span>
                      )}
                      {config.priceMin != null && config.priceMax != null && (
                        <span>
                          {"\u20AC"}{(config.priceMin / 1000).toFixed(0)}k - {"\u20AC"}{(config.priceMax / 1000).toFixed(0)}k
                        </span>
                      )}
                      {(config.fuelTypes || []).length > 0 && (
                        <span>{config.fuelTypes.join(", ")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleScrape(config.id)} disabled={scraping} title="Run scraper">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggle(config)} title={config.isActive ? "Deactivate" : "Activate"}>
                      {config.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingConfig(config); setDialogOpen(true); }} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(config.id)} title="Delete" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
