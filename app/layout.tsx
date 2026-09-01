import type { Metadata, Viewport } from "next";
import { Nunito, Baloo_2 } from "next/font/google";
import { BRAND } from "@/lib/constants";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND.name} · ${BRAND.tagline}`,
  description: `App de gestión para ${BRAND.name}, pastelería artesanal.`,
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FDF2F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${nunito.variable} ${baloo.variable}`}>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
