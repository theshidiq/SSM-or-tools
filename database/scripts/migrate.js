#!/usr/bin/env node

/**
 * Database Migration Runner for Supabase
 * 
 * This script handles the complete migration process including:
 * - Schema creation and updates
 * - Data seeding
 * - Rollback capabilities
 * - Validation and testing
 * - Progress tracking and logging
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'your-supabase-url',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || 'your-service-key',
  migrationsPath: path.join(__dirname, '../migrations'),
  maxRetries: 3,
  timeoutMs: 30000,
  logLevel: process.env.LOG_LEVEL || 'info' // debug, info, warn, error
};

class MigrationRunner {
  constructor() {
    this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey);
    this.startTime = Date.now();
    this.logEntries = [];
  }

  log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data, null, 2) : null,
      elapsed: Date.now() - this.startTime
    };
    
    this.logEntries.push(entry);
    
    if (CONFIG.logLevel === 'debug' || 
        (CONFIG.logLevel === 'info' && ['info', 'warn', 'error'].includes(level)) ||
        (CONFIG.logLevel === 'warn' && ['warn', 'error'].includes(level)) ||
        (CONFIG.logLevel === 'error' && level === 'error')) {
      
      const color = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m'  // red
      }[level] || '\x1b[0m';
      
      console.log(`${color}[${entry.timestamp}] ${level.toUpperCase()}: ${message}\x1b[0m`);
      if (data) {
        console.log(`${color}${JSON.stringify(data, null, 2)}\x1b[0m`);
      }
    }
  }

  async askQuestion(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  async executeSqlFile(filePath, description = '') {
    try {
      this.log('debug', `Reading SQL file: ${filePath}`);
      const sql = await fs.readFile(filePath, 'utf8');
      
      if (!sql.trim()) {
        this.log('warn', `SQL file is empty: ${filePath}`);
        return { success: true, affected: 0 };
      }

      this.log('info', `Executing: ${description || path.basename(filePath)}`);
      
      const startTime = Date.now();
      const { data, error, count } = await this.supabase.rpc('exec_sql', { sql_query: sql });
      const executionTime = Date.now() - startTime;

      if (error) {
        throw new Error(`SQL execution failed: ${error.message}`);
      }

      this.log('info', `✓ Completed in ${executionTime}ms${count ? ` (${count} rows affected)` : ''}`);
      return { success: true, affected: count || 0, executionTime };

    } catch (error) {
      this.log('error', `Failed to execute ${filePath}: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  async executeWithRetry(operation, description, maxRetries = CONFIG.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log('debug', `${description} - Attempt ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // exponential backoff
          this.log('warn', `${description} failed, retrying in ${delay}ms...`, { error: error.message });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async getMigrationFiles(type) {
    const typeDir = path.join(CONFIG.migrationsPath, type);
    
    try {
      const files = await fs.readdir(typeDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort()
        .map(file => ({
          file,
          path: path.join(typeDir, file),
          name: file.replace('.sql', ''),
          type
        }));
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('warn', `Migration directory not found: ${typeDir}`);
        return [];
      }
      throw error;
    }
  }

  async checkMigrationStatus() {
    try {
      const { data, error } = await this.supabase
        .from('migration_history')
        .select('migration_name, executed_at, success')
        .order('executed_at', { ascending: false })
        .limit(10);

      if (error && error.code !== 'PGRST116') { // Table not found error
        throw error;
      }

      return data || [];
    } catch (error) {
      this.log('warn', 'Migration history table not found, will be created during migration');
      return [];
    }
  }

  async recordMigration(migrationName, success, executionTime, errorMessage = null) {
    try {
      const { error } = await this.supabase
        .from('migration_history')
        .insert({
          migration_name: migrationName,
          executed_at: new Date().toISOString(),
          success,
          execution_time_ms: executionTime,
          error_message: errorMessage
        });

      if (error) {
        this.log('warn', `Failed to record migration: ${error.message}`);
      }
    } catch (error) {
      this.log('warn', `Failed to record migration: ${error.message}`);
    }
  }

  async validateMigration() {
    this.log('info', 'Validating migration results...');
    
    const validations = [
      {
        name: 'Check restaurants table',
        query: "SELECT COUNT(*) FROM restaurants WHERE name = 'Sakura Sushi Restaurant'",
        expected: 1
      },
      {
        name: 'Check staff count',
        query: "SELECT COUNT(*) FROM staff WHERE restaurant_id = '550e8400-e29b-41d4-a716-446655440001'",
        expected: 12
      },
      {
        name: 'Check active config version',
        query: "SELECT COUNT(*) FROM config_versions WHERE is_active = true",
        expected: 1
      },
      {
        name: 'Check staff groups',
        query: "SELECT COUNT(*) FROM staff_groups WHERE version_id = (SELECT id FROM config_versions WHERE is_active = true LIMIT 1)",
        expected: 7
      },
      {
        name: 'Check ML model configs',
        query: "SELECT COUNT(*) FROM ml_model_configs WHERE is_default = true",
        expected: 1
      }
    ];

    let allValid = true;

    for (const validation of validations) {
      try {
        const { data, error } = await this.supabase.rpc('exec_sql', { 
          sql_query: validation.query 
        });

        if (error) {
          throw error;
        }

        const result = data[0]?.count || 0;
        const isValid = result >= validation.expected;
        
        this.log(isValid ? 'info' : 'error', 
          `${validation.name}: ${isValid ? '✓' : '✗'} (${result}/${validation.expected})`);

        if (!isValid) allValid = false;

      } catch (error) {
        this.log('error', `Validation failed for ${validation.name}: ${error.message}`);
        allValid = false;
      }
    }

    return allValid;
  }

  async runMigrations(types = ['schema', 'seed'], options = {}) {
    const { force = false, validate = true, skipSeed = false } = options;
    
    try {
      this.log('info', '🚀 Starting database migration...');
      this.log('info', `Target: ${CONFIG.supabaseUrl}`);
      
      if (!force) {
        const answer = await this.askQuestion(
          `This will modify the database at ${CONFIG.supabaseUrl}. Continue? (y/N): `
        );
        
        if (!answer.toLowerCase().startsWith('y')) {
          this.log('info', 'Migration cancelled by user');
          return false;
        }
      }

      const migrationStatus = await this.checkMigrationStatus();
      this.log('info', `Found ${migrationStatus.length} previous migrations`);

      let totalMigrations = 0;
      let successfulMigrations = 0;

      for (const type of types) {
        if (type === 'seed' && skipSeed) {
          this.log('info', `Skipping ${type} migrations`);
          continue;
        }

        this.log('info', `\n📁 Processing ${type} migrations...`);
        
        const migrations = await this.getMigrationFiles(type);
        
        if (migrations.length === 0) {
          this.log('warn', `No ${type} migrations found`);
          continue;
        }

        this.log('info', `Found ${migrations.length} ${type} migrations`);

        for (const migration of migrations) {
          totalMigrations++;
          
          try {
            const result = await this.executeWithRetry(
              () => this.executeSqlFile(migration.path, `${type}/${migration.file}`),
              `Migration ${migration.name}`
            );

            await this.recordMigration(migration.name, true, result.executionTime);
            successfulMigrations++;

          } catch (error) {
            this.log('error', `❌ Migration ${migration.name} failed: ${error.message}`);
            await this.recordMigration(migration.name, false, 0, error.message);
            
            if (!options.continueOnError) {
              throw error;
            }
          }
        }
      }

      this.log('info', `\n📊 Migration Summary:`);
      this.log('info', `Total: ${totalMigrations}, Successful: ${successfulMigrations}, Failed: ${totalMigrations - successfulMigrations}`);

      if (validate && successfulMigrations > 0) {
        const isValid = await this.validateMigration();
        if (!isValid) {
          this.log('warn', '⚠️  Some validations failed, please check the logs');
        } else {
          this.log('info', '✅ All validations passed');
        }
      }

      const duration = Date.now() - this.startTime;
      this.log('info', `🎉 Migration completed in ${duration}ms`);

      return successfulMigrations === totalMigrations;

    } catch (error) {
      this.log('error', `💥 Migration failed: ${error.message}`, { error: error.stack });
      return false;
    }
  }

  async generateRollbackScript() {
    try {
      this.log('info', 'Generating rollback script...');
      
      const { data, error } = await this.supabase
        .from('migration_history')
        .select('migration_name, rollback_sql')
        .eq('success', true)
        .order('executed_at', { ascending: false });

      if (error) {
        throw error;
      }

      const rollbackScript = data
        .map(m => `-- Rollback for ${m.migration_name}\n${m.rollback_sql || '-- No rollback script available'}`)
        .join('\n\n');

      const rollbackPath = path.join(CONFIG.migrationsPath, 'rollback', `rollback_${Date.now()}.sql`);
      await fs.mkdir(path.dirname(rollbackPath), { recursive: true });
      await fs.writeFile(rollbackPath, rollbackScript);

      this.log('info', `Rollback script generated: ${rollbackPath}`);
      return rollbackPath;

    } catch (error) {
      this.log('error', `Failed to generate rollback script: ${error.message}`);
      throw error;
    }
  }

  async saveLogs() {
    try {
      const logsPath = path.join(__dirname, '../logs');
      await fs.mkdir(logsPath, { recursive: true });
      
      const logFile = path.join(logsPath, `migration_${Date.now()}.json`);
      await fs.writeFile(logFile, JSON.stringify({
        startTime: this.startTime,
        endTime: Date.now(),
        config: CONFIG,
        entries: this.logEntries
      }, null, 2));

      this.log('info', `Logs saved to: ${logFile}`);
    } catch (error) {
      this.log('warn', `Failed to save logs: ${error.message}`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new MigrationRunner();

  try {
    const command = args[0] || 'run';
    
    switch (command) {
      case 'run':
      case 'migrate': {
        const options = {
          force: args.includes('--force'),
          validate: !args.includes('--no-validate'),
          skipSeed: args.includes('--skip-seed'),
          continueOnError: args.includes('--continue-on-error')
        };
        
        const types = [];
        if (!args.includes('--skip-schema')) types.push('schema');
        if (!args.includes('--skip-seed')) types.push('seed');
        
        const success = await runner.runMigrations(types, options);
        process.exit(success ? 0 : 1);
        break;
      }

      case 'status': {
        const status = await runner.checkMigrationStatus();
        console.log('\nMigration History:');
        console.table(status);
        break;
      }

      case 'validate': {
        const isValid = await runner.validateMigration();
        process.exit(isValid ? 0 : 1);
        break;
      }

      case 'rollback': {
        const rollbackPath = await runner.generateRollbackScript();
        console.log(`Rollback script: ${rollbackPath}`);
        break;
      }

      case 'help':
      default: {
        console.log(`
Database Migration Runner

Usage: node migrate.js [command] [options]

Commands:
  run, migrate    Run database migrations (default)
  status          Show migration history
  validate        Validate current database state
  rollback        Generate rollback script
  help            Show this help

Options:
  --force                Skip confirmation prompt
  --no-validate          Skip post-migration validation
  --skip-seed            Skip seed data migration
  --skip-schema          Skip schema migration
  --continue-on-error    Continue migration even if some steps fail

Environment Variables:
  SUPABASE_URL           Supabase project URL
  SUPABASE_SERVICE_KEY   Supabase service role key
  LOG_LEVEL              Logging level (debug, info, warn, error)

Examples:
  node migrate.js run --force
  node migrate.js run --skip-seed
  node migrate.js status
  node migrate.js validate
        `);
        break;
      }
    }

  } catch (error) {
    runner.log('error', `Command failed: ${error.message}`, { error: error.stack });
    process.exit(1);
  } finally {
    await runner.saveLogs();
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MigrationRunner, CONFIG };