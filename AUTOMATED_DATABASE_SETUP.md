# Automated Database Setup System

## Overview

The new automated database setup system eliminates the need for manual SQL copy-pasting, providing a one-click solution that creates all required database tables, functions, and configurations automatically through direct Supabase integration.

## Key Features

### ✅ Fully Automated
- **One-click solution**: No manual SQL copy-pasting required
- **Direct SQL execution**: Uses Supabase client's `rpc()` method to execute SQL directly
- **Smart table detection**: Automatically skips existing tables
- **Real-time progress tracking**: Visual progress bar with detailed step information

### 🔧 Robust Error Handling
- **Retry mechanism**: Automatic retry with exponential backoff for transient failures
- **Graceful degradation**: Falls back to manual setup if automation fails
- **Detailed error reporting**: Clear error messages with troubleshooting guidance
- **Non-destructive**: Safe to run multiple times without data loss

### 📊 Progress Monitoring
- **Chunked execution**: Breaks large schema into manageable pieces
- **Real-time updates**: Live progress reporting with percentage completion
- **Step-by-step tracking**: Shows exactly which tables/functions are being created
- **Success/failure indicators**: Clear visual feedback for each operation

## Architecture

### Core Components

1. **AutomatedDatabaseSetupService** (`/src/services/AutomatedDatabaseSetupService.js`)
   - Main service handling automated database setup
   - Chunked SQL execution with retry logic
   - Progress tracking and error handling

2. **DatabaseSetupModal** (`/src/components/settings/DatabaseSetupModal.jsx`)
   - Updated UI supporting both automated and manual modes
   - Real-time progress visualization
   - Fallback options and troubleshooting guidance

3. **SupabaseCapabilities** (`/src/utils/supabaseCapabilities.js`)
   - Capability detection for RPC support
   - Determines optimal setup method
   - Permission validation

## How It Works

### Automated Setup Flow

1. **Capability Check**
   ```javascript
   // Check if Supabase RPC is available
   const capabilities = await SupabaseCapabilities.checkAllCapabilities();
   if (capabilities.automatedSetupSupported) {
     // Use automated setup
   } else {
     // Fall back to manual setup
   }
   ```

2. **Table Detection**
   ```javascript
   // Check existing tables before creating new ones
   await service.checkExistingTables();
   // Automatically skip existing tables
   if (await service.shouldSkipChunk(chunk)) {
     console.log('Skipping - tables already exist');
   }
   ```

3. **Chunked Execution**
   ```javascript
   // Execute SQL in manageable chunks
   for (const chunk of setupChunks) {
     await service.executeChunkWithRetry(chunk);
   }
   ```

4. **Progress Reporting**
   ```javascript
   service.executeSetup(
     (progress) => console.log(`${progress.percentage}%`),
     (error) => console.error('Error:', error.message),
     (result) => console.log('Complete:', result.success)
   );
   ```

### Setup Chunks

The automated setup is divided into logical chunks for better progress tracking and error isolation:

1. **Validate Connection** - Test database connectivity and permissions
2. **Scan Existing Tables** - Check which tables already exist
3. **Create Extensions** - Enable PostgreSQL extensions (`uuid-ossp`, `pgcrypto`)
4. **Create Types** - Create custom database types (`user_role` enum)
5. **Create Core Tables** - Create `restaurants` and `staff` tables
6. **Create Configuration Tables** - Create `config_versions` and `config_changes`
7. **Create Staff Groups** - Create `staff_groups` and `staff_group_members`
8. **Create Business Rules** - Create `conflict_rules`, `daily_limits`, `monthly_limits`
9. **Create Priority Rules** - Create `priority_rules` table
10. **Create ML System** - Create `ml_model_configs` and `ml_model_performance`
11. **Create Functions** - Create helper functions (`get_active_config_version`, etc.)
12. **Create Triggers** - Create update triggers for `updated_at` columns
13. **Create Indexes** - Create performance indexes (non-critical)
14. **Setup RLS Policies** - Configure row level security (non-critical)
15. **Insert Sample Data** - Create sample restaurant and staff data
16. **Final Validation** - Verify setup completion

## Usage Examples

### Basic Automated Setup

