#!/usr/bin/env node

/**
 * Data Export Utility for Shift Schedule Manager
 * 
 * Features:
 * - Export restaurant configurations to JSON/CSV
 * - Backup complete restaurant data
 * - Export specific data types (staff, rules, ML configs)
 * - Anonymize sensitive data for sharing
 * - Validate exported data integrity
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const { Parser } = require('json2csv');

// Configuration
const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'your-supabase-url',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || 'your-service-key',
  outputDir: process.env.OUTPUT_DIR || './exports',
  maxRecords: 10000,
  batchSize: 1000
};

class DataExporter {
  constructor() {
    this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey);
    this.exportId = `export_${Date.now()}`;
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data && process.env.DEBUG) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async ensureOutputDir() {
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
  }

  async exportRestaurantData(restaurantId, options = {}) {
    const {
      format = 'json',
      includeAudit = false,
      anonymize = false,
      compress = false
    } = options;

    try {
      this.log(`Starting export for restaurant: ${restaurantId}`);
      
      // Get restaurant info first
      const { data: restaurant, error: restaurantError } = await this.supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (restaurantError || !restaurant) {
        throw new Error(`Restaurant not found: ${restaurantId}`);
      }

      const exportData = {
        metadata: {
          exportId: this.exportId,
          timestamp: new Date().toISOString(),
          restaurantId,
          restaurantName: restaurant.name,
          version: '1.0',
          format,
          options
        },
        restaurant,
        data: {}
      };

      // Export core data
      const tables = [
        'staff',
        'config_versions',
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
        'constraint_violations'
      ];

      for (const table of tables) {
        this.log(`Exporting ${table}...`);
        exportData.data[table] = await this.exportTable(table, restaurantId);
      }

      // Export audit data if requested
      if (includeAudit) {
        this.log('Exporting audit data...');
        exportData.data.config_changes = await this.exportAuditData(restaurantId);
        exportData.data.schedule_audit_log = await this.exportScheduleAudit(restaurantId);
      }

      // Anonymize data if requested
      if (anonymize) {
        this.log('Anonymizing sensitive data...');
        this.anonymizeData(exportData);
      }

      // Save the export
      const filename = this.generateFilename(restaurant.name, format);
      await this.saveExport(exportData, filename, format, compress);

      this.log(`Export completed: ${filename}`);
      return { success: true, filename, recordCount: this.countRecords(exportData) };

    } catch (error) {
      this.log(`Export failed: ${error.message}`);
      throw error;
    }
  }

  async exportTable(tableName, restaurantId, filters = {}) {
    const records = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && records.length < CONFIG.maxRecords) {
      let query = this.supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + CONFIG.batchSize - 1);

      // Add restaurant filter if the table has restaurant_id
      if (await this.hasColumn(tableName, 'restaurant_id')) {
        query = query.eq('restaurant_id', restaurantId);
      } else if (tableName === 'staff_group_members' || tableName === 'staff_group_hierarchy') {
        // For junction tables, filter through related tables
        const relatedIds = await this.getRelatedIds(tableName, restaurantId);
        if (relatedIds.length === 0) {
          break;
        }
        query = query.in(this.getRelationColumn(tableName), relatedIds);
      } else if (tableName.startsWith('ml_')) {
        // ML tables filter through model configs
        const modelConfigIds = await this.getModelConfigIds(restaurantId);
        if (modelConfigIds.length === 0) {
          break;
        }
        query = query.in('model_config_id', modelConfigIds);
      }

      // Apply additional filters
      for (const [column, value] of Object.entries(filters)) {
        query = query.eq(column, value);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to export ${tableName}: ${error.message}`);
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        records.push(...data);
        offset += CONFIG.batchSize;
        hasMore = data.length === CONFIG.batchSize;
      }
    }

    return records;
  }

  async hasColumn(tableName, columnName) {
    const { data, error } = await this.supabase
      .rpc('exec_sql', { 
        sql_query: `
          SELECT COUNT(*) as count
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND column_name = '${columnName}'
          AND table_schema = 'public'
        `
      });

    return !error && data && data[0]?.count > 0;
  }

  async getRelatedIds(tableName, restaurantId) {
    if (tableName === 'staff_group_members') {
      const { data } = await this.supabase
        .from('staff_groups')
        .select('id')
        .eq('restaurant_id', restaurantId);
      return data?.map(row => row.id) || [];
    }

    if (tableName === 'staff_group_hierarchy') {
      const { data } = await this.supabase
        .from('staff_groups')
        .select('id')
        .eq('restaurant_id', restaurantId);
      return data?.map(row => row.id) || [];
    }

    return [];
  }

  getRelationColumn(tableName) {
    const relations = {
      'staff_group_members': 'group_id',
      'staff_group_hierarchy': 'parent_group_id'
    };
    return relations[tableName] || 'id';
  }

  async getModelConfigIds(restaurantId) {
    const { data } = await this.supabase
      .from('ml_model_configs')
      .select('id')
      .eq('restaurant_id', restaurantId);
    return data?.map(row => row.id) || [];
  }

  async exportAuditData(restaurantId) {
    // Get config version IDs for this restaurant
    const { data: versions } = await this.supabase
      .from('config_versions')
      .select('id')
      .eq('restaurant_id', restaurantId);

    if (!versions || versions.length === 0) {
      return [];
    }

    const versionIds = versions.map(v => v.id);
    
    const { data, error } = await this.supabase
      .from('config_changes')
      .select('*')
      .in('version_id', versionIds)
      .order('changed_at', { ascending: false })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to export audit data: ${error.message}`);
    }

    return data || [];
  }

  async exportScheduleAudit(restaurantId) {
    const { data, error } = await this.supabase
      .from('schedule_audit_log')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to export schedule audit: ${error.message}`);
    }

    return data || [];
  }

  anonymizeData(exportData) {
    const anonymizeEmail = (email) => {
      if (!email) return null;
      const [local, domain] = email.split('@');
      return `user_${Math.random().toString(36).substr(2, 8)}@${domain}`;
    };

    const anonymizeName = (name) => {
      if (!name) return null;
      return `Staff_${Math.random().toString(36).substr(2, 6)}`;
    };

    // Anonymize restaurant data
    if (exportData.restaurant) {
      exportData.restaurant.name = 'Sample Restaurant';
      if (exportData.restaurant.contact_info) {
        exportData.restaurant.contact_info = {
          ...exportData.restaurant.contact_info,
          phone: '+81-3-XXXX-XXXX',
          email: 'info@example.com',
          address: 'Sample Address, Tokyo, Japan'
        };
      }
    }

    // Anonymize staff data
    if (exportData.data.staff) {
      exportData.data.staff = exportData.data.staff.map(staff => ({
        ...staff,
        name: anonymizeName(staff.name),
        email: anonymizeEmail(staff.email),
        metadata: {
          ...staff.metadata,
          emergency_contact: staff.metadata?.emergency_contact ? {
            name: 'Emergency Contact',
            phone: '+81-90-XXXX-XXXX',
            relationship: staff.metadata.emergency_contact.relationship
          } : undefined
        }
      }));
    }

    // Remove sensitive audit information
    if (exportData.data.config_changes) {
      exportData.data.config_changes = exportData.data.config_changes.map(change => ({
        ...change,
        changed_by: null,
        ip_address: null,
        user_agent: null
      }));
    }

    if (exportData.data.schedule_audit_log) {
      exportData.data.schedule_audit_log = exportData.data.schedule_audit_log.map(log => ({
        ...log,
        changed_by: null,
        ip_address: null,
        user_agent: null,
        session_id: null
      }));
    }
  }

  generateFilename(restaurantName, format) {
    const safeRestaurantName = restaurantName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .split('T')[0];

    return `${safeRestaurantName}_export_${timestamp}_${this.exportId}.${format}`;
  }

  async saveExport(data, filename, format, compress = false) {
    await this.ensureOutputDir();
    const filepath = path.join(CONFIG.outputDir, filename);

    let content;
    
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      content = await this.convertToCSV(data);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    if (compress) {
      const zlib = require('zlib');
      const compressed = zlib.gzipSync(content);
      await fs.writeFile(filepath + '.gz', compressed);
    } else {
      await fs.writeFile(filepath, content, 'utf8');
    }

    // Save metadata file
    const metadataFile = path.join(CONFIG.outputDir, `${filename}.meta.json`);
    await fs.writeFile(metadataFile, JSON.stringify({
      ...data.metadata,
      fileSize: content.length,
      compressed,
      recordCount: this.countRecords(data)
    }, null, 2));

    return filepath;
  }

  async convertToCSV(data) {
    const csvData = [];

    // Flatten the nested data structure for CSV
    for (const [tableName, records] of Object.entries(data.data)) {
      if (Array.isArray(records)) {
        for (const record of records) {
          csvData.push({
            table: tableName,
            id: record.id,
            data: JSON.stringify(record)
          });
        }
      }
    }

    const parser = new Parser({
      fields: ['table', 'id', 'data']
    });

    return parser.parse(csvData);
  }

  countRecords(exportData) {
    let count = 0;
    for (const records of Object.values(exportData.data)) {
      if (Array.isArray(records)) {
        count += records.length;
      }
    }
    return count;
  }

  async exportConfiguration(restaurantId, configVersionId = null) {
    this.log(`Exporting configuration for restaurant: ${restaurantId}`);

    let versionFilter = { restaurant_id: restaurantId };
    if (configVersionId) {
      versionFilter.id = configVersionId;
    } else {
      versionFilter.is_active = true;
    }

    const { data: configVersion, error } = await this.supabase
      .from('config_versions')
      .select('*')
      .match(versionFilter)
      .single();

    if (error || !configVersion) {
      throw new Error('Configuration version not found');
    }

    const configExport = {
      metadata: {
        exportId: this.exportId,
        timestamp: new Date().toISOString(),
        type: 'configuration',
        restaurantId,
        configVersionId: configVersion.id,
        version: '1.0'
      },
      configVersion,
      rules: {
        conflict_rules: await this.exportTable('conflict_rules', restaurantId, { version_id: configVersion.id }),
        daily_limits: await this.exportTable('daily_limits', restaurantId, { version_id: configVersion.id }),
        monthly_limits: await this.exportTable('monthly_limits', restaurantId, { version_id: configVersion.id }),
        priority_rules: await this.exportTable('priority_rules', restaurantId, { version_id: configVersion.id })
      },
      mlConfigs: await this.exportTable('ml_model_configs', restaurantId, { version_id: configVersion.id }),
      staffGroups: await this.exportTable('staff_groups', restaurantId, { version_id: configVersion.id })
    };

    const filename = `config_export_${configVersion.version_number}_${Date.now()}.json`;
    await this.saveExport(configExport, filename, 'json');

    return { success: true, filename, configVersion: configVersion.version_number };
  }

  async listExportableRestaurants() {
    const { data, error } = await this.supabase
      .from('restaurants')
      .select('id, name, created_at, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new Error(`Failed to list restaurants: ${error.message}`);
    }

    return data || [];
  }

  async validateExport(filename) {
    try {
      const filepath = path.join(CONFIG.outputDir, filename);
      const content = await fs.readFile(filepath, 'utf8');
      const exportData = JSON.parse(content);

      const validations = [];

      // Validate metadata
      validations.push({
        test: 'Metadata exists',
        passed: !!exportData.metadata,
        details: exportData.metadata ? 'Valid' : 'Missing metadata'
      });

      // Validate restaurant data
      validations.push({
        test: 'Restaurant data exists',
        passed: !!exportData.restaurant,
        details: exportData.restaurant ? exportData.restaurant.name : 'Missing restaurant data'
      });

      // Validate data structure
      const expectedTables = ['staff', 'config_versions', 'staff_groups'];
      const missingTables = expectedTables.filter(table => 
        !exportData.data || !Array.isArray(exportData.data[table])
      );

      validations.push({
        test: 'Essential tables present',
        passed: missingTables.length === 0,
        details: missingTables.length > 0 ? `Missing: ${missingTables.join(', ')}` : 'All essential tables present'
      });

      // Validate data integrity
      const recordCount = this.countRecords(exportData);
      validations.push({
        test: 'Has data records',
        passed: recordCount > 0,
        details: `${recordCount} records found`
      });

      const allPassed = validations.every(v => v.passed);

      return {
        filename,
        valid: allPassed,
        validations,
        summary: {
          recordCount,
          exportDate: exportData.metadata?.timestamp,
          restaurantName: exportData.restaurant?.name
        }
      };

    } catch (error) {
      return {
        filename,
        valid: false,
        error: error.message,
        validations: []
      };
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const exporter = new DataExporter();

  try {
    const command = args[0] || 'help';

    switch (command) {
      case 'restaurant': {
        const restaurantId = args[1];
        if (!restaurantId) {
          console.error('Usage: node data-export.js restaurant <restaurant-id> [options]');
          process.exit(1);
        }

        const options = {
          format: args.includes('--csv') ? 'csv' : 'json',
          includeAudit: args.includes('--include-audit'),
          anonymize: args.includes('--anonymize'),
          compress: args.includes('--compress')
        };

        const result = await exporter.exportRestaurantData(restaurantId, options);
        console.log('Export successful:', result);
        break;
      }

      case 'config': {
        const restaurantId = args[1];
        const configVersionId = args[2] || null;
        
        if (!restaurantId) {
          console.error('Usage: node data-export.js config <restaurant-id> [config-version-id]');
          process.exit(1);
        }

        const result = await exporter.exportConfiguration(restaurantId, configVersionId);
        console.log('Configuration export successful:', result);
        break;
      }

      case 'list': {
        const restaurants = await exporter.listExportableRestaurants();
        console.log('\nAvailable restaurants for export:');
        console.table(restaurants);
        break;
      }

      case 'validate': {
        const filename = args[1];
        if (!filename) {
          console.error('Usage: node data-export.js validate <filename>');
          process.exit(1);
        }

        const validation = await exporter.validateExport(filename);
        console.log('\nExport validation results:');
        console.log(`File: ${validation.filename}`);
        console.log(`Valid: ${validation.valid ? '✅' : '❌'}`);
        
        if (validation.error) {
          console.log(`Error: ${validation.error}`);
        } else {
          console.table(validation.validations);
          console.log('\nSummary:', validation.summary);
        }
        break;
      }

      case 'help':
      default: {
        console.log(`
Data Export Utility for Shift Schedule Manager

Usage: node data-export.js <command> [options]

Commands:
  restaurant <id>     Export complete restaurant data
  config <id> [ver]   Export configuration only
  list                List available restaurants
  validate <file>     Validate exported file
  help                Show this help

Restaurant Export Options:
  --csv               Export in CSV format (default: JSON)
  --include-audit     Include audit trail data
  --anonymize         Anonymize sensitive data
  --compress          Compress output with gzip

Environment Variables:
  SUPABASE_URL           Supabase project URL
  SUPABASE_SERVICE_KEY   Service role key
  OUTPUT_DIR             Export output directory (default: ./exports)
  DEBUG                  Enable debug logging

Examples:
  node data-export.js restaurant 550e8400-e29b-41d4-a716-446655440001
  node data-export.js restaurant 550e8400-e29b-41d4-a716-446655440001 --anonymize --compress
  node data-export.js config 550e8400-e29b-41d4-a716-446655440001
  node data-export.js list
  node data-export.js validate sakura_sushi_export.json
        `);
        break;
      }
    }

  } catch (error) {
    console.error(`Export failed: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DataExporter, CONFIG };