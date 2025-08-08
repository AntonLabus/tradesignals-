/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#22E1FF',
          violet: '#A12FFF',
          pink: '#FF4D8D',
          lime: '#B6FF2E',
        },
      },
      boxShadow: {
        neon: '0 0 20px rgba(34, 225, 255, 0.4), 0 0 40px rgba(161, 47, 255, 0.2)',
        soft: '0 10px 30px rgba(0,0,0,0.25)'
      },
      backgroundImage: {
        'radial-grid': 'radial-gradient(circle at 25% 10%, rgba(34,225,255,0.08), transparent 40%), radial-gradient(circle at 80% 20%, rgba(161,47,255,0.08), transparent 40%), radial-gradient(circle at 50% 80%, rgba(255,77,141,0.06), transparent 40%)',
        'mesh': 'linear-gradient(120deg, rgba(34,225,255,0.06), rgba(161,47,255,0.06) 50%, rgba(255,77,141,0.06))',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' }
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 rgba(34, 225, 255, 0)' },
          '50%': { boxShadow: '0 0 35px rgba(161, 47, 255, 0.35)' }
        },
        'shine': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        glow: 'pulse-glow 3.5s ease-in-out infinite',
        shine: 'shine 3s linear infinite'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem'
      }
    },
  },
  plugins: [],
};
