import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import { Brandmark } from "./Brandmark";

/** Logo horizontal: emblema + wordmark "Sarah & Tin". */
export function Logo({
  size = 44,
  showTagline = true,
  className,
}: {
  size?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Brandmark size={size} />
      <div className="leading-tight">
        <p className="font-display text-xl font-extrabold tracking-tight">
          <span className="text-sarah-dark">Sarah</span>
          <span className="text-gold"> & </span>
          <span className="text-tin-dark">Tin</span>
        </p>
        {showTagline && (
          <p className="text-xs font-medium text-cocoa-light">{BRAND.tagline}</p>
        )}
      </div>
    </div>
  );
}
