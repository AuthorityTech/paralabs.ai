import { createRequire } from "module";
const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");

export default [
  ...nextConfig,
  {
    rules: {
      "react/no-unescaped-entities": "warn",
    },
  },
];