import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // If locations is provided, scraper will use those directly; otherwise it will use (areas x city)
  city: 'Austin, TX',
  areas: ['78701', '78702', '78703'],
  // North America sample locations (city-wide or ZIP/postal prefixes)
  locations: [
    'New York, NY', '10001, New York, NY', '10002, New York, NY',
    'Los Angeles, CA', '90001, Los Angeles, CA', '90002, Los Angeles, CA',
    'Chicago, IL', '60601, Chicago, IL', '60602, Chicago, IL',
    'Miami, FL', '33101, Miami, FL', '33130, Miami, FL',
    'Dallas, TX', '75201, Dallas, TX', '75204, Dallas, TX',
    'San Francisco, CA', '94102, San Francisco, CA', '94103, San Francisco, CA',
    'Seattle, WA', '98101, Seattle, WA', '98109, Seattle, WA',
    'Boston, MA', '02108, Boston, MA', '02116, Boston, MA',
    'Toronto, ON, Canada', 'M5V, Toronto, ON, Canada', 'M4W, Toronto, ON, Canada',
    'Vancouver, BC, Canada', 'V6B, Vancouver, BC, Canada', 'V6E, Vancouver, BC, Canada'
  ],
  // Search multiple local business categories per area (expandable)
  categories: [
    // TOP PRIORITY - E-commerce & Retail
    'online store', 'e-commerce', 'retail shop', 'boutique', 'gift shop', 'specialty store',
    'jewelry store', 'clothing store', 'hat shop', 'shoe store', 'furniture store', 'hardware store',
    'thrift store', 'trophy shop', 'ornament shop',

    // TOP PRIORITY - Professional Services
    'law firm', 'lawyer', 'attorney', 'accounting firm', 'accountant', 'tax preparer',
    'consulting firm', 'management consultant', 'business consultant',

    // TOP PRIORITY - Healthcare
    'family doctor', 'physician', 'medical practice', 'urgent care', 'clinic', 'pharmacy',
    'dentist', 'dental office', 'chiropractor', 'physical therapy',

    // TOP PRIORITY - Real Estate
    'real estate agent', 'real estate office', 'realty', 'property management', 'real estate broker',

    // TOP PRIORITY - Financial Services
    'bank', 'credit union', 'insurance agency', 'insurance broker', 'financial advisor',
    'investment firm', 'mortgage broker',

    // TOP PRIORITY - Technology & SaaS
    'software company', 'tech support', 'computer repair', 'IT services', 'web design',
    'web developer', 'phone repair', 'electronics store',

    // TOP PRIORITY - Restaurants & Hospitality
    'restaurant', 'restaurants', 'pizza restaurant', 'coffee shop', 'bakery', 'cafe',
    'bar', 'pub', 'hotel', 'motel', 'bed and breakfast',

    // TOP PRIORITY - Local Services (Trades)
    'plumber', 'plumbers', 'electrician', 'electricians', 'roofer', 'roofers',
    'hvac', 'air conditioning repair', 'heating contractor', 'handyman',
    'painting contractor', 'flooring contractor', 'remodeling contractor', 'fence contractor',

    // TOP PRIORITY - Education
    'school', 'college', 'university', 'training center', 'tutoring', 'language school',
    'music school', 'martial arts school',

    // TOP PRIORITY - B2B Manufacturing & Wholesale
    'manufacturer', 'wholesaler', 'distributor', 'supplier', 'industrial services',

    // Additional high-value local services
    'auto repair', 'tire shop', 'car wash', 'towing service', 'auto glass shop',
    'pool service', 'landscaping', 'tree service', 'lawn care', 'pest control',
    'carpet cleaning', 'pressure washing', 'barber shop', 'nail salon',
    'beauty salon', 'spa', 'gym', 'yoga studio', 'pet groomer', 'veterinarian',
    'appliance repair', 'locksmith', 'movers', 'storage', 'bike shop'
  ],
  maxBusinessesPerArea: 50,
  outputDir: path.join(__dirname, '..', 'exports'),
  headless: 'new', // 'new' for headless Chrome
  scrollDelay: 2000,
  detailsDelay: 1000,
};

