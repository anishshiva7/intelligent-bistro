/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bistro: {
          50:  '#fff8f1',
          100: '#ffeedd',
          200: '#ffd6b0',
          300: '#ffb979',
          400: '#ff9142',
          500: '#ff6f1a',
          600: '#f05000',
          700: '#c73d00',
          800: '#a03206',
          900: '#832c0a',
          950: '#461400',
        },
        cream: '#fdf6ee',
        dark:  '#1a0a00',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
