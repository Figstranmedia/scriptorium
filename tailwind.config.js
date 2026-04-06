/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f8f7f4',
          100: '#ede9e1',
          200: '#d6cfc0',
          300: '#b8ad97',
          400: '#9a8c76',
          500: '#7d6e5a',
          600: '#5c5043',
          700: '#3e3630',
          800: '#2a2520',
          900: '#1a1714',
        },
        accent: {
          50: '#fdf4f0',
          100: '#fae4d8',
          200: '#f5c4ab',
          300: '#ed9c75',
          400: '#e3703f',
          500: '#d4522b',
          600: '#b03d20',
          700: '#8a2f1a',
          800: '#6b2518',
          900: '#3d1510',
        }
      }
    }
  },
  plugins: []
}
