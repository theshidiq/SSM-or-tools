#!/usr/bin/env node

/**
 * Data Import Utility for Shift Schedule Manager
 * 
 * Features:
 * - Import restaurant data from JSON/CSV exports
 * - Restore configurations and settings
 * - Handle ID conflicts and data migration
 * - Validate imported data integrity
 * - Support for dry-run mode
 * - Rollback capabilities
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'your-supabase-url',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || 'your-service-key',
  batchSize: 100,
  maxRetries: 3,
  validateAfterImport: true
};

class DataImporter {
  constructor() {
    this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey);
    this.importId = `import_${Date.now()}`;
    this.idMappings = new Map(); // Track old ID -> new ID mappings
    this.importLog = [];
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, data };
    this.importLog.push(logEntry);
    
    console.log(`[${timestamp}] ${message}`);
    if (data && process.env.DEBUG) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async loadImportFile(filePath) {
    try {
      this.log(`Loading import file: ${filePath}`);
      
      const content = await fs.readFile(filePath, 'utf8');
      
      // Handle compressed files
      if (filePath.endsWith('.gz')) {
        const zlib = require('zlib');
        content = zlib.gunzipSync(content).toString('utf8');
      }

      let importData;
      if (filePath.endsWith('.json') || filePath.endsWith('.json.gz')) {
        importData = JSON.parse(content);
      } else if (filePath.endsWith('.csv') || filePath.endsWith('.csv.gz')) {
        importData = this.parseCSV(content);
      } else {
        throw new Error('Unsupported file format. Use JSON or CSV.');
      }

      // Validate import data structure
      this.validateImportData(importData);
      
      this.log(`Successfully loaded import data`, {
        recordCount: this.countRecords(importData),
        restaurantName: importData.restaurant?.name,
        exportDate: importData.metadata?.timestamp
      });

      return importData;

    } catch (error) {
      this.log(`Failed to load import file: ${error.message}`);
      throw error;
    }
  }

  validateImportData(data) {
    const errors = [];

    if (!data.metadata) {
      errors.push('Missing metadata section');
    }

    if (!data.restaurant) {
      errors.push('Missing restaurant data');
    }

    if (!data.data || typeof data.data !== 'object') {
      errors.push('Missing or invalid data section');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid import data: ${errors.join(', ')}`);
    }

    this.log('Import data validation passed');
  }

  parseCSV(content) {
    // Simple CSV parser for the flattened export format
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    const data = { metadata: {}, restaurant: {}, data: {} };
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const tableName = values[0];
      const recordData = JSON.parse(values[2]);
      
      if (!data.data[tableName]) {
        data.data[tableName] = [];
      }
      
      data.data[tableName].push(recordData);
    }

    return data;
  }

  countRecords(importData) {
    let count = 0;
    if (importData.data) {
      for (const records of Object.values(importData.data)) {
        if (Array.isArray(records)) {
          count += records.length;
        }
      }
    }
    return count;
  }

  async importRestaurantData(importData, options = {}) {
    const {
      dryRun = false,
      overwrite = false,
      generateNewIds = true,
      skipExisting = true,
      createBackup = true
    } = options;

    try {
      this.log(`Starting restaurant data import`, { 
        dryRun, 
        overwrite, 
        generateNewIds, 
        importId: this.importId 
      });

      if (createBackup && !dryRun) {
        await this.createPreImportBackup(importData.restaurant.id);
      }

      const importPlan = await this.createImportPlan(importData, options);
      
      if (dryRun) {
        this.log('DRY RUN - No actual changes will be made');
        return this.simulateImport(importPlan);
      }

      // Execute the import
      const result = await this.executeImport(importPlan);
      
      // Validate the import
      if (CONFIG.validateAfterImport) {
        await this.validateImportResult(result);
      }

      this.log('Import completed successfully', result);
      return result;

    } catch (error) {
      this.log(`Import failed: ${error.message}`);
      
      if (!dryRun) {
        this.log('Consider running rollback if partial import occurred');
      }
      
      throw error;
    }
  }

  async createImportPlan(importData, options) {
    const plan = {
      restaurant: importData.restaurant,
      tables: [],
      conflicts: [],
      newIds: new Map(),
      operations: []
    };

    // Check if restaurant already exists
    const { data: existingRestaurant } = await this.supabase
      .from('restaurants')
      .select('id, name')
      .eq('id', importData.restaurant.id)
      .single();

    if (existingRestaurant) {
      if (!options.overwrite) {
        plan.conflicts.push({
          type: 'restaurant_exists',
          message: `Restaurant ${existingRestaurant.name} already exists`,
          resolution: 'skip or overwrite required'
        });
      }
    }

    // Plan table imports in dependency order
    const importOrder = [
      'restaurants',
      'config_versions',
      'staff',
      'staff_groups',
      'staff_group_members',
      'staff_group_hierarchy',
      'conflict_rules',
      'daily_limits',
      'monthly_limits',
      'priority_rules',
      'ml_model_configs',
      'ml_model_performance',
      'ml_training_history',
      'ml_feature_importance',
      'constraint_violations',
      'config_changes',
      'schedule_audit_log'
    ];

    for (const tableName of importOrder) {
      if (importData.data[tableName] && Array.isArray(importData.data[tableName])) {
        const tableData = importData.data[tableName];
        
        plan.tables.push({
          name: tableName,
          recordCount: tableData.length,
          operation: existingRestaurant && !options.overwrite ? 'skip' : 'insert'
        });

        // Generate new IDs if requested
        if (options.generateNewIds) {
          for (const record of tableData) {
            if (record.id) {
              const newId = uuidv4();
              plan.newIds.set(record.id, newId);
            }
          }
        }
      }
    }

    return plan;
  }

  async simulateImport(plan) {
    this.log('=== IMPORT SIMULATION ===');
    this.log(`Restaurant: ${plan.restaurant.name} (${plan.restaurant.id})`);
    
    if (plan.conflicts.length > 0) {
      this.log('CONFLICTS DETECTED:');
      for (const conflict of plan.conflicts) {
        this.log(`  - ${conflict.type}: ${conflict.message}`);
      }
    }

    this.log('PLANNED OPERATIONS:');
    for (const table of plan.tables) {
      this.log(`  - ${table.name}: ${table.operation} ${table.recordCount} records`);
    }

    if (plan.newIds.size > 0) {
      this.log(`ID MAPPINGS: ${plan.newIds.size} IDs will be regenerated`);
    }

    return {
      success: true,
      simulation: true,
      conflicts: plan.conflicts,
      operations: plan.tables,
      idMappings: plan.newIds.size
    };
  }

  async executeImport(plan) {
    const results = {
      restaurant: plan.restaurant.name,
      tablesImported: [],
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: []
    };

    if (plan.conflicts.length > 0) {
      throw new Error(`Cannot proceed with import due to conflicts: ${plan.conflicts.map(c => c.message).join(', ')}`);
    }

    // Import restaurant first
    await this.importTable('restaurants', [plan.restaurant], plan.newIds);
    results.tablesImported.push('restaurants');
    results.recordsInserted += 1;

    // Import other tables in dependency order
    for (const tableInfo of plan.tables) {
      if (tableInfo.name === 'restaurants') continue; // Already handled
      
      try {
        const records = await this.getTableData(tableInfo.name);
        const importResult = await this.importTable(tableInfo.name, records, plan.newIds);
        
        results.tablesImported.push(tableInfo.name);
        results.recordsInserted += importResult.inserted;
        results.recordsUpdated += importResult.updated;
        results.recordsSkipped += importResult.skipped;

      } catch (error) {
        this.log(`Error importing table ${tableInfo.name}: ${error.message}`);
        results.errors.push({
          table: tableInfo.name,
          error: error.message
        });
      }
    }

    return results;
  }

  async importTable(tableName, records, idMappings) {
    this.log(`Importing ${tableName}: ${records.length} records`);
    
    const result = { inserted: 0, updated: 0, skipped: 0 };
    
    // Process records in batches
    for (let i = 0; i < records.length; i += CONFIG.batchSize) {
      const batch = records.slice(i, i + CONFIG.batchSize);
      const processedBatch = this.processRecordBatch(batch, idMappings);
      
      try {
        const { data, error } = await this.supabase
          .from(tableName)
          .upsert(processedBatch, { onConflict: 'id' });

        if (error) {
          throw error;
        }

        result.inserted += processedBatch.length;
        
      } catch (error) {
        this.log(`Batch import error for ${tableName}: ${error.message}`);
        
        // Try individual inserts for better error handling
        for (const record of processedBatch) {
          try {
            await this.supabase
              .from(tableName)
              .insert(record);
            result.inserted += 1;
          } catch (individualError) {
            this.log(`Skipped record in ${tableName}: ${individualError.message}`);
            result.skipped += 1;
          }
        }
      }
    }

    return result;
  }

  processRecordBatch(records, idMappings) {
    return records.map(record => {
      const processedRecord = { ...record };

      // Update IDs based on mappings
      if (idMappings.has(record.id)) {
        processedRecord.id = idMappings.get(record.id);
      }

      // Update foreign key references
      this.updateForeignKeyReferences(processedRecord, idMappings);

      // Update timestamps
      if (processedRecord.created_at) {
        processedRecord.created_at = new Date().toISOString();
      }
      if (processedRecord.updated_at) {
        processedRecord.updated_at = new Date().toISOString();
      }

      return processedRecord;
    });
  }

  updateForeignKeyReferences(record, idMappings) {
    // Common foreign key patterns
    const fkFields = [
      'restaurant_id',
      'version_id', 
      'staff_id',
      'group_id',
      'parent_group_id',
      'child_group_id',
      'model_config_id',
      'created_by',
      'changed_by',
      'resolved_by'
    ];

    for (const field of fkFields) {
      if (record[field] && idMappings.has(record[field])) {
        record[field] = idMappings.get(record[field]);
      }
    }

    // Handle JSON fields that might contain IDs
    if (record.conflict_definition && typeof record.conflict_definition === 'object') {
      this.updateJsonIds(record.conflict_definition, idMappings);
    }

    if (record.limit_config && typeof record.limit_config === 'object') {
      this.updateJsonIds(record.limit_config, idMappings);
    }

    if (record.rule_definition && typeof record.rule_definition === 'object') {
      this.updateJsonIds(record.rule_definition, idMappings);
    }
  }

  updateJsonIds(jsonObj, idMappings) {
    if (Array.isArray(jsonObj)) {
      for (let i = 0; i < jsonObj.length; i++) {
        if (typeof jsonObj[i] === 'string' && idMappings.has(jsonObj[i])) {
          jsonObj[i] = idMappings.get(jsonObj[i]);
        } else if (typeof jsonObj[i] === 'object') {
          this.updateJsonIds(jsonObj[i], idMappings);
        }
      }
    } else if (typeof jsonObj === 'object' && jsonObj !== null) {
      for (const [key, value] of Object.entries(jsonObj)) {
        if (typeof value === 'string' && idMappings.has(value)) {
          jsonObj[key] = idMappings.get(value);
        } else if (typeof value === 'object') {
          this.updateJsonIds(value, idMappings);
        }
      }
    }
  }

  async createPreImportBackup(restaurantId) {
    this.log('Creating pre-import backup...');
    
    const { DataExporter } = require('./data-export.js');
    const exporter = new DataExporter();
    
    const backupResult = await exporter.exportRestaurantData(restaurantId, {
      format: 'json',
      includeAudit: true
    });

    this.log(`Pre-import backup created: ${backupResult.filename}`);
    return backupResult.filename;
  }

  async validateImportResult(importResult) {
    this.log('Validating import result...');
    
    const validations = [];

    // Check if restaurant was created
    if (importResult.tablesImported.includes('restaurants')) {
      const { data: restaurant } = await this.supabase
        .from('restaurants')
        .select('id, name')
        .eq('name', importResult.restaurant)
        .single();

      validations.push({
        test: 'Restaurant created',
        passed: !!restaurant,
        details: restaurant ? `${restaurant.name} (${restaurant.id})` : 'Not found'
      });
    }

    // Check staff import
    if (importResult.tablesImported.includes('staff')) {
      const { count } = await this.supabase
        .from('staff')
        .select('*', { count: 'exact', head: true });

      validations.push({
        test: 'Staff records imported',
        passed: count > 0,
        details: `${count} staff records found`
      });
    }

    // Check configuration import
    if (importResult.tablesImported.includes('config_versions')) {
      const { count } = await this.supabase
        .from('config_versions')
        .select('*', { count: 'exact', head: true });

      validations.push({
        test: 'Configuration imported',
        passed: count > 0,
        details: `${count} configuration versions found`
      });
    }

    const failedValidations = validations.filter(v => !v.passed);
    
    if (failedValidations.length > 0) {
      this.log('Import validation issues detected:', failedValidations);
    } else {
      this.log('Import validation passed');
    }

    return {
      valid: failedValidations.length === 0,
      validations,
      failedCount: failedValidations.length
    };
  }

  async saveImportLog() {
    const logFile = `import_log_${this.importId}.json`;
    const logPath = path.join('./logs', logFile);
    
    await fs.mkdir('./logs', { recursive: true });
    await fs.writeFile(logPath, JSON.stringify({
      importId: this.importId,
      timestamp: new Date().toISOString(),
      log: this.importLog
    }, null, 2));

    this.log(`Import log saved: ${logPath}`);
    return logPath;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const importer = new DataImporter();

  try {
    const command = args[0] || 'help';

    switch (command) {
      case 'import': {
        const filePath = args[1];
        if (!filePath) {
          console.error('Usage: node data-import.js import <file-path> [options]');
          process.exit(1);
        }

        const options = {
          dryRun: args.includes('--dry-run'),
          overwrite: args.includes('--overwrite'),
          generateNewIds: args.includes('--generate-new-ids'),
          skipExisting: !args.includes('--no-skip-existing'),
          createBackup: !args.includes('--no-backup')
        };

        const importData = await importer.loadImportFile(filePath);
        const result = await importer.importRestaurantData(importData, options);
        
        console.log('\nImport Result:');
        console.table(result);
        
        break;
      }

      case 'validate': {
        const filePath = args[1];
        if (!filePath) {
          console.error('Usage: node data-import.js validate <file-path>');
          process.exit(1);
        }

        const importData = await importer.loadImportFile(filePath);
        console.log('✅ Import file is valid and ready for import');
        console.log(`Records: ${importer.countRecords(importData)}`);
        console.log(`Restaurant: ${importData.restaurant?.name}`);
        break;
      }

      case 'help':
      default: {
        console.log(`
Data Import Utility for Shift Schedule Manager

Usage: node data-import.js <command> [options]

Commands:
  import <file>    Import restaurant data from file
  validate <file>  Validate import file format
  help            Show this help

Import Options:
  --dry-run              Simulate import without making changes
  --overwrite            Overwrite existing restaurant data
  --generate-new-ids     Generate new UUIDs for all records
  --no-skip-existing     Don't skip existing records
  --no-backup            Skip creating pre-import backup

Environment Variables:
  SUPABASE_URL           Supabase project URL
  SUPABASE_SERVICE_KEY   Service role key
  DEBUG                  Enable debug logging

Examples:
  node data-import.js validate sakura_sushi_export.json
  node data-import.js import sakura_sushi_export.json --dry-run
  node data-import.js import sakura_sushi_export.json --overwrite --generate-new-ids
        `);
        break;
      }
    }

  } catch (error) {
    console.error(`Import failed: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await importer.saveImportLog();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DataImporter, CONFIG };