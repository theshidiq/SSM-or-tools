import React, { useEffect } from "react";
import { X } from "lucide-react";
import { isDateWithinWorkPeriod } from "../../utils/dateUtils";

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
}) => {
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

  // Remove the problematic sync logic that was interfering with updates

  if (!showStaffEditModal) return null;

  // Provide default values for editingStaffData to prevent crashes
  const safeEditingStaffData = editingStaffData || {
    name: "",
    position: "",
    status: "社員",
    startPeriod: null,
    endPeriod: null,
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    if (isAddingNewStaff) {
      handleCreateStaff(safeEditingStaffData);
    } else if (selectedStaffForEdit) {
      updateStaff(selectedStaffForEdit.id, safeEditingStaffData, (newStaff) => {
        setStaffMembersByMonth((prev) => ({
          ...prev,
          [currentMonthIndex]: newStaff,
        }));

        // Update the modal's form state to reflect the successful update
        const updatedStaff = newStaff.find(
          (staff) => staff.id === selectedStaffForEdit.id,
        );
        if (updatedStaff) {
          console.log(
            "🔄 Modal: Updating form state with new staff data",
            updatedStaff,
          );
          setEditingStaffData({
            name: updatedStaff.name,
            position: updatedStaff.position || "",
            status: updatedStaff.status || "社員",
            startPeriod: updatedStaff.startPeriod || null,
            endPeriod: updatedStaff.endPeriod || null,
          });

          // Also update the selectedStaffForEdit to ensure consistency
          setSelectedStaffForEdit(updatedStaff);
        }
      });

      // Use setTimeout to ensure the update completes before saving
      setTimeout(() => {
        scheduleAutoSave(schedule, staffMembers);
      }, 100);
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
    // Find the most current staff data from the staffMembers array
    const currentStaffData =
      staffMembers.find((s) => s.id === staff.id) || staff;

    console.log("📋 Modal: Staff selected", {
      id: currentStaffData.id,
      name: currentStaffData.name,
      status: currentStaffData.status,
      position: currentStaffData.position,
    });

    setSelectedStaffForEdit(currentStaffData);
    const newEditingData = {
      name: currentStaffData.name,
      position: currentStaffData.position || "",
      status: currentStaffData.status || "社員",
      startPeriod: currentStaffData.startPeriod || null,
      endPeriod: currentStaffData.endPeriod || null,
    };

    console.log("📝 Modal: Setting editing data", newEditingData);
    setEditingStaffData(newEditingData);
    setIsAddingNewStaff(false);
  };

  const startAddingNew = () => {
    setIsAddingNewStaff(true);
    setSelectedStaffForEdit(null);
    setEditingStaffData({
      name: "",
      position: "",
      status: "社員",
      startPeriod: null,
      endPeriod: null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // Only close if clicking the overlay itself, not its children
          setShowStaffEditModal(false);
          setSelectedStaffForEdit(null);
          setIsAddingNewStaff(false);
        }
      }}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 h-[65vh] overflow-y-auto"
        onClick={(e) => {
          e.stopPropagation(); // Prevent overlay click handler
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">スタッフ管理</h2>
          <button
            onClick={() => {
              setShowStaffEditModal(false);
              setSelectedStaffForEdit(null);
              setIsAddingNewStaff(false);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Staff List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-700">
                スタッフ一覧
              </h3>
              <button
                onClick={startAddingNew}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                新規追加
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {staffMembers.map((staff) => {
                const isActive =
                  isDateWithinWorkPeriod(dateRange[0], staff) ||
                  isDateWithinWorkPeriod(
                    dateRange[dateRange.length - 1],
                    staff,
                  );

                return (
                  <div
                    key={staff.id}
                    onClick={() => handleStaffSelect(staff)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedStaffForEdit?.id === staff.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    } ${!isActive ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">
                          {staff.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {staff.position} • {staff.status}
                          {!isActive && (
                            <span className=" text-orange-600"> (期間外)</span>
                          )}
                        </div>
                      </div>
                      {selectedStaffForEdit?.id === staff.id && (
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Staff Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">
              {isAddingNewStaff
                ? "スタッフ追加"
                : selectedStaffForEdit
                  ? "スタッフ編集"
                  : "スタッフを選択してください"}
            </h3>

            {(isAddingNewStaff || selectedStaffForEdit) && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={safeEditingStaffData.name}
                    onChange={(e) =>
                      setEditingStaffData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    placeholder="スタッフ名を入力"
                  />
                </div>

                {/* Position Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    職位
                  </label>
                  <input
                    type="text"
                    value={safeEditingStaffData.position}
                    onChange={(e) =>
                      setEditingStaffData((prev) => ({
                        ...prev,
                        position: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例: Server, Kitchen, Manager"
                  />
                </div>

                {/* Status Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    雇用形態 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value="社員"
                        checked={safeEditingStaffData.status === "社員"}
                        onChange={(e) =>
                          setEditingStaffData((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                        className="mr-2 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <span className="text-sm text-gray-700">社員</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value="派遣"
                        checked={safeEditingStaffData.status === "派遣"}
                        onChange={(e) => {
                          const currentYear = new Date().getFullYear();
                          setEditingStaffData((prev) => ({
                            ...prev,
                            status: e.target.value,
                            // If 派遣 is selected, set both periods to current year
                            startPeriod: {
                              ...prev.startPeriod,
                              year: currentYear,
                            },
                            endPeriod: {
                              ...prev.endPeriod,
                              year: currentYear,
                            },
                          }));
                        }}
                        className="mr-2 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <span className="text-sm text-gray-700">派遣</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value="パート"
                        checked={safeEditingStaffData.status === "パート"}
                        onChange={(e) => {
                          const currentYear = new Date().getFullYear();
                          setEditingStaffData((prev) => ({
                            ...prev,
                            status: e.target.value,
                            // If パート is selected, set both periods to current year
                            startPeriod: {
                              ...prev.startPeriod,
                              year: currentYear,
                            },
                            endPeriod: {
                              ...prev.endPeriod,
                              year: currentYear,
                            },
                          }));
                        }}
                        className="mr-2 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <span className="text-sm text-gray-700">パート</span>
                    </label>
                  </div>
                </div>

                {/* Start Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始期間
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={safeEditingStaffData.startPeriod?.year || ""}
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          startPeriod: {
                            ...prev.startPeriod,
                            year: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          },
                        }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">年</option>
                      {Array.from({ length: 5 }, (_, i) => {
                        const currentYear = new Date().getFullYear();
                        const year = currentYear - 4 + i; // Start from 4 years ago, go up to current year
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={safeEditingStaffData.startPeriod?.month || ""}
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          startPeriod: {
                            ...prev.startPeriod,
                            month: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          },
                        }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">月</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                    <select
                      value={safeEditingStaffData.startPeriod?.day || ""}
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          startPeriod: {
                            ...prev.startPeriod,
                            day: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          },
                        }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">日</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* End Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了期間
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={safeEditingStaffData.endPeriod?.year || ""}
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          endPeriod: e.target.value
                            ? {
                                ...prev.endPeriod,
                                year: parseInt(e.target.value),
                              }
                            : null,
                        }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">年</option>
                      {Array.from({ length: 2 }, (_, i) => {
                        const year = new Date().getFullYear() + i;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={safeEditingStaffData.endPeriod?.month || ""}
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          endPeriod:
                            prev.endPeriod || e.target.value
                              ? {
                                  ...prev.endPeriod,
                                  month: e.target.value
                                    ? parseInt(e.target.value)
                                    : null,
                                }
                              : null,
                        }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">月</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                    <select
                      value={safeEditingStaffData.endPeriod?.day || ""}
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          endPeriod:
                            prev.endPeriod || e.target.value
                              ? {
                                  ...prev.endPeriod,
                                  day: e.target.value
                                    ? parseInt(e.target.value)
                                    : null,
                                }
                              : null,
                        }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">日</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaffForEdit(null);
                      setIsAddingNewStaff(false);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    キャンセル
                  </button>

                  {selectedStaffForEdit && !isAddingNewStaff && (
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(selectedStaffForEdit.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                    >
                      削除
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    {isAddingNewStaff ? "追加" : "更新"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffEditModal;
