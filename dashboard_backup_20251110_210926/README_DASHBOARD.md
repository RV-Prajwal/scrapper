# 📊 Lead Scraper Dashboard - Enhanced UI

## Overview

The redesigned Lead Scraper Dashboard provides a modern, fully-featured interface for analyzing, filtering, and exporting qualified leads from your Puppeteer scraper. Built with vanilla JavaScript, it offers real-time updates, advanced filtering, pagination, sorting, and bulk operations.

---

## ✨ New Features

### 1. **Advanced Leads Table**
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Paginated Display**: Configurable page sizes (10, 25, 50, 100 leads per page)
- **Column Sorting**: Click any column header to sort data (ascending/descending)
- **Row Selection**: Select individual rows or entire pages with checkboxes
- **Action Buttons**: Copy phone numbers, view Google Maps links directly from the table

### 2. **Enhanced Filters**
- **Status Filter**: Toggle between "No Website," "Has Website," or "All"
- **Area Filter**: Filter leads by geographic area/location
- **Category Filter**: Filter by business category
- **Min Rating Filter**: Show only leads with ratings above a threshold
- **Search Box**: Real-time search across business names, phone, addresses, and more

### 3. **Bulk Operations**
- **Select All Checkbox**: Select all leads on current page or all filtered results
- **Bulk Export**: Export selected leads to CSV with one click
- **Export All Filtered**: Export all leads matching current filter criteria

### 4. **Enhanced KPIs**
- **Total Leads**: Count of all leads in dataset
- **No Website**: Count of leads without online presence
- **With Phone**: Count of leads with phone numbers on file
- **Areas**: Number of unique geographic areas
- **Categories**: Number of unique business categories
- **Avg Rating**: Average business rating across filtered leads

### 5. **Smart Analytics**
- **Top Categories Chart**: Bar chart showing leads by business category
- **Top Areas Chart**: Bar chart showing leads by geographic area
- **Dynamic Updates**: Charts refresh as filters are applied

---

## 🚀 Quick Start

### Running the Dashboard

```bash
cd dashboard
npm install
npm start
```

The dashboard will be available at `http://localhost:3000`

### Prerequisites

- Node.js 14+
- CSV files in `../exports/` directory from the Puppeteer scraper

---

## 📋 Table Columns

| Column | Description | Sortable |
|--------|-------------|----------|
| **Business Name** | Lead company name | ✅ Yes |
| **Category** | Business category/industry | ✅ Yes |
| **Phone** | Contact phone number | ✅ Yes |
| **Address** | Business address | ✅ No |
| **City** | City/locality | ✅ No |
| **Area** | Geographic area/ZIP | ✅ Yes |
| **Rating** | Business rating (1-5 stars) | ✅ Yes |
| **Reviews** | Number of reviews | ✅ Yes |
| **Website** | Website status (Visit link or "No Website" badge) | ✅ No |
| **Actions** | Copy phone, View on Maps | ✅ No |

---

## 🔍 Filter Examples

### Find high-quality plumbers with no website
1. Set **Filter by Status** → "No Website"
2. Set **Filter by Category** → "plumbers"
3. Set **Min Rating** → "4.0"
4. Results: Ready-to-contact plumbers

### Export all electricians in New York
1. Set **Filter by Area** → "New York, NY"
2. Set **Filter by Category** → "electricians"
3. Click **📥 Export All Filtered**
4. CSV file downloads automatically

### Search for businesses with phone number
1. Enter search term like "phone" or specific company name
2. Results filter in real-time
3. Use "Copy" button to extract phone numbers

---

## 📊 Pagination Controls

### Features
- **Previous/Next Buttons**: Navigate between pages
- **Page Input**: Jump directly to a specific page
- **Page Size Selector**: Choose 10, 25, 50, or 100 leads per page
- **Record Info**: Shows "Showing X to Y of Z leads"

### Example
- Total: 189 leads
- Page Size: 25
- Pages: 8 total
- Current: Page 1 → showing 1-25

---

## 💾 Export Options

### Export All Filtered
- Exports **all** leads matching current filters
- Filename: `qualified_leads_YYYY-MM-DD.csv`
- Includes all columns

### Export Selected
- Exports only **checked** rows
- Filename: `selected_leads_YYYY-MM-DD.csv`
- Button shows selected count: "📥 Export Selected (5)"

### CSV Format
Includes columns:
- business_name
- address
- phone
- website
- area
- city
- category
- reviews_count
- rating
- url

---

## 🎨 UI/UX Features

### Responsive Design
- **Desktop (1440px+)**: Full 6-column KPI grid, 2-column charts
- **Tablet (768px-1024px)**: 3-column KPI grid, 1-column charts
- **Mobile (<768px)**: 2-column KPI grid, stacked filters, scrollable table

