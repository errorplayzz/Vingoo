/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink:     "#0A0A0B",
        "ink-2": "#1A1A1C",
        muted:   "#64748B",
        faint:   "#94A3B8",
        accent:  "#1D4ED8",
        "accent-dim": "#3B66E8",
        wire:    "#CBD5E1",
        glass:   "rgba(255,255,255,0.75)",
        surface: "#F8FAFC",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "10xl": ["10rem",  { lineHeight: "0.9", letterSpacing: "-0.04em" }],
        "9xl":  ["8rem",   { lineHeight: "0.9", letterSpacing: "-0.04em" }],
        "8xl":  ["6rem",   { lineHeight: "0.92", letterSpacing: "-0.035em" }],
        "7xl":  ["4.5rem", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
      },
      boxShadow: {
        glass:   "0 4px 30px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        "glass-lg": "0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
        lift:    "0 12px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)",
      },
      backdropBlur: {
        xs: "4px",
      },
      keyframes: {
        "float-x":  { "0%,100%": { transform: "translateX(0px)" }, "50%": { transform: "translateX(8px)" } },
        "float-y":  { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-10px)" } },
        "pulse-dot":{ "0%,100%": { opacity: "0.4", transform: "scale(1)" }, "50%": { opacity: "1", transform: "scale(1.3)" } },
        "draw-line":{ from: { strokeDashoffset: "1000" }, to: { strokeDashoffset: "0" } },
        "scan":     { from: { transform: "translateY(-100%)" }, to: { transform: "translateY(100%)" } },
      },
      animation: {
        "float-x":  "float-x 6s ease-in-out infinite",
        "float-y":  "float-y 7s ease-in-out infinite",
        "pulse-dot":"pulse-dot 3s ease-in-out infinite",
        "draw-line":"draw-line 2s ease forwards",
        "scan":     "scan 3s linear infinite",
      },
    },
  },
  plugins: [],
};

