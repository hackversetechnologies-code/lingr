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
        // Lingr Design System
        'warm-paper': '#F5F0EB',
        'warm-chat': '#EDE8E2',
        'partner-bubble': '#FFFFFF',
        'user-bubble': '#2C2C2C',
        'accent-red': '#C0392B',
        'text-primary': '#1A1A1A',
        'text-secondary': '#888888',
        'success': '#4A7C59',
        'typing': '#AAAAAA',
      },
      fontFamily: {
        'playfair': ['Playfair Display', 'Georgia', 'serif'],
        'inter': ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'bubble': '18px 18px 18px 4px',
        'bubble-user': '18px 18px 4px 18px',
      },
      animation: {
        'typing': 'typing 1.4s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'message-in': 'messageIn 0.25s ease-out',
      },
      keyframes: {
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        messageIn: {
          from: { transform: 'translateY(8px) scale(0.98)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
