# Weather Archive — Cloudflare Workers edition

A static JavaScript weather-history dashboard packaged for Cloudflare Workers. The UI is served as a Cloudflare static asset; a small Worker proxies Open-Meteo geocoding and historical archive requests through same-origin `/api/*` routes and applies input validation and caching.

## Stack

- Vanilla HTML, CSS, and JavaScript (no build step or frontend framework)
- Cloudflare Workers + Workers Static Assets
- Open-Meteo Geocoding API and Historical Weather API
- No API key or secrets required

## Deploy

1. Install a current Node.js LTS release.
2. From this directory, install Wrangler:

   ```bash
   npm install
   ```

3. Authenticate with Cloudflare:

   ```bash
   npx wrangler login
   ```

4. Preview locally:

   ```bash
   npm run dev
   ```

5. Deploy:

   ```bash
   npm run deploy
   ```

Wrangler will publish the `public/` directory as static assets and deploy `src/worker.js` for the API routes. The first deployment may ask you to choose or confirm a Cloudflare account.

## Local development

`npm run dev` starts Wrangler's local Worker runtime. The frontend uses same-origin `/api/geocode` and `/api/archive` endpoints, so the local preview exercises the same proxy code as production.

Health check: `/api/health`

## Project layout

- `public/index.html` — dashboard UI and client-side interactions
- `src/worker.js` — API routing, validation, upstream proxying, and cache settings
- `wrangler.jsonc` — Workers and static asset configuration

## Notes

- Historical data availability depends on Open-Meteo's archive update delay; the UI defaults to five days ago and handles an upstream-provided maximum date.
- The Worker restricts archive requests to the hourly fields used by the dashboard and validates coordinates and date ranges.
- Open-Meteo availability, terms, and rate limits still apply. Caching reduces repeat requests but does not guarantee unlimited usage.
