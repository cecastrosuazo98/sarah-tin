import type { Config } from "tailwindcss";

/**
 * Paleta Sarah & Tin — derivada del logo oficial.
 * Crema de fondo, durazno en superficies, rosa (Sarah) y celeste (Tin)
 * como acentos, dorado para detalles especiales y café cálido para texto.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        // Superficies (fondo blush claro, derivado del coral del logo)
        cream: {
          DEFAULT: "#FDF2F0",
          50: "#FFF9F8",
          100: "#FDF2F0",
          200: "#FAE6E3",
        },
        peach: {
          DEFAULT: "#F8DAD7",
          light: "#FCEAE8",
          dark: "#EEC4C0",
        },
        // Marca — rosa frambuesa (Sarah) del texto del logo
        sarah: {
          DEFAULT: "#D24D77",
          light: "#EDA6C1",
          dark: "#B0355E",
          50: "#FBEDF2",
        },
        // Tin — azul grisáceo suave (peto de Tin)
        tin: {
          DEFAULT: "#8FA7B8",
          light: "#C4D3DC",
          dark: "#6E8898",
          50: "#EFF4F7",
        },
        gold: {
          DEFAULT: "#C9A24B",
          light: "#DEBE7C",
          dark: "#A9863A",
        },
        cocoa: {
          DEFAULT: "#5A3E2B",
          light: "#8A6A50",
          soft: "#B79C86",
        },
        // Estados semánticos
        success: "#6FAE7F",
        warning: "#E0A250",
        danger: "#DB5A5A",
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        display: ["var(--font-baloo)", "var(--font-nunito)", "cursive"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        soft: "0 4px 20px -8px rgba(90, 62, 43, 0.18)",
        card: "0 2px 14px -6px rgba(90, 62, 43, 0.15)",
        lift: "0 10px 30px -10px rgba(90, 62, 43, 0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
