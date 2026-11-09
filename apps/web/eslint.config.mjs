import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  // Vendored React Bits components (components/bits): upstream code reads refs and Math.random during
  // render by design; keep them close to upstream instead of rewriting them for the React Compiler rules.
  {
    files: ["components/bits/**"],
    rules: { "react-hooks/refs": "off", "react-hooks/purity": "off", "react-hooks/set-state-in-effect": "off" },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];

export default config;
