/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        'gold': '#FFD700',
        'gold-dark': '#B8860B',
        'profit': '#00E676',
        'loss': '#FF5252',
        'bg-primary': '#0a0e17',
        'bg-secondary': '#111827',
        'bg-card': '#1a1f2e',
      },
    },
  },
  plugins: [],
};
