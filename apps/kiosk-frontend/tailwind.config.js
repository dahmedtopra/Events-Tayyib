module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: "#f1faf6",
          100: "#d8f3e7",
          200: "#b3e7d2",
          300: "#86d7b9",
          400: "#57c39f",
          500: "#2fa987",
          600: "#1d8a6d",
          700: "#156f58",
          800: "#0f5a46",
          900: "#0b4a3a"
        },
        gold: {
          50: "#fbf7e6",
          100: "#f5ebc1",
          200: "#ecd889",
          300: "#e1c253",
          400: "#d4a92a",
          500: "#c8941b",
          600: "#a87512",
          700: "#875c10",
          800: "#6f4a0f",
          900: "#5a3c0e"
        },
        ivory: "#f7f4ee",
        charcoal: "#1f2a2f"
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 90, 70, 0.12)",
        glow: "0 0 40px rgba(47, 169, 135, 0.25)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};
