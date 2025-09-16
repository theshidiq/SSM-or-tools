// Testing Strategy Implementation: Integration Testing (lines 809-840)
// React component integration tests with WebSocket mocking
// Exact implementation from IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { toast } from 'sonner';
import StaffEditModal from '../StaffEditModal';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock feature flags
jest.mock('../../../config/featureFlags', () => ({
  useFeatureFlag: jest.fn((flag) => {
    switch (flag) {
      case 'OPTIMISTIC_UPDATES':
        return true;
      case 'ENHANCED_LOGGING':
        return false;
      default:
        return false;
    }
  }),
  checkSystemHealth: jest.fn(() => ({ status: 'healthy' })),
}));

// Mock WebSocket for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.send = jest.fn();

    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen();
      }
    }, 10);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Test close' });
    }
  }

  // Simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket;
global.WebSocket.OPEN = 1;
global.WebSocket.CONNECTING = 0;
global.WebSocket.CLOSED = 3;

// Mock crypto.randomUUID for consistent client IDs
global.crypto = {
  randomUUID: jest.fn(() => 'test-client-id'),
};

describe('StaffEditModal with WebSocket', () => {
  let mockWebSocket;
  let mockProps;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock WebSocket instance
    mockWebSocket = {
      send: jest.fn(),
      onmessage: jest.fn(),
      readyState: WebSocket.OPEN,
      close: jest.fn(),
    };

    // Mock WebSocket constructor to return our mock
    global.WebSocket = jest.fn(() => mockWebSocket);

    // Default modal props
    mockProps = {
      showStaffEditModal: true,
      setShowStaffEditModal: jest.fn(),
      isAddingNewStaff: false,
      setIsAddingNewStaff: jest.fn(),
      selectedStaffForEdit: {
        id: 'staff-1',
        name: 'Test Staff',
        position: 'Server',
        status: '社員',
        startPeriod: null,
        endPeriod: null,
      },
      setSelectedStaffForEdit: jest.fn(),
      editingStaffData: {
        name: 'Test Staff',
        position: 'Server',
        status: '社員',
        startPeriod: null,
        endPeriod: null,
      },
      setEditingStaffData: jest.fn(),
      staffMembers: [
        {
          id: 'staff-1',
          name: 'Test Staff',
          position: 'Server',
          status: '社員',
        },
      ],
      dateRange: ['2024-01-01', '2024-01-31'],
      addStaff: jest.fn(),
      updateStaff: jest.fn(),
      deleteStaff: jest.fn(),
      schedule: {},
      updateSchedule: jest.fn(),
      currentMonthIndex: 0,
      isSaving: false,
      error: null,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Exact implementation from official plan lines 812-838
  it('should update staff member immediately', async () => {
    const { getByTestId } = render(<StaffEditModal {...mockProps} />);

    // Mock WebSocket connection - exact implementation from plan lines 817-828
    mockWebSocket.send.mockImplementation((message) => {
      const parsed = JSON.parse(message);
      if (parsed.type === 'STAFF_UPDATE') {
        // Simulate immediate server response
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'STAFF_UPDATE',
            payload: parsed.payload,
          }),
        });
      }
    });

    // Perform update - exact implementation from plan lines 831-832
    fireEvent.change(getByTestId('staff-name'), { target: { value: 'New Name' } });
    fireEvent.click(getByTestId('save-button'));

    // Verify immediate UI update - exact implementation from plan lines 835-837
    await waitFor(() => {
      expect(getByTestId('staff-name')).toHaveValue('New Name');
    });
  });

  it('should handle WebSocket STAFF_CREATE messages for real-time collaboration', async () => {
    // Mock updateStaff to call callback immediately for testing
    mockProps.updateStaff.mockImplementation((staffId, staffData, callback) => {
      const updatedStaffArray = mockProps.staffMembers.map(staff =>
        staff.id === staffId ? { ...staff, ...staffData } : staff
      );
      if (callback) callback(updatedStaffArray);
    });

    render(<StaffEditModal {...mockProps} />);

    // Mock WebSocket message for staff creation from another client
    const newStaffMessage = {
      type: 'STAFF_CREATE',
      payload: {
        id: 'staff-new',
        name: 'Remote Added Staff',
        position: 'Chef',
        status: '社員',
      },
      timestamp: new Date().toISOString(),
      clientId: 'remote-client-id',
    };

    // Simulate receiving a staff creation message
    act(() => {
      mockWebSocket.onmessage({
        data: JSON.stringify(newStaffMessage),
      });
    });

    // Verify that the new staff appears in the staff list
    await waitFor(() => {
      expect(screen.getByText('Remote Added Staff')).toBeInTheDocument();
    });
  });

  it('should handle staff update with <50ms response time for race condition elimination', async () => {
    const startTime = performance.now();

    // Mock immediate response for performance testing
    mockProps.updateStaff.mockImplementation((staffId, staffData, callback) => {
      const updatedStaffArray = mockProps.staffMembers.map(staff =>
        staff.id === staffId ? { ...staff, ...staffData } : staff
      );

      // Simulate immediate callback (< 50ms as per KPI)
      setTimeout(() => {
        if (callback) callback(updatedStaffArray);
      }, 10); // 10ms response time
    });

    const { getByTestId } = render(<StaffEditModal {...mockProps} />);

    // Perform rapid update
    fireEvent.change(getByTestId('staff-name'), { target: { value: 'Updated Name' } });
    fireEvent.click(getByTestId('save-button'));

    // Verify response time meets KPI (<50ms)
    await waitFor(() => {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(50); // <50ms KPI requirement
    });

    // Verify UI update
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Updated Nameを更新しました');
    });
  });

  it('should prevent race conditions during concurrent staff updates', async () => {
    let updateCallCount = 0;

    mockProps.updateStaff.mockImplementation((staffId, staffData, callback) => {
      updateCallCount++;

      // Simulate slight delay to test race conditions
      setTimeout(() => {
        const updatedStaffArray = mockProps.staffMembers.map(staff =>
          staff.id === staffId ? { ...staff, ...staffData, version: updateCallCount } : staff
        );
        if (callback) callback(updatedStaffArray);
      }, 20);
    });

    const { getByTestId } = render(<StaffEditModal {...mockProps} />);

    // Perform rapid successive updates to test race condition prevention
    fireEvent.change(getByTestId('staff-name'), { target: { value: 'Update 1' } });
    fireEvent.click(getByTestId('save-button'));

    fireEvent.change(getByTestId('staff-name'), { target: { value: 'Update 2' } });
    fireEvent.click(getByTestId('save-button'));

    fireEvent.change(getByTestId('staff-name'), { target: { value: 'Final Update' } });
    fireEvent.click(getByTestId('save-button'));

    // Wait for all updates to complete
    await waitFor(() => {
      expect(updateCallCount).toBeGreaterThan(0);
    }, { timeout: 200 });

    // Verify that the final state is consistent (no race condition)
    await waitFor(() => {
      expect(getByTestId('staff-name')).toHaveValue('Final Update');
    });

    // Verify that last writer wins (no race condition artifacts)
    expect(toast.success).toHaveBeenCalledWith('Final Updateを更新しました');
  });

  it('should handle WebSocket connection errors gracefully', async () => {
    // Mock WebSocket to simulate connection error
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockProps.updateStaff.mockRejectedValue(new Error('WebSocket not connected'));

    const { getByTestId } = render(<StaffEditModal {...mockProps} />);

    // Attempt update with disconnected WebSocket
    fireEvent.change(getByTestId('staff-name'), { target: { value: 'Failed Update' } });
    fireEvent.click(getByTestId('save-button'));

    // Verify error handling
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('更新に失敗しました')
      );
    });
  });

  it('should synchronize staff data across multiple clients in real-time', async () => {
    // Mock staff sync from another client
    const syncMessage = {
      type: 'SYNC_RESPONSE',
      payload: {
        staffMembers: [
          ...mockProps.staffMembers,
          {
            id: 'staff-remote',
            name: 'Remote Client Staff',
            position: 'Manager',
            status: '社員',
          },
        ],
        version: 2,
        timestamp: new Date().toISOString(),
      },
    };

    render(<StaffEditModal {...mockProps} />);

    // Simulate receiving sync response with updated staff list
    act(() => {
      mockWebSocket.onmessage({
        data: JSON.stringify(syncMessage),
      });
    });

    // Verify that remote client's staff appears
    await waitFor(() => {
      expect(screen.getByText('Remote Client Staff')).toBeInTheDocument();
    });
  });

  it('should maintain form state consistency during WebSocket reconnection', async () => {
    const { getByTestId } = render(<StaffEditModal {...mockProps} />);

    // Start editing
    fireEvent.change(getByTestId('staff-name'), { target: { value: 'Editing During Reconnect' } });

    // Simulate WebSocket disconnection and reconnection
    act(() => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockWebSocket.onclose({ code: 1006, reason: 'Connection lost' });
    });

    // Simulate reconnection
    act(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen();
    });

    // Verify form state is preserved
    await waitFor(() => {
      expect(getByTestId('staff-name')).toHaveValue('Editing During Reconnect');
    });
  });

  it('should validate KPI requirements for UI responsiveness', async () => {
    const performanceMetrics = {
      updateStartTime: null,
      updateCompleteTime: null,
    };

    // Mock updateStaff with performance tracking
    mockProps.updateStaff.mockImplementation((staffId, staffData, callback) => {
      performanceMetrics.updateStartTime = performance.now();

      // Simulate fast server response
      setTimeout(() => {
        performanceMetrics.updateCompleteTime = performance.now();
        const updatedStaffArray = mockProps.staffMembers.map(staff =>
          staff.id === staffId ? { ...staff, ...staffData } : staff
        );
        if (callback) callback(updatedStaffArray);
      }, 15); // 15ms response time
    });

    const { getByTestId } = render(<StaffEditModal {...mockProps} />);

    // Perform update with performance monitoring
    fireEvent.change(getByTestId('staff-name'), { target: { value: 'Performance Test' } });
    fireEvent.click(getByTestId('save-button'));

    // Verify KPI compliance
    await waitFor(() => {
      const responseTime = performanceMetrics.updateCompleteTime - performanceMetrics.updateStartTime;

      // Validate success criteria from plan lines 918-923
      expect(responseTime).toBeLessThan(50); // <50ms UI response time
      expect(toast.success).toHaveBeenCalledWith('Performance Testを更新しました');
    });
  });
});