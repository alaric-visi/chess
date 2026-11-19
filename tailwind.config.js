/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Semantic colour tokens; values live in src/index.css.
      colors: {
        bg: token('bg'),
        fg: token('fg'),
        muted: token('muted'),
        surface: token('surface'),
        ok: token('ok'),
        warn: token('warn'),
        bad: token('bad'),
        info: token('info'),
      },
      boxShadow: {
        hard: '2px 2px 0 0 rgb(var(--shadow))',
        'hard-lg': '8px 8px 0 0 rgb(var(--shadow) / 0.8)',
      },
      fontFamily: {
        'label-mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
