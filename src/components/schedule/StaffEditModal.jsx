import React from 'react';
import { X } from 'lucide-react';
import { isDateWithinWorkPeriod } from '../../utils/dateUtils';

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
  scheduleAutoSave
}) => {
  if (!showStaffEditModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (isAddingNewStaff) {
      handleCreateStaff(editingStaffData);
    } else if (selectedStaffForEdit) {
      updateStaff(editingStaffData, (newStaff) => {
        setStaffMembersByMonth(prev => ({
          ...prev,
          [currentMonthIndex]: newStaff
        }));
      });
      
      setTimeout(() => {
        scheduleAutoSave(schedule, staffMembers);
      }, 0);
    }
  };

  const handleDeleteStaff = (staffId) => {
    const confirmed = window.confirm('本当にこのスタッフを削除しますか？');
    if (confirmed) {
      const { newStaffMembers, newSchedule } = deleteStaff(
        staffId,
        schedule,
        updateSchedule,
        (newStaff) => {
          setStaffMembersByMonth(prev => ({
            ...prev,
            [currentMonthIndex]: newStaff
          }));
        }
      );
      
      setShowStaffEditModal(false);
      setSelectedStaffForEdit(null);
      
      setTimeout(() => {
        scheduleAutoSave(newSchedule, newStaffMembers);
      }, 0);
    }
  };

  const handleStaffSelect = (staff) => {
    setSelectedStaffForEdit(staff);
    setEditingStaffData({
      name: staff.name,
      position: staff.position || '',
      status: staff.status || '社員',
      startPeriod: staff.startPeriod || null,
      endPeriod: staff.endPeriod || null
    });
    setIsAddingNewStaff(false);
  };

  const startAddingNew = () => {
    setIsAddingNewStaff(true);
    setSelectedStaffForEdit(null);
    setEditingStaffData({
      name: '',
      position: '',
      status: '社員',
      startPeriod: null,
      endPeriod: null
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 h-[50vh] overflow-y-auto">
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
              <h3 className="text-lg font-semibold text-gray-700">スタッフ一覧</h3>
              <button
                onClick={startAddingNew}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                新規追加
              </button>
            </div>

            <div className="space-y-2 max-h-[35vh] overflow-y-auto">
              {staffMembers.map((staff) => {
                const isActive = isDateWithinWorkPeriod(dateRange[0], staff) || 
                                isDateWithinWorkPeriod(dateRange[dateRange.length - 1], staff);
                
                return (
                  <div
                    key={staff.id}
                    onClick={() => handleStaffSelect(staff)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedStaffForEdit?.id === staff.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${!isActive ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">{staff.name}</div>
                        <div className="text-sm text-gray-600">
                          {staff.position} • {staff.status}
                          {!isActive && <span className=" text-orange-600"> (期間外)</span>}
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
              {isAddingNewStaff ? 'スタッフ追加' : selectedStaffForEdit ? 'スタッフ編集' : 'スタッフを選択してください'}
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
                    value={editingStaffData.name}
                    onChange={(e) => setEditingStaffData(prev => ({ ...prev, name: e.target.value }))}
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
                    value={editingStaffData.position}
                    onChange={(e) => setEditingStaffData(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例: Server, Kitchen, Manager"
                  />
                </div>

                {/* Status Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    雇用形態 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingStaffData.status}
                    onChange={(e) => setEditingStaffData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="社員">社員</option>
                    <option value="派遣">派遣</option>
                  </select>
                </div>

                {/* Start Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始期間
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="年"
                      value={editingStaffData.startPeriod?.year || ''}
                      onChange={(e) => setEditingStaffData(prev => ({
                        ...prev,
                        startPeriod: {
                          ...prev.startPeriod,
                          year: parseInt(e.target.value) || null
                        }
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="2000"
                      max="2050"
                    />
                    <input
                      type="number"
                      placeholder="月"
                      value={editingStaffData.startPeriod?.month || ''}
                      onChange={(e) => setEditingStaffData(prev => ({
                        ...prev,
                        startPeriod: {
                          ...prev.startPeriod,
                          month: parseInt(e.target.value) || null
                        }
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="12"
                    />
                    <input
                      type="number"
                      placeholder="日"
                      value={editingStaffData.startPeriod?.day || ''}
                      onChange={(e) => setEditingStaffData(prev => ({
                        ...prev,
                        startPeriod: {
                          ...prev.startPeriod,
                          day: parseInt(e.target.value) || null
                        }
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="31"
                    />
                  </div>
                </div>

                {/* End Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了期間（任意）
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="年"
                      value={editingStaffData.endPeriod?.year || ''}
                      onChange={(e) => setEditingStaffData(prev => ({
                        ...prev,
                        endPeriod: e.target.value ? {
                          ...prev.endPeriod,
                          year: parseInt(e.target.value) || null
                        } : null
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="2000"
                      max="2050"
                    />
                    <input
                      type="number"
                      placeholder="月"
                      value={editingStaffData.endPeriod?.month || ''}
                      onChange={(e) => setEditingStaffData(prev => ({
                        ...prev,
                        endPeriod: prev.endPeriod || e.target.value ? {
                          ...prev.endPeriod,
                          month: parseInt(e.target.value) || null
                        } : null
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="12"
                    />
                    <input
                      type="number"
                      placeholder="日"
                      value={editingStaffData.endPeriod?.day || ''}
                      onChange={(e) => setEditingStaffData(prev => ({
                        ...prev,
                        endPeriod: prev.endPeriod || e.target.value ? {
                          ...prev.endPeriod,
                          day: parseInt(e.target.value) || null
                        } : null
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="31"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    {isAddingNewStaff ? '追加' : '更新'}
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
                    onClick={() => {
                      setSelectedStaffForEdit(null);
                      setIsAddingNewStaff(false);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    キャンセル
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