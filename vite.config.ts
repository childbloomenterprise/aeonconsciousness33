import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": `http://127.0.0.1:${loadEnv(mode, process.cwd(), "LOCAL_API_PORT").LOCAL_API_PORT || 3001}`,
    },
  },
  build: { target: "es2022", sourcemap: false },
}));
