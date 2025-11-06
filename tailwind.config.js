/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Theme colors
        primary: '#7c3aed',
        secondary: '#3d2f54',
        background: '#1a1625',
        foreground: '#e6e4f0',
        muted: '#3d2f54',
        'muted-foreground': '#9d95b2',
        destructive: '#ef4444',
        card: '#252138',
        'card-foreground': '#e6e4f0',
        border: 'rgba(139, 92, 246, 0.15)',

        // Tier colors
        'tier-inner': '#fbbf24',
        'tier-close': '#e5e7eb',
        'tier-community': '#d97706',
      },

      spacing: {
        'card-padding': '12px',
        'row-height': '72px',
        'row-gap': '12px',
        'avatar-sm': '40px',
        'avatar-md': '44px',
      },

      borderRadius: {
        'weave-card': '12px',
        'weave-container': '10px',
      },

      fontSize: {
        'name': ['17px', { lineHeight: '20px', fontWeight: '600' }],
        'status': ['13px', { lineHeight: '18px' }],
      },
    },
  },
  plugins: [],
};
