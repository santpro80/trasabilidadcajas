/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./public/**/*.{html,js}",
    "./*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        'villalba-blue': '#2563eb',
        'background-dark': '#0a0f16',
        'surface-dark': '#161e2a'
      }
    }
  },
  plugins: [],
}
