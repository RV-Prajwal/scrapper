# 📊 Lead Scraper Dashboard v2.0

A modern, responsive real-time dashboard for managing and analyzing scraped leads with advanced filtering, visualization, and export capabilities.

## ✨ Features

### Core Features
- **Real-Time Updates** - Live Server-Sent Events (SSE) for instant data synchronization
- **Advanced Filtering** - Filter by category, area, website status, and rating
- **Full-Text Search** - Search across business names, phone numbers, emails, and categories
- **Data Visualization** - Interactive charts showing distribution by category and area
- **Paginated Table** - Efficient display of large datasets with customizable page sizes
- **Bulk Export** - Export filtered, selected, or all leads to CSV format
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices

### KPI Metrics
- Total Leads
- Leads with Phone Numbers
- Leads with Email Addresses
- Leads with Websites
- Average Rating
- Unique Geographic Areas

### Data Management
- **CSV File Processing** - Automatically processes qualified leads and all businesses
- **Sortable Columns** - Click column headers to sort data
- **Row Selection** - Select individual or all rows for bulk operations
- **Real-Time Sync** - Watches export directory for new/updated CSV files

## 🚀 Getting Started

### Prerequisites
- Node.js 14+ and npm
- Express.js
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Install dependencies:**
```bash
cd dashboard
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Access the dashboard:**
Open your browser and navigate to:
```
http://localhost:5000
```

### Port Configuration
By default, the server runs on port 5000. To use a different port:
```bash
PORT=3000 npm start
```

## 📁 Project Structure

```
dashboard/
├── server.js              # Express server & API endpoints
├── dataManager.js         # Data processing and statistics
├── package.json           # Dependencies and scripts
├── README.md              # This file
└── public/
    ├── index.html         # Main HTML structure
    ├── app.js             # Frontend logic and interactions
    └── styles.css         # Responsive styling
