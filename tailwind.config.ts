import type { Config } from "tailwindcss";

/**
 * Kameleoon Product Design tokens.
 * ShadCN/Tailwind defaults are the numerical source of truth (spacing, radius scale,
 * component sizing). Kameleoon overrides only COLORS and FONTS.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Kameleoon primitive palette (from brand-tokens.ts)
        green: {
          5: "#f1f9f7", 10: "#e7f4f1", 20: "#d2eae5", 30: "#b6ddd5", 40: "#97cec2",
          50: "#54a08f", 60: "#348372", 70: "#2c5d52", 80: "#1c3b34", 90: "#1d342f",
        },
        lime: {
          5: "#f8fced", 10: "#f1f9dc", 20: "#ebf7cc", 30: "#e5f5b5", 40: "#dae995",
          50: "#adbc6c", 60: "#8a9556", 70: "#555e2c",
        },
        beige: {
          5: "#f8f8f7", 10: "#f4f4f1", 20: "#efefeb", 30: "#e6e6e0", 40: "#d6d6cd",
          50: "#b8b8a8", 60: "#8c8c73",
        },
        blue: {
          5: "#f5f6ff", 10: "#f0f2ff", 20: "#e5e9ff", 30: "#d1d8ff", 40: "#b3beff",
          50: "#8d92fc", 60: "#7077f6", 70: "#454892", 80: "#2c2e5e",
        },
        pink: { 30: "#eacef8", 60: "#b46ed6" },
        orange: { 30: "#f2d4c4", 60: "#c96a3e", 70: "#804739" },
        red: { 5: "#fdf3f4", 30: "#f7cfd2", 60: "#af464e", 70: "#7c2f35" },
        // ShadCN-compatible semantic tokens (driven by CSS variables in globals.css)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-noto-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        pulse: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.25s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
