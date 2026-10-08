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
          DEFAULT: "rgba(242, 239, 232, 0.08)",
          light: "rgba(242, 239, 232, 0.14)",
          strong: "rgba(242, 239, 232, 0.22)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--foreground)",
          border: "rgba(242, 239, 232, 0.06)",
        },
        surface: {
          50: "#0b0b0d",
          100: "var(--surface-1)",
          200: "var(--surface-2)",
          300: "var(--surface-3)",
          DEFAULT: "var(--surface-1)",
          border: "rgba(242, 239, 232, 0.08)",
          borderLight: "rgba(242, 239, 232, 0.14)",
        },
        brand: {
          50: "#f8f2e2",
          100: "#eee0bd",
          200: "#e6d19b",
          300: "#dec477",
          400: "#d7b558",
          500: "#d7b558",
          600: "#bb983e",
          700: "#94752e",
          DEFAULT: "#d7b558",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        heading: ["var(--font-heading)", "Montserrat", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "7px",
        DEFAULT: "10px",
        md: "12px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
      },
    },
  },
  plugins: [],
};

export default config;
