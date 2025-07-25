import React, { useState, useEffect, useCallback } from 'react';
import { migrateStaffMembers } from '../utils/staffUtils';
import { defaultStaffMembersArray } from '../constants/staffConstants';

export const useStaffManagement = (currentMonthIndex, staffMembersByMonth, supabaseScheduleData) => {
  const [staffMembers, setStaffMembers] = useState(() => {
    console.log('Initializing staffMembers with defaults:', defaultStaffMembersArray);
    return defaultStaffMembersArray;
  });
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

  // Load staff members for current month
  useEffect(() => {
    console.log('Loading staff for month:', currentMonthIndex, 'supabaseScheduleData:', supabaseScheduleData);
    const savedStaffMembers = staffMembersByMonth[currentMonthIndex];
    
    if (savedStaffMembers) {
      console.log('Using saved staff members:', savedStaffMembers);
      setStaffMembers(migrateStaffMembers(savedStaffMembers));
    } else if (supabaseScheduleData && supabaseScheduleData.schedule_data && supabaseScheduleData.schedule_data._staff_members) {
      // Use staff members from database if available
      console.log('Using staff from database:', supabaseScheduleData.schedule_data._staff_members);
      const migratedStaffFromDb = migrateStaffMembers(supabaseScheduleData.schedule_data._staff_members);
      setStaffMembers(migratedStaffFromDb);
    } else {
      // If no saved staff members for this month, use the default staff members
      console.log('Using default staff members:', defaultStaffMembersArray);
      setStaffMembers(defaultStaffMembersArray);
    }
  }, [currentMonthIndex, staffMembersByMonth, supabaseScheduleData]);

  // Force reset to default staff when database is empty
  useEffect(() => {
    if (supabaseScheduleData === null) {
      console.log('Database is empty, using default staff from useState initial state');
      setStaffMembers(defaultStaffMembersArray);
    }
  }, [supabaseScheduleData]);

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
    
    // Close modal immediately for better UX
    setShowStaffEditModal(false);
    setIsAddingNewStaff(false);
    
    return { newStaffMembers, newSchedule };
  }, [staffMembers]);

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
  }, [staffMembers, selectedStaffForEdit]);

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

  console.log('useStaffManagement returning staffMembers:', staffMembers);
  
  return {
    staffMembers,
    setStaffMembers,
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