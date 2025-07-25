import React, { useState, useEffect, useCallback } from 'react';
import { migrateStaffMembers } from '../utils/staffUtils';
import { defaultStaffMembersArray } from '../constants/staffConstants';

export const useStaffManagement = (currentMonthIndex, supabaseScheduleData) => {
  const [staffMembers, setStaffMembers] = useState([]);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);
  const [isAddingNewStaff, setIsAddingNewStaff] = useState(false);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState(null);
  const [showStaffEditModal, setShowStaffEditModal] = useState(false);
  const [editingStaffData, setEditingStaffData] = useState({
    name: '',
    position: '',
    status: '社員',
    startPeriod: null,
    endPeriod: null
  });

  // Load staff members - from database or localStorage as fallback
  useEffect(() => {
    if (supabaseScheduleData && supabaseScheduleData.schedule_data && supabaseScheduleData.schedule_data._staff_members) {
      // Use staff members from database
      const migratedStaffFromDb = migrateStaffMembers(supabaseScheduleData.schedule_data._staff_members);
      setStaffMembers(migratedStaffFromDb);
      setHasLoadedFromDb(true);
    } else if (supabaseScheduleData === null) {
      // Database is null - check localStorage as fallback
      try {
        const savedStaffByMonth = JSON.parse(localStorage.getItem('staff-by-month-data') || '{}');
        const localStaff = savedStaffByMonth[currentMonthIndex] || [];
        if (localStaff.length > 0) {
          setStaffMembers(localStaff);
        } else {
          setStaffMembers([]);
        }
      } catch {
        setStaffMembers([]);
      }
      setHasLoadedFromDb(true);
    }
    // Don't set hasLoadedFromDb for undefined case (still loading)
  }, [supabaseScheduleData, currentMonthIndex]);


  // Create new staff member
  const createNewStaff = useCallback((staffData, schedule, dateRange, onScheduleUpdate, onStaffUpdate) => {
    const newStaffId = `01934d2c-8a7b-7${Date.now().toString(16).slice(-3)}-8${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;
    
    const newStaff = {
      id: newStaffId,
      name: staffData.name || '新しいスタッフ',
      position: staffData.position || 'Staff',
      color: 'position-server',
      status: staffData.status,
      startPeriod: staffData.startPeriod,
      endPeriod: staffData.endPeriod
    };
    
    const newStaffMembers = [...staffMembers, newStaff];
    
    // Add empty schedule data for new staff member
    const newSchedule = {
      ...schedule,
      [newStaffId]: {}
    };
    
    // Initialize all dates for the new staff member
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      newSchedule[newStaffId][dateKey] = ''; // Start with blank
    });
    
    // Update states immediately for instant UI response
    React.startTransition(() => {
      setStaffMembers(newStaffMembers);
      onStaffUpdate(newStaffMembers);
      onScheduleUpdate(newSchedule);
    });
    
    // Force save to localStorage immediately
    const savedStaffByMonth = JSON.parse(localStorage.getItem('staff-by-month-data') || '{}');
    savedStaffByMonth[currentMonthIndex] = newStaffMembers;
    localStorage.setItem('staff-by-month-data', JSON.stringify(savedStaffByMonth));
    
    // Close modal immediately for better UX
    setShowStaffEditModal(false);
    setIsAddingNewStaff(false);
    
    return { newStaffMembers, newSchedule };
  }, [staffMembers, currentMonthIndex]);

  // Edit staff member name
  const editStaffName = useCallback((staffId, newName, onStaffUpdate) => {
    const newStaffMembers = staffMembers.map(staff => 
      staff.id === staffId ? { ...staff, name: newName } : staff
    );
    
    // Use startTransition for immediate UI update
    React.startTransition(() => {
      setStaffMembers(newStaffMembers);
      onStaffUpdate(newStaffMembers);
    });
  }, [staffMembers]);

  // Delete staff member
  const deleteStaff = useCallback((staffId, schedule, onScheduleUpdate, onStaffUpdate) => {
    if (staffMembers.length <= 1) {
      alert('最低1つの列は必要です。');
      return;
    }
    
    const newStaffMembers = staffMembers.filter(staff => staff.id !== staffId);
    
    // Remove from schedule data
    const newSchedule = { ...schedule };
    delete newSchedule[staffId];
    
    // Update states immediately for instant UI response
    React.startTransition(() => {
      setStaffMembers(newStaffMembers);
      onStaffUpdate(newStaffMembers);
      onScheduleUpdate(newSchedule);
    });
    
    return { newStaffMembers, newSchedule };
  }, [staffMembers]);

  // Update existing staff member
  const updateStaff = useCallback((updatedStaffData, onStaffUpdate) => {
    const updatedStaffMembers = staffMembers.map(staff => 
      staff.id === selectedStaffForEdit.id 
        ? { 
            ...staff, 
            name: updatedStaffData.name,
            position: updatedStaffData.position,
            status: updatedStaffData.status,
            startPeriod: updatedStaffData.startPeriod,
            endPeriod: updatedStaffData.endPeriod
          }
        : staff
    );
    
    // Use startTransition for immediate UI update
    React.startTransition(() => {
      setStaffMembers(updatedStaffMembers);
      onStaffUpdate(updatedStaffMembers);
    });
    
    // Force save to localStorage immediately
    const savedStaffByMonth = JSON.parse(localStorage.getItem('staff-by-month-data') || '{}');
    savedStaffByMonth[currentMonthIndex] = updatedStaffMembers;
    localStorage.setItem('staff-by-month-data', JSON.stringify(savedStaffByMonth));
    
    // Close modal
    setSelectedStaffForEdit(null);
    setIsAddingNewStaff(false);
    setShowStaffEditModal(false);
    setEditingStaffData({
      name: '',
      position: '',
      status: '社員',
      startPeriod: null,
      endPeriod: null
    });
    
    return updatedStaffMembers;
  }, [staffMembers, selectedStaffForEdit, currentMonthIndex]);

  // Start adding new staff
  const startAddingNewStaff = useCallback(() => {
    setIsAddingNewStaff(true);
    setSelectedStaffForEdit(null);
    setEditingStaffData({
      name: '',
      position: '',
      status: '社員',
      startPeriod: null,
      endPeriod: null
    });
    setShowStaffEditModal(true);
  }, []);

  
  return {
    staffMembers: staffMembers,
    setStaffMembers,
    hasLoadedFromDb,
    isAddingNewStaff,
    setIsAddingNewStaff,
    selectedStaffForEdit,
    setSelectedStaffForEdit,
    showStaffEditModal,
    setShowStaffEditModal,
    editingStaffData,
    setEditingStaffData,
    createNewStaff,
    editStaffName,
    deleteStaff,
    updateStaff,
    startAddingNewStaff
  };
};