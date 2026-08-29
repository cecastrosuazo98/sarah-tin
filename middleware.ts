import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todo excepto archivos que deben servirse sin autenticación:
     * - _next/static, _next/image
     * - favicon, sw.js, manifest y assets de la PWA (icons/*)
     * - imágenes, fuentes y otros estáticos por extensión
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|txt|xml|webmanifest|woff|woff2|ttf)$).*)",
  ],
};
