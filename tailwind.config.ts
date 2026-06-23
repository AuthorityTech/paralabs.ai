import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      maxWidth: {
        content: "var(--frame, 42rem)",
      },
      colors: {
        link: "var(--interactive)",
        nothing: {
          page: "var(--page-bg)",
          surface: "var(--surface)",
          raised: "var(--surface-raised)",
          border: "var(--border)",
          borderHi: "var(--border-visible)",
          display: "var(--text-display)",
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          disabled: "var(--text-disabled)",
          accent: "var(--accent)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "SF Pro Display", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-mono)", "SF Mono", "ui-monospace", "monospace"],
        display: ["var(--font-playfair)", "New York", "Georgia", "serif"],
      },
      transitionTimingFunction: {
        nothing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
      typography: {
        nothing: {
          css: {
            "--tw-prose-body": "var(--text-primary)",
            "--tw-prose-headings": "var(--text-display)",
            "--tw-prose-links": "var(--interactive)",
            "--tw-prose-bold": "var(--text-primary)",
            "--tw-prose-counters": "var(--text-secondary)",
            "--tw-prose-bullets": "var(--text-disabled)",
            "--tw-prose-hr": "var(--border)",
            "--tw-prose-quotes": "var(--text-secondary)",
            "--tw-prose-quote-borders": "var(--border-visible)",
            "--tw-prose-code": "var(--text-primary)",
            "--tw-prose-pre-code": "var(--text-primary)",
            "--tw-prose-pre-bg": "var(--surface-raised)",
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
