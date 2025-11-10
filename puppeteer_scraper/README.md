# Puppeteer Lead Scraper

Browser-based scraper for Google Maps business listings (no API key required).

## Features

- ✅ Scrapes Google Maps without API (free)
- ✅ Extracts: name, address, phone, website, rating, reviews
- ✅ Filters qualified leads (no website + sufficient reviews)
- ✅ Anti-detection: realistic user agent, random delays
- ✅ Resource blocking for faster scraping
- ✅ Exports to CSV

## Setup

1. **Install Node.js** (if not installed): https://nodejs.org/

2. **Install dependencies:**
   ```bash
   cd puppeteer_scraper
   npm install
   ```

3. **Configure** (edit `scraper.js` lines 10-18):
   ```js
   const CONFIG = {
     city: 'Austin, TX',              // Your target city
     areas: ['78701', '78702'],        // ZIP codes or neighborhoods
     searchQuery: 'restaurants',       // Business type
     maxBusinessesPerArea: 50,         // Results per area
     headless: 'new',                  // 'new' = invisible, false = watch browser
     scrollDelay: 2000,                // ms between scrolls
     detailsDelay: 1000,               // ms between detail fetches
   };
   ```

## Usage

**Run scraper:**
```bash
npm start
```

**Watch it work** (opens browser):
```js
// In scraper.js, change:
headless: false
```

## Output

Results saved to `../exports/`:
- `all_businesses_TIMESTAMP.csv` - All scraped businesses
- `qualified_leads_TIMESTAMP.csv` - Filtered leads (no website, >10 reviews)

## Tips

### Avoid blocks:
- **Slow down**: increase `scrollDelay` and `detailsDelay`
- **Reduce volume**: lower `maxBusinessesPerArea`
- **Add stealth plugin**:
  ```bash
  npm install puppeteer-extra puppeteer-extra-plugin-stealth
  ```
  ```js
  import puppeteer from 'puppeteer-extra';
  import StealthPlugin from 'puppeteer-extra-plugin-stealth';
  puppeteer.use(StealthPlugin());
  ```

### Change target site:
Modify `scrapeGoogleMaps()` and `getBusinessDetails()` selectors for other sites.

### Handle errors:
- **Timeout**: increase timeouts in `goto()` calls
- **Selectors changed**: inspect page and update CSS selectors
- **Rate limiting**: add longer delays or rotate IPs

## Comparison: Puppeteer vs Google Places API

| Feature | Puppeteer (This) | Google Places API (Python) |
|---------|------------------|----------------------------|
| Cost | Free | $0.017/place details call |
| Speed | Slower (1-2s/business) | Faster (300ms/business) |
| Reliability | Fragile (Google changes HTML) | Stable (official API) |
| Data Quality | Good | Excellent |
| Blocking Risk | Medium | None |
| Scalability | Limited (100s) | High (1000s) |

**Recommendation**: Use Puppeteer for small-scale prototypes or when API costs are prohibitive. Use API for production.
