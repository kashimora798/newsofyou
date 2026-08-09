import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Prevent the dep optimizer from trying to resolve onnxruntime-web —
  // it's an optional native module inside @imgly/background-removal
  // that is never actually used at runtime in this app.
  optimizeDeps: {
    exclude: ["@imgly/background-removal", "onnxruntime-web"],
    rolldownOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu"],
    },
  },
  build: {
    target: ["es2015", "chrome58", "firefox57", "safari11"],
    rolldownOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu"],
    },
    rollupOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu"],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three") || id.includes("@react-three")) {
              return "three";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
              return "vendor";
            }
            if (id.includes("@supabase")) {
              return "supabase";
            }
            if (id.includes("@radix-ui")) {
              return "ui";
            }
            if (id.includes("recharts")) {
              return "charts";
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
