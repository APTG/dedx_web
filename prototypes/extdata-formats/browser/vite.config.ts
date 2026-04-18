import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Separate zarrita chunk so its bundle size is reported clearly
        manualChunks: { zarrita: ["zarrita"] },
      },
    },
  },
});
