import { cn } from "@/lib/utils";

type Tone = "sarah" | "tin" | "gold" | "success" | "danger" | "warning" | "neutral";

const tones: Record<Tone, string> = {
  sarah: "bg-sarah-50 text-sarah-dark",
  tin: "bg-tin-50 text-tin-dark",
  gold: "bg-[#FBF1DA] text-gold-dark",
  success: "bg-[#EAF4EB] text-success",
  danger: "bg-[#FBEDED] text-danger",
  warning: "bg-[#FBF1DA] text-warning",
  neutral: "bg-peach-light text-cocoa-light",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
