import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

class DataManager {
  constructor(exportsDir) {
    this.exportsDir = exportsDir;
    this.data = {
      allBusinesses: [],
      qualifiedLeads: [],
    };
    this.fileOffsets = new Map();
  }

  /**
   * Load all CSV files from exports directory
   */
  async loadAllData() {
    try {
      const files = await fs.promises.readdir(this.exportsDir);
      const csvFiles = files.filter(f => f.endsWith('.csv'));

      this.data.allBusinesses = [];
      this.data.qualifiedLeads = [];
      this.fileOffsets.clear();

      for (const file of csvFiles) {
        this.processFile(path.join(this.exportsDir, file));
      }

      return true;
    } catch (error) {
      console.error('Error loading all data:', error);
      return false;
    }
  }

  /**
   * Process a single CSV file
   */
  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true });
      const fileName = path.basename(filePath);
      const isQualified = fileName.includes('qualified');

      const prevCount = this.fileOffsets.get(filePath) || 0;
      const newRecords = records.slice(prevCount);

      if (isQualified) {
        this.data.qualifiedLeads.push(...newRecords);
      } else {
        this.data.allBusinesses.push(...newRecords);
      }

      this.fileOffsets.set(filePath, records.length);

      return {
        isQualified,
        newRecords: newRecords.length,
        totalRecords: records.length,
        fileName
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return { isQualified: false, newRecords: 0, totalRecords: 0, fileName: '' };
    }
  }

  /**
   * Get all data with optional filters
   */
  getData(filters = {}) {
    let data = this.data.qualifiedLeads.length > 0 ? this.data.qualifiedLeads : this.data.allBusinesses;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      data = data.filter(row =>
        (row.business_name || '').toLowerCase().includes(search) ||
        (row.phone || '').toLowerCase().includes(search) ||
        (row.email || '').toLowerCase().includes(search) ||
        (row.category || '').toLowerCase().includes(search)
      );
    }

    if (filters.category) {
      data = data.filter(row => row.category === filters.category);
    }

    if (filters.area) {
      data = data.filter(row => (row.area || row.city) === filters.area);
    }

    if (filters.hasWebsite !== undefined) {
      data = data.filter(row => {
        const hasWebsite = !!(row.website && row.website.trim());
        return hasWebsite === filters.hasWebsite;
      });
    }

  if (filters.minRating) {
    const minRating = parseFloat(filters.minRating);
    data = data.filter(row => {
      const rating = parseFloat(row.rating) || 0;
      return rating >= minRating;
    });
  }

  if (filters.incompleteContact) {
    data = data.filter(row => {
      const hasPhone = !!(row.phone && row.phone.trim());
      const hasEmail = !!(row.email && row.email.trim());
      const hasWebsite = !!(row.website && row.website.trim());
      // Show only those missing at least one contact method
      return !(hasPhone && hasEmail && hasWebsite);
    });
  }

  return data;
  }

  /**
   * Get paginated data
   */
  getPaginated(filters = {}, page = 1, pageSize = 25) {
    const allData = this.getData(filters);
    const total = allData.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: allData.slice(start, end),
      total,
      page,
      pageSize,
      totalPages
    };
  }

  /**
   * Get unique values for a field
   */
  getUniqueValues(field) {
    const data = this.data.qualifiedLeads.length > 0 ? this.data.qualifiedLeads : this.data.allBusinesses;
    const values = new Set();
    data.forEach(row => {
      const value = row[field];
      if (value && value.trim()) {
        values.add(value.trim());
      }
    });
    return Array.from(values).sort();
  }

  /**
   * Compute statistics
   */
  getStats() {
    const data = this.data.qualifiedLeads.length > 0 ? this.data.qualifiedLeads : this.data.allBusinesses;

    const stats = {
      totalLeads: data.length,
      leadsWithWebsite: 0,
      leadsWithPhone: 0,
      leadsWithEmail: 0,
      uniqueCategories: 0,
      uniqueAreas: 0,
      averageRating: 0,
      averageReviews: 0,
      categoryDistribution: {},
      areaDistribution: {}
    };

    let totalRating = 0;
    let totalReviews = 0;
    let ratingCount = 0;
    const categories = new Set();
    const areas = new Set();

    data.forEach(row => {
      if (row.website && row.website.trim()) stats.leadsWithWebsite++;
      if (row.phone && row.phone.trim()) stats.leadsWithPhone++;
      if (row.email && row.email.trim()) stats.leadsWithEmail++;

      if (row.category) {
        const cat = row.category.trim();
        categories.add(cat);
        stats.categoryDistribution[cat] = (stats.categoryDistribution[cat] || 0) + 1;
      }

      const area = (row.area || row.city || 'Unknown').trim();
      areas.add(area);
      stats.areaDistribution[area] = (stats.areaDistribution[area] || 0) + 1;

      const rating = parseFloat(row.rating);
      if (!isNaN(rating)) {
        totalRating += rating;
        ratingCount++;
      }

      const reviews = parseInt(row.reviews_count) || 0;
      totalReviews += reviews;
    });

    stats.uniqueCategories = categories.size;
    stats.uniqueAreas = areas.size;
    stats.averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(2) : '0.00';
    stats.averageReviews = data.length > 0 ? (totalReviews / data.length).toFixed(1) : '0.0';

    return stats;
  }
}

export { DataManager };
