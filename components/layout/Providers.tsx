"use client";

import { ToastProvider } from "@/components/ui/toast";
import { DataBootstrap } from "@/components/data/DataBootstrap";
import { SaleFlowProvider } from "@/components/features/sales/SaleFlow";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DataBootstrap />
      <SaleFlowProvider>{children}</SaleFlowProvider>
    </ToastProvider>
  );
}
