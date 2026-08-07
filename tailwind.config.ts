import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Colours live as CSS variables in styles/globals.css so the theme can be swapped
 * at runtime. This wrapper keeps Tailwind opacity modifiers (bg-p/40) working.
 *
 * Tailwind resolves a colour value that is a function at run time, passing the opacity
 * modifier in, but its `Config` type only models colour leaves as strings. The cast keeps
 * the documented run-time contract while satisfying the published types; the plain
 * `var(--x)` fallback (no modifier) is kept so themed colours still render on browsers
 * without `color-mix()`.
 */
const withAlpha = (variable: string): string => {
  const resolve = ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `var(${variable})`
      : `color-mix(in srgb, var(${variable}) calc(${opacityValue} * 100%), transparent)`;

  return resolve as unknown as string;
};

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
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
  plugins: [tailwindcssAnimate],
};

export default config;
