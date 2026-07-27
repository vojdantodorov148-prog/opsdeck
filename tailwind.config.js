/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#EDF2F3',        // page behind the app frame
        surface: '#FFFFFF',
        panel: '#F7FAFA',          // sidebar / inset panels
        line: '#E6EDEC',           // hairline borders
        ink: {
          DEFAULT: '#111C1B',
          soft: '#4A5A58',
          mute: '#849492',
        },
        teal: {
          50: '#EAF6F4',
          100: '#D3EDE8',
          200: '#A8DBD3',
          300: '#6FC4B8',
          400: '#38A899',
          500: '#0F9382',   // primary accent
          600: '#0B7C6D',
          700: '#0A6357',
        },
        status: {
          todo: '#94A3A1',
          doing: '#0F9382',
          blocked: '#D97A5B',
          done: '#5BA96F',
          plan: '#7EA6C9',
          winner: '#4E9E6E',
          stopped: '#B08A8A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '26px' },
      boxShadow: {
        card: '0 1px 2px rgba(17,28,27,0.04), 0 6px 18px -12px rgba(17,28,27,0.18)',
        float: '0 2px 6px rgba(17,28,27,0.06), 0 18px 40px -24px rgba(17,28,27,0.35)',
        app: '0 30px 80px -40px rgba(17,28,27,0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(16px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'slide-in': 'slide-in .2s cubic-bezier(.22,.8,.3,1)',
      },
    },
  },
  plugins: [],
}
