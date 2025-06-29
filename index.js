const axios = require('axios');
const { parseStringPromise } = require('xml2js');

const POLL_INTERVAL_MS = 2000;
const RSS_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss';

let lastSeenAge = null;
let lastSeenGuid = null;
let intervalId;

async function pollFeed() {
  const now = new Date().toISOString();

  try {
    // 1) HEAD only to check 'age'
    const head = await axios.head(RSS_URL, { timeout: 3000 });
    const age = parseInt(head.headers.age || '0', 10);

    // 2) Decide whether to GET, and log in one line
    if (lastSeenAge === null || age < lastSeenAge) {
      console.log(`${now} – HEAD age: ${age} – new or first, fetching feed`);
      const resp = await axios.get(RSS_URL, {
        timeout: 5000,
        validateStatus: s => s === 200
      });

      // 3) Parse & dedupe by <guid>
      const doc   = await parseStringPromise(resp.data);
      const items = (doc.rss.channel[0].item || []);
      if (items.length) {
        const latest   = items[0];
        const guid     = latest.guid[0];
        if (guid !== lastSeenGuid) {
          lastSeenGuid = guid;
          const title    = latest.title[0];
          const link     = latest.link[0];
          const pubDateS = latest.pubDate[0];
          const pubDate  = new Date(pubDateS);
          const latency  = ((Date.now() - pubDate.getTime()) / 1000).toFixed(1);

          console.log('→ New article found:');
          console.log(`   Title  : ${title}`);
          console.log(`   Link   : ${link}`);
          console.log(`   PubDate: ${pubDateS}`);
          console.log(`   Latency: ${latency} s`);
        }
      }
    } else {
      console.log(`${now} – HEAD age: ${age} – no new feed yet, skipping GET`);
    }

    // 4) Update lastSeenAge for next tick
    lastSeenAge = age;

  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.warn(`${now} – rate limited (429) – consider backing off`);
      clearInterval(intervalId);
    } else {
      console.error(`${now} – error:`, err.message);
    }
  }
}

console.log(`Starting HEAD-first poller every ${POLL_INTERVAL_MS} ms`);
intervalId = setInterval(pollFeed, POLL_INTERVAL_MS);
