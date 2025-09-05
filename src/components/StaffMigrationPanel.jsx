/**
 * Phase 4: Staff Migration Interface Component
 * Provides user-friendly interface for migrating staff data from localStorage to database
 */

import React, { useState, useEffect } from 'react';
import {
  hasLocalStorageStaffData,
  performStaffMigration,
  extractLocalStorageStaffData,
  transformStaffDataForDatabase,
  restoreStaffFromBackup
} from '../utils/staffMigrationUtils';

const StaffMigrationPanel = () => {
  const [migrationState, setMigrationState] = useState({
    status: 'idle', // 'idle', 'analyzing', 'migrating', 'completed', 'error'
    hasData: false,
    foundKeys: [],
    preview: [],
    result: null,
    error: null,
    backupKey: null
  });

  const [migrationOptions, setMigrationOptions] = useState({
    skipDuplicates: true,
    updateDuplicates: false,
    createBackup: true,
    cleanup: true,
    dryRun: false
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Check for localStorage data on component mount
  useEffect(() => {
    analyzeMigrationNeeds();
  }, []);

  const analyzeMigrationNeeds = async () => {
    setMigrationState(prev => ({ ...prev, status: 'analyzing' }));
    
    try {
      const localStorageCheck = hasLocalStorageStaffData();
      
      if (localStorageCheck.hasData) {
        // Extract and preview the data
        const extractedData = extractLocalStorageStaffData();
        let previewData = [];
        
        if (extractedData) {
          // Combine all data for preview
          Object.entries(extractedData.periodBased).forEach(([period, periodData]) => {
            const transformedStaff = transformStaffDataForDatabase(periodData.data);
            previewData = previewData.concat(transformedStaff.map(staff => ({
              ...staff,
              source: `Period ${period} (${periodData.source})`
            })));
          });
          
          Object.entries(extractedData.injected).forEach(([period, injectedData]) => {
            const transformedStaff = transformStaffDataForDatabase(injectedData);
            previewData = previewData.concat(transformedStaff.map(staff => ({
              ...staff,
              source: `Injected Period ${period}`
            })));
          });
          
          if (extractedData.legacy) {
            const transformedStaff = transformStaffDataForDatabase(extractedData.legacy.data);
            previewData = previewData.concat(transformedStaff.map(staff => ({
              ...staff,
              source: `Legacy (${extractedData.legacy.source})`
            })));
          }
          
          // Remove duplicates for preview
          const uniquePreview = [];
          const seenNames = new Set();
          previewData.forEach(staff => {
            const key = `${staff.name}-${staff.position}`;
            if (!seenNames.has(key)) {
              seenNames.add(key);
              uniquePreview.push(staff);
            }
          });
          
          setMigrationState(prev => ({
            ...prev,
            status: 'idle',
            hasData: true,
            foundKeys: localStorageCheck.foundKeys,
            preview: uniquePreview
          }));
        } else {
          setMigrationState(prev => ({
            ...prev,
            status: 'error',
            error: 'Failed to extract data from localStorage'
          }));
        }
      } else {
        setMigrationState(prev => ({
          ...prev,
          status: 'completed',
          hasData: false,
          foundKeys: []
        }));
      }
    } catch (error) {
      setMigrationState(prev => ({
        ...prev,
        status: 'error',
        error: `Analysis failed: ${error.message}`
      }));
    }
  };

  const handleMigration = async () => {
    setMigrationState(prev => ({ ...prev, status: 'migrating' }));
    
    try {
      const result = await performStaffMigration(migrationOptions);
      
      setMigrationState(prev => ({
        ...prev,
        status: result.success ? 'completed' : 'error',
        result,
        error: result.success ? null : result.message,
        backupKey: result.backupKey
      }));
    } catch (error) {
      setMigrationState(prev => ({
        ...prev,
        status: 'error',
        error: `Migration failed: ${error.message}`
      }));
    }
  };

  const handleDryRun = async () => {
    const originalDryRun = migrationOptions.dryRun;
    setMigrationOptions(prev => ({ ...prev, dryRun: true }));
    setMigrationState(prev => ({ ...prev, status: 'migrating' }));
    
    try {
      const result = await performStaffMigration({ ...migrationOptions, dryRun: true });
      
      setMigrationState(prev => ({
        ...prev,
        status: 'idle',
        result,
        error: result.success ? null : result.message
      }));
    } catch (error) {
      setMigrationState(prev => ({
        ...prev,
        status: 'error',
        error: `Dry run failed: ${error.message}`
      }));
    } finally {
      setMigrationOptions(prev => ({ ...prev, dryRun: originalDryRun }));
    }
  };

  const handleRollback = async () => {
    if (!migrationState.backupKey) {
      alert('No backup available for rollback');
      return;
    }
    
    if (!confirm('Are you sure you want to rollback the migration? This will restore localStorage data and you may lose any new data added since migration.')) {
      return;
    }
    
    try {
      const result = restoreStaffFromBackup(migrationState.backupKey);
      if (result.success) {
        alert(`Rollback successful: ${result.message}`);
        await analyzeMigrationNeeds(); // Re-analyze after rollback
      } else {
        alert(`Rollback failed: ${result.message}`);
      }
    } catch (error) {
      alert(`Rollback error: ${error.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'analyzing': return 'text-blue-600';
      case 'migrating': return 'text-yellow-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (migrationState.status) {
      case 'analyzing': return 'Analyzing localStorage data...';
      case 'migrating': return 'Migrating staff data...';
      case 'completed': return migrationState.hasData ? 'Migration completed successfully!' : 'No migration needed - no localStorage data found';
      case 'error': return `Error: ${migrationState.error}`;
      default: return migrationState.hasData ? 'Ready to migrate staff data' : 'No staff data found in localStorage';
    }
  };

  const canMigrate = migrationState.status === 'idle' && migrationState.hasData && migrationState.preview.length > 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-blue-200">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 mr-2 rounded-full bg-blue-500"></div>
        <h3 className="text-lg font-semibold text-gray-800">Phase 4: Staff Data Migration</h3>
      </div>

      {/* Status Display */}
      <div className={`mb-4 p-3 rounded-md bg-gray-50 ${getStatusColor(migrationState.status)}`}>
        <div className="flex items-center">
          {migrationState.status === 'analyzing' || migrationState.status === 'migrating' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
          ) : null}
          <span className="font-medium">{getStatusText()}</span>
        </div>
      </div>

      {/* Data Summary */}
      {migrationState.hasData && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <h4 className="font-medium text-blue-800 mb-2">Found localStorage staff data:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            {migrationState.foundKeys.map((key, index) => (
              <li key={index}>• {key}</li>
            ))}
          </ul>
          <p className="text-sm text-blue-600 mt-2">
            {migrationState.preview.length} unique staff members ready for migration
          </p>
        </div>
      )}

      {/* Preview Section */}
      {migrationState.preview.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <span>{showPreview ? '▼' : '▶'}</span>
            <span className="ml-1">Preview staff data ({migrationState.preview.length} members)</span>
          </button>
          
          {showPreview && (
            <div className="mt-2 max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Position</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {migrationState.preview.map((staff, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2">{staff.name}</td>
                      <td className="px-3 py-2">{staff.position}</td>
                      <td className="px-3 py-2">{staff.status}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{staff.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Migration Options */}
      {canMigrate && (
        <div className="mb-4">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center text-gray-600 hover:text-gray-800 font-medium mb-2"
          >
            <span>{showAdvancedOptions ? '▼' : '▶'}</span>
            <span className="ml-1">Migration Options</span>
          </button>
          
          {showAdvancedOptions && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-md">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={migrationOptions.skipDuplicates}
                  onChange={(e) => setMigrationOptions(prev => ({ 
                    ...prev, 
                    skipDuplicates: e.target.checked,
                    updateDuplicates: e.target.checked ? false : prev.updateDuplicates
                  }))}
                  className="mr-2"
                />
                <span className="text-sm">Skip duplicate staff members (recommended)</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={migrationOptions.updateDuplicates}
                  onChange={(e) => setMigrationOptions(prev => ({ 
                    ...prev, 
                    updateDuplicates: e.target.checked,
                    skipDuplicates: e.target.checked ? false : prev.skipDuplicates
                  }))}
                  className="mr-2"
                />
                <span className="text-sm">Update duplicate staff members instead of skipping</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={migrationOptions.createBackup}
                  onChange={(e) => setMigrationOptions(prev => ({ ...prev, createBackup: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm">Create backup before migration (recommended)</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={migrationOptions.cleanup}
                  onChange={(e) => setMigrationOptions(prev => ({ ...prev, cleanup: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm">Clean up localStorage after successful migration</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {canMigrate && (
          <>
            <button
              onClick={handleDryRun}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              disabled={migrationState.status === 'migrating'}
            >
              Test Migration (Dry Run)
            </button>
            
            <button
              onClick={handleMigration}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              disabled={migrationState.status === 'migrating'}
            >
              Start Migration
            </button>
          </>
        )}
        
        {migrationState.status === 'completed' && !migrationState.hasData && (
          <button
            onClick={analyzeMigrationNeeds}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Re-check for Data
          </button>
        )}
        
        {migrationState.status === 'error' && (
          <button
            onClick={analyzeMigrationNeeds}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Retry Analysis
          </button>
        )}
        
        {migrationState.backupKey && (
          <button
            onClick={handleRollback}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Rollback Migration
          </button>
        )}
      </div>

      {/* Migration Result */}
      {migrationState.result && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <h4 className="font-medium text-gray-800 mb-2">Migration Result:</h4>
          <div className="text-sm space-y-1">
            {migrationState.result.dryRun && (
              <p className="text-blue-600 font-medium">🧪 This was a dry run - no actual migration performed</p>
            )}
            <p><span className="font-medium">Status:</span> {migrationState.result.success ? '✅ Success' : '❌ Failed'}</p>
            <p><span className="font-medium">Message:</span> {migrationState.result.message}</p>
            {migrationState.result.migrated !== undefined && (
              <p><span className="font-medium">Migrated:</span> {migrationState.result.migrated} staff members</p>
            )}
            {migrationState.result.duplicates !== undefined && migrationState.result.duplicates > 0 && (
              <p><span className="font-medium">Duplicates skipped:</span> {migrationState.result.duplicates}</p>
            )}
            {migrationState.result.errors && migrationState.result.errors.length > 0 && (
              <div>
                <p className="font-medium text-red-600">Errors:</p>
                <ul className="ml-4 text-red-600">
                  {migrationState.result.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
            {migrationState.backupKey && (
              <p><span className="font-medium">Backup:</span> {migrationState.backupKey}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffMigrationPanel;