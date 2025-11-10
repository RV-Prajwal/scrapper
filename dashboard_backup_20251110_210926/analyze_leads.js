import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const EXPORTS_DIR = path.join(process.cwd(), '..', 'exports');

// Set to store unique business identifiers
const uniqueBusinesses = new Set();
const uniqueQualifiedLeads = new Set();

// Stats object
const stats = {
    totalFiles: 0,
    allBusinessFiles: 0,
    qualifiedLeadsFiles: 0,
    totalBusinesses: 0,
    totalQualifiedLeads: 0,
    businessesByCategory: {},
    qualifiedByCategory: {}
};

// Generate a unique business identifier
function getBusinessId(record) {
    return `${record.name}_${record.address}_${record.city}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Process a single CSV file
function processFile(filePath) {
    const fileName = path.basename(filePath);
    const isQualified = fileName.includes('qualified_leads');
    
    console.log(`Processing: ${fileName}`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const records = parse(content, { columns: true, skip_empty_lines: true });
        
        stats.totalFiles++;
        if (isQualified) {
            stats.qualifiedLeadsFiles++;
        } else {
            stats.allBusinessFiles++;
        }
        
        records.forEach(record => {
            const businessId = getBusinessId(record);
            const category = record.category || 'uncategorized';
            
            if (isQualified) {
                uniqueQualifiedLeads.add(businessId);
                stats.qualifiedByCategory[category] = (stats.qualifiedByCategory[category] || 0) + 1;
            } else {
                uniqueBusinesses.add(businessId);
                stats.businessesByCategory[category] = (stats.businessesByCategory[category] || 0) + 1;
            }
        });
        
        return records.length;
    } catch (error) {
        console.error(`Error processing ${fileName}:`, error.message);
        return 0;
    }
}

// Process all CSV files
const files = fs.readdirSync(EXPORTS_DIR)
    .filter(file => file.toLowerCase().endsWith('.csv'))
    .map(file => path.join(EXPORTS_DIR, file));

// Process each file
files.forEach(processFile);

// Calculate final stats
stats.totalBusinesses = uniqueBusinesses.size;
stats.totalQualifiedLeads = uniqueQualifiedLeads.size;

// Print results
console.log('\n=== Lead Analysis Results ===');
console.log(`\nFile Statistics:`);
console.log(`Total CSV files processed: ${stats.totalFiles}`);
console.log(`All businesses files: ${stats.allBusinessFiles}`);
console.log(`Qualified leads files: ${stats.qualifiedLeadsFiles}`);

console.log(`\nLead Statistics:`);
console.log(`Total unique businesses: ${stats.totalBusinesses}`);
console.log(`Total unique qualified leads: ${stats.totalQualifiedLeads}`);

console.log(`\nBusinesses by Category:`);
Object.entries(stats.businessesByCategory)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
        console.log(`${category}: ${count}`);
    });

console.log(`\nQualified Leads by Category:`);
Object.entries(stats.qualifiedByCategory)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
        console.log(`${category}: ${count}`);
    });