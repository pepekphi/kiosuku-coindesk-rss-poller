const axios = require('axios');
const { parseStringPromise } = require('xml2js');

const POLL_INTERVAL_MS = 2000;
const RSS_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss';

let lastSeenAge = null;   // for detecting when age resets
let lastSeenGuid = null;  // for dedupe once we do GET

async function pollFeed() {
  try {
    // 1) HEAD to fetch only headers
    const head = await axios.head(RSS_URL, { timeout: 3000 });
    const age = parseInt(head.headers.age || '0', 10);
    console.log(`${new Date().toISOString()} – HEAD age: ${age}`);

    // 2) Decide whether to GET
    //    - first run (lastSeenAge===null) → GET
    //    - age < lastSeenAge → new content in CDN → GET
    if ( lastSeenAge === null || age < lastSeenAge ) {
      console.log(`${new Date().toISOString()} – fetching full feed (new/first)...`);

      const resp = await axios.get(RSS_URL, {
        timeout: 5000,
        validateStatus: s => s === 200
      });

      // 3) Parse & dedupe by <guid>
      const doc   = await parseStringPromise(resp.data);
      const items = doc.rss.channel[0].item || [];
      if (items.length) {
        const latest = items[0];
        const guid   = latest.guid[0];
        if (guid !== lastSeenGuid) {
          lastSeenGuid = guid;
          const title    = latest.title[0];
          const link     = latest.link[0];
          const pubDateS = latest.pubDate[0];
          const pubDate  = new Date(pubDateS);
          const latency  = ((Date.now() - pubDate.getTime())/1000).toFixed(1);
          console.log('→ New article found:');
          console.log(`   Title  : ${title}`);
          console.log(`   Link   : ${link}`);
          console.log(`   PubDate: ${pubDateS}`);
          console.log(`   Latency: ${latency} s`);
        }
      }
    } else {
      console.log(`${new Date().toISOString()} – no new feed yet, skipping GET`);
    }

    // 4) Update lastSeenAge
    lastSeenAge = age;

  } catch (err) {
    console.error(`${new Date().toISOString()} – error:`, err.message);
  }
}

console.log(`Starting HEAD-first poller every ${POLL_INTERVAL_MS} ms`);
setInterval(pollFeed, POLL_INTERVAL_MS);
