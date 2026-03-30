# fuji-visibility-api

A lightweight REST API that serves Mt. Fuji visibility forecast data scraped from [isfujivisible.com](https://isfujivisible.com/).

## Endpoints

### `GET /visibility`

Returns the cached forecast data.

```json
{
  "updatedAt": "2026-03-30T06:00:00.000Z",
  "forecast": [
    {
      "date": "Mon, Mar 30",
      "isToday": true,
      "north": {
        "morning":   { "status": "Visible",     "score": 10, "description": "Excellent visibility conditions" },
        "afternoon": { "status": "Not Visible",  "score": 1,  "description": "Poor visibility conditions" }
      },
      "south": {
        "morning":   { "status": "Visible",     "score": 9,  "description": "Excellent visibility conditions" },
        "afternoon": { "status": "Partly Visible","score": 6, "description": "Good visibility with some clouds" }
      }
    }
  ]
}
```

Returns `503` if the cache hasn't been populated yet.

### `GET /health`

```json
{ "status": "ok", "lastUpdated": "2026-03-30T06:00:00.000Z" }
```

## Running locally

```bash
npm install
npm run dev   # uses node --watch for auto-reload
```

The server listens on `PORT` (default `3000`) and `HOST` (default `0.0.0.0`).

## How it works

- On startup the scraper runs immediately to warm the in-memory cache.
- A `node-cron` job re-scrapes every day at **06:00 JST** (21:00 UTC) so the cache stays fresh.
- Scraping is done with `undici` (HTTP) + `cheerio` (HTML parsing) — no headless browser needed because the site renders server-side.

## Deploy to Render

The included `render.yaml` configures a free-tier Node.js web service. Push to GitHub, connect the repo in Render, and deploy.
