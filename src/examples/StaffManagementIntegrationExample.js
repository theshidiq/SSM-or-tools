/**
 * Phase 2 Staff Management Integration Example
 * 
 * This example shows how to switch from useStaffManagement to useStaffRealtime
 * while maintaining complete API compatibility.
 */

import React, { useState } from 'react';

// Import both hooks for comparison
import { useStaffManagement } from '../hooks/useStaffManagement';
import { useStaffRealtime } from '../hooks/useStaffRealtime';

const StaffManagementIntegrationExample = () => {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [useRealtimeHook, setUseRealtimeHook] = useState(false);

  // Example: Switch between hooks seamlessly
  const staffHookProps = useRealtimeHook 
    ? useStaffRealtime(currentMonthIndex)
    : useStaffManagement(currentMonthIndex, null, null);

  // Destructure the same API from either hook
  const {
    staff,              // Array of staff members
    loading,            // Loading state
    addStaff,           // Function to add staff
    updateStaff,        // Function to update staff
    deleteStaff,        // Function to delete staff  
    reorderStaff,       // Function to reorder staff
    currentPeriod,      // Current period context (realtime only)
    setCurrentPeriod,   // Period setter (realtime only)
    isRealtime,         // Phase identification
    phase,              // Phase description
    error,              // Error state
    isConnected         // Connection status (realtime only)
  } = staffHookProps;

  // Example staff operations - identical API for both hooks
  const handleAddStaff = () => {
    const newStaff = {
      id: `staff-${Date.now()}`,
      name: "新しいスタッフ",
      position: "Server", 
      status: "社員",
      startPeriod: null,
      endPeriod: null
    };

    addStaff(newStaff, (updatedStaff) => {
      console.log('Staff added successfully:', updatedStaff.length, 'total staff');
    });
  };

  const handleUpdateStaff = (staffId) => {
    const updatedData = {
      name: "Updated Name",
      position: "Manager"
    };

    updateStaff(staffId, updatedData, (updatedStaff) => {
      console.log('Staff updated successfully');
    });
  };

  const handleDeleteStaff = (staffId) => {
    deleteStaff(staffId, {}, () => {}, (newStaffMembers) => {
      console.log('Staff deleted successfully:', newStaffMembers.length, 'remaining');
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">
          Staff Management Integration Example
        </h1>
        
        {/* Hook Switcher */}
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={useRealtimeHook}
              onChange={(e) => setUseRealtimeHook(e.target.checked)}
              className="rounded"
            />
            <span className="font-medium">
              Use Real-time Hook (Phase 2)
            </span>
          </label>
          
          <div className="mt-2 text-sm text-gray-600">
            <div>Current Phase: <strong>{phase || "Phase 1: localStorage"}</strong></div>
            <div>Real-time: <strong>{isRealtime ? "Yes" : "No"}</strong></div>
            {isConnected !== undefined && (
              <div>Connected: <strong>{isConnected ? "Yes" : "No"}</strong></div>
            )}
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Current Period: {currentMonthIndex}
          </label>
          <select
            value={currentMonthIndex}
            onChange={(e) => {
              const newPeriod = parseInt(e.target.value);
              setCurrentMonthIndex(newPeriod);
              if (setCurrentPeriod) {
                setCurrentPeriod(newPeriod);
              }
            }}
            className="border rounded px-3 py-1"
          >
            {[0, 1, 2, 3, 4, 5].map(period => (
              <option key={period} value={period}>
                Period {period}
              </option>
            ))}
          </select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            Error: {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded">
            Loading staff data...
          </div>
        )}
      </div>

      {/* Staff Management Actions */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Staff Management Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAddStaff}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Staff
          </button>
          
          {staff.length > 0 && (
            <>
              <button
                onClick={() => handleUpdateStaff(staff[0].id)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Update First Staff
              </button>
              
              <button
                onClick={() => handleDeleteStaff(staff[0].id)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete First Staff
              </button>
            </>
          )}
        </div>
      </div>

      {/* Staff List Display */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          Current Staff ({staff.length})
        </h2>
        
        {staff.length === 0 ? (
          <p className="text-gray-500">No staff members found.</p>
        ) : (
          <div className="grid gap-3">
            {staff.map((staffMember, index) => (
              <div
                key={staffMember.id}
                className="p-3 border rounded-lg bg-white shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{staffMember.name}</h3>
                    <p className="text-sm text-gray-600">
                      {staffMember.position} • {staffMember.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      Order: {staffMember.order || index} • ID: {staffMember.id.slice(-8)}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStaff(staffMember.id)}
                      className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(staffMember.id)}
                      className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Compatibility Information */}
      <div className="p-4 bg-gray-50 rounded">
        <h3 className="font-semibold mb-2">API Compatibility</h3>
        <div className="text-sm text-gray-700 space-y-1">
          <div>✅ <code>staff</code> - Array of staff members</div>
          <div>✅ <code>loading</code> - Loading state</div>
          <div>✅ <code>addStaff(newStaff, onSuccess)</code> - Add staff member</div>
          <div>✅ <code>updateStaff(staffId, updatedData, onSuccess)</code> - Update staff</div>
          <div>✅ <code>deleteStaff(staffId, schedule, updateSchedule, onSuccess)</code> - Delete staff</div>
          <div>✅ <code>reorderStaff(reorderedStaff, onSuccess)</code> - Reorder staff</div>
          <div>✅ <code>editStaffName(staffId, newName, onSuccess)</code> - Edit name</div>
          <div>✅ <code>createNewStaff(...args)</code> - Create with schedule integration</div>
          <div>✅ <code>handleCreateStaff(staffData, onSuccess)</code> - Handle creation</div>
          <div>➕ <code>currentPeriod / setCurrentPeriod</code> - Real-time only</div>
          <div>➕ <code>isRealtime / isConnected</code> - Real-time status</div>
        </div>
      </div>
    </div>
  );
};

export default StaffManagementIntegrationExample;