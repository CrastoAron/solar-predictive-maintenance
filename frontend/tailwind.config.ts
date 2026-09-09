import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          orange: "#f97316",
          "orange-light": "#fb923c",
          "orange-dark": "#ea6c0a",
        },
        // Dark theme palette (from screenshots - deep black)
        dark: {
          bg: "#0d0d14",
          surface: "#12121c",
          card: "#161622",
          border: "#1e1e2e",
          hover: "#1c1c2e",
        },
        // Light theme palette (from screenshots - clean white)
        light: {
          bg: "#f8f9fc",
          surface: "#ffffff",
          card: "#ffffff",
          border: "#e5e7eb",
          hover: "#f3f4f6",
        },
        // Status colors (from screenshots)
        status: {
          healthy: "#22c55e",
          warning: "#f97316",
          critical: "#ef4444",
          info: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "card-dark": "0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px 0 rgba(0,0,0,0.3)",
        "card-light": "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.04)",
        "orange-glow": "0 0 20px rgba(249,115,22,0.25)",
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
