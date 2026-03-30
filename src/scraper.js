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

// ── Curated camera list (sourced from isfujivisible.com) ─────────────────────
// YouTube IDs are extracted from the page source; channel links used where available.
// Order matches the site's camera picker order.
const CAMERAS = [
  // North
  { name: 'Lake Kawaguchiko, Oishi Park', location: 'Kawaguchiko',              side: 'north', youtubeId: 'bdUbACCWmoY', channelId: '' },
  { name: 'Fujikawaguchiko',              location: 'Fujikawaguchiko',           side: 'north', youtubeId: 'kYK9J6KNz0M', channelId: '' },
  { name: 'Lake Yamanakako',              location: 'Yamanakako',                side: 'north', youtubeId: 'Gn2CJjzY068', channelId: '' },
  { name: 'Chureito Pagoda',              location: 'Arakurayama Sengen Park',   side: 'north', youtubeId: '',             channelId: 'UCnqVpkMd8g9BvbePO-ZXTVA' },
  { name: 'Lake Shoji',                   location: 'Lake Shoji',                side: 'north', youtubeId: 'so_3HK9HIdg', channelId: '' },
  { name: 'Lake Motosu',                  location: 'Lake Motosu',               side: 'north', youtubeId: '_qdu714QT1E', channelId: '' },
  { name: 'Oshino',                       location: 'Oshino',                    side: 'north', youtubeId: 'sm3xXTfDtGE', channelId: '' },
  { name: 'Mt. Fuji Panoramic Ropeway',   location: 'Tenjoyama Park, Kawaguchiko', side: 'north', youtubeId: 'Sv9hcJ3k5h4', channelId: '' },
  { name: 'FUJIYAMA Tower',               location: 'Fuji-Q Highland',           side: 'north', youtubeId: '_6nLps25Kws', channelId: '' },
  // South
  { name: 'Jukkoku Pass',                 location: 'Hakone',                    side: 'south', youtubeId: '4Hro9QIrsYA', channelId: '' },
  { name: 'Lake Ashinoko',                location: 'Hakone',                    side: 'south', youtubeId: 'maMMEh-2Bsk', channelId: '' },
  { name: 'Hiroshige Mt. Fuji',           location: 'Shizuoka City',             side: 'south', youtubeId: 'GsD9QQEKSzQ', channelId: '' },
  { name: 'Shonan Enoshima',              location: 'Shichirigahama, Kamakura',  side: 'south', youtubeId: '_ddxDN0eMnA', channelId: '' },
  { name: 'Shichimensan, Minobu',         location: 'Minobu',                    side: 'west',  youtubeId: '54NpKx_efis', channelId: '' },
  { name: 'Fujinomiya',                   location: 'Fujinomiya',                side: 'south', youtubeId: 'tDw-LV_EKJM', channelId: '' },
  { name: 'Grinpa, 2nd Station',          location: 'Susono',                    side: 'south', youtubeId: 'Joer2U0vki4', channelId: '' },
];

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

  return {
    updatedAt: new Date().toISOString(),
    forecast,
    cameras: CAMERAS,
  };
}

module.exports = { scrape };
