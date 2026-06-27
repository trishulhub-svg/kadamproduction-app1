import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7c3aed",
          light: "#a78bfa",
          dark: "#6d28d9",
        },
        kp: {
          primary: "#7c3aed",
          success: "#059669",
          warning: "#d97706",
          danger: "#dc2626",
          info: "#0891b2",
          secondary: "#64748b",
          dark: "#0f172a",
          purple: "#7c3aed",
          purple2: "#6d28d9",
          accent: "#7c3aed",
          "accent-light": "rgba(124, 58, 237, 0.1)",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #8b5cf6 100%)",
        "purple-gradient": "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
