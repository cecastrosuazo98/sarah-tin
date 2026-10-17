import { Logo } from "@/components/brand/Logo";
import { SyncIndicator } from "@/components/layout/SyncIndicator";

/** Barra superior visible solo en móvil (en escritorio manda el sidebar). */
export function Topbar() {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-peach/60 bg-cream-50/90 px-4 pb-3 backdrop-blur-md lg:hidden">
      <Logo size={44} showTagline={false} />
      <SyncIndicator compact />
    </header>
  );
}
