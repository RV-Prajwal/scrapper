import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

class DataManager {
  constructor() {
    this.allLeads = new Map(); // businessId -> lead data
    this.qualifiedLeads = new Map(); // businessId -> lead data
    this.categories = new Set();
    this.lastUpdate = new Map(); // file -> last modified time
  }

  // Generate a unique ID for a business
  generateBusinessId(record) {
    return `${record.name}_${record.address}_${record.city}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  // Process a single CSV file
  processFile(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const lastModified = stats.mtimeMs;
      
      // Skip if we've already processed this version of the file
      if (this.lastUpdate.get(filePath) === lastModified) {
        return { newRecords: 0, totalRecords: 0 };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true });
      const fileName = path.basename(filePath);
      const isQualified = fileName.includes('qualified_leads');
      let newRecords = 0;

      records.forEach(record => {
        const businessId = this.generateBusinessId(record);
        if (record.category) {
          this.categories.add(record.category);
        }

        // Add metadata
        record._meta = {
          sourceFile: fileName,
          lastUpdated: new Date().toISOString(),
          isQualified
        };

        // Store in appropriate collection
        if (isQualified) {
          if (!this.qualifiedLeads.has(businessId)) {
            newRecords++;
          }
          this.qualifiedLeads.set(businessId, record);
        } else {
          if (!this.allLeads.has(businessId)) {
            newRecords++;
          }
          this.allLeads.set(businessId, record);
        }
      });

      this.lastUpdate.set(filePath, lastModified);
      return {
        newRecords,
        totalRecords: records.length,
        isQualified
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return { newRecords: 0, totalRecords: 0 };
    }
  }

  // Get statistics about the data
  getStats() {
    return {
      totalBusinesses: this.allLeads.size,
      qualifiedLeads: this.qualifiedLeads.size,
      categories: Array.from(this.categories),
      timestamp: new Date().toISOString()
    };
  }

  // Get all leads with optional filters
  getLeads({ 
    type = 'all', // 'all' or 'qualified'
    category = null,
    limit = null,
    offset = 0,
    sortBy = 'lastUpdated',
    sortOrder = 'desc'
  } = {}) {
    const collection = type === 'qualified' ? this.qualifiedLeads : this.allLeads;
    let results = Array.from(collection.values());

    // Apply category filter
    if (category) {
      results = results.filter(lead => lead.category === category);
    }

    // Sort results
    results.sort((a, b) => {
      const aVal = a._meta[sortBy] || a[sortBy];
      const bVal = b._meta[sortBy] || b[sortBy];
      return sortOrder === 'desc' ? 
        (bVal > aVal ? 1 : -1) :
        (aVal > bVal ? 1 : -1);
    });

    // Apply pagination
    if (limit !== null) {
      results = results.slice(offset, offset + limit);
    }

    return results;
  }
}

export const dataManager = new DataManager();