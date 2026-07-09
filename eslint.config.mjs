import next from "eslint-config-next/core-web-vitals";

// Next.js 16 removed `next lint`; linting now runs through the ESLint CLI with
// flat config. `eslint-config-next/core-web-vitals` bundles the Next.js base,
// TypeScript, and Core Web Vitals rules.
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**"] },
  ...next,
];

export default eslintConfig;
