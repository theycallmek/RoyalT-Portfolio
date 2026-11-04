# royalt.online

Personal portfolio of RoyalT: developer and maker based in California, working on mobile app
automation, web development, embedded IoT systems, 3D CAD and visual content creation.

**Live:** https://royalt.online

A single scrolling page in a Swiss/editorial mono style (ruled grids, oversized type, light/dark
modes, four accent colours) that pulls in live data:

- **GitHub**: stars, repos, followers, language breakdown by code size, top repos, recent pushes
- **YouTube**: channel stats and every upload, sortable by views, date or likes
- **MakerWorld**: 3D-print models with covers, sortable by downloads, likes, prints or date
- **Homelab**: anonymized live CPU / memory / disk / temperature / network for three home servers

## Stack

**Frontend**
- [Astro 7](https://astro.build): static output, content collections validated with Zod 4
- React 19 islands for the live sections
- Tailwind CSS v4, CSS scroll-driven animations, View Transitions, OKLCH relative colours
  (an accent-derived palette)
- TypeScript (strict), self-hosted Commit Mono font, Lucide-based line icons

**Backend**
- A small Node 22 stats service (TypeScript via native type stripping, no framework)
- GitHub REST API and YouTube Data API v3, cached with last-good fallback
- A token-authenticated homelab ingest over Tailscale, fed by tiny bash agents
  (systemd timers on Ubuntu, cron on OpenWrt)

**Quality**
- Vitest unit tests, Playwright end-to-end tests with axe accessibility checks (dark and light)
- Biome for linting and formatting
- Lighthouse 100 / 100 / 100 / 100 with zero layout shift

**Hosting**
- Docker Compose on a home server: Caddy serves the static build and proxies `/api`
- Cloudflare Tunnel for the domain (no open ports); Tailscale Funnel as a backup address

## Development

Requires Node 22.23.4 or newer (see `.node-version`).

```sh
npm install
npm run dev          # site on http://localhost:4321
npm run stats        # stats service on :8787 (reads .env for the YouTube API key)
npm test             # unit tests
npm run test:e2e     # Playwright + axe
npm run lint         # Biome
```

Copy `.env.example` to `.env` and fill in your own values. Deployment, the homelab agents and the
MakerWorld import are documented in [`docs/DEPLOY.md`](docs/DEPLOY.md).
