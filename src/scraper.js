'use strict';

const { load } = require('cheerio');
const { fetch } = require('undici');

const URL = 'https://isfujivisible.com/';

/**
 * Parse a single time-period slot (morning or afternoon) within a day card.
 * @param {CheerioAPI} $
 * @param {Cheerio} slotEl
 */
function parseSlot($, slotEl) {
  // Status badge — the rounded-full border span that holds the visibility text
  const status = slotEl.find('span[class*="rounded-full"][class*="border"]').first().text().trim();

  // Score and description live inside the hidden popover div
  const popover = slotEl.find('div[x-show]').first();
  const scoreText = popover.find('p[class*="rounded-full"][class*="font-bold"]').first().text().trim();
  const score = scoreText ? parseInt(scoreText, 10) : null;

  // The description is the second <p> inside the popover's flex container
  const descEl = popover.find('div.flex p').last();
  const description = descEl.text().trim() || null;

  return { status: status || null, score, description };
}

/**
 * Parse all day cards from a carousel element (north or south).
 * @param {CheerioAPI} $
 * @param {Cheerio} carousel
 */
function parseCarousel($, carousel) {
  const days = [];

  carousel.find('div.snap-start').each((_, cardWrapper) => {
    const card = $(cardWrapper);

    // Date label
    const date = card.find('p.text-sm.font-semibold').first().text().trim();
    if (!date) return;

    // Is today?
    const isToday = card.find('span').filter((_, el) => $(el).text().trim() === 'TODAY').length > 0;

    // Morning slot — the container div whose background is blue-50
    const morningSlot = card.find('div[class*="bg-blue-50"]').first();
    // Afternoon slot — orange-50
    const afternoonSlot = card.find('div[class*="bg-orange-50"]').first();

    days.push({
      date,
      isToday,
      morning: parseSlot($, morningSlot),
      afternoon: parseSlot($, afternoonSlot),
    });
  });

  return days;
}

/**
 * Parse live camera YouTube IDs from the page.
 * @param {CheerioAPI} $
 * @returns {Array<{name: string, location: string, side: string, youtubeId: string}>}
 */
function parseCameras($) {
  const cameras = [];

  // Camera entries are in <h3> + location <p> + Alpine.js x-data with youtubeId
  $('[x-data]').each((_, el) => {
    const xData = $(el).attr('x-data') || '';
    const idMatch = xData.match(/youtubeId\s*:\s*['"]([^'"]+)['"]/);
    if (!idMatch) return;

    const youtubeId = idMatch[1];

    // Channel ID (optional, for linking to channel live page)
    const channelMatch = xData.match(/channelId\s*:\s*['"]([^'"]+)['"]/);
    const channelId = channelMatch ? channelMatch[1] : null;

    // Name and location come from the nearest preceding h3 + p
    const container = $(el).closest('div');
    const name = container.find('h3').first().text().trim() ||
                 $(el).prevAll('h3').first().text().trim() || null;
    const location = container.find('p').first().text().trim() || null;

    // Determine side from name/location text
    const text = (name + ' ' + location).toLowerCase();
    const side = text.includes('south') || text.includes('hakone') || text.includes('shizuoka') || text.includes('enoshima') || text.includes('minobu') || text.includes('fujinomiya') || text.includes('susono')
      ? 'south' : 'north';

    if (youtubeId) {
      cameras.push({ name, location, side, youtubeId, channelId });
    }
  });

  return cameras;
}

/**
 * Scrape Mt. Fuji visibility data from isfujivisible.com.
 * @returns {Promise<object>}
 */
async function scrape() {
  const response = await fetch(URL, {
    headers: {
      'User-Agent': 'fuji-visibility-api/1.0 (+https://github.com/fuji-visibility-api)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${URL}`);
  }

  const html = await response.text();
  const $ = load(html);

  const northCarousel = $('div[x-ref="carouselNorth"]');
  const southCarousel = $('div[x-ref="carouselSouth"]');

  const northDays = parseCarousel($, northCarousel);
  const southDays = parseCarousel($, southCarousel);

  // Merge north + south by day index
  const forecast = northDays.map((northDay, i) => {
    const southDay = southDays[i] || {};
    return {
      date: northDay.date,
      isToday: northDay.isToday,
      north: {
        morning: northDay.morning,
        afternoon: northDay.afternoon,
      },
      south: {
        morning: southDay.morning ?? null,
        afternoon: southDay.afternoon ?? null,
      },
    };
  });

  const cameras = parseCameras($);

  return {
    updatedAt: new Date().toISOString(),
    forecast,
    cameras,
  };
}

module.exports = { scrape };
