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
          DEFAULT: "#1e3c72",
          light: "#2a5298",
        },
        kp: {
          primary: "#0d6efd",
          success: "#198754",
          warning: "#ffc107",
          danger: "#dc3545",
          info: "#0dcaf0",
          secondary: "#6c757d",
          dark: "#212529",
          purple: "#667eea",
          purple2: "#764ba2",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        "purple-gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
