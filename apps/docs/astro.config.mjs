import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://playerstack.techskills.academy",
  integrations: [sitemap()],
  // Keep the spaces between inline elements.
  compressHTML: true,
  server: {
    host: true,
    port: 5181,
  },
  vite: {
    server: {
      allowedHosts: ["host.docker.internal", "localhost", "127.0.0.1"],
    },
  },
});
