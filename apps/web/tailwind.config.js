/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d1117',
        panel: '#161b22',
        edge: '#30363d',
        muted: '#8b949e',
        accent: '#2f81f7',
      },
    },
  },
  plugins: [],
};
