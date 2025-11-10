/* eslint-disable */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import chokidar from 'chokidar';
import { dataManager } from './dataManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const ROOT_DIR = path.join(__dirname, '..');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PUPPETEER_SCRAPER_FILE = path.join(ROOT_DIR, 'puppeteer_scraper', 'scraper.js');

// --- Live updates via Server-Sent Events (SSE)
const sseClients = new Set();
function sseBroadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch (_) {}
  }
}

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('event: ping\n');
  res.write('data: {}\n\n');
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Ensure exports dir exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

app.use(express.static(PUBLIC_DIR));

async function getConfiguredCategories() {
  try {
    const text = await fs.promises.readFile(PUPPETEER_SCRAPER_FILE, 'utf-8');
    const m = text.match(/categories\s*:\s*\[([\s\S]*?)\]/m);
    if (!m) return [];
    const inside = m[1];
    const items = [];
    const re = /'([^']+)'/g;
    let mm;
    while ((mm = re.exec(inside)) !== null) {
      const v = mm[1].trim();
      if (v) items.push(v);
    }
    return Array.from(new Set(items));
  } catch (e) {
    return [];
  }
}

// Watch incremental qualified CSVs and emit rows as they are appended
const offsets = new Map(); // file -> row count seen
function processQualifiedFile(full) {
  try {
    const content = fs.readFileSync(full, 'utf-8');
    const rows = parse(content, { columns: true, skip_empty_lines: true });
    const prev = offsets.get(full) || 0;
    const fileName = path.basename(full);
    const fileType = fileName.includes('qualified_leads') ? 'qualified' : 'all';
    
    if (rows.length > prev) {
      const news = rows.slice(prev);
      offsets.set(full, rows.length);
      
      // Broadcast each new row with metadata
      for (const r of news) {
        sseBroadcast({
          type: fileType,
          payload: {
            ...r,
            _meta: {
              source: fileName,
              timestamp: new Date().toISOString(),
              rowNumber: prev + news.indexOf(r) + 1
            }
          }
        });
      }

      // Broadcast summary update
      sseBroadcast({
        type: 'summary_update',
        payload: {
          file: fileName,
          newRows: news.length,
          totalRows: rows.length,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      offsets.set(full, rows.length);
    }
  } catch (error) {
    console.error(`Error processing file ${full}:`, error);
  }
}

// Watch all CSV files in exports directory
const watcher = chokidar.watch(path.join(EXPORTS_DIR, '*.csv'), {
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
});

// Initial load of all existing files
async function loadAllFiles() {
  const files = await fs.promises.readdir(EXPORTS_DIR);
  for (const file of files) {
    if (file.endsWith('.csv')) {
      const fullPath = path.join(EXPORTS_DIR, file);
      processFile(fullPath);
    }
  }
  // Broadcast initial stats
  broadcastStats();
}

// Process file changes
function processFile(filePath) {
  const result = dataManager.processFile(filePath);
  if (result.newRecords > 0) {
    sseBroadcast({
      type: result.isQualified ? 'new_qualified_leads' : 'new_businesses',
      payload: {
        file: path.basename(filePath),
        newRecords: result.newRecords,
        totalRecords: result.totalRecords,
        timestamp: new Date().toISOString()
      }
    });
    broadcastStats();
  }
}

// Broadcast current statistics
function broadcastStats() {
  sseBroadcast({
    type: 'stats_update',
    payload: dataManager.getStats()
  });
}

watcher
  .on('add', async (filePath) => {
    console.log(`New file detected: ${filePath}`);
    processFile(filePath);
  })
  .on('change', async (filePath) => {
    console.log(`File changed: ${filePath}`);
    processFile(filePath);
  });

// Load existing files on startup
loadAllFiles();

async function getObservedCategories() {
  const cats = new Set();
  try {
    const entries = await fs.promises.readdir(EXPORTS_DIR);
    const csvs = entries.filter((f) => f.toLowerCase().endsWith('.csv'));
    for (const name of csvs) {
      try {
        const full = path.join(EXPORTS_DIR, name);
        const content = await fs.promises.readFile(full, 'utf-8');
        const records = parse(content, { columns: true, skip_empty_lines: true });
        for (const r of records) {
          if (r.category) cats.add(String(r.category));
        }
      } catch (_) { /* ignore bad file */ }
    }
  } catch (_) { /* ignore */ }
  return Array.from(cats);
}

// List available CSV files in /exports
app.get('/api/files', async (_req, res) => {
  try {
    const entries = await fs.promises.readdir(EXPORTS_DIR);
    const csvs = entries.filter((f) => f.toLowerCase().endsWith('.csv'));
    const detailed = await Promise.all(
      csvs.map(async (name) => {
        const full = path.join(EXPORTS_DIR, name);
        const stat = await fs.promises.stat(full);
        const type = name.includes('qualified') ? 'qualified' : 'all';
        return {
          name,
          type,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        };
      })
    );
    detailed.sort((a, b) => b.mtimeMs - a.mtimeMs);
    res.json({ files: detailed });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Read CSV content as JSON rows
app.get('/api/data', async (req, res) => {
  try {
    const file = String(req.query.file || '');
    if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file parameter' });
    }
    const full = path.join(EXPORTS_DIR, file);
    if (!fs.existsSync(full)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = await fs.promises.readFile(full, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    res.json({ rows: records });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Meta: categories (configured + observed)
app.get('/api/meta', async (_req, res) => {
  try {
    const [configured, observed] = await Promise.all([
      getConfiguredCategories(),
      getObservedCategories(),
    ]);
    const set = new Set([...(configured || []), ...(observed || [])]);
    res.json({ categories: Array.from(set) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Fallback to index.html for SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
  console.log(`Exports directory: ${EXPORTS_DIR}`);
});
