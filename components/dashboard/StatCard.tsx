import { type LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "sarah" | "tin" | "gold" | "cocoa" | "success" | "danger";

const toneStyles: Record<Tone, { chip: string; icon: string }> = {
  sarah: { chip: "bg-sarah-50 text-sarah-dark", icon: "text-sarah-dark" },
  tin: { chip: "bg-tin-50 text-tin-dark", icon: "text-tin-dark" },
  gold: { chip: "bg-[#FBF1DA] text-gold-dark", icon: "text-gold-dark" },
  cocoa: { chip: "bg-peach-light text-cocoa", icon: "text-cocoa" },
  success: { chip: "bg-[#EAF4EB] text-success", icon: "text-success" },
  danger: { chip: "bg-[#FBEDED] text-danger", icon: "text-danger" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "sarah",
  trend,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: { value: string; direction: "up" | "down"; positive?: boolean };
  hint?: string;
}) {
  const styles = toneStyles[tone];
  return (
    <div className="group rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift animate-fade-up sm:p-5">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            styles.chip
          )}
        >
          <Icon className={cn("h-5 w-5", styles.icon)} />
        </div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              trend.positive ?? trend.direction === "up"
                ? "bg-[#EAF4EB] text-success"
                : "bg-[#FBEDED] text-danger"
            )}
          >
            {trend.direction === "up" ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-cocoa-light">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-extrabold text-cocoa">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-cocoa-soft">{hint}</p>}
    </div>
  );
}
