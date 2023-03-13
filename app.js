const axios = require('axios');
const cheerio = require('cheerio');
const { parse: parseUrl } = require('url');

const siteUrl = 'http://localhost:3000';
const maxConcurrency = 15;
const limit = 1000;
let currentLinkCount = 0;

const queue = new Set();
const visited = new Set();
const log = [];

async function verifyLink(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const pageTitle = $('title').text().trim();

    $('a').each((i, link) => {
        
      const href = $(link).attr('href');
      console.log('link', href)
      
      if (!href) {
        console.log('left')
        return;
      }

      if (href[0] === '#') {
        console.log('anchor')
        return;
      }

      let { hostname, pathname } = parseUrl(href);
      if (!hostname) {
        hostname = siteUrl;
      }
      else if (hostname !== siteUrl.hostname) {
        return;
      }

      const targetUrl = siteUrl + pathname;
      console.log('targetUrl: ',targetUrl)
      if (visited.has(targetUrl) || queue.has(targetUrl)) {
        return;
      }

      queue.add(targetUrl);
    });

    log.push({ url, pageTitle, status: response.status });
  } catch (error) {
    log.push({ url, error: error.message });
  }

  visited.add(url);
  currentLinkCount++;
}

async function crawl() {
  while (queue.size > 0 && currentLinkCount < limit) {
    const pending = Array.from(queue).slice(0, maxConcurrency);
    await Promise.all(pending.map(verifyLink));
  }
}

queue.add(siteUrl);

crawl().then(() => {
  console.log(`Crawl complete. Visited ${currentLinkCount} pages.`);
  console.log(`Saving log to file...`);
  saveLog(log);
}).catch(error => {
  console.error(error);
});

function saveLog(log) {
  // Save log to JSON file
  const json = JSON.stringify(log, null, 2);
  require('fs').writeFileSync('log.json', json);

  // Save log to CSV file
  const createCsvWriter = require('csv-writer').createObjectCsvWriter;
  const csvWriter = createCsvWriter({
    path: 'log.csv',
    header: [
      { id: 'url', title: 'URL' },
      { id: 'pageTitle', title: 'Page Title' },
      { id: 'status', title: 'HTTP Status' },
      { id: 'error', title: 'Error' }
    ]
  });
  csvWriter.writeRecords(log).catch(error => console.error(error));

  // Save log to XML file
  const xmlBuilder = require('xmlbuilder');
  const xml = xmlBuilder.create('log');
  log.forEach(item => {
    const entry = xml.ele('entry');
    entry.ele('url', item.url);
    entry.ele('pageTitle', item.pageTitle);
    entry.ele('status', item.status);
    entry.ele('error', item.error);
  });
  require('fs').writeFileSync('log.xml', xml.toString({ pretty: true }));
}
