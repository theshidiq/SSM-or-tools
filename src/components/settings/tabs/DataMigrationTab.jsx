/**
 * Phase 4 Day 7: Data Migration Tab for Settings Backend Integration
 * Provides settings migration interface with multi-table mapping preview
 */

import React, { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { useSettingsData } from "../../../hooks/useSettingsData";

const DataMigrationTab = () => {
  const {
    migrateToBackend,
    backendMode,
    currentVersion,
    versionName,
    settings,
    isConnectedToBackend
  } = useSettingsData();

  const [migrationStatus, setMigrationStatus] = useState('not_started');
  const [migrationError, setMigrationError] = useState(null);

  // Migration handler
  const handleMigrate = async () => {
    if (!isConnectedToBackend) {
      setMigrationError('WebSocket not connected. Please ensure the server is running.');
      return;
    }

    setMigrationStatus('in_progress');
    setMigrationError(null);

    try {
      await migrateToBackend();
      setMigrationStatus('completed');
    } catch (err) {
      setMigrationStatus('failed');
      setMigrationError(err.message || 'Migration failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Settings Migration to Multi-Table Backend
        </h3>
        <p className="text-sm text-gray-600">
          Migrate settings data from localStorage to the multi-table database backend for improved performance and real-time synchronization.
        </p>
      </div>

      {/* Information Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This feature migrates your settings from browser localStorage to a sophisticated multi-table database backend. This enables version control, audit trails, and real-time collaboration.
        </AlertDescription>
      </Alert>

      {/* Backend Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Backend Status</span>
            <Badge
              variant="outline"
              className={backendMode === 'websocket-multitable' ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}
            >
              {backendMode === 'websocket-multitable' ? '🟢 Multi-Table' : '📱 localStorage'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Backend Mode:</span>
              <span className="text-sm font-medium">{backendMode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Version:</span>
              <span className="text-sm font-medium">
                {currentVersion ? `${currentVersion} - ${versionName}` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Connection Status:</span>
              <Badge
                variant={isConnectedToBackend ? "success" : "secondary"}
                className={isConnectedToBackend ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}
              >
                {isConnectedToBackend ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Table Mapping Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Table Migration Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Your settings will be migrated from a flat localStorage structure to a normalized multi-table database:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-2 font-medium text-gray-700">localStorage Key</th>
                    <th className="text-left p-2 font-medium text-gray-700">Target Table</th>
                    <th className="text-left p-2 font-medium text-gray-700">Mapping Type</th>
                    <th className="text-right p-2 font-medium text-gray-700">Item Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="p-2 font-mono text-xs">staffGroups[]</td>
                    <td className="p-2 font-mono text-xs text-blue-600">staff_groups</td>
                    <td className="p-2 text-xs">Array → Rows</td>
                    <td className="p-2 text-xs text-right">{settings?.staffGroups?.length || 0} items</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-2 font-mono text-xs">dailyLimits[]</td>
                    <td className="p-2 font-mono text-xs text-blue-600">daily_limits</td>
                    <td className="p-2 text-xs">Array → Rows</td>
                    <td className="p-2 text-xs text-right">{settings?.dailyLimits?.length || 0} items</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-2 font-mono text-xs">monthlyLimits[]</td>
                    <td className="p-2 font-mono text-xs text-blue-600">monthly_limits</td>
                    <td className="p-2 text-xs">Array → Rows</td>
                    <td className="p-2 text-xs text-right">{settings?.monthlyLimits?.length || 0} items</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-2 font-mono text-xs">priorityRules[]</td>
                    <td className="p-2 font-mono text-xs text-blue-600">priority_rules</td>
                    <td className="p-2 text-xs">Array → Rows</td>
                    <td className="p-2 text-xs text-right">{settings?.priorityRules?.length || 0} items</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-2 font-mono text-xs">mlParameters{}</td>
                    <td className="p-2 font-mono text-xs text-blue-600">ml_model_configs</td>
                    <td className="p-2 text-xs">Object → Row</td>
                    <td className="p-2 text-xs text-right">{settings?.mlParameters ? '1 config' : '0 configs'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Migration creates a new configuration version in the database. Your localStorage data will be preserved as a backup.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleMigrate}
            disabled={migrationStatus === 'in_progress' || backendMode === 'websocket-multitable' || !isConnectedToBackend}
            className="w-full"
          >
            {migrationStatus === 'in_progress' ? 'Migrating...' : 'Migrate to Multi-Table Backend'}
          </Button>

          {migrationStatus === 'completed' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                ✅ Migration completed! Settings now stored in multi-table architecture with version control.
              </p>
            </div>
          )}

          {migrationStatus === 'failed' && migrationError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                ❌ Migration failed: {migrationError}
              </p>
            </div>
          )}

          {backendMode === 'websocket-multitable' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                ℹ️ Already using multi-table backend. No migration needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migration Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Benefits of Multi-Table Backend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-green-700 mb-2">✅ Advantages</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Version control with rollback capability</li>
                <li>• Complete audit trail of all changes</li>
                <li>• Real-time synchronization across users</li>
                <li>• Normalized database structure</li>
                <li>• Configuration locking for production</li>
                <li>• Restaurant-level multi-tenancy</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-700 mb-2">
                ℹ️ Technical Details
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 5 normalized database tables</li>
                <li>• PostgreSQL with JSONB flexibility</li>
                <li>• Row-level security (RLS)</li>
                <li>• WebSocket real-time updates</li>
                <li>• Automated audit logging</li>
                <li>• Version activation/deactivation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataMigrationTab;
