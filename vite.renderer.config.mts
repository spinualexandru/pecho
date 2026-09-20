import * as path from "path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

// Native compilation wins the local benchmark; Babel remains a tested fallback.
const compiler = process.env.PECHO_REACT_COMPILER ?? "oxc";
if (compiler !== "babel" && compiler !== "oxc") {
  throw new Error(`Unknown PECHO_REACT_COMPILER: ${compiler}`);
}

export default defineConfig({
  // Only the application HTML is a dependency-scan entry. Generated reports
  // and packaged renderers are not additional applications.
  optimizeDeps: { entries: ["index.html"] },
  server: {
    watch: {
      ignored: [
        "**/{.vite,.cache,out,dist,coverage,playwright-report,test-results,blob-report}/**",
      ],
    },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    ...(compiler === "oxc"
      ? [react({ compiler: { logDiagnostics: true } })]
      : [react(), babel({ presets: [reactCompilerPreset()] })]),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
