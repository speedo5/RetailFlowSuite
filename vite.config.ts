import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Fail if the port is already in use instead of silently falling back
    strictPort: true,
    // Ensure HMR client connects to the correct host (use localhost for dev)
    hmr: {
      host: 'localhost'
    },
    proxy: {
      // Proxy API requests during development to the production API host
      // This avoids CORS issues by making requests from the dev server.
      '/api': {
        target: 'https://server.finetechmedia.co.ke',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
