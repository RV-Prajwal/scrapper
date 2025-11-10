/* eslint-disable */

const state = {
  allRows: [],
  filteredRows: [],
  configCategories: [],
  charts: { category: null, area: null },
  currentPage: 1,
  pageSize: 25,
  sortField: null,
  sortAsc: true,
  selectedRows: new Set(),
};

const el = (id) => document.getElementById(id);

// ============ API Calls ============
async function fetchFiles() {
  const res = await fetch('/api/files');
  const data = await res.json();
  return data.files || [];
}

async function fetchData(file) {
  const res = await fetch(`/api/data?file=${encodeURIComponent(file)}`);
  const data = await res.json();
  return data.rows || [];
}

async function fetchMeta() {
  const res = await fetch('/api/meta');
  const data = await res.json();
  return data.categories || [];
}

// ============ UI Population ============
function populateFileSelect(files) {
  const select = el('fileSelect');
  select.innerHTML = '';
  for (const f of files) {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = `${f.type.toUpperCase()} • ${f.name}`;
    select.appendChild(opt);
  }
  const preferred = files.find((f) => f.type === 'qualified') || files[0];
  if (preferred) select.value = preferred.name;
}

// ============ KPI Calculations ============
function setKPIs(rows) {
  const total = rows.length;
  const qualified = rows.filter((r) => !r.website || String(r.website).includes('google.com')).length;
  const withPhone = rows.filter((r) => r.phone && String(r.phone).trim()).length;
  const areas = new Set(rows.map((r) => r.area).filter(Boolean)).size;
  const categories = new Set(rows.map((r) => r.category).filter(Boolean)).size;
  
  const ratings = rows
    .map((r) => parseFloat(r.rating))
    .filter((r) => !isNaN(r));
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '0';

  el('kpiTotal').textContent = total;
  el('kpiQualified').textContent = qualified;
  el('kpiWithPhone').textContent = withPhone;
  el('kpiAreas').textContent = areas;
  el('kpiCategories').textContent = categories;
  el('kpiAvgRating').textContent = avgRating + '★';
}

// ============ Filter Updates ============
function updateFilters(rows) {
  const areas = Array.from(new Set(rows.map((r) => r.area).filter(Boolean))).sort();
  const rowCategories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));
  const categories = Array.from(new Set([...(state.configCategories || []), ...rowCategories])).sort();

  const areaSel = el('areaFilter');
  const catSel = el('categoryFilter');

  areaSel.innerHTML = '<option value="">All</option>' + areas.map(a => `<option value="${a}">${a}</option>`).join('');
  catSel.innerHTML = '<option value="">All</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ============ Filtering & Sorting ============
function applyFilters() {
  const q = el('searchInput').value.toLowerCase();
  const area = el('areaFilter').value;
  const category = el('categoryFilter').value;
  const status = el('statusFilter').value;
  const minRating = parseFloat(el('ratingFilter').value) || 0;

  state.filteredRows = state.allRows.filter((r) => {
    const matchesArea = !area || r.area === area;
    const matchesCat = !category || r.category === category;
    
    let matchesStatus = true;
    if (status === 'no-website') {
      matchesStatus = !r.website || String(r.website).includes('google.com');
    } else if (status === 'with-website') {
      matchesStatus = r.website && !String(r.website).includes('google.com');
    }
    
    const rating = parseFloat(r.rating) || 0;
    const matchesRating = rating >= minRating;
    
    const hay = `${r.business_name || r.name || ''} ${r.phone || ''} ${r.address || ''} ${r.area || ''} ${r.city || ''} ${r.category || ''}`.toLowerCase();
    const matchesSearch = !q || hay.includes(q);
    
    return matchesArea && matchesCat && matchesStatus && matchesRating && matchesSearch;
  });

  applySorting();
  state.currentPage = 1;
  state.selectedRows.clear();
  updateUI();
}

function applySorting() {
  if (!state.sortField) return;

  state.filteredRows.sort((a, b) => {
    let aVal = a[state.sortField] || '';
    let bVal = b[state.sortField] || '';

    if (['rating', 'reviews_count', 'reviewsCount'].includes(state.sortField)) {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }

    if (aVal < bVal) return state.sortAsc ? -1 : 1;
    if (aVal > bVal) return state.sortAsc ? 1 : -1;
    return 0;
  });
}

// ============ Pagination ============
function getPaginatedRows() {
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  return state.filteredRows.slice(start, end);
}

function getTotalPages() {
  return Math.ceil(state.filteredRows.length / state.pageSize);
}

function updatePaginationControls() {
  const total = getTotalPages();
  el('totalPages').textContent = total;
  el('pageInput').value = state.currentPage;
  el('prevPage').disabled = state.currentPage <= 1;
  el('nextPage').disabled = state.currentPage >= total;
  el('recordsInfo').textContent = `Showing ${Math.min((state.currentPage - 1) * state.pageSize + 1, state.filteredRows.length)} to ${Math.min(state.currentPage * state.pageSize, state.filteredRows.length)} of ${state.filteredRows.length} leads`;
}

