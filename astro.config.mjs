import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:4321", // set SITE_URL at build time once the domain is known
  output: "static",
  redirects: {
    "/about": "/#about",
    "/projects": "/#code",
    "/blog": "/#write",
    "/hobbies": "/#make",
    "/links": "/#about",
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Tailscale hostname so the dev/preview server works through `tailscale serve`/`funnel`.
    server: {
      allowedHosts: ["royalpc.collie-truck.ts.net"],
      proxy: { "/api": process.env.STATS_URL ?? "http://localhost:8787" },
    },
    preview: {
      allowedHosts: ["royalpc.collie-truck.ts.net"],
      proxy: { "/api": process.env.STATS_URL ?? "http://localhost:8787" },
    },
  },
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
});