/**
 * Scrape Google Maps for businesses in a specific area
 */
async function scrapeGoogleMaps(page, searchQuery, area, maxResults = 50) {
  const businesses = [];
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery + ' in ' + area)}`;
  
  console.log(`Navigating to: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  
  // Handle consent/cookie banners if present and wait for results to load (with retry & fallback)
  await dismissConsent(page);
  try {
    await page.waitForSelector('[role="feed"]', { timeout: 90000 });
  } catch (e) {
    console.warn('Feed not found within 90s, retrying after reload...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await dismissConsent(page);
    try {
      await page.waitForSelector('[role\="feed\"]', { timeout: 60000 });
    } catch (e2) {
      console.warn('Falling back to waiting for result cards (.Nv2PK)');
      await page.waitForSelector('[role\="feed\"] > div > div.Nv2PK, .Nv2PK', { timeout: 60000 });
    }
  }
  await randomDelay(2000, 3000);

  let previousCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 20;

  // Scroll to load all results
  while (scrollAttempts < maxScrollAttempts && businesses.length < maxResults) {
    // Extract all business data from current view
    const extracted = await page.evaluate(() => {
      const results = [];
      const debugInfo = { totalCards: 0, extracted: 0, noName: 0, noUrl: 0 };
      
      // Find all business card containers
      const cards = Array.from(document.querySelectorAll('[role="feed"] > div > div.Nv2PK'));
      debugInfo.totalCards = cards.length;
      
      for (const card of cards) {
        // Find the main business link (first link that goes to /maps/place/)
        const mainLink = card.querySelector('a.hfpxzc[href*="/maps/place/"]');
        
        if (!mainLink || mainLink.href.includes('reserve') || mainLink.href.includes('chooseprovider')) {
          continue;
        }
        
        // Get business name from the card (not inside the link)
        const nameEl = card.querySelector('[class*="fontHeadlineSmall"]') || 
                      card.querySelector('.qBF1Pd.fontHeadlineSmall') ||
                      card.querySelector('.qBF1Pd');
        const name = nameEl?.textContent?.trim() || null;
        
        if (!name) {
          debugInfo.noName++;
          continue;
        }
        
        // Get rating and review count from the card
        const ratingImg = card.querySelector('[role="img"][aria-label*="star"]');
        let rating = null;
        let reviewsCount = null;
        
        if (ratingImg) {
          const label = ratingImg.getAttribute('aria-label') || '';
          const ratingMatch = label.match(/(\d+\.?\d*)\s*star/);
          const reviewMatch = label.match(/([\d,]+)\s*review/);
          
          rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
          if (reviewMatch) {
            reviewsCount = parseInt(reviewMatch[1].replace(/,/g, ''));
          }
        }
        
        results.push({
          name,
          rating,
          reviewsCount,
          url: mainLink.href,
        });
        debugInfo.extracted++;
      }
      
      return { results, debugInfo };
    });
    
    console.log(`  Debug: ${extracted.debugInfo.totalCards} cards, ${extracted.debugInfo.extracted} extracted, ${extracted.debugInfo.noName} no name`);
    
    // Add new unique businesses
    const existingUrls = new Set(businesses.map(b => b.url));
    for (const biz of extracted.results) {
      if (!existingUrls.has(biz.url) && businesses.length < maxResults) {
        businesses.push({ ...biz, area });
        existingUrls.add(biz.url);
      }
    }
    
    console.log(`Found ${businesses.length} unique businesses after scroll ${scrollAttempts + 1}`);
    
    if (businesses.length === previousCount) {
      scrollAttempts++;
    } else {
      scrollAttempts = 0;
      previousCount = businesses.length;
    }

    // Scroll down in the results panel
    if (businesses.length < maxResults) {
      await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        if (feed) {
          feed.scrollTo(0, feed.scrollHeight);
        } else {
          window.scrollBy(0, window.innerHeight);
        }
      });
      await randomDelay(CONFIG.scrollDelay, CONFIG.scrollDelay + 1000);
    }
  }

  console.log(`Collected ${businesses.length} businesses for ${area}`);
  return businesses.slice(0, maxResults);
}

