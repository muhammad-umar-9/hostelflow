import type { Config } from "tailwindcss";

/**
 * Colours live as CSS variables in styles/globals.css so the theme can be swapped
 * at runtime. This wrapper keeps Tailwind opacity modifiers (bg-p/40) working.
 */
const withAlpha =
  (variable: string) =>
  ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `var(${variable})`
      : `color-mix(in srgb, var(${variable}) calc(${opacityValue} * 100%), transparent)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        p: withAlpha("--p"),
        pd: withAlpha("--pd"),
        tint: withAlpha("--tint"),
        ok: withAlpha("--ok"),
        okt: withAlpha("--ok-tint"),
        warn: withAlpha("--warn"),
        warnt: withAlpha("--warn-tint"),
        bad: withAlpha("--bad"),
        badt: withAlpha("--bad-tint"),
        ink: withAlpha("--ink"),
        mut: withAlpha("--mut"),
        line: withAlpha("--line"),
        canvas: withAlpha("--bg"),
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        urdu: ["var(--font-urdu)", "serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "16px",
        "3xl": "20px",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "none" },
        },
      },
      animation: {
        "fade-up": "fade-up .24s ease-out",
        "sheet-up": "sheet-up .24s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
