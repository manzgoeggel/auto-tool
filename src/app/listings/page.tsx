"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreBadge } from "@/components/score-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatMileage, timeAgo } from "@/lib/format";

interface ListingRow {
  listings: {
    id: number;
    title: string;
    priceEur: number | null;
    mileageKm: number | null;
    firstRegistrationYear: number | null;
    fuelType: string | null;
    transmission: string | null;
    sellerType: string | null;
    location: string | null;
    listingUrl: string;
    vatDeductible: boolean | null;
    firstSeenAt: string | null;
  };
  score: {
    combinedScore: number | null;
    estimatedMarginMinChf: number | null;
    estimatedMarginMaxChf: number | null;
    totalLandedCostChf: number | null;
  } | null;
}

export default function ListingsPage() {
  const [data, setData] = useState<{
    listings: ListingRow[];
    total: number;
    page: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("combined_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [brand, setBrand] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        sortBy,
        sortOrder,
      });
      if (brand) params.set("brand", brand);
      if (maxPrice) params.set("maxPrice", maxPrice);

      const res = await fetch(`/api/listings?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, brand, maxPrice]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Listings</h1>
        <p className="text-muted-foreground mt-1">
          Browse and filter all scraped listings.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Brand</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={brand}
                  onChange={(e) => { setBrand(e.target.value); setPage(1); }}
                  placeholder="Filter by brand..."
                  className="pl-9 w-48"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max Price</label>
              <Input
                type="number"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                placeholder="e.g. 30000"
                className="w-36"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sort by</label>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combined_score">Deal Score</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="mileage">Mileage</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                  <SelectItem value="first_seen">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Order</label>
              <Select value={sortOrder} onValueChange={(v: "asc" | "desc") => { setSortOrder(v); setPage(1); }}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Score</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Mileage</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Est. Margin</TableHead>
                <TableHead>Seen</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data || data.listings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    No listings found. Run the scraper from Settings to populate data.
                  </TableCell>
                </TableRow>
              ) : (
                data.listings.map((row) => {
                  const l = row.listings;
                  const s = row.score;
                  return (
                    <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        {s?.combinedScore != null ? (
                          <ScoreBadge score={s.combinedScore} size="sm" />
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/listings/${l.id}`} className="font-medium hover:underline line-clamp-1">
                          {l.title}
                        </Link>
                        <div className="flex gap-1 mt-0.5">
                          {l.vatDeductible && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">VAT</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {l.priceEur ? formatPrice(l.priceEur, "EUR") : "N/A"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {l.mileageKm != null ? formatMileage(l.mileageKm) : "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">{l.firstRegistrationYear || "N/A"}</TableCell>
                      <TableCell className="text-sm">{l.fuelType || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={l.sellerType === "private" ? "default" : "secondary"} className="text-xs">
                          {l.sellerType || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {s?.estimatedMarginMinChf != null ? (
                          <span className={s.estimatedMarginMinChf > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400"}>
                            {formatPrice(s.estimatedMarginMinChf, "CHF")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.firstSeenAt ? timeAgo(l.firstSeenAt) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <a href={l.listingUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(data.page - 1) * 25 + 1}-{Math.min(data.page * 25, data.total)} of {data.total}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