### Visual Indicators
- **"No Website" Badge**: Red tag for leads without online presence
- **Action Buttons**: Hover effects show available operations
- **Row Highlighting**: Selected rows show blue highlight
- **Sortable Headers**: Hover shows sort indicator (⇅)
- **KPI Cards**: Hover effect lifts cards for better feedback

### Performance
- **Live Pagination**: Only current page rendered
- **Efficient Sorting**: Numeric sorts for ratings/reviews
- **Event Delegation**: Minimal event listeners
- **Lazy Chart Updates**: Charts only update on data change

---

## 📱 Mobile-Responsive Features

### Table Responsiveness
- Horizontal scrolling on small screens
- Compact cell padding on mobile
- Touch-friendly button sizes
- Readable font sizes

### Filter Layout
- Filters stack vertically on mobile
- Full-width filter inputs
- Stacked KPI cards (2x3 grid)
- Bottom pagination section

---

## ⌨️ Keyboard Shortcuts & Interactions

### Click Interactions
- **Column Header**: Sort by that column
- **Phone Number**: Link to phone call (tel:)
- **"Visit" Button**: Open website in new tab
- **"Maps" Button**: Open Google Maps in new tab
- **"Copy" Button**: Copy phone to clipboard

### Checkbox Interactions
- **Header Checkbox**: Select all on current page
- **"Select All" Toggle**: Select all filtered leads
- **Row Checkbox**: Individual row selection

---

## 📈 Data State Management

### State Variables
```javascript
state = {
  allRows: [],           // All loaded leads
  filteredRows: [],      // After filters applied
  currentPage: 1,        // Current pagination page
  pageSize: 25,          // Leads per page
  sortField: null,       // Current sort column
  sortAsc: true,         // Sort direction
  selectedRows: Set(),   // Selected lead URLs
}
```

### Filter Priority
1. **Status Filter** (No Website / Has Website / All)
2. **Min Rating Filter** (numerical comparison)
3. **Area Filter** (exact match)
4. **Category Filter** (exact match)
5. **Search Filter** (substring in multiple fields)

---

## 🔄 Live Updates

### Server-Sent Events (SSE)
- Dashboard connects to `/api/stream` on load
- New qualified leads trigger immediate updates
- Charts and KPIs refresh without page reload
- Maintains current page position

---

## 📊 KPI Calculations

### Total Leads
All rows in filtered dataset

### No Website
Count where: `!website || website.includes('google.com')`

### With Phone
Count where: `phone && phone.trim().length > 0`

### Areas
Unique count of `area` field

### Categories
Unique count of `category` field

### Avg Rating
Average of `rating` field (numeric)

---

## 🛠️ Technical Details

### Stack
- **Frontend**: Vanilla JavaScript (ES6+)
- **Charts**: Chart.js 4.4
- **Styling**: Custom CSS (Grid, Flexbox)
- **Backend**: Express.js
- **Data**: CSV files from scraper

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

### File Structure
```
dashboard/
├── public/
│   ├── index.html      # Main HTML template
│   ├── styles.css      # All styling
│   ├── app.js          # Main application logic
├── server.js           # Express backend
├── dataManager.js      # Data processing
└── package.json        # Dependencies
```

---

## 🐛 Troubleshooting

### Dashboard not loading
- Ensure CSV files exist in `../exports/`
- Check server is running on port 3000
- Open browser console (F12) for errors

### Filters not working
- Clear search box and other filters
- Try refreshing the page
- Check that data loaded (see KPI counts)

### Export not working
- Ensure rows are selected before exporting
- Check browser download settings
- Try different export format

### Charts not showing
- Ensure filters return at least one lead
- Check for category/area data in CSV
- Wait a moment for Chart.js to initialize

---

## 📞 Support

For issues with:
- **Dashboard UI**: Check browser console (F12)
- **Data Loading**: Verify CSV files in exports/
- **Scraper**: See `../puppeteer_scraper/README.md`

---

## 📝 Version History

### v2.0 (Current)
- ✨ Complete UI redesign
- 🎯 Advanced pagination & sorting
- 📊 Bulk selection & export
- 🔍 Enhanced filtering
- 📱 Full mobile responsiveness
- ⚡ Real-time updates via SSE

### v1.0
- Basic table display
- Simple filtering
- Chart visualization

---

## 🎯 Planned Features

- [ ] CSV import for custom leads
- [ ] Lead status tracking (contacted, converted, etc.)
- [ ] Email integration for bulk outreach
- [ ] API for programmatic access
- [ ] Dark/Light mode toggle
- [ ] Export templates

---

**Last Updated**: 2025-11-10  
**Dashboard Version**: 2.0
