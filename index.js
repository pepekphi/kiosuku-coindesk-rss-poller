const axios = require('axios');
const { parseStringPromise } = require('xml2js');

const RSS_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS, 10) || 2000;

let lastModified = null;

async function pollFeed() {
  try {
    const headers = {};
    if (lastModified) {
      headers['If-Modified-Since'] = lastModified;
    }

    const resp = await axios.get(RSS_URL, {
      headers,
      timeout: 5000,
      validateStatus: s => s === 200 || s === 304
    });

    if (resp.status === 304) {
      console.log(`${new Date().toISOString()} – no change (304)`);
      return;
    }

    // Got new feed data (200)
    console.log(`${new Date().toISOString()} – feed updated (200)`);

    // Update our last‐modified marker
    if (resp.headers['last-modified']) {
      lastModified = resp.headers['last-modified'];
    }

    // Parse only the latest item
    const doc = await parseStringPromise(resp.data);
    const items = doc.rss.channel[0].item;
    if (items && items.length) {
      const latest = items[0];
      const title    = latest.title[0];
      const link     = latest.link[0];
      const pubDateS = latest.pubDate[0];
      const pubDate  = new Date(pubDateS);
      const now      = new Date();
      const latencyS = ((now - pubDate) / 1000).toFixed(1);

      console.log('Latest article:');
      console.log(`  Title : ${title}`);
      console.log(`  Link  : ${link}`);
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

console.log(`Starting poller: interval = ${POLL_INTERVAL} ms`);
setInterval(pollFeed, POLL_INTERVAL);
