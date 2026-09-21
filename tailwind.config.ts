import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Status colors used consistently across readiness, compliance, and
        // maintenance views — see components/StatusBadge.tsx. Kept in one
        // place so "warning" or "blocked" never drifts to a different shade
        // in a screen built later.
        status: {
          ok: '#15803d',
          warning: '#b45309',
          blocked: '#b91c1c',
        },
        // High-contrast "outdoor mode" surface — the default background for
        // field-facing screens (equipment scan, check-in/out), tuned for
        // readability in direct sunlight rather than for a desk monitor.
        outdoor: {
          bg: '#ffffff',
          surface: '#f4f4f5',
          border: '#d4d4d8',
          text: '#18181b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
