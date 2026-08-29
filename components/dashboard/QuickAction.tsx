import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "sarah" | "tin" | "gold" | "cocoa";

const toneStyles: Record<Tone, string> = {
  sarah: "bg-sarah-50 text-sarah-dark group-hover:bg-sarah group-hover:text-white",
  tin: "bg-tin-50 text-tin-dark group-hover:bg-tin group-hover:text-cocoa",
  gold: "bg-[#FBF1DA] text-gold-dark group-hover:bg-gold group-hover:text-white",
  cocoa: "bg-peach-light text-cocoa group-hover:bg-cocoa group-hover:text-white",
};

/** Botón grande de acción rápida. Puede ser enlace o botón. */
export function QuickAction({
  label,
  icon: Icon,
  tone = "sarah",
  href,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200",
          toneStyles[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-cocoa">{label}</span>
    </>
  );

  const base =
    "group flex w-full items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-3 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]";

  if (href) {
    return (
      <Link href={href} className={base}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {content}
    </button>
  );
}
