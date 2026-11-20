import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` serves the app on http://localhost:5173 with hot reload.
// API requests are forwarded to the API container, which docker compose
// publishes on localhost:8001, so the stack has to be running too
const api = "http://localhost:8001";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/reports": api,
      "/health": api,
      "/docs": api,
      "/openapi.json": api,
    },
  },
});
