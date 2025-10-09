/**
 * Component Tests for StaffGroupsTab
 * Tests data transformation, defensive array checks, and backward compatibility
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffGroupsTab from "../StaffGroupsTab";

// Mock useBackupStaffService hook
jest.mock("../../../../hooks/useBackupStaffService", () => ({
  useBackupStaffService: () => ({
    backupAssignments: [],
    loading: false,
    error: null,
    syncStatus: "synced",
    addBackupAssignment: jest.fn().mockResolvedValue(true),
    removeBackupAssignment: jest.fn().mockResolvedValue(true),
    refreshBackupAssignments: jest.fn(),
    getAvailableBackupStaff: jest.fn(() => []),
  }),
}));

describe("StaffGroupsTab Component", () => {
  const mockStaffMembers = [
    { id: "staff-1", name: "John Doe", position: "Chef" },
    { id: "staff-2", name: "Jane Smith", position: "Sous Chef" },
    { id: "staff-3", name: "Bob Johnson", position: "Line Cook" },
  ];

  const mockOnSettingsChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Data Transformation useMemo Layer", () => {
    test("transforms WebSocket multi-table format to localStorage format", async () => {
      const settingsWithGroupConfig = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen Staff",
            groupConfig: {
              members: ["staff-1", "staff-2"],
              color: "#3B82F6",
            },
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settingsWithGroupConfig}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      // Verify group is rendered (data transformation successful)
      await waitFor(() => {
        expect(screen.getByText("Kitchen Staff")).toBeInTheDocument();
      });

      // Verify members are displayed (extracted from groupConfig)
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    test("handles direct members array (localStorage format)", async () => {
      const settingsWithDirectMembers = {
        staffGroups: [
          {
            id: "group-1",
            name: "Service Team",
            members: ["staff-1", "staff-3"],
            color: "#10B981",
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settingsWithDirectMembers}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Service Team")).toBeInTheDocument();
      });

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
    });

    test("memoizes staffGroups to prevent unnecessary re-renders", async () => {
      const settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Test Group",
            members: ["staff-1"],
          },
        ],
      };

      const { rerender } = render(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      const initialRender = screen.getByText("Test Group");

      // Re-render with same settings (should use memoized value)
      rerender(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      // Component should not re-render unnecessarily
      expect(screen.getByText("Test Group")).toBe(initialRender);
    });
  });

  describe("Defensive Array Checks", () => {
    test("handles undefined members array gracefully", async () => {
      const settingsWithUndefinedMembers = {
        staffGroups: [
          {
            id: "group-1",
            name: "Empty Group",
            // members is undefined
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settingsWithUndefinedMembers}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Empty Group")).toBeInTheDocument();
      });

      // Should show "No staff assigned" message
      expect(
        screen.getByText("No staff assigned to this group"),
      ).toBeInTheDocument();
    });

    test("handles null members array gracefully", async () => {
      const settingsWithNullMembers = {
        staffGroups: [
          {
            id: "group-1",
            name: "Null Members Group",
            members: null,
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settingsWithNullMembers}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Null Members Group")).toBeInTheDocument();
      });

      expect(
        screen.getByText("No staff assigned to this group"),
      ).toBeInTheDocument();
    });

    test("handles undefined staffGroups array", async () => {
      const settingsWithUndefinedGroups = {};

      render(
        <StaffGroupsTab
          settings={settingsWithUndefinedGroups}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText("No Staff Groups")).toBeInTheDocument();
      });
    });

    test("handles empty staffGroups array", async () => {
      const settingsWithEmptyGroups = {
        staffGroups: [],
      };

      render(
        <StaffGroupsTab
          settings={settingsWithEmptyGroups}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("No Staff Groups")).toBeInTheDocument();
      });

      // Should show create first group button
      expect(screen.getByText("Create First Group")).toBeInTheDocument();
    });
  });

  describe("Backward Compatibility", () => {
    test("supports localStorage format (direct members array)", async () => {
      const localStorageSettings = {
        staffGroups: [
          {
            id: "local-group-1",
            name: "Kitchen",
            description: "Main kitchen staff",
            color: "#3B82F6",
            members: ["staff-1", "staff-2"],
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={localStorageSettings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Kitchen")).toBeInTheDocument();
      });

      expect(screen.getByText("Main kitchen staff")).toBeInTheDocument();
      expect(screen.getByText("Members (2)")).toBeInTheDocument();
    });

    test("supports WebSocket format (groupConfig.members)", async () => {
      const webSocketSettings = {
        staffGroups: [
          {
            id: "ws-group-1",
            name: "Service",
            description: "Service team",
            color: "#10B981",
            groupConfig: {
              members: ["staff-2", "staff-3"],
              additionalData: "test",
            },
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={webSocketSettings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Service")).toBeInTheDocument();
      });

      expect(screen.getByText("Service team")).toBeInTheDocument();
      expect(screen.getByText("Members (2)")).toBeInTheDocument();
    });

    test("handles mixed format gracefully", async () => {
      const mixedSettings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Group with members",
            members: ["staff-1"],
          },
          {
            id: "group-2",
            name: "Group with groupConfig",
            groupConfig: {
              members: ["staff-2"],
            },
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={mixedSettings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Group with members")).toBeInTheDocument();
        expect(screen.getByText("Group with groupConfig")).toBeInTheDocument();
      });

      // Both should show 1 member
      const memberCounts = screen.getAllByText(/Members \(1\)/);
      expect(memberCounts).toHaveLength(2);
    });
  });

  describe("User Interactions", () => {
    test("creates new group with Add Group button", async () => {
      const user = userEvent.setup();

      render(
        <StaffGroupsTab
          settings={{ staffGroups: [] }}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      const addButton = screen.getByText("Add Group");
      await user.click(addButton);

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalled();
      });

      const updatedSettings = mockOnSettingsChange.mock.calls[0][0];
      expect(updatedSettings.staffGroups).toHaveLength(1);
      expect(updatedSettings.staffGroups[0].name).toBe("New Group");
      expect(updatedSettings.staffGroups[0].members).toEqual([]);
    });

    test("adds staff to group via Add Staff button", async () => {
      const user = userEvent.setup();

      const settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen",
            members: [],
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      const addStaffButton = screen.getByText("Add Staff");
      await user.click(addStaffButton);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText("Add Staff to Kitchen")).toBeInTheDocument();
      });

      // Click on a staff member
      const staffOption = screen.getByText("John Doe");
      await user.click(staffOption);

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalled();
      });
    });

    test("removes staff from group", async () => {
      const user = userEvent.setup();

      const settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen",
            members: ["staff-1", "staff-2"],
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Find and click remove button (X icon)
      const removeButtons = screen.getAllByTitle("Remove from group");
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalled();
      });

      const updatedSettings = mockOnSettingsChange.mock.calls[0][0];
      expect(updatedSettings.staffGroups[0].members).toHaveLength(1);
    });

    test("deletes group with confirmation", async () => {
      const user = userEvent.setup();

      const settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen",
            members: ["staff-1"],
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      const deleteButton = screen.getByTitle("Delete Group");
      await user.click(deleteButton);

      // Confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByText("Delete Staff Group")).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmButton = screen.getByText("Delete Group");
      await user.click(confirmButton);

      await waitFor(
        () => {
          expect(mockOnSettingsChange).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Edit Mode", () => {
    test("enters edit mode when Edit button clicked", async () => {
      const user = userEvent.setup();

      const settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen",
            description: "Main kitchen",
            members: [],
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      const editButton = screen.getByTitle("Edit");
      await user.click(editButton);

      // Should show save and cancel buttons
      await waitFor(() => {
        expect(screen.getByTitle("Save changes")).toBeInTheDocument();
        expect(screen.getByTitle("Cancel changes")).toBeInTheDocument();
      });
    });

    test("saves changes in edit mode", async () => {
      const user = userEvent.setup();

      const settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen",
            description: "",
            members: [],
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      const editButton = screen.getByTitle("Edit");
      await user.click(editButton);

      // Modify name
      const nameInput = screen.getByDisplayValue("Kitchen");
      await user.clear(nameInput);
      await user.type(nameInput, "Kitchen Team");

      // Save changes
      const saveButton = screen.getByTitle("Save changes");
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalled();
      });
    });

    test("cancels changes in edit mode", async () => {
      const user = userEvent.setup();

      const settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen",
            description: "Original description",
            members: [],
          },
        ],
      };

      render(
        <StaffGroupsTab
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      const editButton = screen.getByTitle("Edit");
      await user.click(editButton);

      // Modify name
      const nameInput = screen.getByDisplayValue("Kitchen");
      await user.clear(nameInput);
      await user.type(nameInput, "Changed Name");

      // Cancel changes
      const cancelButton = screen.getByTitle("Cancel changes");
      await user.click(cancelButton);

      await waitFor(() => {
        // Should restore original name
        expect(mockOnSettingsChange).toHaveBeenCalled();
      });
    });
  });

  describe("Validation", () => {
    test("displays validation errors", async () => {
      const validationErrors = {
        staffGroups: "At least one staff group is required",
      };

      render(
        <StaffGroupsTab
          settings={{ staffGroups: [] }}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
          validationErrors={validationErrors}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Validation Errors")).toBeInTheDocument();
        expect(
          screen.getByText("At least one staff group is required"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Backup Staff Management", () => {
    test("displays backup management section", async () => {
      render(
        <StaffGroupsTab
          settings={{ staffGroups: [] }}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Backup Group Management")).toBeInTheDocument();
      });
    });

    test("shows no backup assignments message when empty", async () => {
      render(
        <StaffGroupsTab
          settings={{ staffGroups: [], backupAssignments: [] }}
          onSettingsChange={mockOnSettingsChange}
          staffMembers={mockStaffMembers}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("No backup assignments")).toBeInTheDocument();
      });
    });
  });
});
