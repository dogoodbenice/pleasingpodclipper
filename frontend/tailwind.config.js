/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          accent: '#06b6d4',
          yellow: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}
