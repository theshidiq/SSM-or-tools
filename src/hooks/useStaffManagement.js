import { useState, useEffect, useCallback } from 'react';
import { migrateStaffMembers } from '../utils/staffUtils';
import { optimizedStorage, performanceMonitor } from '../utils/storageUtils';

// Keep legacy function for backward compatibility during transition
const loadFromLocalStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
};

export const useStaffManagement = (currentMonthIndex, supabaseScheduleData) => {
  const [staffMembers, setStaffMembers] = useState([]);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);
  
  // Modal states for staff editing
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

  useEffect(() => {
    // Priority 1: Check optimized storage first (memory cache + localStorage)
    const localStaff = optimizedStorage.getStaffData(currentMonthIndex);
    
    try {
      if (localStaff && Array.isArray(localStaff) && localStaff.length > 0) {
        setStaffMembers(localStaff);
        setHasLoadedFromDb(true);
        // Development mode only: log load success
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }
    } catch (error) {
      console.warn('Error loading staff from optimized storage:', error);
      // Continue to database fallback
    }
    
    // Priority 2: Fallback to database data if no localStorage data
    if (supabaseScheduleData && supabaseScheduleData.schedule_data) {
      if (supabaseScheduleData.schedule_data._staff_members && supabaseScheduleData.schedule_data._staff_members.length > 0) {
        const migratedStaffFromDb = migrateStaffMembers(supabaseScheduleData.schedule_data._staff_members);
        setStaffMembers(migratedStaffFromDb);
      } else {
        const { _staff_members, ...scheduleData } = supabaseScheduleData.schedule_data;
        const staffIds = Object.keys(scheduleData);
        if (staffIds.length > 0) {
          // Create staff objects from schedule data keys
          const extractedStaff = staffIds.map(staffId => ({
            id: staffId,
            name: `Staff-${staffId.slice(-4)}`, // Use last 4 chars of ID as name
            position: 'Unknown',
            status: '社員',
            department: '',
            order: 0
          }));
          
          setStaffMembers(extractedStaff);
          
          // Save to optimized storage for future use
          optimizedStorage.saveStaffData(currentMonthIndex, extractedStaff);
        } else {
          setStaffMembers([]);
        }
      }
      setHasLoadedFromDb(true);
    } else if (supabaseScheduleData === null) {
      // Database is explicitly null (no connection or empty)
      // Use optimized storage data if available
      const fallbackStaff = optimizedStorage.getStaffData(currentMonthIndex) || [];
      setStaffMembers(fallbackStaff);
      setHasLoadedFromDb(true);
    } else if (supabaseScheduleData && !supabaseScheduleData.schedule_data) {
      // Database exists but has no schedule data
      // Use optimized storage data if available
      const fallbackStaff = optimizedStorage.getStaffData(currentMonthIndex) || [];
      setStaffMembers(fallbackStaff);
      setHasLoadedFromDb(true);
    }
  }, [currentMonthIndex, supabaseScheduleData]);

  const addStaff = useCallback((newStaff, onSuccess) => {
    const updatedStaff = [...staffMembers, newStaff];
    setStaffMembers(updatedStaff);
    
    // Save to optimized storage
    optimizedStorage.saveStaffData(currentMonthIndex, updatedStaff);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`➕ Added staff member: ${newStaff.name} to period ${currentMonthIndex}`);
    }
    if (onSuccess) onSuccess(updatedStaff);
  }, [staffMembers, currentMonthIndex]);

  const updateStaff = useCallback((staffId, updatedData, onSuccess) => {
    const updatedStaff = staffMembers.map(staff => 
      staff.id === staffId ? { ...staff, ...updatedData } : staff
    );
    setStaffMembers(updatedStaff);
    
    // Save to optimized storage
    optimizedStorage.saveStaffData(currentMonthIndex, updatedStaff);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Updated staff member: ${staffId} in period ${currentMonthIndex}`);
    }
    if (onSuccess) onSuccess(updatedStaff);
  }, [staffMembers, currentMonthIndex]);

  const deleteStaff = useCallback((staffIdToDelete, scheduleData, updateSchedule, onSuccess) => {
    // Remove staff from staff list
    const newStaffMembers = staffMembers.filter(staff => staff.id !== staffIdToDelete);
    setStaffMembers(newStaffMembers);
    
    // Remove staff from schedule data
    const newSchedule = { ...scheduleData };
    delete newSchedule[staffIdToDelete];
    
    // Update schedule
    updateSchedule(newSchedule);
    
    // Save to optimized storage
    optimizedStorage.saveStaffData(currentMonthIndex, newStaffMembers);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗑️ Deleted staff member: ${staffIdToDelete} from period ${currentMonthIndex}`);
    }
    
    if (onSuccess) onSuccess(newStaffMembers);
    
    return { newStaffMembers, newSchedule };
  }, [staffMembers, currentMonthIndex]);

  const editStaffName = useCallback((staffId, newName, onSuccess) => {
    const updatedStaff = staffMembers.map(staff => 
      staff.id === staffId ? { ...staff, name: newName } : staff
    );
    setStaffMembers(updatedStaff);
    
    // Save to optimized storage
    optimizedStorage.saveStaffData(currentMonthIndex, updatedStaff);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✏️ Edited staff name: ${staffId} -> ${newName} in period ${currentMonthIndex}`);
    }
    
    if (onSuccess) onSuccess(updatedStaff);
  }, [staffMembers, currentMonthIndex]);

  const reorderStaff = useCallback((reorderedStaff, onSuccess) => {
    setStaffMembers(reorderedStaff);
    
    // Save to optimized storage
    optimizedStorage.saveStaffData(currentMonthIndex, reorderedStaff);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Reordered staff in period ${currentMonthIndex}`);
    }
    
    if (onSuccess) onSuccess(reorderedStaff);
  }, [currentMonthIndex]);

  // Create new staff member with schedule initialization
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
    if (dateRange) {
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        newSchedule[newStaffId][dateKey] = ''; // Start with blank
      });
    }
    
    // Update states
    setStaffMembers(newStaffMembers);
    if (onStaffUpdate) onStaffUpdate(newStaffMembers);
    if (onScheduleUpdate) onScheduleUpdate(newSchedule);
    
    // Save to optimized storage
    optimizedStorage.saveStaffData(currentMonthIndex, newStaffMembers);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🆕 Created new staff member: ${newStaff.name} in period ${currentMonthIndex}`);
    }
    
    // Close modal
    setShowStaffEditModal(false);
    setIsAddingNewStaff(false);
    setEditingStaffData({
      name: '',
      position: '',
      status: '社員',
      startPeriod: null,
      endPeriod: null
    });
    
    return { newStaffMembers, newSchedule };
  }, [staffMembers, currentMonthIndex]);

  // Handle staff creation from modal
  const handleCreateStaff = useCallback((staffData) => {
    const newStaffId = `01934d2c-8a7b-7${Date.now().toString(16).slice(-3)}-8${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;
    
    const newStaff = {
      id: newStaffId,
      name: staffData.name || '新しいスタッフ',
      position: staffData.position || 'Staff',
      color: 'position-server',
      status: staffData.status,
      startPeriod: staffData.startPeriod,
      endPeriod: staffData.endPeriod,
      order: staffMembers.length
    };
    
    addStaff(newStaff, () => {
      setShowStaffEditModal(false);
      setIsAddingNewStaff(false);
      setEditingStaffData({
        name: '',
        position: '',
        status: '社員',
        startPeriod: null,
        endPeriod: null
      });
      
      // Log performance metrics after staff operations (development mode only)
      performanceMonitor.logSummary();
    });
  }, [addStaff, staffMembers.length]);

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
    staffMembers,
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
    addStaff,
    updateStaff,
    deleteStaff,
    editStaffName,
    reorderStaff,
    createNewStaff,
    handleCreateStaff,
    startAddingNewStaff
  };
};