export function formatPrice(amount: number, currency: "EUR" | "CHF"): string {
  const symbol = currency === "EUR" ? "\u20AC" : "CHF";
  const formatted = new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  const prefix = amount < 0 ? "-" : "";

  if (currency === "CHF") {
    return `${prefix}${symbol} ${formatted}`;
  }
  return `${prefix}${symbol}${formatted}`;
}

export function formatMileage(km: number): string {
  return `${new Intl.NumberFormat("de-CH").format(km)} km`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("de-CH").format(n);
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return then.toLocaleDateString("de-CH");
}
