import type { Config } from "tailwindcss"
import path from "path"

const config: Config = {
  content: [
    path.join(__dirname, "pages/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "components/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "app/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "contexts/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        brand: { DEFAULT: "#185FA5", dark: "#145290", light: "#EBF2FA" },
        // Sivar-inspired palette
        "ca-yellow": { DEFAULT: "#FFC400", hover: "#E5AF00", light: "#FFF7CC", dark: "#CC9D00" },
        "ca-blue":   { DEFAULT: "#1B3A8C", hover: "#152D70", light: "#E8EDFA", dark: "#0F2255" },
        // Refined Navy handoff (design_handoff_citizen_agent_refined_navy) —
        // calm status + neutral-surface tokens shared across Dashboard/My
        // Plan/Chat/Profile, so later pages reuse these instead of each
        // re-deriving their own greys.
        "ca-ink":     "#1B2440", // text on ca-yellow surfaces (avatar initial, Preview button)
        "ca-success": { DEFAULT: "#326B4D", light: "#E7F1EB", border: "#D2E5D8" },
        "ca-warn":    { DEFAULT: "#8E6627", light: "#F6EFD9", border: "#E7DCB8" },
        "ca-danger":  { DEFAULT: "#BC3A3A", light: "#FDECEC" },
        "ca-surface": { canvas: "#F8FAFC", border: "#E6EAF0", hairline: "#EEF1F6", input: "#E2E8F0" },
        "ca-track":   "#EEF2F7", // progress-bar background track (distinct from ca-surface tones)
        "ca-text":    { secondary: "#64748B", tertiary: "#94A3B8" },
        // Chat's neutral context-pill treatment — a distinct, slightly
        // darker-text tone from ca-surface/ca-text (used nowhere else yet).
        "ca-pill":    { DEFAULT: "#F1F4F8", border: "#E5EAF1", text: "#475569" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "DM Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}

export default config
