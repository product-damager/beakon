import path from "node:path";
import { defineConfig } from "vitest/config";

// Minimal — resolves the `@/` import alias to the repo root the same way
// tsconfig.json's `paths` does, so a test importing anything under
// `components/`/`app/` doesn't fail with a confusing "Cannot find package"
// error (QA-REPORT-HERON-W3.md finding #9). Nothing beyond alias resolution.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
