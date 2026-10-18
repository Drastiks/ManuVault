import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Anthracite très foncé, nuances de noir bleuté
        ink: {
          950: "#080a0f",
          900: "#0c0e15",
          850: "#10131c",
          800: "#151926",
          700: "#1c2131",
          600: "#262c40",
          500: "#353c55",
        },
        // Violet électrique
        volt: {
          300: "#b7a6ff",
          400: "#9d88ff",
          500: "#8467ff",
          600: "#7048f5",
          700: "#5d37d8",
        },
        // Accent bleu discret
        sky2: {
          400: "#6aa5ff",
          500: "#4d8ff5",
        },
        text: {
          DEFAULT: "#e8eaf3",
          muted: "#a0a6bb",
          faint: "#6c7390",
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        xl2: "14px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 6px 18px -10px rgba(0,0,0,0.6)",
        pop: "0 18px 50px -12px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)",
        glow: "0 0 0 1px rgba(132,103,255,0.45), 0 8px 28px -8px rgba(132,103,255,0.55)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fade: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.97) translateY(4px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        toast: {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        slide: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        rise: "rise 260ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        fade: "fade 160ms ease-out both",
        pop: "pop 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        toast: "toast 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        slide: "slide 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
