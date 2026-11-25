/** @type {import('tailwindcss').Config} */
// Colours, fonts, radii and shadows come from the design-system tokens defined
// as CSS variables in client/src/index.css, so dark mode is a variable swap.
module.exports = {
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-sunk": "var(--surface-sunk)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "seat-1": "var(--seat-1)",
        "on-seat-1": "var(--on-seat-1)",
        "seat-1-soft": "var(--seat-1-soft)",
        "seat-2": "var(--seat-2)",
        "seat-2-ink": "var(--seat-2-ink)",
        "on-seat-2": "var(--on-seat-2)",
        "seat-2-soft": "var(--seat-2-soft)",
        danger: "var(--danger)",
        "on-danger": "var(--on-danger)",
        "danger-soft": "var(--danger-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        success: "var(--success)",
        focus: "var(--focus)",
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        tile: "var(--shadow-tile)",
        pop: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
}
