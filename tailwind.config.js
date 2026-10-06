/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors (WCAG compliant)
        primary: {
          DEFAULT: '#FF6B35',  // Decorative only
          dark: '#D84315',     // Buttons, CTAs, text on white (4.5:1)
          light: '#FF8F66',    // Backgrounds, badges
        },
        // Neutral colors
        background: '#FAFAFA',
        card: '#FFFFFF',
        text: {
          primary: '#1A1A1A',
          secondary: '#666666',
        },
        // Status colors
        success: '#28A745',
        warning: '#FFC107',
        danger: '#DC3545',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        // Worker-friendly sizes
        'body': ['18px', { lineHeight: '1.5' }],
        'small': ['16px', { lineHeight: '1.4' }],
        'caption': ['14px', { lineHeight: '1.3' }],
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 20px rgba(0, 0, 0, 0.12)',
        'button': '0 4px 12px rgba(216, 67, 21, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'scale-up': 'scaleUp 0.15s ease-in-out',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleUp: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.02)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: '200px 0' },
        },
      },
    },
  },
  plugins: [],
};