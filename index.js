const axios = require('axios');
const { parseStringPromise } = require('xml2js');

// Poll interval in milliseconds — adjust this value as needed
const POLL_INTERVAL_MS = 2000;

const RSS_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss';

let lastModified = null;
let savedEtag = null;

async function pollFeed() {
  try {
    const headers = {};
    if (lastModified) {
      headers['If-Modified-Since'] = lastModified;
    }
    if (savedEtag) {
      headers['If-None-Match'] = savedEtag;
    }

    const resp = await axios.get(RSS_URL, {
      headers,
      timeout: 5000,
      validateStatus: s => s === 200 || s === 304
    });

    // **Log all response headers so you can inspect ETag / Last-Modified / cache settings**
    console.log('Response headers:', resp.headers);

    if (resp.status === 304) {
      console.log(`${new Date().toISOString()} – no change (304)`);
      return;
    }

    console.log(`${new Date().toISOString()} – feed updated (200)`);

    // Capture Last-Modified and ETag if present
    if (resp.headers['last-modified']) {
      lastModified = resp.headers['last-modified'];
    }
    if (resp.headers.etag) {
      savedEtag = resp.headers.etag;
    }

    const doc = await parseStringPromise(resp.data);
    const items = doc.rss.channel[0].item;
    if (items && items.length) {
      const latest   = items[0];
      const title    = latest.title[0];
      const link     = latest.link[0];
      const pubDateS = latest.pubDate[0];
      const pubDate  = new Date(pubDateS);
      const now      = new Date();
      const latencyS = ((now - pubDate) / 1000).toFixed(1);

      console.log('Latest article:');
      console.log(`  Title  : ${title}`);
      console.log(`  Link   : ${link}`);
      console.log(`  PubDate: ${pubDateS}`);
      console.log(`  Latency: ${latencyS} s`);
    }

  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.warn(`${new Date().toISOString()} – rate limited (429)`);
    } else {
      console.error(`${new Date().toISOString()} – error:`, err.message);
    }
  }
}

console.log(`Starting poller: interval = ${POLL_INTERVAL_MS} ms`);
setInterval(pollFeed, POLL_INTERVAL_MS);
