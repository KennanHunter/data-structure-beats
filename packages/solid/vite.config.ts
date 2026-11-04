import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["solid-js", "solid-js/web", "@kennanhunter/data-structure-beats"],
    },
    sourcemap: true,
    minify: false,
  },
});
