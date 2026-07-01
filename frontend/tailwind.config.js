/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1", // Neon Indigo
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        dark: {
          bg: "#06070c",
          card: "rgba(13, 15, 30, 0.7)",
          border: "rgba(255, 255, 255, 0.06)",
          hover: "rgba(255, 255, 255, 0.12)",
        }
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 20px 0 rgba(99, 102, 241, 0.25)",
      },
      backdropBlur: {
        glass: "12px",
      }
    },
  },
  plugins: [],
}
