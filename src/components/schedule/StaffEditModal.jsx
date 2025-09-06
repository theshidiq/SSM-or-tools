import React, { useEffect, useRef } from "react";
import { isDateWithinWorkPeriod } from "../../utils/dateUtils";

// ShadCN UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

const StaffEditModal = ({
  showStaffEditModal,
  setShowStaffEditModal,
  isAddingNewStaff,
  setIsAddingNewStaff,
  selectedStaffForEdit,
  setSelectedStaffForEdit,
  editingStaffData,
  setEditingStaffData,
  staffMembers,
  dateRange,
  handleCreateStaff,
  updateStaff,
  deleteStaff,
  schedule,
  updateSchedule,
  setStaffMembersByMonth,
  currentMonthIndex,
  scheduleAutoSave,
  _clearAndRefreshFromDatabase,
  isRefreshingFromDatabase,
}) => {
  // Track if user is actively editing to prevent overwriting their changes
  const [isUserEditing, setIsUserEditing] = React.useState(false);

  // Ref for the name input field to enable auto-focus
  const nameInputRef = useRef(null);

  // Reset editing flag when modal closes and focus name input when modal opens
  useEffect(() => {
    if (!showStaffEditModal) {
      setIsUserEditing(false);
    } else {
      // Focus the name input when modal opens
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100); // Small delay to ensure modal is fully rendered
    }
  }, [showStaffEditModal]);
  // Set default year values for new staff when modal opens
  useEffect(() => {
    if (!showStaffEditModal || !editingStaffData) {
      return; // Don't run effect if modal is not shown or no data
    }

    const currentYear = new Date().getFullYear();

    // Only set default year if it doesn't exist AND we're not already editing existing staff
    if (!editingStaffData.startPeriod?.year && !selectedStaffForEdit) {
      setEditingStaffData((prev) => ({
        ...prev,
        startPeriod: {
          ...prev.startPeriod,
          year: currentYear,
        },
      }));
    }
  }, [showStaffEditModal, selectedStaffForEdit]);

  // Sync selectedStaffForEdit with latest staffMembers data when staffMembers updates
  // BUT only when user is not actively editing to prevent overwriting their changes
  useEffect(() => {
    // Skip sync if user is actively editing the form
    if (isUserEditing) {
      return;
    }

    if (selectedStaffForEdit && staffMembers && staffMembers.length > 0) {
      // Find the updated staff data from the current staffMembers array
      const updatedStaffData = staffMembers.find(
        (s) => s.id === selectedStaffForEdit.id,
      );

      if (updatedStaffData) {
        // Check if the data has actually changed to avoid unnecessary updates
        const hasChanges =
          updatedStaffData.name !== selectedStaffForEdit.name ||
          updatedStaffData.status !== selectedStaffForEdit.status ||
          updatedStaffData.position !== selectedStaffForEdit.position ||
          JSON.stringify(updatedStaffData.startPeriod) !==
            JSON.stringify(selectedStaffForEdit.startPeriod) ||
          JSON.stringify(updatedStaffData.endPeriod) !==
            JSON.stringify(selectedStaffForEdit.endPeriod);

        if (hasChanges) {
          // Update selectedStaffForEdit with latest data
          setSelectedStaffForEdit(updatedStaffData);

          // Immediately update the form state to reflect the changes
          const newEditingData = {
            name: updatedStaffData.name,
            position: updatedStaffData.position || "",
            status: updatedStaffData.status || "社員",
            startPeriod: updatedStaffData.startPeriod || null,
            endPeriod: updatedStaffData.endPeriod || null,
          };

          setEditingStaffData(newEditingData);
        }
      }
    }
  }, [
    staffMembers,
    selectedStaffForEdit,
    setSelectedStaffForEdit,
    setEditingStaffData,
    isUserEditing,
  ]);

  // Helper function to update editing data and mark user as actively editing
  const updateEditingStaffData = (updateFn) => {
    setIsUserEditing(true);
    setEditingStaffData(updateFn);

    // Clear the editing flag after a short delay to allow for multiple rapid changes
    setTimeout(() => {
      setIsUserEditing(false);
    }, 2000); // 2 seconds after last change
  };

  // Provide default values for editingStaffData to prevent crashes
  const safeEditingStaffData = editingStaffData || {
    name: "",
    position: "",
    status: "社員",
    startPeriod: null,
    endPeriod: null,
  };

  // Create a stable key for the form that only changes when switching staff or modes
  // This prevents unnecessary re-renders while typing
  const formKey = `${selectedStaffForEdit?.id || "new"}-${isAddingNewStaff ? "add" : "edit"}`;

  if (!showStaffEditModal) return null;

  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Clear editing flag since user is submitting
    setIsUserEditing(false);

    if (isAddingNewStaff) {
      handleCreateStaff(safeEditingStaffData, async () => {
        // Save to database
        try {
          await scheduleAutoSave(schedule, staffMembers);
        } catch (error) {
          console.error("❌ Modal: Database save failed:", error);
        }
      });
    } else if (selectedStaffForEdit) {
      updateStaff(
        selectedStaffForEdit.id,
        safeEditingStaffData,
        async (newStaff) => {
          setStaffMembersByMonth((prev) => ({
            ...prev,
            [currentMonthIndex]: newStaff,
          }));

          // Update the modal's form state to reflect the successful update
          const updatedStaff = newStaff.find(
            (staff) => staff.id === selectedStaffForEdit.id,
          );
          if (updatedStaff) {
            // Create new editing data object
            const newEditingData = {
              name: updatedStaff.name,
              position: updatedStaff.position || "",
              status: updatedStaff.status || "社員",
              startPeriod: updatedStaff.startPeriod || null,
              endPeriod: updatedStaff.endPeriod || null,
            };

            // Update both selected staff and editing data immediately
            setSelectedStaffForEdit(updatedStaff);
            setEditingStaffData(newEditingData);
          }

          // Save to database
          try {
            await scheduleAutoSave(schedule, newStaff);
          } catch (error) {
            console.error("❌ Modal: Database save failed:", error);
          }
        },
      );
    }
  };

  const handleDeleteStaff = (staffId) => {
    const confirmed = window.confirm("本当にこのスタッフを削除しますか？");
    if (confirmed) {
      const { newStaffMembers, newSchedule } = deleteStaff(
        staffId,
        schedule,
        updateSchedule,
        (newStaff) => {
          setStaffMembersByMonth((prev) => ({
            ...prev,
            [currentMonthIndex]: newStaff,
          }));
        },
      );

      setShowStaffEditModal(false);
      setSelectedStaffForEdit(null);

      setTimeout(() => {
        scheduleAutoSave(newSchedule, newStaffMembers);
      }, 0);
    }
  };

  const handleStaffSelect = (staff) => {
    // Clear editing flag when selecting different staff
    setIsUserEditing(false);

    // ALWAYS use the most current staff data from the staffMembers array
    // This ensures we get the latest data even after database refresh
    const currentStaffData = staffMembers.find((s) => s.id === staff.id);

    if (!currentStaffData) {
      return;
    }

    setSelectedStaffForEdit(currentStaffData);
    const newEditingData = {
      name: currentStaffData.name,
      position: currentStaffData.position || "",
      status: currentStaffData.status || "社員",
      startPeriod: currentStaffData.startPeriod || null,
      endPeriod: currentStaffData.endPeriod || null,
    };

    setEditingStaffData(newEditingData);
    setIsAddingNewStaff(false);

    // Focus the name input after selecting staff
    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 50);
  };

  const startAddingNew = () => {
    // Clear editing flag when starting new staff creation
    setIsUserEditing(false);
    setIsAddingNewStaff(true);
    setSelectedStaffForEdit(null);
    setEditingStaffData({
      name: "",
      position: "",
      status: "社員",
      startPeriod: null,
      endPeriod: null,
    });

    // Focus the name input when adding new staff
    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 50);
  };

  return (
    <Dialog
      open={showStaffEditModal}
      onOpenChange={(open) => {
        if (!open) {
          setIsUserEditing(false);
          setShowStaffEditModal(false);
          setSelectedStaffForEdit(null);
          setIsAddingNewStaff(false);
        }
      }}
    >
      <DialogContent className="w-[95vw] max-w-6xl h-[90vh] max-h-[90vh] overflow-y-auto bg-background border-border shadow-2xl">
        {/* Loading overlay for database refresh */}
        {isRefreshingFromDatabase && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-[60] rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
              <p className="text-muted-foreground text-sm">
                Refreshing data from database...
              </p>
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">スタッフ管理</DialogTitle>
          <DialogDescription>
            スタッフの追加、編集、削除を行います。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-6 h-full p-1">
          {/* Left Panel - Staff List */}
          <div className="flex-1 lg:max-w-md space-y-4 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-card-foreground">
                スタッフ一覧
              </h3>
              <Button
                onClick={startAddingNew}
                className="bg-green-500 hover:bg-green-600"
              >
                新規追加
              </Button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
              {staffMembers.map((staff) => {
                const isActive =
                  isDateWithinWorkPeriod(dateRange[0], staff) ||
                  isDateWithinWorkPeriod(
                    dateRange[dateRange.length - 1],
                    staff,
                  );

                return (
                  <Card
                    key={staff.id}
                    onClick={() => handleStaffSelect(staff)}
                    className={`cursor-pointer transition-all ${
                      selectedStaffForEdit?.id === staff.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-accent"
                    } ${!isActive ? "opacity-60" : ""}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{staff.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>{staff.position}</span> •{" "}
                            <Badge variant="outline">{staff.status}</Badge>
                            {!isActive && (
                              <Badge variant="destructive">期間外</Badge>
                            )}
                          </div>
                        </div>
                        {selectedStaffForEdit?.id === staff.id && (
                          <div className="w-3 h-3 bg-primary rounded-full"></div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Staff Form */}
          <div className="flex-1 space-y-4">
            <h3 className="text-lg font-semibold text-card-foreground">
              {isAddingNewStaff
                ? "スタッフ追加"
                : selectedStaffForEdit
                  ? "スタッフ編集"
                  : "スタッフを選択してください"}
            </h3>

            {(isAddingNewStaff || selectedStaffForEdit) && (
              <div className="relative isolate">
                <form
                  key={formKey}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="staff-name">
                      名前 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="staff-name"
                      name="staff-name"
                      ref={nameInputRef}
                      type="text"
                      value={safeEditingStaffData.name}
                      onChange={(e) =>
                        updateEditingStaffData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                      placeholder="スタッフ名を入力"
                      autoComplete="off"
                      list=""
                    />
                  </div>

                  {/* Position Field */}
                  <div className="space-y-2">
                    <Label htmlFor="staff-position">職位</Label>
                    <Input
                      id="staff-position"
                      name="position"
                      type="text"
                      value={safeEditingStaffData.position}
                      onChange={(e) =>
                        updateEditingStaffData((prev) => ({
                          ...prev,
                          position: e.target.value,
                        }))
                      }
                      placeholder="例: Server, Kitchen, Manager"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      list=""
                      data-1p-ignore
                      data-lpignore="true"
                    />
                  </div>

                  {/* Status Field */}
                  <div className="space-y-2">
                    <Label>
                      雇用形態 <span className="text-destructive">*</span>
                    </Label>
                    <RadioGroup
                      value={safeEditingStaffData.status}
                      onValueChange={(value) => {
                        const currentYear = new Date().getFullYear();
                        updateEditingStaffData((prev) => ({
                          ...prev,
                          status: value,
                          // If 派遣 or パート is selected, set both periods to current year
                          ...(value === "派遣" || value === "パート"
                            ? {
                                startPeriod: {
                                  ...prev.startPeriod,
                                  year: currentYear,
                                },
                                endPeriod: {
                                  ...prev.endPeriod,
                                  year: currentYear,
                                },
                              }
                            : {}),
                        }));
                      }}
                      className="flex flex-row space-x-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="社員" id="status-employee" />
                        <Label htmlFor="status-employee">社員</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="派遣" id="status-dispatch" />
                        <Label htmlFor="status-dispatch">派遣</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="パート" id="status-part" />
                        <Label htmlFor="status-part">パート</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Start Period */}
                  <div className="space-y-2">
                    <Label>開始期間</Label>
                    <div className="grid grid-cols-3 gap-2 relative">
                      <Select
                        value={
                          safeEditingStaffData.startPeriod?.year?.toString() ||
                          ""
                        }
                        onValueChange={(value) =>
                          updateEditingStaffData((prev) => ({
                            ...prev,
                            startPeriod: {
                              ...prev.startPeriod,
                              year: value ? parseInt(value) : null,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="年" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => {
                            const currentYear = new Date().getFullYear();
                            const year = currentYear - 4 + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Select
                        value={
                          safeEditingStaffData.startPeriod?.month?.toString() ||
                          ""
                        }
                        onValueChange={(value) =>
                          updateEditingStaffData((prev) => ({
                            ...prev,
                            startPeriod: {
                              ...prev.startPeriod,
                              month: value ? parseInt(value) : null,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="月" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={
                          safeEditingStaffData.startPeriod?.day?.toString() ||
                          ""
                        }
                        onValueChange={(value) =>
                          updateEditingStaffData((prev) => ({
                            ...prev,
                            startPeriod: {
                              ...prev.startPeriod,
                              day: value ? parseInt(value) : null,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="日" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* End Period */}
                  <div className="space-y-2">
                    <Label>終了期間</Label>
                    <div className="grid grid-cols-3 gap-2 relative">
                      <Select
                        value={
                          safeEditingStaffData.endPeriod?.year?.toString() || ""
                        }
                        onValueChange={(value) =>
                          updateEditingStaffData((prev) => ({
                            ...prev,
                            endPeriod: value
                              ? {
                                  ...prev.endPeriod,
                                  year: parseInt(value),
                                }
                              : null,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="年" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 2 }, (_, i) => {
                            const year = new Date().getFullYear() + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Select
                        value={
                          safeEditingStaffData.endPeriod?.month?.toString() ||
                          ""
                        }
                        onValueChange={(value) =>
                          updateEditingStaffData((prev) => ({
                            ...prev,
                            endPeriod:
                              prev.endPeriod || value
                                ? {
                                    ...prev.endPeriod,
                                    month: value ? parseInt(value) : null,
                                  }
                                : null,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="月" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={
                          safeEditingStaffData.endPeriod?.day?.toString() || ""
                        }
                        onValueChange={(value) =>
                          updateEditingStaffData((prev) => ({
                            ...prev,
                            endPeriod:
                              prev.endPeriod || value
                                ? {
                                    ...prev.endPeriod,
                                    day: value ? parseInt(value) : null,
                                  }
                                : null,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="日" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsUserEditing(false);
                        setSelectedStaffForEdit(null);
                        setIsAddingNewStaff(false);
                      }}
                    >
                      キャンセル
                    </Button>

                    {selectedStaffForEdit && !isAddingNewStaff && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() =>
                          handleDeleteStaff(selectedStaffForEdit.id)
                        }
                      >
                        削除
                      </Button>
                    )}

                    <Button
                      type="button"
                      onClick={handleSubmit}
                      className="flex-1"
                    >
                      {isAddingNewStaff ? "追加" : "更新"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StaffEditModal;
