/**
 * ROM Runner - Tailwind CSS Configuration
 * @version 1.0.0
 * @description Design tokens and theme configuration for ROM Runner UI
 */

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './index.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ========================================
      // SPACING
      // ========================================
      spacing: {
        '18': '4.5rem',      // 72px
        '88': '22rem',       // 352px
        '112': '28rem',      // 448px
        '128': '32rem',      // 512px
        'sidebar': '240px',
        'sidebar-collapsed': '64px',
        'header': '48px',
        'status-bar': '24px',
      },

      // ========================================
      // COLORS
      // ========================================
      colors: {
        // Primary brand color (blue)
        primary: {
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

        // Semantic colors
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },

        // Platform manufacturer colors (for badges/icons)
        platform: {
          nintendo: '#E60012',
          sony: '#003791',
          sega: '#0060A8',
          microsoft: '#107C10',
          atari: '#F7941D',
          nec: '#FF6600',
          snk: '#FFD700',
          commodore: '#6B5B95',
          sinclair: '#CC0000',
          neo: '#FFD700',
        },

        // Compatibility status colors
        compat: {
          perfect: '#10b981',    // emerald-500
          playable: '#22c55e',   // green-500
          ingame: '#f59e0b',     // amber-500
          menu: '#f97316',       // orange-500
          boots: '#ef4444',      // red-500
          broken: '#dc2626',     // red-600
          unknown: '#6b7280',    // gray-500
        },

        // Performance tier colors
        perf: {
          excellent: '#10b981',  // emerald-500
          great: '#22c55e',      // green-500
          good: '#84cc16',       // lime-500
          moderate: '#f59e0b',   // amber-500
          poor: '#f97316',       // orange-500
          unplayable: '#ef4444', // red-500
        },

        // Surface colors (use CSS custom properties for theme switching)
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },

        // Text colors
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          inverse: 'var(--text-inverse)',
        },

        // Border colors
        border: {
          DEFAULT: 'var(--border-default)',
          hover: 'var(--border-hover)',
          focus: 'var(--border-focus)',
          subtle: 'var(--border-subtle)',
        },
      },

      // ========================================
      // TYPOGRAPHY
      // ========================================
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }], // 10px
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],    // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },

      // ========================================
      // BORDER RADIUS
      // ========================================
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',       // 4px
        'DEFAULT': '0.375rem', // 6px
        'md': '0.5rem',        // 8px
        'lg': '0.625rem',      // 10px
        'xl': '0.75rem',       // 12px
        '2xl': '1rem',         // 16px
        '3xl': '1.5rem',       // 24px
        'full': '9999px',
        'game-card': '0.625rem', // 10px - consistent card radius
        'button': '0.375rem',    // 6px
        'input': '0.375rem',     // 6px
        'modal': '0.75rem',      // 12px
        'tooltip': '0.25rem',    // 4px
      },

      // ========================================
      // SHADOWS
      // ========================================
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'DEFAULT': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        // Custom shadows
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'card-selected': '0 0 0 2px var(--border-focus)',
        'modal': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'toast': '0 4px 12px rgb(0 0 0 / 0.15)',
        'focus': '0 0 0 3px var(--focus-ring-color)',
      },

      // ========================================
      // TRANSITIONS
      // ========================================
      transitionDuration: {
        '50': '50ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // ========================================
      // Z-INDEX
      // ========================================
      zIndex: {
        'behind': '-1',
        'base': '0',
        'dropdown': '50',
        'sticky': '100',
        'header': '150',
        'sidebar': '150',
        'modal-backdrop': '200',
        'modal': '210',
        'popover': '250',
        'toast': '300',
        'tooltip': '400',
        'max': '9999',
      },

      // ========================================
      // GRID
      // ========================================
      gridTemplateColumns: {
        'game-grid-xs': 'repeat(auto-fill, minmax(100px, 1fr))',
        'game-grid-sm': 'repeat(auto-fill, minmax(120px, 1fr))',
        'game-grid-md': 'repeat(auto-fill, minmax(160px, 1fr))',
        'game-grid-lg': 'repeat(auto-fill, minmax(200px, 1fr))',
        'game-grid-xl': 'repeat(auto-fill, minmax(240px, 1fr))',
      },

      // ========================================
      // ASPECT RATIO
      // ========================================
      aspectRatio: {
        'game-cover': '3 / 4',       // Standard game box art
        'game-cover-wide': '16 / 9', // Wide format
        'square': '1 / 1',
      },

      // ========================================
      // MIN/MAX DIMENSIONS
      // ========================================
      minWidth: {
        'modal-sm': '320px',
        'modal-md': '480px',
        'modal-lg': '640px',
        'modal-xl': '768px',
        'sidebar': '240px',
      },
      maxWidth: {
        'modal-sm': '400px',
        'modal-md': '560px',
        'modal-lg': '720px',
        'modal-xl': '960px',
        'toast': '360px',
        'dropdown': '280px',
      },
      minHeight: {
        'modal': '200px',
        'card': '120px',
      },

      // ========================================
      // ANIMATIONS & KEYFRAMES
      // ========================================
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-right': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'scale-out': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5%)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'slide-out-right': 'slide-out-right 200ms ease-in',
        'slide-in-up': 'slide-in-up 200ms ease-out',
        'slide-in-down': 'slide-in-down 200ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        'scale-out': 'scale-out 150ms ease-in',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'spin': 'spin 1s linear infinite',
        'spin-slow': 'spin 2s linear infinite',
        'bounce-subtle': 'bounce-subtle 1s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'progress': 'progress-indeterminate 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // Use .form-* classes instead of global styles
    }),
    require('tailwindcss-animate'),
  ],
};

export default config;