// ============ Table Rendering ============
function renderTable() {
  const tbody = document.querySelector('#leadsTable tbody');
  tbody.innerHTML = '';

  const paginatedRows = getPaginatedRows();
  
  for (const r of paginatedRows) {
    const tr = document.createElement('tr');
    if (state.selectedRows.has(r.url || r.business_name)) {
      tr.classList.add('selected');
    }

    const isNoWebsite = !r.website || String(r.website).includes('google.com');
    const rating = parseFloat(r.rating) || 0;
    const ratingDisplay = rating > 0 ? `${rating}★` : 'N/A';

    tr.innerHTML = `
      <td class="col-checkbox">
        <input type="checkbox" class="row-checkbox" ${state.selectedRows.has(r.url || r.business_name) ? 'checked' : ''} />
      </td>
      <td class="lead-name">${esc(r.business_name || r.name || 'N/A')}</td>
      <td>${esc(r.category || 'Uncategorized')}</td>
      <td>${r.phone ? `<a href="tel:${esc(r.phone)}" class="phone-link">${esc(r.phone)}</a>` : '<span style="color: var(--muted);">—</span>'}</td>
      <td><span title="${esc(r.address || '')}">${esc((r.address || '').substring(0, 30))}</span></td>
      <td>${esc(r.city || '')}</td>
      <td>${esc(r.area || '')}</td>
      <td>${ratingDisplay}</td>
      <td>${esc(r.reviews_count || r.reviewsCount || '0')}</td>
      <td>
        ${isNoWebsite 
          ? '<span class="tag tag-danger">No Website</span>' 
          : `<a href="${esc(r.website)}" target="_blank" class="url-link" title="${esc(r.website)}">Visit</a>`}
      </td>
      <td>
        <button class="action-btn" onclick="copyToClipboard('${esc(r.phone || '')}')" ${!r.phone ? 'disabled' : ''}>Copy</button>
        ${r.url ? `<a href="${esc(r.url)}" target="_blank" class="action-btn" style="display: inline-block; text-decoration: none;">Maps</a>` : ''}
      </td>
    `;

    tr.querySelector('.row-checkbox').addEventListener('change', (e) => {
      const key = r.url || r.business_name;
      if (e.target.checked) {
        state.selectedRows.add(key);
        tr.classList.add('selected');
      } else {
        state.selectedRows.delete(key);
        tr.classList.remove('selected');
      }
      updateBulkExportBtn();
    });

    tbody.appendChild(tr);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied: ' + text);
  });
}

// ============ Charts ============
function upsertChart(refKey, ctxId, labels, values, title) {
  const ctx = document.getElementById(ctxId);
  const existing = state.charts[refKey];
  const data = {
    labels,
    datasets: [{
      label: title,
      data: values,
      backgroundColor: '#4f46e5',
    }],
  };

  if (existing) {
    existing.data = data;
    existing.update();
    return existing;
  }

  const chart = new Chart(ctx, {
    type: 'bar',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { autoSkip: false } } },
    },
  });
  state.charts[refKey] = chart;
  return chart;
}

function updateCharts() {
  const byCat = countBy(state.filteredRows, (r) => r.category || 'Uncategorized');
  const byArea = countBy(state.filteredRows, (r) => r.area || 'Unknown');

  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).slice(0, 10);
  const catValues = catLabels.map((k) => byCat[k]);
  const areaLabels = Object.keys(byArea).sort((a, b) => byArea[b] - byArea[a]).slice(0, 10);
  const areaValues = areaLabels.map((k) => byArea[k]);

  upsertChart('category', 'categoryChart', catLabels, catValues, 'Leads by Category');
  upsertChart('area', 'areaChart', areaLabels, areaValues, 'Leads by Area');
}

function countBy(arr, keyFn) {
  const m = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!k) continue;
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

