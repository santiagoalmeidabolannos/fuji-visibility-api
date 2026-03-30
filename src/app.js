'use strict';

const Fastify = require('fastify');
const cron = require('node-cron');
const { scrape } = require('./scraper');
const cache = require('./cache');

const app = Fastify({ logger: true });

// Polling guidance returned to clients
const POLL_META = {
  scrapeIntervalMinutes: 60,
  sourceUpdatesDaily: true,
  recommendedPollingIntervalMinutes: 60,
  note: 'The source (isfujivisible.com) updates once per day. Polling more often than once per hour is unnecessary.',
};

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', async (_req, reply) => {
  return reply.send({
    status: 'ok',
    lastScraped: cache.lastUpdated(),
    lastChanged: cache.lastChanged(),
    polling: POLL_META,
  });
});

app.get('/visibility', async (_req, reply) => {
  const data = cache.get();
  if (!data) {
    return reply.code(503).send({ error: 'Data not yet available. Please try again shortly.' });
  }

  // Recommend clients cache for 1 hour
  reply.header('Cache-Control', 'public, max-age=3600');

  return reply.send({
    meta: {
      lastScraped: cache.lastUpdated(),
      lastChanged: cache.lastChanged(),
      ...POLL_META,
    },
    forecast: data.forecast,
  });
});

// ── Cron: re-scrape every hour ────────────────────────────────────────────────
cron.schedule('0 * * * *', async () => {
  app.log.info('cron: starting hourly scrape');
  try {
    const data = await scrape();
    const changed = cache.set(data);
    app.log.info(
      { changed },
      'cron: scrape complete — data %s',
      changed ? 'UPDATED' : 'unchanged'
    );
  } catch (err) {
    app.log.error({ err }, 'cron: scrape failed');
  }
}, { timezone: 'UTC' });

// ── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  // Warm the cache before accepting traffic
  app.log.info('startup: running initial scrape...');
  try {
    const data = await scrape();
    cache.set(data);
    app.log.info('startup: cache warmed with %d forecast days', data.forecast.length);
  } catch (err) {
    app.log.error({ err }, 'startup: initial scrape failed — cache is empty');
  }

  const host = process.env.HOST ?? '0.0.0.0';
  const port = parseInt(process.env.PORT ?? '3000', 10);

  await app.listen({ host, port });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
