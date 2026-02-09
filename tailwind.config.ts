import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        biz: {
          bg: "#F6F7FB",
          surface: "#FFFFFF",
          ink: "#111827",
          muted: "#6B7280",
          line: "#E7E7EE",
          sand: "#FFE2B8",
          cream: "#FFF3E1",

          // Updated to "electric orange"
          orange: "#FF2D00",
          orange2: "#FF5200",
        },
      },
      boxShadow: {
        soft: "0 12px 30px rgba(17, 24, 39, 0.10)",
        card: "0 10px 25px rgba(17,24,39,0.08)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;