import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        biz: {
          bg: "#F7F7FB",
          surface: "#FFFFFF",
          ink: "#111827",
          muted: "#6B7280",
          line: "#E5E7EB",
          sand: "#FFF0DB",
          cream: "#FFF8EE",

          orange: "#FF4D00",
          "orange-hover": "#E64500",
          "orange-light": "#FFF4ED",
          orange2: "#FF6A00",
        },
      },
      fontSize: {
        "h1": ["1.75rem", { lineHeight: "2.125rem", fontWeight: "800", letterSpacing: "-0.02em" }],
        "h2": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "700", letterSpacing: "-0.01em" }],
        "h3": ["1rem", { lineHeight: "1.5rem", fontWeight: "700" }],
        "body": ["0.875rem", { lineHeight: "1.375rem", fontWeight: "400" }],
        "body-medium": ["0.875rem", { lineHeight: "1.375rem", fontWeight: "500" }],
        "caption": ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "500" }],
        "micro": ["0.6875rem", { lineHeight: "1rem", fontWeight: "600", letterSpacing: "0.02em" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      boxShadow: {
        "soft": "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card": "0 2px 8px rgba(0,0,0,0.06)",
        "float": "0 8px 24px rgba(0,0,0,0.10)",
        "glow-orange": "0 0 20px rgba(255,77,0,0.15)",
      },
      borderRadius: {
        "xl2": "1.25rem",
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "press": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.97)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
        "shimmer": "shimmer 2s infinite",
        "press": "press 0.15s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
