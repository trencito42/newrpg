import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.07)",
          light: "rgba(255, 255, 255, 0.12)",
          strong: "rgba(255, 255, 255, 0.18)",
        },
        muted: {
          DEFAULT: "#151516",
          foreground: "#8a8a90",
        },
        accent: {
          DEFAULT: "#e5e5e7",
          foreground: "#0b0b0c",
        },
        card: {
          DEFAULT: "#151516",
          foreground: "#f1f1f1",
          border: "rgba(255, 255, 255, 0.07)",
        },
        surface: {
          50: "#111112",
          100: "#151516",
          200: "#1a1a1c",
          300: "#222225",
          DEFAULT: "#151516",
          border: "rgba(255, 255, 255, 0.07)",
          borderLight: "rgba(255, 255, 255, 0.12)",
        },
        brand: {
          50: "#f5f5f5",
          100: "#e5e5e5",
          200: "#cccccc",
          300: "#b3b3b3",
          400: "#999999",
          500: "#e5e5e7",
          600: "#cccccc",
          700: "#999999",
          DEFAULT: "#e5e5e7",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "10px",
        "2xl": "12px",
      },
    },
  },
  plugins: [],
};

export default config;
