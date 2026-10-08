module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce"
        }
      },
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"] },
      boxShadow: {
        soft: "0 12px 36px rgba(43, 28, 68, 0.10)",
        modal: "0 24px 80px rgba(28, 18, 45, 0.22)"
      }
    }
  },
  plugins: []
};
