import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile({ deleteInlinedFiles: false })],
  server: {
    host: "127.0.0.1",
    port: 4178,
  },
  build: {
    outDir: "dist",
    license: { fileName: "THIRD_PARTY_UI.md" },
    emptyOutDir: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: {
      input: "index.html",
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

