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
