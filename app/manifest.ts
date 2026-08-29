import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sarah & Tin · Pastelería artesanal",
    short_name: "Sarah & Tin",
    description:
      "App de gestión para la pastelería artesanal Sarah & Tin: ventas, productos, recetas, costos, caja, clientes y pedidos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF3E8",
    theme_color: "#FBF3E8",
    lang: "es-CL",
    categories: ["business", "productivity", "food"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
