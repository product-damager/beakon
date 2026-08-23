import type { Config } from "tailwindcss";

/**
 * Product Design tokens.
 * ShadCN/Tailwind defaults are the numerical source of truth (spacing, radius scale,
 * component sizing). Product overrides only COLORS and FONTS.
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
        // Product primitive palette (from brand-tokens.ts)
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
          // beige-50 is also the correct token for label text on the
          // `green-90` dark sidebar (RoadmapNav.tsx tier 2/3 labels, Sprint
          // Heron Week 3c / QA-REPORT-HERON-W3.md finding #3) — 6.59:1 there,
          // vs. beige-70's 2.44:1 on that same background. See the note below
          // beige-70's own figures: those are computed against white, not
          // this app's dark sidebar surface.
          50: "#b8b8a8", 60: "#8c8c73",
          // Added Sprint Heron Week 1 (docs/design/app-shell-and-settings.md
          // finding 1b) — beige-60 measures ~2.98:1 on white, failing WCAG AA
          // (4.5:1). beige-70 measures ~5.4:1 on white — verified via the
          // WCAG relative-luminance formula, not eyeballed. Scoped fix: only
          // repoints the four named real-copy call sites the brief listed
          // (SettingsDialog, AppShell sidebar subtitle, Archived, Toaster) —
          // every other beige-60 usage (102 call sites) is untouched.
          // IMPORTANT (Sprint Heron Week 3c, finding #3): the figures above
          // are computed against WHITE only. On the sidebar's actual
          // `bg-green-90` (#1d342f) background, beige-70 measures a
          // failing 2.44:1 — worse than beige-60 there (3.86:1), and worse
          // than beige-70 itself on white. Don't reapply this white-
          // background number to dark-surface label text; use beige-50
          // (6.59:1 on green-90) for that instead, as RoadmapNav.tsx now does.
          70: "#6b6b58",
        },
        blue: {
          5: "#f5f6ff", 10: "#f0f2ff", 20: "#e5e9ff", 30: "#d1d8ff", 40: "#b3beff",
          50: "#8d92fc", 60: "#7077f6", 70: "#454892", 80: "#2c2e5e",
        },
        pink: { 30: "#eacef8", 60: "#b46ed6" },
        orange: { 30: "#f2d4c4", 60: "#c96a3e", 70: "#804739" },
        red: { 5: "#fdf3f4", 30: "#f7cfd2", 60: "#af464e", 70: "#7c2f35" },
        // Added for Health's "Delayed" value (docs/plans/okr-filters-archive-
        // parity-and-delayed-health.md item 6 / docs/design/okr-filters-
        // archive-parity-and-delayed-health.md §4) — sits between green and
        // orange, distinct from every hue Governance (OKR_GOVERNANCE_META)
        // and the rest of Health already claim. Verified via the same WCAG
        // relative-luminance method as beige-70's comment above, not
        // eyeballed: amber-70 (#92400e) on white = 7.09:1, amber-70 on
        // amber-30 (#fef3c7) = 6.37:1 — both pass AA (4.5:1) comfortably,
        // clearing the same bar HEALTH_META's tag rendering holds every
        // other status color to.
        amber: { 30: "#fef3c7", 60: "#d97706", 70: "#92400e" },
        // Added Sprint Vireo, Initiative 2 (docs/plans/vireo-grouped-okr-
        // view-and-drawer-detail-rework.md) — OKR_GOVERNANCE_META's
        // `being_reviewed` collided with HEALTH_META.at_risk (both were
        // bg-orange-30/text-orange-70, two unrelated domains sharing one
        // hue). `indigo` was floated first but rejected: blue-60 (#7077f6)
        // already leans purple, so a separate "indigo" token would just
        // read as a shade of `blue`. `violet` is a genuinely distinct hue
        // from every family Governance/Health already claim. Verified via
        // the same WCAG relative-luminance method as amber-70's comment
        // above, not eyeballed: violet-70 (#5c3785) on violet-30 (#e8dcf7)
        // = 6.84:1, violet-70 on white = 8.97:1 — both clear AA (4.5:1)
        // comfortably.
        violet: { 30: "#e8dcf7", 60: "#7c4fb0", 70: "#5c3785" },
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
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulse: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.25s cubic-bezier(0.22,1,0.36,1)",
        "slide-up": "slide-up 0.2s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
