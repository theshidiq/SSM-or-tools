/**
 * Phase 4: Data Migration Tab for Settings Modal
 * Provides migration interface within the settings panel
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { AlertTriangle, Info } from "lucide-react";
import StaffMigrationPanel from "../../StaffMigrationPanel";

const DataMigrationTab = () => {
  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Data Migration</h3>
        <p className="text-sm text-gray-600">
          Migrate staff data from localStorage to the database for improved performance and real-time collaboration.
        </p>
      </div>

      {/* Information Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This feature helps you migrate existing staff data stored in your browser's localStorage to the Supabase database. 
          This enables real-time collaboration and prevents data loss when switching devices or browsers.
        </AlertDescription>
      </Alert>

      {/* Migration Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Migration Overview</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Phase 4
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Status:</span>
              <span className="text-sm font-medium">Database-first architecture enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Real-time Features:</span>
              <Badge variant="success" className="bg-green-50 text-green-700">
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Migration Support:</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                Ready
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration Process */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Data Migration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <h4 className="font-medium text-gray-900">Migration Process:</h4>
            <ol className="text-sm text-gray-600 space-y-1 ml-4">
              <li>1. Analyze existing localStorage data</li>
              <li>2. Transform data format for database compatibility</li>
              <li>3. Create backup of original data</li>
              <li>4. Migrate staff members to Supabase database</li>
              <li>5. Verify migration success</li>
              <li>6. Clean up localStorage (optional)</li>
            </ol>
          </div>

          {/* Warning for important data */}
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Migration will automatically create backups, but it's recommended to export 
              your current schedule data before proceeding. The migration is designed to be safe and reversible.
            </AlertDescription>
          </Alert>

          {/* Migration Panel */}
          <StaffMigrationPanel />
        </CardContent>
      </Card>

      {/* Migration Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Benefits of Database Migration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-green-700 mb-2">✅ Advantages</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time collaboration across devices</li>
                <li>• Automatic data synchronization</li>
                <li>• Prevents data loss from browser issues</li>
                <li>• Better performance with large datasets</li>
                <li>• Centralized data management</li>
                <li>• Automatic backup and versioning</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-700 mb-2">ℹ️ Technical Details</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Uses Supabase PostgreSQL database</li>
                <li>• Row-level security enabled</li>
                <li>• Real-time subscriptions for live updates</li>
                <li>• Optimistic updates for responsiveness</li>
                <li>• Conflict resolution for concurrent edits</li>
                <li>• JSON-based metadata storage</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataMigrationTab;