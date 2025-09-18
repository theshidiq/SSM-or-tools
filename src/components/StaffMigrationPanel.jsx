/**
 * StaffMigrationPanel - Replacement component for staff data migration
 * Uses existing Phase 4 migration utilities for localStorage to database migration
 */

import React, { useState, useEffect } from "react";
import { AlertTriangle, Info, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

// Import migration utilities
import {
  hasLocalStorageStaffData,
  performStaffMigration,
  extractLocalStorageStaffData,
} from "../utils/staffMigrationUtils";

const StaffMigrationPanel = () => {
  const [migrationState, setMigrationState] = useState("idle"); // idle, checking, migrating, completed, error
  const [migrationResult, setMigrationResult] = useState(null);
  const [localDataStatus, setLocalDataStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Check for local storage data on component mount
  useEffect(() => {
    checkLocalStorageData();
  }, []);

  const checkLocalStorageData = () => {
    setMigrationState("checking");
    setProgress(10);

    try {
      const dataStatus = hasLocalStorageStaffData();
      setLocalDataStatus(dataStatus);
      setMigrationState("idle");
      setProgress(0);
    } catch (err) {
      setError(`Failed to check local data: ${err.message}`);
      setMigrationState("error");
      setProgress(0);
    }
  };

  const handleMigration = async (options = {}) => {
    setMigrationState("migrating");
    setError(null);
    setProgress(20);

    try {
      // Perform the migration
      const result = await performStaffMigration({
        skipDuplicates: true,
        createBackup: true,
        cleanup: false, // Keep localStorage data as backup initially
        dryRun: false,
        ...options,
      });

      setProgress(100);
      setMigrationResult(result);

      if (result.success) {
        setMigrationState("completed");
        // Refresh local data status
        setTimeout(() => {
          checkLocalStorageData();
        }, 1000);
      } else {
        setMigrationState("error");
        setError(result.message || "Migration failed");
      }
    } catch (err) {
      setMigrationState("error");
      setError(`Migration error: ${err.message}`);
      setProgress(0);
    }
  };

  const handleDryRun = async () => {
    setMigrationState("migrating");
    setError(null);
    setProgress(50);

    try {
      const result = await performStaffMigration({
        dryRun: true,
        skipDuplicates: true,
      });

      setProgress(100);
      setMigrationResult(result);
      setMigrationState("completed");
    } catch (err) {
      setMigrationState("error");
      setError(`Dry run error: ${err.message}`);
      setProgress(0);
    }
  };

  const renderMigrationStatus = () => {
    if (!localDataStatus) {
      return (
        <Alert>
          <RefreshCw className="h-4 w-4" />
          <AlertDescription>Checking for migration data...</AlertDescription>
        </Alert>
      );
    }

    if (!localDataStatus.hasData) {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            No staff data found in localStorage. Migration not needed.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Found staff data in localStorage: {localDataStatus.foundKeys.join(", ")} (
          {localDataStatus.count} source{localDataStatus.count !== 1 ? "s" : ""})
        </AlertDescription>
      </Alert>
    );
  };

  const renderMigrationControls = () => {
    if (!localDataStatus?.hasData || migrationState === "migrating") {
      return null;
    }

    return (
      <div className="flex gap-3">
        <Button
          onClick={() => handleDryRun()}
          variant="outline"
          disabled={migrationState === "migrating"}
        >
          Preview Migration
        </Button>
        <Button
          onClick={() => handleMigration()}
          disabled={migrationState === "migrating"}
        >
          Start Migration
        </Button>
      </div>
    );
  };

  const renderMigrationProgress = () => {
    if (migrationState !== "migrating") return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Migration Progress</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>
    );
  };

  const renderMigrationResult = () => {
    if (!migrationResult) return null;

    const isSuccess = migrationResult.success;
    const isDryRun = migrationResult.dryRun;

    return (
      <Card className={`border-l-4 ${isSuccess ? "border-l-green-500" : "border-l-red-500"}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {isDryRun ? "Migration Preview" : "Migration Result"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">{migrationResult.message}</p>

            {isSuccess && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Migrated:</span>{" "}
                  <Badge variant="outline">{migrationResult.migrated || 0}</Badge>
                </div>
                <div>
                  <span className="font-medium">Duplicates:</span>{" "}
                  <Badge variant="secondary">{migrationResult.duplicates || 0}</Badge>
                </div>
                {migrationResult.extractedFrom && (
                  <div className="col-span-2">
                    <span className="font-medium">Sources:</span>{" "}
                    <span className="text-gray-600">
                      {migrationResult.extractedFrom.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {migrationResult.errors && migrationResult.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {migrationResult.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {isDryRun && migrationResult.preview && (
              <div className="mt-3">
                <h4 className="font-medium mb-2">Preview ({migrationResult.preview.length} staff members):</h4>
                <div className="max-h-40 overflow-y-auto text-sm bg-gray-50 p-2 rounded">
                  {migrationResult.preview.slice(0, 5).map((staff, index) => (
                    <div key={index} className="py-1">
                      {staff.name} - {staff.position} ({staff.id})
                    </div>
                  ))}
                  {migrationResult.preview.length > 5 && (
                    <div className="py-1 text-gray-500">
                      ... and {migrationResult.preview.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Migration Status */}
      {renderMigrationStatus()}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Migration Progress */}
      {renderMigrationProgress()}

      {/* Migration Controls */}
      {renderMigrationControls()}

      {/* Migration Result */}
      {renderMigrationResult()}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={checkLocalStorageData}
          disabled={migrationState === "migrating"}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>
    </div>
  );
};

export default StaffMigrationPanel;