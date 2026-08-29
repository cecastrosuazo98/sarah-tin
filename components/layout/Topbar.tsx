import { Logo } from "@/components/brand/Logo";

/** Barra superior visible solo en móvil (en escritorio manda el sidebar). */
export function Topbar() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-peach/60 bg-cream-50/90 px-4 pb-3 backdrop-blur-md lg:hidden">
      <Logo size={44} showTagline={false} />
    </header>
  );
}