// ============ Export Functions ============
function exportToCSV(rows, filename) {
  const headers = ['business_name', 'address', 'phone', 'website', 'area', 'city', 'category', 'reviews_count', 'rating', 'url'];
  const csvRows = rows.map(r => [
    r.business_name || r.name || '',
    r.address || '',
    r.phone || '',
    r.website || '',
    r.area || '',
    r.city || '',
    r.category || '',
    r.reviews_count || r.reviewsCount || '',
    r.rating || '',
    r.url || '',
  ]);

  const csv = [
    headers.join(','),
    ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"` ).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function updateBulkExportBtn() {
  const btn = el('bulkExportBtn');
  btn.disabled = state.selectedRows.size === 0;
  btn.textContent = `📥 Export Selected (${state.selectedRows.size})`;
}

// ============ Event Handlers ============
function hookEvents() {
  el('fileSelect').addEventListener('change', async () => {
    const file = el('fileSelect').value;
    if (!file) return;
    const rows = await fetchData(file);
    state.allRows = rows;
    updateFilters(rows);
    applyFilters();
  });

  el('areaFilter').addEventListener('change', applyFilters);
  el('categoryFilter').addEventListener('change', applyFilters);
  el('statusFilter').addEventListener('change', applyFilters);
  el('ratingFilter').addEventListener('change', applyFilters);
  el('searchInput').addEventListener('input', applyFilters);
  el('pageSizeSelect').addEventListener('change', (e) => {
    state.pageSize = parseInt(e.target.value);
    state.currentPage = 1;
    updateUI();
  });

  document.querySelectorAll('.col-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sortField === field) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortField = field;
        state.sortAsc = true;
      }
      applySorting();
      updateUI();
    });
  });

  el('prevPage').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      updateUI();
    }
  });

  el('nextPage').addEventListener('click', () => {
    const total = getTotalPages();
    if (state.currentPage < total) {
      state.currentPage++;
      updateUI();
    }
  });

  el('pageInput').addEventListener('change', (e) => {
    const page = parseInt(e.target.value) || 1;
    const total = getTotalPages();
    state.currentPage = Math.min(Math.max(1, page), total);
    updateUI();
  });

  el('headerCheckbox').addEventListener('change', (e) => {
    const paginatedRows = getPaginatedRows();
    if (e.target.checked) {
      paginatedRows.forEach(r => state.selectedRows.add(r.url || r.business_name));
    } else {
      paginatedRows.forEach(r => state.selectedRows.delete(r.url || r.business_name));
    }
    renderTable();
    updateBulkExportBtn();
  });

  el('selectAllToggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      state.filteredRows.forEach(r => state.selectedRows.add(r.url || r.business_name));
    } else {
      state.selectedRows.clear();
    }
    renderTable();
    updateBulkExportBtn();
  });

  el('exportAllBtn').addEventListener('click', () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToCSV(state.filteredRows, `qualified_leads_${timestamp}.csv`);
  });

  el('bulkExportBtn').addEventListener('click', () => {
    const selectedRows = state.filteredRows.filter(r => state.selectedRows.has(r.url || r.business_name));
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToCSV(selectedRows, `selected_leads_${timestamp}.csv`);
  });

  el('refreshBtn').addEventListener('click', refreshFiles);
}

// ============ Main UI Update ============
function updateUI() {
  setKPIs(state.filteredRows);
  updatePaginationControls();
  renderTable();
  updateCharts();
}

async function loadSelectedFile() {
  const file = el('fileSelect').value;
  if (!file) return;
  const rows = await fetchData(file);
  state.allRows = rows;
  updateFilters(rows);
  applyFilters();
}

// Load ALL qualified leads from all files
async function loadAllQualifiedLeads() {
  try {
    const files = await fetchFiles();
    const qualifiedFiles = files.filter(f => f.type === 'qualified');
    
    const allLeads = [];
    const seenUrls = new Set();
    
    // Fetch data from all qualified files and deduplicate
    for (const file of qualifiedFiles) {
      const rows = await fetchData(file.name);
      for (const row of rows) {
        const url = row.url || (row.business_name + row.phone);
        if (!seenUrls.has(url)) {
          allLeads.push(row);
          seenUrls.add(url);
        }
      }
    }
    
    console.log(`Loaded ${allLeads.length} unique qualified leads from ${qualifiedFiles.length} files`);
    state.allRows = allLeads;
    updateFilters(allLeads);
    applyFilters();
  } catch (error) {
    console.error('Error loading all qualified leads:', error);
  }
}

async function refreshFiles() {
  const current = el('fileSelect').value;
  const files = await fetchFiles();
  state.configCategories = await fetchMeta();
  if (!files.length) return;
  const names = new Set(files.map(f => f.name));
  populateFileSelect(files);
  if (current && names.has(current)) {
    el('fileSelect').value = current;
  }
  await loadSelectedFile();
}

// ============ Live Stream ============
function wireLiveStream() {
  try {
    const es = new EventSource('/api/stream');
    es.onmessage = (ev) => {
      if (!ev?.data) return;
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'qualified' && msg.payload) {
          state.allRows.push(msg.payload);
          applyFilters();
        }
      } catch (_) {}
    };
  } catch (_) {}
}

// ============ Initialization ============
async function init() {
  hookEvents();
  wireLiveStream();
  state.configCategories = await fetchMeta();
  const files = await fetchFiles();
  
  if (!files.length) {
    document.body.insertAdjacentHTML('beforeend', '<div class="empty">❌ No CSVs found in exports/. Run the scraper first.</div>');
    return;
  }
  
  populateFileSelect(files);
  
  // Load ALL qualified leads by default instead of just selected file
  await loadAllQualifiedLeads();
  
  setInterval(refreshFiles, 60000);
}

init();
