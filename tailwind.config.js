/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'surface-container-lowest': '#ffffff',
        surface: '#fbf9f9',
        primary: '#000000',
        'on-primary': '#ffffff',
        secondary: '#5d5f5f',
        'secondary-fixed': '#e2e2e2',
      },
      fontFamily: {
        'label-mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

