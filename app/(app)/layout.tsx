import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Topbar } from "@/components/layout/Topbar";
import { Providers } from "@/components/layout/Providers";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="min-h-dvh">
        <Sidebar />
        <div className="lg:pl-64">
          <Topbar />
          <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6 lg:pb-10 lg:pt-8">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </Providers>
  );
}
