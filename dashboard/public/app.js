// ============================================
// DASHBOARD STATE & VARIABLES
// ============================================

const state = {
  currentPage: 1,
  pageSize: 25,
  sortField: 'business_name',
  sortDirection: 'asc',
  filters: {
    search: '',
    category: '',
    area: '',
    hasWebsite: '',
    minRating: '',
    incompleteContact: ''
  },
  selectedRows: new Set(),
  allStats: {},
  eventSource: null,
  charts: {
    category: null,
    area: null
  }
};

// ============================================
// DOM ELEMENTS
// ============================================

const DOM = {
  // Filters
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  areaFilter: document.getElementById('areaFilter'),
  websiteFilter: document.getElementById('websiteFilter'),
  ratingFilter: document.getElementById('ratingFilter'),
  incompleteContactFilter: document.getElementById('incompleteContactFilter'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),

  // KPIs
  kpiTotal: document.getElementById('kpiTotal'),
  kpiPhone: document.getElementById('kpiPhone'),
  kpiEmail: document.getElementById('kpiEmail'),
  kpiWebsite: document.getElementById('kpiWebsite'),
  kpiAvgRating: document.getElementById('kpiAvgRating'),
  kpiAreas: document.getElementById('kpiAreas'),

  // Charts
  categoryChart: document.getElementById('categoryChart'),
  areaChart: document.getElementById('areaChart'),

  // Table
  tableBody: document.getElementById('tableBody'),
  headerCheckbox: document.getElementById('headerCheckbox'),
  selectAllToggle: document.getElementById('selectAllToggle'),
  leadsTable: document.getElementById('leadsTable'),

  // Pagination
  pageInput: document.getElementById('pageInput'),
  totalPages: document.getElementById('totalPages'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  recordsInfo: document.getElementById('recordsInfo'),
  pageSizeSelect: document.getElementById('pageSizeSelect'),

  // Buttons
  refreshBtn: document.getElementById('refreshBtn'),
  bulkExportBtn: document.getElementById('bulkExportBtn'),
  exportAllBtn: document.getElementById('exportAllBtn'),

  // Status
  connectionStatus: document.getElementById('connectionStatus')
};

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  try {
    console.log('Initializing dashboard...');
    
    // Load initial stats
    await loadStats();
    
    // Load filter options
    await loadFilterOptions();
    
    // Load leads
    await loadLeads();
    
    // Connect to real-time updates
    connectSSE();
    
    // Attach event listeners
    attachEventListeners();
    
    console.log('Dashboard initialized successfully');
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// ============================================
// API CALLS
// ============================================

async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    state.allStats = await response.json();
    updateKPIs();
    updateCharts();
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function loadFilterOptions() {
  try {
    const response = await fetch('/api/filters');
    const filters = await response.json();
    
    // Populate category filter
    DOM.categoryFilter.innerHTML = '<option value="">All Categories</option>';
    filters.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      DOM.categoryFilter.appendChild(option);
    });
    
    // Populate area filter
    DOM.areaFilter.innerHTML = '<option value="">All Areas</option>';
    filters.areas.forEach(area => {
      const option = document.createElement('option');
      option.value = area;
      option.textContent = area;
      DOM.areaFilter.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading filter options:', error);
  }
}

async function loadLeads() {
  try {
    const params = new URLSearchParams({
      page: state.currentPage,
      pageSize: state.pageSize,
      search: state.filters.search,
      category: state.filters.category,
      area: state.filters.area,
      hasWebsite: state.filters.hasWebsite,
      minRating: state.filters.minRating
    });

    const response = await fetch(`/api/leads?${params}`);
    const result = await response.json();

    // Update table
    renderTable(result.data);

    // Update pagination
    state.currentPage = result.page;
    DOM.totalPages.textContent = result.totalPages;
    DOM.pageInput.value = result.page;
    
    DOM.prevPage.disabled = result.page <= 1;
    DOM.nextPage.disabled = result.page >= result.totalPages;

    // Update records info
    const showing = result.data.length;
    const total = result.total;
    DOM.recordsInfo.textContent = `Showing ${showing} of ${total} leads`;
  } catch (error) {
    console.error('Error loading leads:', error);
  }
}

// ============================================
// TABLE RENDERING
// ============================================

function renderTable(leads) {
  DOM.tableBody.innerHTML = '';
  
  if (leads.length === 0) {
    DOM.tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-light);">
          No leads found
        </td>
      </tr>
    `;
    return;
  }

  leads.forEach((lead, index) => {
    const row = document.createElement('tr');
    const isSelected = state.selectedRows.has(index);
    
    row.innerHTML = `
      <td class="col-checkbox">
        <input type="checkbox" class="row-checkbox" data-index="${index}" ${isSelected ? 'checked' : ''}>
      </td>
      <td><strong>${escapeHtml(lead.business_name || '')}</strong></td>
      <td>${escapeHtml(lead.category || '')}</td>
      <td><a href="tel:${lead.phone}" title="${lead.phone}">${escapeHtml(lead.phone || '')}</a></td>
      <td>${escapeHtml(lead.address || '')}</td>
      <td>${escapeHtml(lead.city || '')}</td>
      <td>${lead.rating ? `<strong>${lead.rating}</strong>` : '-'}</td>
      <td>${lead.reviews_count || '0'}</td>
      <td>${lead.website ? `<a href="${lead.website}" target="_blank" rel="noopener">🔗</a>` : '-'}</td>
      <td>${lead.email ? `<a href="mailto:${lead.email}" title="${lead.email}">📧</a>` : '-'}</td>
    `;

    // Add checkbox change handler
    row.querySelector('.row-checkbox').addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedRows.add(index);
      } else {
        state.selectedRows.delete(index);
      }
      updateCheckboxStates();
    });

    DOM.tableBody.appendChild(row);
  });
}

// ============================================
// KPI UPDATES
// ============================================

function updateKPIs() {
  const stats = state.allStats;
  DOM.kpiTotal.textContent = formatNumber(stats.totalLeads || 0);
  DOM.kpiPhone.textContent = formatNumber(stats.leadsWithPhone || 0);
  DOM.kpiEmail.textContent = formatNumber(stats.leadsWithEmail || 0);
  DOM.kpiWebsite.textContent = formatNumber(stats.leadsWithWebsite || 0);
  DOM.kpiAvgRating.textContent = stats.averageRating || '0.00';
  DOM.kpiAreas.textContent = formatNumber(stats.uniqueAreas || 0);
}

function updateCharts() {
  const stats = state.allStats;

  // Category Chart
  const categoryLabels = Object.keys(stats.categoryDistribution || {}).slice(0, 10);
  const categoryData = categoryLabels.map(cat => stats.categoryDistribution[cat]);

  if (state.charts.category) {
    state.charts.category.destroy();
  }

  state.charts.category = new Chart(DOM.categoryChart, {
    type: 'doughnut',
    data: {
      labels: categoryLabels,
      datasets: [{
        data: categoryData,
        backgroundColor: generateColors(categoryLabels.length),
        borderColor: 'var(--bg-primary)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 12 } }
        }
      }
    }
  });

  // Area Chart
  const areaLabels = Object.keys(stats.areaDistribution || {}).slice(0, 10);
  const areaData = areaLabels.map(area => stats.areaDistribution[area]);

  if (state.charts.area) {
    state.charts.area.destroy();
  }

  state.charts.area = new Chart(DOM.areaChart, {
    type: 'bar',
    data: {
      labels: areaLabels,
      datasets: [{
        label: 'Leads',
        data: areaData,
        backgroundColor: 'var(--primary-color)',
        borderColor: 'var(--primary-dark)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

// ============================================
// REAL-TIME UPDATES (SSE)
// ============================================

function connectSSE() {
  if (state.eventSource) {
    state.eventSource.close();
  }

  state.eventSource = new EventSource('/api/stream');

  state.eventSource.onopen = () => {
    console.log('SSE connected');
    updateConnectionStatus(true);
  };

  state.eventSource.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleSSEMessage(message);
    } catch (error) {
      console.error('Error parsing SSE message:', error);
    }
  };

  state.eventSource.onerror = () => {
    console.error('SSE connection error');
    updateConnectionStatus(false);
  };
}

function handleSSEMessage(message) {
  if (message.type === 'file_added' || message.type === 'file_changed') {
    console.log('File event received, refreshing data...');
    setTimeout(() => {
      loadStats();
      loadLeads();
    }, 500);
  }
}

function updateConnectionStatus(isOnline) {
  if (isOnline) {
    DOM.connectionStatus.textContent = '🟢 Connected';
    DOM.connectionStatus.className = 'connection-status online';
  } else {
    DOM.connectionStatus.textContent = '🔴 Offline';
    DOM.connectionStatus.className = 'connection-status offline';
  }
}

// ============================================
// FILTERING & SEARCH
// ============================================

function applyFilters() {
  state.filters.search = DOM.searchInput.value;
  state.filters.category = DOM.categoryFilter.value;
  state.filters.area = DOM.areaFilter.value;
  state.filters.hasWebsite = DOM.websiteFilter.value;
  state.filters.minRating = DOM.ratingFilter.value;
  state.filters.incompleteContact = DOM.incompleteContactFilter.value;
  
  state.currentPage = 1;
  loadLeads();
}

function clearFilters() {
  DOM.searchInput.value = '';
  DOM.categoryFilter.value = '';
  DOM.areaFilter.value = '';
  DOM.websiteFilter.value = '';
  DOM.ratingFilter.value = '';
  DOM.incompleteContactFilter.value = '';
  
  state.filters = {
    search: '',
    category: '',
    area: '',
    hasWebsite: '',
    minRating: '',
    incompleteContact: ''
  };
  state.currentPage = 1;
  
  loadLeads();
}

// ============================================
// CHECKBOX MANAGEMENT
// ============================================

function updateCheckboxStates() {
  const checkboxes = Array.from(document.querySelectorAll('.row-checkbox'));
  const checkedCount = checkboxes.filter(cb => cb.checked).length;
  const totalCount = checkboxes.length;

  DOM.headerCheckbox.checked = checkedCount === totalCount && totalCount > 0;
  DOM.headerCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
  
  DOM.bulkExportBtn.disabled = checkedCount === 0;
}

function toggleSelectAll(checked) {
  state.selectedRows.clear();
  document.querySelectorAll('.row-checkbox').forEach((checkbox, index) => {
    checkbox.checked = checked;
    if (checked) {
      state.selectedRows.add(index);
    }
  });
  updateCheckboxStates();
}

// ============================================
// EXPORT FUNCTIONALITY
// ============================================

async function exportSelected() {
  if (state.selectedRows.size === 0) {
    alert('No rows selected');
    return;
  }

  // Get current page data
  const rows = Array.from(DOM.tableBody.querySelectorAll('tr'));
  const selectedLeads = [];
  
  state.selectedRows.forEach(index => {
    if (rows[index]) {
      selectedLeads.push(rows[index]);
    }
  });

  exportLeadsToCSV(selectedLeads);
}

async function exportAll() {
  try {
    const filters = {
      search: state.filters.search,
      category: state.filters.category,
      area: state.filters.area,
      hasWebsite: state.filters.hasWebsite === '' ? undefined : state.filters.hasWebsite === 'true',
      minRating: state.filters.minRating === '' ? undefined : parseFloat(state.filters.minRating)
    };

    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters })
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    downloadBlob(blob, `leads_export_${Date.now()}.csv`);
  } catch (error) {
    console.error('Export error:', error);
    alert('Export failed');
  }
}

function exportLeadsToCSV(rows) {
  // Extract headers
  const headers = ['Business Name', 'Category', 'Phone', 'Address', 'City', 'Rating', 'Reviews', 'Website', 'Email'];
  
  // Extract data
  const data = rows.map(row => {
    const cells = row.querySelectorAll('td');
    return [
      cells[1]?.textContent || '',
      cells[2]?.textContent || '',
      cells[3]?.textContent || '',
      cells[4]?.textContent || '',
      cells[5]?.textContent || '',
      cells[6]?.textContent || '',
      cells[7]?.textContent || '',
      cells[8]?.textContent || '',
      cells[9]?.textContent || ''
    ];
  });

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, `leads_export_${Date.now()}.csv`);
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ============================================
// PAGINATION
// ============================================

function goToPage(page) {
  const totalPages = parseInt(DOM.totalPages.textContent);
  if (page >= 1 && page <= totalPages) {
    state.currentPage = page;
    loadLeads();
    window.scrollTo(0, 0);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function attachEventListeners() {
  // Filter inputs
  DOM.searchInput.addEventListener('change', applyFilters);
  DOM.categoryFilter.addEventListener('change', applyFilters);
  DOM.areaFilter.addEventListener('change', applyFilters);
  DOM.websiteFilter.addEventListener('change', applyFilters);
  DOM.ratingFilter.addEventListener('change', applyFilters);
  DOM.incompleteContactFilter.addEventListener('change', applyFilters);
  DOM.clearFiltersBtn.addEventListener('click', clearFilters);

  // Buttons
  DOM.refreshBtn.addEventListener('click', async () => {
    DOM.refreshBtn.disabled = true;
    await loadStats();
    await loadLeads();
    DOM.refreshBtn.disabled = false;
  });

  DOM.bulkExportBtn.addEventListener('click', exportSelected);
  DOM.exportAllBtn.addEventListener('click', exportAll);

  // Checkboxes
  DOM.headerCheckbox.addEventListener('change', (e) => {
    toggleSelectAll(e.target.checked);
  });

  DOM.selectAllToggle.addEventListener('change', (e) => {
    toggleSelectAll(e.target.checked);
  });

  // Pagination
  DOM.pageInput.addEventListener('change', (e) => {
    const page = parseInt(e.target.value);
    goToPage(page);
  });

  DOM.prevPage.addEventListener('click', () => {
    goToPage(state.currentPage - 1);
  });

  DOM.nextPage.addEventListener('click', () => {
    goToPage(state.currentPage + 1);
  });

  // Page size
  DOM.pageSizeSelect.addEventListener('change', (e) => {
    state.pageSize = parseInt(e.target.value);
    state.currentPage = 1;
    loadLeads();
  });

  // Table sorting
  DOM.leadsTable.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.field;
      if (state.sortField === field) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDirection = 'asc';
      }
      loadLeads();
    });
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function generateColors(count) {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#ef4444', '#6366f1', '#14b8a6', '#f97316',
    '#6b7280', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'
  ];
  
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
}

// ============================================
// START APPLICATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

// Reconnect SSE every 5 minutes
setInterval(() => {
  if (state.eventSource && state.eventSource.readyState === EventSource.CLOSED) {
    connectSSE();
  }
}, 5 * 60 * 1000);
