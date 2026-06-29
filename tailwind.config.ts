import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core Background Colors
        background: 'hsl(210, 15%, 8%)',           // #111417
        'background-light': 'hsl(210, 15%, 12%)',  // #1a1e23
        foreground: 'hsl(0, 0%, 100%)',            // #ffffff
        
        // Primary Brand Colors
        primary: {
          DEFAULT: 'hsl(214, 100%, 50%)',         // #0066ff
          foreground: 'hsl(0, 0%, 100%)',         // White text on blue
        },
        
        // Accent Colors
        secondary: 'hsl(174, 72%, 56%)',          // #4ade80
        accent: 'hsl(262, 83%, 58%)',             // #8b5cf6
        success: 'hsl(174, 72%, 56%)',            // #4ade80
        warning: 'hsl(32, 95%, 44%)',             // #f59e0b
        destructive: 'hsl(0, 84%, 60%)',          // #ef4444
        info: 'hsl(214, 100%, 50%)',              // #0066ff
        
        // UI Colors
        border: 'hsl(210, 15%, 20%)',             // #374151
        card: 'hsl(210, 15%, 16%)',               // #2b2e3b
        input: 'hsl(210, 15%, 8%)',               // #111417
        
        // Text Colors
        'muted-foreground': 'hsl(0, 0%, 63%)',    // #a0a0a0
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'float-medium': 'float-medium 4s ease-in-out infinite',
        'float-fast': 'float-fast 3s ease-in-out infinite',
        'terminal-pulse': 'terminal-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'terminal-scan': 'terminal-scan 3s linear infinite',
        'fadeInUp': 'fadeInUp 0.6s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(180deg)' },
        },
        'float-medium': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-15px) rotate(120deg)' },
        },
        'float-fast': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(90deg)' },
        },
        'terminal-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'terminal-scan': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config