```

## 🔌 API Endpoints

### Statistics
- **GET `/api/stats`** - Get current statistics and metrics

### Data
- **GET `/api/leads`** - Get paginated leads with filters
  - Query parameters: `page`, `pageSize`, `search`, `category`, `area`, `hasWebsite`, `minRating`

### Filters
- **GET `/api/filters`** - Get available filter options (categories, areas)

### Export
- **POST `/api/export`** - Export filtered data to CSV
  - Body: `{ filters: {...} }`

### Real-Time
- **GET `/api/stream`** - Server-Sent Events stream for live updates
  - Messages: `file_added`, `file_changed`, `data_refreshed`

### Admin
- **POST `/api/refresh`** - Force refresh all data from CSV files

## 🎨 UI Components

### Header
- Dashboard title and description
- Refresh button for manual data sync
- Real-time connection status indicator

### Filters Section
- **Search Input** - Full-text search across multiple fields
- **Category Filter** - Dropdown with available categories
- **Area Filter** - Dropdown with available geographic areas
- **Website Status** - Filter by has/no website
- **Min Rating** - Numeric filter for minimum rating
- **Clear Filters** - Button to reset all filters

### KPI Cards
Six key performance indicator cards displaying:
- Total leads count
- Phone contact availability
- Email contact availability
- Website presence
- Average rating
- Number of areas covered

### Charts
- **Category Distribution** - Doughnut chart showing top 10 categories
- **Area Distribution** - Bar chart showing top 10 areas

### Data Table
- **Columns**: Business Name, Category, Phone, Address, City, Rating, Reviews, Website, Email
- **Features**:
  - Clickable phone numbers (tel: links)
  - Website links (opens in new tab)
  - Email links (mailto: links)
  - Sortable columns
  - Checkbox row selection
  - Hover highlighting

### Pagination
- **Page Navigation** - Previous/Next buttons
- **Page Input** - Direct page number entry
- **Page Size** - Configurable rows per page (10, 25, 50, 100)
- **Records Info** - Display showing/total records

### Export Controls
- **Export Selected** - Download selected rows as CSV
- **Export All Filtered** - Download all filtered results as CSV

## 🔄 Real-Time Updates

The dashboard uses Server-Sent Events (SSE) for live updates:

1. Client connects to `/api/stream` endpoint
2. Server broadcasts events when:
   - New CSV files are detected
   - Existing CSV files are modified
   - Data is manually refreshed

3. Client automatically:
   - Reloads statistics
   - Refreshes table data
   - Updates charts

4. Connection status indicator shows online/offline state

## 📊 Data Format

The dashboard expects CSV files with the following columns:
- `business_name` - Name of the business
- `category` - Business category
- `phone` - Contact phone number
- `email` - Contact email address
- `website` - Website URL
- `address` - Physical address
- `city` - City name
- `area` - Geographic area (if different from city)
- `rating` - Business rating (0-5)
- `reviews_count` - Number of reviews

## 🎯 Filtering & Search

### Search
- Searches across: business name, phone, email, category
- Case-insensitive matching
- Real-time filtering as you type

### Category Filter
- Automatically populated from data
- Single selection
- Shows count by category in charts

### Area Filter
- Populated from city/area fields
- Single selection
- Useful for geographic analysis

### Website Status
- All (default)
- Has Website
- No Website

### Rating Filter
- Minimum rating threshold
- Decimal values supported
- Range: 0-5

## 💾 Export Features

### CSV Export Format
Exports include:
- All filtered/selected columns
- Proper escaping of special characters
- Headers row included
- Timestamp in filename

### Export Methods
1. **Select Rows** - Check individual rows and click "Export Selected"
2. **Export All Filtered** - Export all results matching current filters
3. **Select All Toggle** - Quick select/deselect all visible rows

## 📱 Responsive Design

The dashboard is fully responsive:
- **Desktop** (1200px+): Full layout with charts and wide table
- **Tablet** (768px-1199px): Adjusted spacing and stacked components
- **Mobile** (< 768px): Simplified layout, hidden charts, optimized table

## 🔐 Security Notes

- SQL injection: Not applicable (uses in-memory JSON)
- XSS protection: All HTML content is escaped
- CSRF: Use HTTPS in production
- Data validation: Performed on backend and frontend

## 🐛 Troubleshooting

### Dashboard not loading
- Check server is running: `npm start`
- Verify port 5000 is not in use
- Check browser console for errors

### Charts not showing
- Ensure Chart.js is loaded from CDN
- Check console for JavaScript errors
- Refresh page (Ctrl+R)

### Real-time updates not working
- Check SSE connection in Network tab
- Verify new CSV files are being added to `/exports` directory
- Restart server

### Export not working
- Verify at least one row is selected
- Check browser console for errors
- Ensure sufficient disk space

## 🚀 Production Deployment

### Environment Setup
```bash
# Set production port
export PORT=8080

# Run server
npm start
```

### Recommended Setup
1. Use a process manager (PM2, systemd)
2. Setup reverse proxy (nginx, Apache)
3. Enable HTTPS/SSL certificates
4. Monitor server logs
5. Setup automated backups

### Example PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'dashboard',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }]
};
```

## 📝 Performance Considerations

- **File Watching**: Uses Chokidar for efficient file monitoring
- **Memory**: In-memory data storage (suitable for ~10k leads)
- **Pagination**: Server-side pagination reduces load time
- **Charts**: Limited to top 10 categories/areas
- **Filtering**: Performed on backend before sending to client

## 🔄 Monitoring & Logging

Server logs include:
- File watch events (add, change)
- Data load operations
- Stats computation
- Connection events

## 📚 Additional Resources

- Chart.js Documentation: https://www.chartjs.org/
- Express.js Guide: https://expressjs.com/
- CSV Format: https://tools.ietf.org/html/rfc4180

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review server console logs
3. Check browser developer console
4. Verify CSV file format

## 📄 License

This project is part of the Lead Scraper suite.

---

**Version**: 2.0.0  
**Last Updated**: 2025  
**Built with**: Node.js, Express, Chart.js, Vanilla JavaScript