/**
 * Get detailed information for a business
 */
async function getBusinessDetails(page, business) {
  try {
    console.log(`Getting details for: ${business.name}`);
    await page.goto(business.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay(CONFIG.detailsDelay, CONFIG.detailsDelay + 500);

    // Extract details from the business page
    const details = await page.evaluate(() => {
      const getTextContent = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      const getAttributeContent = (selector, attr) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) : null;
      };

      // Phone number
      const phoneButton = Array.from(document.querySelectorAll('button[data-item-id*="phone"]'))
        .find(btn => btn.getAttribute('data-item-id')?.includes('phone'));
      const phone = phoneButton ? phoneButton.getAttribute('data-item-id').replace('phone:tel:', '') : null;

      // Address
      const addressButton = Array.from(document.querySelectorAll('button[data-item-id*="address"]'))
        .find(btn => btn.getAttribute('data-item-id')?.includes('address'));
      const address = addressButton ? addressButton.getAttribute('aria-label') : null;

      // Website
      const websiteLink = Array.from(document.querySelectorAll('a[data-item-id*="authority"]'))
        .find(link => link.getAttribute('data-item-id')?.includes('authority'));
      const website = websiteLink ? websiteLink.href : null;

      return {
        phone,
        address,
        website,
      };
    });

    return {
      ...business,
      ...details,
      detailsFetched: true,
    };
  } catch (error) {
    console.error(`Failed to get details for ${business.name}:`, error.message);
    return {
      ...business,
      detailsFetched: false,
      error: error.message,
    };
  }
}

/**
 * Filter qualified leads: ONLY businesses with no website.
 * Age and review count are NOT considered.
 */
function filterQualifiedLeads(businesses) {
  return businesses.filter(biz => {
    const hasNoWebsite = !biz.website || biz.website.includes('google.com');
    return hasNoWebsite && biz.detailsFetched;
  });
}

/**
 * Save results to CSV (fresh file)
 */
