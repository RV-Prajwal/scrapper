import puppeteer from 'puppeteer';
import fs from 'fs';

async function debug() {
  const browser = await puppeteer.launch({
    headless: false, // Watch what happens
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  const searchUrl = 'https://www.google.com/maps/search/restaurants+in+78701,+Austin,+TX';
  
  console.log('Navigating to:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  
  console.log('Waiting for results...');
  await page.waitForSelector('[role="feed"]', { timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Take screenshot
  await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
  console.log('Screenshot saved: debug_screenshot.png');

  // Get HTML of the feed
  const feedHTML = await page.$eval('[role="feed"]', el => el.innerHTML);
  fs.writeFileSync('debug_feed.html', feedHTML, 'utf-8');
  console.log('Feed HTML saved: debug_feed.html');

  // Try to find business cards
  const links = await page.$$('[role="feed"] a');
  console.log(`\nFound ${links.length} links in feed`);

  // Sample first 3 links
  for (let i = 0; i < Math.min(3, links.length); i++) {
    const data = await links[i].evaluate(el => {
      return {
        href: el.href,
        innerHTML: el.innerHTML.substring(0, 500), // First 500 chars
        outerHTML: el.outerHTML.substring(0, 500),
      };
    });
    console.log(`\n--- Link ${i + 1} ---`);
    console.log('URL:', data.href);
    console.log('HTML preview:', data.innerHTML.substring(0, 200));
  }

  // Try different selectors for business names
  console.log('\n--- Testing selectors ---');
  const selectors = [
    '[class*="fontHeadline"]',
    '[class*="qBF1Pd"]',
    'div[jstcache]',
    'a[href*="/maps/place/"] div',
    '[role="feed"] a div div div',
  ];

  for (const selector of selectors) {
    const count = await page.$$eval(selector, els => els.length);
    console.log(`${selector}: ${count} matches`);
    if (count > 0) {
      const sample = await page.$eval(selector, el => el.textContent?.trim() || '');
      console.log(`  Sample: "${sample.substring(0, 100)}"`);
    }
  }

  console.log('\n✓ Debug complete. Press Ctrl+C to close browser.');
  
  // Keep browser open for manual inspection
  await new Promise(() => {}); // Wait forever
}

debug().catch(console.error);
