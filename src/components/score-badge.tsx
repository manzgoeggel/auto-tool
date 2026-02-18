import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  if (score >= 60) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  if (score >= 40) return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
  return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Low";
}

export function ScoreBadge({ score, size = "md", showLabel = false }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex items-center justify-center rounded-full border font-bold",
          getScoreColor(score),
          sizeClasses[size]
        )}
      >
        {Math.round(score)}
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium", getScoreColor(score).split(" ").slice(1, 3).join(" "))}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}