```javascript
import AutomatedDatabaseSetupService from './src/services/AutomatedDatabaseSetupService.js';

const service = new AutomatedDatabaseSetupService();

const result = await service.executeSetup(
  // Progress callback
  (progress) => {
    console.log(`${progress.percentage}% - ${progress.message}`);
  },
  // Error callback
  (error, chunk) => {
    console.error(`Error in ${chunk.name}: ${error.message}`);
  },
  // Completion callback
  (result) => {
    if (result.success) {
      console.log('✅ Setup completed successfully!');
    } else {
      console.log('❌ Setup failed:', result.error);
    }
  }
);
```

### With React Component

```jsx
import { AutomatedDatabaseSetupService } from '../services/AutomatedDatabaseSetupService';

const MyComponent = () => {
  const [service] = useState(() => new AutomatedDatabaseSetupService());
  const [progress, setProgress] = useState(0);
  
  const handleSetup = async () => {
    await service.executeSetup(
      (progressInfo) => setProgress(progressInfo.percentage),
      (error) => console.error('Setup error:', error),
      (result) => {
        if (result.success) {
          alert('Database setup completed!');
        }
      }
    );
  };
  
  return (
    <div>
      <button onClick={handleSetup}>Start Automated Setup</button>
      <div>Progress: {progress}%</div>
    </div>
  );
};
```

## Configuration

### Retry Settings

```javascript
const service = new AutomatedDatabaseSetupService();
service.maxRetries = 5; // Default: 3
service.retryDelay = 2000; // Default: 1000ms
```

### Chunk Customization

```javascript
// Access and modify setup chunks
const chunks = service.getSetupChunks();
chunks.forEach(chunk => {
  chunk.retryable = true; // Enable retry for all chunks
});
```

## Error Handling

### Common Error Scenarios

1. **RPC Not Available**
   ```javascript
   if (error.message.includes('function') && error.message.includes('does not exist')) {
     // RPC exec function not available - use manual setup
   }
   ```

2. **Permission Denied**
   ```javascript
   if (error.code === '42501') {
     // Insufficient privileges - check Supabase RLS policies
   }
   ```

3. **Table Already Exists**
   ```javascript
   if (error.code === '42P07') {
     // Table already exists - safely ignored
   }
   ```

### Retry Logic

```javascript
async executeChunkWithRetry(chunk) {
  for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
    try {
      await this.executeChunk(chunk);
      return; // Success
    } catch (error) {
      if (attempt === this.maxRetries) throw error;
      
      const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
      await this.sleep(delay);
    }
  }
}
```

## Fallback to Manual Setup

If automated setup fails, the system automatically provides:

1. **Complete SQL schema** for manual execution
2. **Step-by-step instructions** for Supabase dashboard
3. **Validation capability** to check manual setup success
4. **Clear error explanations** with troubleshooting tips

## Benefits Over Manual Setup

| Feature | Manual Setup | Automated Setup |
|---------|-------------|----------------|
| User Actions Required | 5-7 manual steps | 1 click |
| Time to Complete | 3-5 minutes | 30-60 seconds |
| Error Recovery | Manual retry | Automatic retry |
| Progress Visibility | None | Real-time |
| Table Collision Handling | Manual check | Automatic skip |
| Rollback Support | Manual | Planned feature |

## Testing

Run the test script to verify automated setup functionality:

```bash
node test-automated-setup.js
```

This will:
1. Check Supabase capabilities
2. Test automated setup execution
3. Report detailed results
4. Provide recommendations if issues are found

## Troubleshooting

### Setup Fails Immediately

**Cause**: RPC function not available
**Solution**: Enable RPC functions in Supabase or use manual setup

### Permission Errors

**Cause**: Insufficient database privileges
**Solution**: Check Supabase authentication and RLS policies

### Partial Success

**Cause**: Some tables already exist
**Solution**: Normal behavior - existing tables are skipped safely

### Network Timeouts

**Cause**: Large schema execution timing out
**Solution**: Automatic retry will handle transient issues

## Future Enhancements

1. **Rollback Capability**: Automatic rollback on critical failures
2. **Schema Migration**: Support for schema updates and migrations
3. **Custom Configurations**: User-defined table schemas
4. **Batch Operations**: Improved performance for large schemas
5. **Real-time Monitoring**: WebSocket-based progress updates

## Security Considerations

- All SQL execution uses parameterized queries where possible
- RLS policies are enabled by default on all tables
- No sensitive data is logged during setup process
- Automatic cleanup of temporary functions and test data
- Permission validation before executing any SQL

The automated database setup system represents a significant improvement in user experience, reducing setup complexity from multiple manual steps to a single automated process while maintaining safety and reliability.