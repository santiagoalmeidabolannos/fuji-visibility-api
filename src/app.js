'use strict';

const Fastify = require('fastify');
const cron = require('node-cron');
const { scrape } = require('./scraper');
const cache = require('./cache');

const app = Fastify({ logger: true });

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', async (_req, reply) => {
  return reply.send({ status: 'ok', lastUpdated: cache.lastUpdated() });
});

app.get('/visibility', async (_req, reply) => {
  const data = cache.get();
  if (!data) {
    return reply.code(503).send({ error: 'Data not yet available. Please try again shortly.' });
  }
  return reply.send(data);
});

// ── Cron: re-scrape every day at 06:00 JST (21:00 UTC previous day) ──────────
// JST = UTC+9, so 06:00 JST = 21:00 UTC
cron.schedule('0 21 * * *', async () => {
  app.log.info('cron: starting scheduled scrape');
  try {
    const data = await scrape();
    cache.set(data);
    app.log.info('cron: scrape complete, %d forecast days cached', data.forecast.length);
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
