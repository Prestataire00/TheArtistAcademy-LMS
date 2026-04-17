import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f4',
          100: '#ffe0e8',
          200: '#ffc6d4',
          300: '#ff9db5',
          400: '#FF5783',
          500: '#B5294E',
          600: '#B5294E',
          700: '#9a2242',
          800: '#7d1c36',
          900: '#5c1428',
        },
        dark: {
          DEFAULT: '#272831',
          light: '#52545F',
          muted: '#90929D',
        },
        light: {
          DEFAULT: '#EDEDED',
        },
      },
    },
  },
  plugins: [],
};

export default config;
