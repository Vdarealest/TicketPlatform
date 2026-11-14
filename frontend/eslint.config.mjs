import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // The flagged effects are deliberate: reading localStorage (token,
      // theme, language) after hydration, and fetching on mount. Doing either
      // during render would make the server HTML differ from the browser's
      // first render. Kept visible as a warning, not a CI failure.
      "react-hooks/set-state-in-effect": "warn",
      // Banners are Cloudinary URLs already resized via cdnImage/cdnSrcSet
      // (lib/image.ts); next/image would add a second optimisation layer.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
