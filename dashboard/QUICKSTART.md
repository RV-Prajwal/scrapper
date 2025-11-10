# 🚀 Quick Start Guide

## Installation & Setup (One-Time)

### 1. Navigate to Dashboard Directory
```powershell
cd "C:\Users\PrajwalVenkatesh\Desktop\lead_scraper\dashboard"
```

### 2. Install Dependencies
Dependencies are already installed. If needed, reinstall:
```bash
npm install
```

## Starting the Dashboard

### Option 1: Default Port (5000)
```bash
npm start
```

### Option 2: Custom Port
```bash
$env:PORT=3000; npm start
```

### Option 3: Development Mode
```bash
npm run dev
```

## Accessing the Dashboard

Once running, open your browser:
```
http://localhost:5000
```

Or custom port:
```
http://localhost:3000
```

## Features Overview

### Top Section (Header)
- **📊 Title** - Dashboard branding
- **🔄 Refresh Button** - Manually sync data
- **🟢/🔴 Status** - Connection indicator

### Filter Controls
- **🔍 Search** - Find by name, phone, email, category
- **Category** - Filter by business type
- **Area** - Filter by location
- **Website Status** - Has/No website toggle
- **Min Rating** - Minimum rating threshold
- **Clear Filters** - Reset all filters

### KPI Cards (Top Metrics)
- 📋 Total Leads
- 📱 With Phone
- 💬 With Email
- 🌐 Has Website
- ⭐ Avg Rating
- 📍 Areas

### Charts
- **Doughnut Chart** - Top 10 categories distribution
- **Bar Chart** - Top 10 areas distribution

### Data Table
- Sortable columns (click header)
- Clickable phone numbers (tel:)
- Clickable email addresses (mailto:)
- Website links (opens in new tab)
- Row selection with checkboxes
- Bulk export capability

### Pagination
- Page navigation (Previous/Next)
- Direct page input
- Rows per page selector (10, 25, 50, 100)
- Current page info

### Export Options
- **Export Selected** - Download checked rows
- **Export All Filtered** - Download all filtered results

## Common Tasks

### Search for a Business
1. Enter business name in search box
2. Press Enter or wait for auto-filter
3. Results update in real-time

### Filter by Location
1. Select area from "Area" dropdown
2. Table automatically filters
3. Charts update to show area data

### Export Leads
**Method 1 - Selected Rows:**
1. Check boxes for rows you want
2. Click "Export Selected"
3. CSV downloads automatically

**Method 2 - All Filtered:**
1. Apply any filters you need
2. Click "Export All Filtered"
3. CSV downloads with timestamp

### Change Page Size
1. Select new size from dropdown (10, 25, 50, 100)
2. Table reloads with new page size
3. Pagination updates

### Go to Specific Page
1. Enter page number in "Page" input
2. Press Enter
3. Table jumps to that page

## Real-Time Updates

The dashboard automatically updates when:
- New CSV files are added to `/exports`
- Existing CSV files are modified
- Scraper completes and exports new data

Status indicator shows:
- 🟢 **Connected** - Real-time updates enabled
- 🔴 **Offline** - Check server connection

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | Type in search box |
| Sort Column | Click column header |
| Navigate | Click Previous/Next or page input |
| Select Row | Click checkbox |
| Select All | Click header checkbox |

## Troubleshooting

### "Cannot find module" Error
**Fix:**
```bash
npm install
```

### Port Already in Use
**Fix 1:** Use different port
```bash
$env:PORT=3001; npm start
```

**Fix 2:** Kill process using port 5000
```powershell
Get-Process -Name node | Stop-Process -Force
```

### Dashboard Loads But No Data
**Check:**
1. CSV files exist in `/exports` folder
2. CSV files have proper headers
3. Refresh button shows any data loads

### Real-Time Updates Not Working
**Check:**
1. Connection status shows 🟢
2. New CSV files are in `/exports`
3. Server console for errors

### Export Not Working
**Check:**
1. At least one row is selected
2. Browser allows downloads
3. Sufficient disk space

## File Structure

```
dashboard/
├── server.js           ← Main server file
├── dataManager.js      ← Data processing
├── package.json        ← Dependencies
├── .gitignore          ← Git ignore rules
├── README.md           ← Full documentation
├── QUICKSTART.md       ← This file
└── public/
    ├── index.html      ← UI Structure
    ├── app.js          ← Frontend logic
    └── styles.css      ← Styling
```

## Performance Tips

- **Large Datasets** - Use filters to reduce displayed data
- **Page Size** - Set to 50-100 for faster loading
- **Search** - Use specific terms for better results
- **Charts** - Shows top 10 only for performance

## Data Expectations

CSV files should contain:
- `business_name` - Company name
- `category` - Industry type
- `phone` - Contact number
- `email` - Email address
- `website` - Website URL
- `address` - Street address
- `city` - City name
- `area` - Geographic area
- `rating` - Rating (0-5)
- `reviews_count` - Number of reviews

## Next Steps

1. **Explore Data** - Browse existing leads
2. **Try Filters** - Test filtering by category/area
3. **Export Data** - Download filtered results
4. **View Charts** - Analyze distributions
5. **Monitor Real-Time** - Watch updates as scraper runs

## Support

- **Server Issues** - Check terminal for error messages
- **UI Issues** - Refresh browser (Ctrl+R or Cmd+R)
- **Data Issues** - Verify CSV format in `/exports`
- **Performance** - Reduce page size or filter data

---

**Happy Scraping! 🎉**
