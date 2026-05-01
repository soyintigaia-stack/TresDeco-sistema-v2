/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        td: {
          black: '#1A1A18', dark: '#242421', card: '#2E2E2B',
          beige: '#C9B99A', muted: '#666660', faint: '#444441',
          green: '#5DCAA5', amber: '#EF9F27', red: '#F09595', blue: '#85B7EB',
        }
      }
    }
  },
  plugins: []
}
