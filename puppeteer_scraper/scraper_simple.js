import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  city: 'Austin, TX',
  areas: ['78701', '78702', '78703'],
  searchQuery: 'restaurants', // or 'plumbers', 'dentists', 'contractors', etc.
  maxBusinessesPerArea: 50,
  minReviews: 10, // Minimum review count
  minRating: 4.0, // Minimum rating
  outputDir: path.join(__dirname, '..', 'exports'),
  headless: false,
  scrollDelay: 2000,
};

/**
 * Scrape listing page - get ALL data without navigating
 */
async function scrapeListingPage(page, searchQuery, area, maxResults = 50) {
  const businesses = [];
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery + ' in ' + area)}`;
  
  console.log(`Navigating to: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[role="feed"]', { timeout: 30000 });
  await randomDelay(2000, 3000);

  let previousCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 15; // Reduced for faster scraping

  while (scrollAttempts < maxScrollAttempts && businesses.length < maxResults) {
    // Extract data from current view
    const extracted = await page.evaluate(() => {
      const results = [];
      const cards = Array.from(document.querySelectorAll('[role="feed"] > div > div.Nv2PK'));
      
      for (const card of cards) {
        // Main business link
        const mainLink = card.querySelector('a.hfpxzc[href*="/maps/place/"]');
        if (!mainLink || mainLink.href.includes('reserve') || mainLink.href.includes('chooseprovider')) {
          continue;
        }
        
        // Business name
        const nameEl = card.querySelector('[class*="fontHeadlineSmall"]') || card.querySelector('.qBF1Pd');
        const name = nameEl?.textContent?.trim() || null;
        if (!name) continue;
        
        // Rating and review count - parse from aria-label
        const ratingEl = card.querySelector('[role="img"][aria-label*="star"]');
        let rating = null;
        let reviewsCount = null;
        
        if (ratingEl) {
          const ariaLabel = ratingEl.getAttribute('aria-label') || '';
          // Examples: "4.8 stars 16,910 Reviews" or "4.5 stars 2,063 reviews"
          const ratingMatch = ariaLabel.match(/([\d.]+)\s*star/i);
          const reviewMatch = ariaLabel.match(/([\d,]+)\s*review/i);
          
          rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
          reviewsCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : null;
        }
        
        // Address (simple extraction from card)
        const addressSpans = Array.from(card.querySelectorAll('span')).filter(s => 
          s.textContent && s.textContent.includes('·') && (s.textContent.includes('St') || s.textContent.includes('Ave') || s.textContent.includes('Blvd'))
        );
        const address = addressSpans.length > 0 ? addressSpans[0].textContent.trim() : null;
        
        // Check if business appears to have a website button/link
        const websiteButton = card.querySelector('a[href*="://"]') && 
                             !card.querySelector('a[href*="google.com"]');
        const hasWebsite = !!websiteButton;
        
        results.push({
          name,
          rating,
          reviewsCount,
          address,
          hasWebsite,
          url: mainLink.href,
        });
      }
      
      return results;
    });

    // Add new unique businesses
    const existingUrls = new Set(businesses.map(b => b.url));
    for (const biz of extracted) {
      if (!existingUrls.has(biz.url) && businesses.length < maxResults) {
        businesses.push({ ...biz, area });
        existingUrls.add(biz.url);
      }
    }

    console.log(`  Found ${businesses.length} businesses after scroll ${scrollAttempts + 1}`);

    if (businesses.length === previousCount) {
      scrollAttempts++;
    } else {
      scrollAttempts = 0;
      previousCount = businesses.length;
    }

    // Scroll
    if (businesses.length < maxResults) {
      await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        if (feed) feed.scrollTo(0, feed.scrollHeight);
      });
      await randomDelay(CONFIG.scrollDelay, CONFIG.scrollDelay + 500);
    }
  }

  return businesses.slice(0, maxResults);
}

/**
 * Filter qualified leads
 */
function filterQualifiedLeads(businesses, minReviews, minRating) {
  return businesses.filter(biz => {
    // Must NOT have website
    if (biz.hasWebsite) return false;
    
    // Must have sufficient reviews
    if (!biz.reviewsCount || biz.reviewsCount < minReviews) return false;
    
    // Must have good rating
    if (!biz.rating || biz.rating < minRating) return false;
    
    return true;
  });
}

/**
 * Save to CSV
 */
function saveToCSV(businesses, filename) {
  const outputPath = path.join(CONFIG.outputDir, filename);
  
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const headers = ['business_name', 'address', 'area', 'city', 'reviews_count', 'rating', 'has_website', 'url'];
  const rows = businesses.map(biz => [
    biz.name || '',
    biz.address || '',
    biz.area || '',
    CONFIG.city,
    biz.reviewsCount || '',
    biz.rating || '',
    biz.hasWebsite ? 'Yes' : 'No',
    biz.url || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(`✓ Saved ${businesses.length} businesses to ${outputPath}`);
}

function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Starting simplified lead scraper...\n');

  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });

  const allBusinesses = [];

  // Scrape each area
  for (const area of CONFIG.areas) {
    console.log(`\n📍 Scraping area: ${area}`);
    
    try {
      const businesses = await scrapeListingPage(
        page,
        CONFIG.searchQuery,
        `${area}, ${CONFIG.city}`,
        CONFIG.maxBusinessesPerArea
      );
      
      allBusinesses.push(...businesses);
      console.log(`✓ Completed ${area}: ${businesses.length} businesses`);
    } catch (error) {
      console.error(`✗ Error in ${area}:`, error.message);
    }
  }

  await browser.close();

  // Save all results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  saveToCSV(allBusinesses, `all_businesses_${timestamp}.csv`);

  // Filter and save qualified leads (no website + good reviews)
  const qualifiedLeads = filterQualifiedLeads(allBusinesses, CONFIG.minReviews, CONFIG.minRating);
  saveToCSV(qualifiedLeads, `qualified_leads_no_website_${timestamp}.csv`);

  console.log(`\n✅ Scraping complete!`);
  console.log(`   Total businesses: ${allBusinesses.length}`);
  console.log(`   Qualified leads (no website, ${CONFIG.minReviews}+ reviews, ${CONFIG.minRating}+ rating): ${qualifiedLeads.length}`);
  console.log(`\n💡 Qualified leads saved to: qualified_leads_no_website_${timestamp}.csv`);
}

main().catch(console.error);
