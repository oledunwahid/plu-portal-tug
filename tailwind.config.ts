import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'u-cream': '#FAF7F2',
        'u-card': '#FFFDF8',
        'u-dark': '#1A1008',
        'u-primary': '#1C1107',
        'u-secondary': '#6B5744',
        'u-gold': '#C9A84C',
        'u-border': '#E8DDD0',
        'u-input': '#C8B8A8',
        'u-row': '#F5EFE8',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 4px rgba(26,16,8,0.08)',
        'card-md': '0 4px 16px rgba(26,16,8,0.12)',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease',
        'slide-in-right': 'slide-in-right 250ms ease',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
