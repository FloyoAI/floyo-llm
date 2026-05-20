import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const VITE_PORT = 5174;
const DEFAULT_BACKEND_PORT = 8788;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const portFromEnv = Number(env.PORT || process.env.PORT || DEFAULT_BACKEND_PORT);
  // Guard against PORT being set to Vite's own port (which would make the
  // dev proxy loop back to itself). This can happen when tooling injects
  // PORT=5174 into the environment, or if a user accidentally picks 5174
  // for the backend.
  const backendPort = portFromEnv === VITE_PORT ? DEFAULT_BACKEND_PORT : portFromEnv;

  return {
    plugins: [react()],
    server: {
      port: VITE_PORT,
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