function saveToCSV(businesses, filename) {
  const outputPath = path.join(CONFIG.outputDir, filename);
  
  // Ensure exports directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const headers = ['business_name', 'address', 'phone', 'website', 'area', 'city', 'category', 'reviews_count', 'rating', 'url'];
  const rows = businesses.map(biz => [
    biz.name || '',
    biz.address || '',
    biz.phone || '',
    biz.website || '',
    biz.area || '',
    (biz.city || biz.area || ''),
    biz.category || '',
    biz.reviewsCount || '',
    biz.rating || '',
    biz.url || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/\"/g, '""')}"`).join(','))
  ].join('\n');

  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(`✓ Saved ${businesses.length} businesses to ${outputPath}`);
}

function csvEscape(cell) {
  return '"' + String(cell ?? '').replace(/"/g, '""') + '"';
}

function appendToCSV(businesses, filename) {
  if (!businesses || !businesses.length) return;
  const outputPath = path.join(CONFIG.outputDir, filename);
  if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  const headers = ['business_name', 'address', 'phone', 'website', 'area', 'city', 'category', 'reviews_count', 'rating', 'url'];
  const lines = [];
  if (!fs.existsSync(outputPath)) {
    lines.push(headers.join(','));
  }
  for (const biz of businesses) {
    const row = [
      biz.name || '',
      biz.address || '',
      biz.phone || '',
      biz.website || '',
      biz.area || '',
      (biz.city || biz.area || ''),
      biz.category || '',
      biz.reviewsCount || '',
      biz.rating || '',
      biz.url || '',
    ];
    lines.push(row.map(csvEscape).join(','));
  }
  fs.appendFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
  console.log(`• Appended ${businesses.length} rows to ${outputPath}`);
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

/**
 * Random delay to mimic human behavior
 */
function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Try to dismiss common Google consent/cookie dialogs
async function dismissConsent(page) {
  try {
    // Give DOM a brief moment
    await page.waitForTimeout(500);
    // Look for likely buttons
    const candidates = await page.$$eval('button, div[role="button"]', els => els.map(el => ({
      text: (el.innerText || '').trim().toLowerCase(),
      aria: (el.getAttribute('aria-label') || '').trim().toLowerCase()
    })));
    const wanted = ['accept all', 'i agree', 'agree', 'accept'];
    const match = candidates.find(c => wanted.some(w => c.text.includes(w) || c.aria.includes(w)));
    if (match) {
      await page.evaluate((wanted) => {
        const els = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const lowerWanted = wanted.map(w => w.toLowerCase());
        const target = els.find(el => {
          const text = (el.innerText || '').trim().toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
          return lowerWanted.some(w => text.includes(w) || aria.includes(w));
        });
        if (target) (target).click();
      }, wanted);
      await page.waitForTimeout(500);
    }
  } catch (_) {
    // ignore
  }
}

/**
 * Main scraper function
 */
async function main() {
  console.log('🚀 Starting Puppeteer scraper...\n');

  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ],
  });

  const page = await browser.newPage();

  // Anti-detection measures
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  
  await page.setViewport({ width: 1920, height: 1080 });

  // Block unnecessary resources to speed up
  await page.setRequestInterception(true);
  page.on('request', req => {
    const resourceType = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  const allBusinesses = [];

// Build target locations: prefer CONFIG.locations if provided, otherwise expand areas x city
const targets = Array.isArray(CONFIG.locations) && CONFIG.locations.length
  ? CONFIG.locations
  : (CONFIG.areas || []).map(a => `${a}, ${CONFIG.city}`);

// Scrape each target and category
for (const target of targets) {
  console.log(`\n📍 Scraping location: ${target}`);
  
  for (const category of CONFIG.categories) {
    console.log(`  🔎 Category: ${category}`);
    try {
      // Get business list for this category
      const businesses = await scrapeGoogleMaps(
        page,
        category,
        target,
        CONFIG.maxBusinessesPerArea
      );

      const batchAll = [];
      const targetSlug = slug(target);
      const categorySlug = slug(category);

      // Get details for each business
      for (const biz of businesses) {
        const detailed = await getBusinessDetails(page, biz);
        const withMeta = { ...detailed, category, city: target };
        allBusinesses.push(withMeta);
        batchAll.push(withMeta);
        await randomDelay(800, 1600); // Polite delay between requests
      }

      // Incremental save (all)
      appendToCSV(batchAll, `all_businesses_inc_${targetSlug}_${categorySlug}.csv`);

      // Filter and incremental save (qualified) with live logs
      const qualifiedBatch = filterQualifiedLeads(batchAll);
      for (const q of qualifiedBatch) {
        console.log(`[QUALIFIED] ${q.name || ''} | ${category} | ${target}`);
      }
      appendToCSV(qualifiedBatch, `qualified_leads_inc_${targetSlug}_${categorySlug}.csv`);

      console.log(`  ✓ Completed category: ${category}`);
    } catch (error) {
      console.error(`  ✗ Error scraping category ${category} in ${target}:`, error.message);
    }
  }

  console.log(`✓ Completed location: ${target}`);
}

  await browser.close();

  // Save all results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  saveToCSV(allBusinesses, `all_businesses_${timestamp}.csv`);

  // Filter and save qualified leads
  const qualifiedLeads = filterQualifiedLeads(allBusinesses, 10);
  saveToCSV(qualifiedLeads, `qualified_leads_${timestamp}.csv`);

  console.log(`\n✅ Scraping complete!`);
  console.log(`   Total businesses: ${allBusinesses.length}`);
  console.log(`   Qualified leads: ${qualifiedLeads.length}`);
}

// Run scraper
main().catch(console.error);
