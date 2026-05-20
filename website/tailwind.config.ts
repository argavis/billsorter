import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{astro,html,ts,tsx,js,jsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f0fd',
          100: '#ebdffa',
          200: '#d4bff5',
          300: '#b393ec',
          400: '#8c61df',
          500: '#7039d2',
          600: '#5923c2', // PRIMARY
          700: '#491ca6',
          800: '#3b1788',
          900: '#2f126b',
          950: '#1d0a45',
        },
        ink: {
          50:  '#fbfbfb', // light surface
          100: '#f3f3f4',
          200: '#e6e6e8',
          300: '#cccdd1',
          400: '#9a9ba2',
          500: '#65676f',
          600: '#4a4c54',
          700: '#33353c',
          800: '#1f2026',
          900: '#101116',
          950: '#080808', // dark surface
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Fluid-Type-Scale, clamp(min, preferred, max)
        'hero-1': ['clamp(2.75rem, 8.5vw, 3.25rem)', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'hero-2': ['clamp(2.5rem, 7vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'sect-1': ['clamp(2.5rem, 7.5vw, 3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'sect-2': ['clamp(1.75rem, 4vw, 2.25rem)', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
      },
      boxShadow: {
        glow: '0 0 80px rgba(89, 35, 194, 0.35)',
        'glow-sm': '0 0 30px rgba(89, 35, 194, 0.25)',
        elev: '0 20px 60px -10px rgba(0, 0, 0, 0.3)',
        glass: '0 20px 80px -10px rgba(89, 35, 194, 0.5)',
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s steps(2) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'cursor-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
