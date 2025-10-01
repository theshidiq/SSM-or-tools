import React, { useEffect, useRef, useState, useCallback } from "react";
import { isDateWithinWorkPeriod } from "../../utils/dateUtils";
import { toast } from "sonner";
import { useFeatureFlag, checkSystemHealth } from "../../config/featureFlags";

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
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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
  addStaff,
  updateStaff,
  deleteStaff,
  schedule,
  updateSchedule,
  currentMonthIndex,
  isSaving = false, // New prop to show saving state
  error = null, // New prop to show errors
  invalidateAllPeriodsCache = null, // Phase 3: Cache invalidation for database refresh
}) => {
  // Debug staffMembers prop changes
  React.useEffect(() => {
    console.log(`🔍 [StaffModal] Received staffMembers: ${staffMembers?.length || 0} staff`);
    if (staffMembers?.length > 0) {
      console.log(`🔍 [StaffModal] Staff list:`, staffMembers.map(s => ({id: s.id, name: s.name, lastModified: s.lastModified})));
    }
  }, [staffMembers]);

  // Track if user is actively editing to prevent overwriting their changes
  const [isUserEditing, setIsUserEditing] = React.useState(false);
  
  // Track operation states for better UX
  const [operationState, setOperationState] = useState({
    isProcessing: false,
    lastOperation: null,
    lastOperationSuccess: false,
  });

  // Feature flags for enhanced behavior
  const optimisticUpdatesEnabled = useFeatureFlag('OPTIMISTIC_UPDATES');
  const enhancedLoggingEnabled = useFeatureFlag('ENHANCED_LOGGING');

  // Optimistic update state management
  const [optimisticStaffData, setOptimisticStaffData] = useState(null);
  const [pendingOperation, setPendingOperation] = useState(null);

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

  // Enhanced sync with optimistic update awareness
  // Sync selectedStaffForEdit with latest staffMembers data when staffMembers updates
  useEffect(() => {
    // Skip sync during optimistic updates to prevent conflicts
    if (optimisticUpdatesEnabled && pendingOperation) {
      if (enhancedLoggingEnabled) {
        console.log(`⏸️ [Enhanced Sync] Skipping sync during optimistic update for ${pendingOperation.type} operation`);
      }
      return;
    }

    // Skip sync if user is actively editing the form AND it's not right after an operation
    if (isUserEditing && !operationState.lastOperationSuccess) {
      if (enhancedLoggingEnabled) {
        console.log(`⏸️ [Enhanced Sync] Skipping sync - user is actively editing`);
      }
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
          if (enhancedLoggingEnabled) {
            console.log(`🔄 [Enhanced Sync] Syncing form with updated data for: ${updatedStaffData.name}`);
          }

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

          // Clear the editing flag since we've successfully synced
          setIsUserEditing(false);
        }
      }
    }
  }, [
    staffMembers,
    selectedStaffForEdit,
    setSelectedStaffForEdit,
    setEditingStaffData,
    isUserEditing,
    operationState.lastOperationSuccess,
    optimisticUpdatesEnabled,
    pendingOperation,
    enhancedLoggingEnabled,
  ]);

  // Helper function to update editing data and mark user as actively editing
  const updateEditingStaffData = (updateFn) => {
    setIsUserEditing(true);
    setEditingStaffData(updateFn);

    // Clear the editing flag after a shorter delay and only if no operation is in progress
    setTimeout(() => {
      if (!operationState.isProcessing) {
        setIsUserEditing(false);
      }
    }, 1000); // 1 second after last change
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

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Validate required fields
    if (!safeEditingStaffData.name?.trim()) {
      toast.error("名前を入力してください");
      return;
    }

    // Enhanced logging with feature flag
    if (enhancedLoggingEnabled) {
      console.log(`🚀 [Enhanced StaffModal] Starting ${isAddingNewStaff ? 'add' : 'update'} operation for: ${safeEditingStaffData.name}`);
      console.log(`🚀 [Enhanced StaffModal] Optimistic updates enabled: ${optimisticUpdatesEnabled}`);
    }

    // Clear editing flag and set processing state
    setIsUserEditing(false);
    setOperationState({
      isProcessing: true,
      lastOperation: isAddingNewStaff ? 'add' : 'update',
      lastOperationSuccess: false,
    });

    // Optimistic update mechanism
    if (optimisticUpdatesEnabled) {
      if (enhancedLoggingEnabled) {
        console.log(`⚡ [Optimistic Update] Applying immediate UI update for ${safeEditingStaffData.name}`);
      }

      // Store pending operation for rollback if needed
      setPendingOperation({
        type: isAddingNewStaff ? 'add' : 'update',
        data: safeEditingStaffData,
        staffId: selectedStaffForEdit?.id,
        timestamp: Date.now()
      });

      // Apply optimistic update immediately
      if (isAddingNewStaff) {
        const optimisticStaff = {
          ...safeEditingStaffData,
          id: `temp_${Date.now()}`, // Temporary ID for optimistic update
          isOptimistic: true // Flag to identify optimistic updates
        };
        setOptimisticStaffData(optimisticStaff);
      } else {
        // For updates, immediately reflect changes in form
        setOptimisticStaffData({
          ...selectedStaffForEdit,
          ...safeEditingStaffData,
          isOptimistic: true
        });
      }
    }

    try {
      if (isAddingNewStaff) {
        console.log(`➕ [Real-time UI] Adding new staff member: ${safeEditingStaffData.name}`);
        
        // Show immediate optimistic feedback
        toast.success(`${safeEditingStaffData.name}を追加しています...`, { duration: 1000 });
        
        const newStaff = addStaff(safeEditingStaffData, (updatedStaffArray) => {
          if (enhancedLoggingEnabled) {
            console.log("✅ [Enhanced StaffModal] Staff added successfully - confirming optimistic update");
          }

          // Clear optimistic state - real data is now available
          setOptimisticStaffData(null);
          setPendingOperation(null);

          setOperationState({
            isProcessing: false,
            lastOperation: 'add',
            lastOperationSuccess: true,
          });

          // Phase 3: Invalidate React Query cache to trigger database refresh
          if (invalidateAllPeriodsCache) {
            console.log('🔄 [StaffModal-Refresh] Invalidating cache after staff add to refresh from database');
            invalidateAllPeriodsCache();
          }

          // Show success feedback
          toast.success(`${safeEditingStaffData.name}を追加しました`);

          // Keep modal open but clear form for next addition
          setIsAddingNewStaff(true);
          setSelectedStaffForEdit(null);
          setEditingStaffData({
            name: "",
            position: "",
            status: "社員",
            startPeriod: null,
            endPeriod: null,
          });

          // Focus name input for next entry
          setTimeout(() => {
            if (nameInputRef.current) {
              nameInputRef.current.focus();
            }
          }, 100);
        });
        
      } else if (selectedStaffForEdit) {
        console.log(`✏️ [Real-time UI] Updating staff member: ${safeEditingStaffData.name}`);
        
        // Show immediate optimistic feedback
        toast.success(`${safeEditingStaffData.name}を更新しています...`, { duration: 1000 });
        
        updateStaff(
          selectedStaffForEdit.id,
          safeEditingStaffData,
          (updatedStaffArray) => {
            if (enhancedLoggingEnabled) {
              console.log("✅ [Enhanced StaffModal] Staff updated successfully - confirming optimistic update");
            }

            // Clear optimistic state - real data is now available
            setOptimisticStaffData(null);
            setPendingOperation(null);

            setOperationState({
              isProcessing: false,
              lastOperation: 'update',
              lastOperationSuccess: true,
            });

            // Phase 3: Invalidate React Query cache to trigger database refresh
            if (invalidateAllPeriodsCache) {
              console.log('🔄 [StaffModal-Refresh] Invalidating cache to refresh from database');
              invalidateAllPeriodsCache();
            }

            // Show success feedback
            toast.success(`${safeEditingStaffData.name}を更新しました`);

            // Force immediate form sync by clearing editing flag
            setIsUserEditing(false);

            // Update the modal's form state to reflect the successful update
            const updatedStaff = updatedStaffArray.find(
              (staff) => staff.id === selectedStaffForEdit.id,
            );
            if (updatedStaff) {
              if (enhancedLoggingEnabled) {
                console.log(`✅ [Enhanced StaffModal] Syncing form with confirmed data: ${updatedStaff.name}`);
              }

              // Update selected staff reference
              setSelectedStaffForEdit(updatedStaff);

              // Update form state with latest data
              const newEditingData = {
                name: updatedStaff.name,
                position: updatedStaff.position || "",
                status: updatedStaff.status || "社員",
                startPeriod: updatedStaff.startPeriod || null,
                endPeriod: updatedStaff.endPeriod || null,
              };
              setEditingStaffData(newEditingData);
            }
          },
        );
      }
    } catch (error) {
      if (enhancedLoggingEnabled) {
        console.error("❌ [Enhanced StaffModal] Staff operation failed - rolling back optimistic update:", error);
      }

      // Rollback optimistic update on error
      if (optimisticUpdatesEnabled && pendingOperation) {
        if (enhancedLoggingEnabled) {
          console.log(`⏪ [Optimistic Rollback] Rolling back ${pendingOperation.type} operation for safety`);
        }

        // Clear optimistic state
        setOptimisticStaffData(null);
        setPendingOperation(null);

        // Revert form to previous state if updating
        if (!isAddingNewStaff && selectedStaffForEdit) {
          setEditingStaffData({
            name: selectedStaffForEdit.name,
            position: selectedStaffForEdit.position || "",
            status: selectedStaffForEdit.status || "社員",
            startPeriod: selectedStaffForEdit.startPeriod || null,
            endPeriod: selectedStaffForEdit.endPeriod || null,
          });
        }
      }

      setOperationState({
        isProcessing: false,
        lastOperation: isAddingNewStaff ? 'add' : 'update',
        lastOperationSuccess: false,
      });

      // Show enhanced error feedback
      const operationText = isAddingNewStaff ? '追加' : '更新';
      toast.error(`スタッフの${operationText}に失敗しました: ${error.message}`);

      // System health check on error
      const healthCheck = checkSystemHealth();
      if (healthCheck.status !== 'healthy' && enhancedLoggingEnabled) {
        console.warn('⚠️ [System Health] System health check indicates issues:', healthCheck);
      }
    }
  };

  const handleDeleteStaff = async (staffId) => {
    const staffToDelete = staffMembers.find(s => s.id === staffId);
    const staffName = staffToDelete?.name || 'スタッフ';
    
    const confirmed = window.confirm(`本当に${staffName}を削除しますか？\n\nこの操作は元に戻せません。`);
    if (!confirmed) return;
    
    console.log(`🗑️ [Real-time UI] Deleting staff member: ${staffName}`);
    
    setOperationState({
      isProcessing: true,
      lastOperation: 'delete',
      lastOperationSuccess: false,
    });
    
    try {
      // Show immediate optimistic feedback
      toast.success(`${staffName}を削除しています...`, { duration: 1000 });
      
      const { newStaffMembers, newSchedule } = deleteStaff(
        staffId,
        schedule,
        updateSchedule,
        (updatedStaffArray) => {
          console.log("✅ [Real-time UI] Staff deleted successfully with immediate UI update");

          setOperationState({
            isProcessing: false,
            lastOperation: 'delete',
            lastOperationSuccess: true,
          });

          // Phase 3: Invalidate React Query cache to trigger database refresh
          if (invalidateAllPeriodsCache) {
            console.log('🔄 [StaffModal-Refresh] Invalidating cache after staff delete to refresh from database');
            invalidateAllPeriodsCache();
          }

          // Show success feedback
          toast.success(`${staffName}を削除しました`);

          // Close modal after successful deletion
          setShowStaffEditModal(false);
          setSelectedStaffForEdit(null);
          setIsAddingNewStaff(false);
        },
      );
    } catch (error) {
      console.error("❌ [Real-time UI] Staff deletion failed:", error);
      
      setOperationState({
        isProcessing: false,
        lastOperation: 'delete',
        lastOperationSuccess: false,
      });
      
      toast.error(`${staffName}の削除に失敗しました: ${error.message}`);
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
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-card-foreground">
                  スタッフ一覧
                </h3>
                {isSaving && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>同期中...</span>
                  </div>
                )}
                {operationState.lastOperationSuccess && (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
              </div>
              <Button
                onClick={startAddingNew}
                disabled={operationState.isProcessing}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50"
              >
                {operationState.isProcessing && operationState.lastOperation === 'add' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    追加中...
                  </>
                ) : (
                  "新規追加"
                )}
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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-card-foreground">
                {isAddingNewStaff
                  ? "スタッフ追加"
                  : selectedStaffForEdit
                    ? "スタッフ編集"
                    : "スタッフを選択してください"}
              </h3>
              
              {/* Real-time status indicators */}
              <div className="flex items-center gap-2">
                {error && (
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>エラー</span>
                  </div>
                )}
                {operationState.isProcessing && (
                  <div className="flex items-center gap-1 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {operationState.lastOperation === 'add' && '追加中...'}
                      {operationState.lastOperation === 'update' && '更新中...'}
                      {operationState.lastOperation === 'delete' && '削除中...'}
                    </span>
                  </div>
                )}
                {operationState.lastOperationSuccess && !operationState.isProcessing && (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>完了</span>
                  </div>
                )}
              </div>
            </div>

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
                        disabled={operationState.isProcessing}
                        onClick={() =>
                          handleDeleteStaff(selectedStaffForEdit.id)
                        }
                      >
                        {operationState.isProcessing && operationState.lastOperation === 'delete' ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            削除中...
                          </>
                        ) : (
                          "削除"
                        )}
                      </Button>
                    )}

                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={operationState.isProcessing || !safeEditingStaffData.name?.trim()}
                      className="flex-1"
                    >
                      {operationState.isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {isAddingNewStaff ? "追加中..." : "更新中..."}
                        </>
                      ) : (
                        isAddingNewStaff ? "追加" : "更新"
                      )}
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
