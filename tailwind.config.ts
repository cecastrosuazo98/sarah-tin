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
        // Superficies
        cream: {
          DEFAULT: "#FBF3E8",
          50: "#FFFDF8",
          100: "#FBF3E8",
          200: "#F5E8D5",
        },
        peach: {
          DEFAULT: "#F7E0C3",
          light: "#FBEBD7",
          dark: "#EFCFA6",
        },
        // Marca
        sarah: {
          DEFAULT: "#E79FBE",
          light: "#F4C9DA",
          dark: "#D97DA6",
          50: "#FCEFF4",
        },
        tin: {
          DEFAULT: "#A9D4DE",
          light: "#CFE7ED",
          dark: "#7FB9C7",
          50: "#EAF5F7",
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
        // Estados semánticos suaves
        success: "#7BAE7F",
        warning: "#E0A250",
        danger: "#D98C8C",
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
