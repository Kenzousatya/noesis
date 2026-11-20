/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        sidebar: 'rgb(var(--sidebar) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        panel2: 'rgb(var(--panel2) / <alpha-value>)',
        ink: 'rgb(var(--text) / <alpha-value>)',
        ink2: 'rgb(var(--text2) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        accent2: 'rgb(var(--accent2) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        active: 'rgb(var(--active) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        onaccent: 'rgb(var(--on-accent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      spacing: {
        '8.5': '2.125rem',
        '9.5': '2.375rem',
      },
      borderRadius: {
        card: '12px',
        panel: '16px',
        btn: '8px',
        input: '9px',
      },
      boxShadow: {
        lift: '0 8px 24px -16px rgba(0,0,0,0.55)',
        modal: '0 32px 80px -32px rgba(0,0,0,0.6)',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
