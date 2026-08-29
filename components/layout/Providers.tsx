"use client";

import { ToastProvider } from "@/components/ui/toast";
import { DataBootstrap } from "@/components/data/DataBootstrap";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DataBootstrap />
      {children}
    </ToastProvider>
  );
}
