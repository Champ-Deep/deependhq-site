import next from "eslint-config-next";

// Flat config. eslint-config-next 16.x exports a ready-made flat config array,
// so no FlatCompat shim is needed.
const eslintConfig = [
  ...next,
  {
    ignores: ["node_modules/**", ".next/**", "worker/**"],
  },
];

export default eslintConfig;
