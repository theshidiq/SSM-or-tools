/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // ShadCN theme colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Legacy colors for compatibility
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Schedule-specific colors
        schedule: {
          morning: '#fef3c7',
          afternoon: '#fed7aa',
          evening: '#e0e7ff',
          night: '#f3e8ff',
          weekend: '#f0f9ff',
        },
        // Status colors
        status: {
          active: '#10b981',
          pending: '#f59e0b',
          inactive: '#6b7280',
          urgent: '#ef4444',
        },
        // Shift type colors
        shift: {
          manager: '#8b5cf6',
          cashier: '#06b6d4',
          stock: '#84cc16',
          maintenance: '#f97316',
          security: '#64748b',
        },
        // Background variations
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '104': '26rem',
        '112': '28rem',
        '128': '32rem',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'none': '0',
        DEFAULT: '0.3rem',
        'xl': '0.3rem',
        '2xl': '0.3rem',
        '3xl': '0.3rem',
        'full': '0.3rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        'schedule': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'shift-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-4px)' },
          '60%': { transform: 'translateY(-2px)' },
        },
      },
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
        // Schedule-specific breakpoints
        'schedule-sm': '640px',
        'schedule-md': '768px',
        'schedule-lg': '1024px',
        'schedule-xl': '1280px',
      },
      gridTemplateColumns: {
        // Schedule table layouts
        'schedule-7': 'repeat(7, minmax(0, 1fr))',
        'schedule-8': 'minmax(80px, auto) repeat(7, minmax(0, 1fr))',
        'employee-table': 'repeat(auto-fit, minmax(150px, 1fr))',
        'shift-form': 'repeat(auto-fit, minmax(200px, 1fr))',
      },
      gridTemplateRows: {
        'schedule-hours': 'repeat(24, minmax(40px, auto))',
        'schedule-compact': 'repeat(12, minmax(30px, auto))',
      },
      zIndex: {
        'dropdown': '1000',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'notification': '1080',
      },
      transitionProperty: {
        'width': 'width',
        'spacing': 'margin, padding',
        'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
      },
      transitionDuration: {
        '0': '0ms',
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Custom plugin for schedule-specific utilities
    function({ addUtilities, theme }) {
      addUtilities({
        '.shift-card': {
          '@apply bg-white border border-surface-200 rounded-lg shadow-shift-card hover:shadow-md transition-shadow duration-200': {},
        },
        '.shift-morning': {
          '@apply bg-schedule-morning border-amber-200': {},
        },
        '.shift-afternoon': {
          '@apply bg-schedule-afternoon border-orange-200': {},
        },
        '.shift-evening': {
          '@apply bg-schedule-evening border-indigo-200': {},
        },
        '.shift-night': {
          '@apply bg-schedule-night border-purple-200': {},
        },
        '.schedule-grid': {
          '@apply grid grid-cols-schedule-8 gap-1 overflow-x-auto': {},
        },
        '.schedule-cell': {
          '@apply min-h-[40px] border border-surface-200 p-1 relative': {},
        },
        '.schedule-header': {
          '@apply bg-surface-50 font-medium text-surface-700 sticky top-0 z-10': {},
        },
        '.btn-schedule': {
          '@apply inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200': {},
        },
        '.btn-schedule-secondary': {
          '@apply inline-flex items-center justify-center px-4 py-2 border border-surface-300 text-sm font-medium rounded-md text-surface-700 bg-white hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200': {},
        },
        '.input-schedule': {
          '@apply block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm': {},
        },
        '.modal-overlay': {
          '@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-modal': {},
        },
        '.modal-content': {
          '@apply bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6': {},
        },
        '.status-badge': {
          '@apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium': {},
        },
        '.status-active': {
          '@apply bg-green-100 text-green-800': {},
        },
        '.status-pending': {
          '@apply bg-yellow-100 text-yellow-800': {},
        },
        '.status-inactive': {
          '@apply bg-gray-100 text-gray-800': {},
        },
        '.table-schedule': {
          '@apply min-w-full divide-y divide-surface-200': {},
        },
        '.table-schedule th': {
          '@apply px-6 py-3 bg-surface-50 text-left text-xs font-medium text-surface-500 uppercase tracking-wider': {},
        },
        '.table-schedule td': {
          '@apply px-6 py-4 whitespace-nowrap text-sm text-surface-900': {},
        },
      });
    },
  ],
  darkMode: 'class',
  // Enable JIT mode for better performance
  mode: 'jit',
  // Safelist important classes that might be generated dynamically
  safelist: [
    'shift-morning',
    'shift-afternoon',
    'shift-evening',
    'shift-night',
    'status-active',
    'status-pending',
    'status-inactive',
    'bg-shift-manager',
    'bg-shift-cashier',
    'bg-shift-stock',
    'bg-shift-maintenance',
    'bg-shift-security',
  ],
};