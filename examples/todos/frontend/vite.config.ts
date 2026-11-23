import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The generated client calls /api; in development Vite forwards it to the FastAPI backend.
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: backend, rewrite: (path) => path.replace(/^\/api/, "") } },
  },
});
