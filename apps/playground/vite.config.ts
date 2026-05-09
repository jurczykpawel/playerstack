import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5180,
    open: false,
    host: true,
    allowedHosts: ["host.docker.internal", "localhost", "127.0.0.1"],
  },
  build: {
    target: "es2020",
  },
});
