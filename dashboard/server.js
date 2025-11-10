import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { DataManager } from './dataManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize Data Manager
const dataManager = new DataManager(EXPORTS_DIR);
let sseClients = new Set();

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Broadcast to all SSE clients
function broadcast(message) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// ============= ENDPOINTS =============

// Server-Sent Events endpoint
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('event: connected\ndata: {}\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Get statistics
app.get('/api/stats', (req, res) => {
  const stats = dataManager.getStats();
  res.json(stats);
});

// Get paginated leads
app.get('/api/leads', (req, res) => {
  const filters = {
    search: req.query.search || '',
    category: req.query.category || '',
    area: req.query.area || '',
    hasWebsite: req.query.hasWebsite ? req.query.hasWebsite === 'true' : undefined,
    minRating: req.query.minRating || ''
  };

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 25;

  const result = dataManager.getPaginated(filters, page, pageSize);
  res.json(result);
});

// Get filter options
app.get('/api/filters', (req, res) => {
  res.json({
    categories: dataManager.getUniqueValues('category'),
    areas: dataManager.getUniqueValues('area') || dataManager.getUniqueValues('city'),
  });
});

// Export data to CSV
app.post('/api/export', express.json(), (req, res) => {
  const { filters, format = 'csv' } = req.body;
  const data = dataManager.getData(filters || {});

  if (data.length === 0) {
    return res.status(400).json({ error: 'No data to export' });
  }

  // Get headers from first row
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header =>
        `"${(row[header] || '').toString().replace(/"/g, '""')}"`
      ).join(',')
    )
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="leads_export_${Date.now()}.csv"`);
  res.send(csvContent);
});

// Refresh data
app.post('/api/refresh', async (req, res) => {
  await dataManager.loadAllData();
  const stats = dataManager.getStats();
  broadcast({ type: 'data_refreshed', stats });
  res.json({ success: true, stats });
});

// Serve static files
app.use(express.static(PUBLIC_DIR));

// 404 handler - serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ============= FILE WATCHING =============

// Watch CSV files for changes
const watcher = chokidar.watch(path.join(EXPORTS_DIR, '*.csv'), {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
});

watcher.on('add', (filePath) => {
  console.log(`[WATCH] New file: ${path.basename(filePath)}`);
  dataManager.processFile(filePath);
  broadcast({ type: 'file_added', file: path.basename(filePath) });
});

watcher.on('change', (filePath) => {
  console.log(`[WATCH] File changed: ${path.basename(filePath)}`);
  dataManager.processFile(filePath);
  broadcast({ type: 'file_changed', file: path.basename(filePath) });
});

// ============= INITIALIZATION =============

// Load initial data
async function initialize() {
  console.log('Loading initial data...');
  await dataManager.loadAllData();
  console.log(`Loaded ${dataManager.data.qualifiedLeads.length} qualified leads and ${dataManager.data.allBusinesses.length} all businesses`);
}

initialize().catch(console.error);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard Server running on http://localhost:${PORT}`);
  console.log(`📊 Watching for CSV files in: ${EXPORTS_DIR}\n`);
});
