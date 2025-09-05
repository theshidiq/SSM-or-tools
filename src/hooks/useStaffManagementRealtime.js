/**
 * Staff Management Real-time Hook - Corrected Implementation
 *
 * IMPORTANT: This file was incorrectly implemented looking for a 'staff_members'
 * table that doesn't exist. The correct implementation is in useStaffRealtime.js
 *
 * This is now an alias to the correct implementation for backward compatibility.
 */

import { useStaffRealtime } from "./useStaffRealtime";

/**
 * @deprecated Use useStaffRealtime instead. This hook was incorrectly implemented.
 * This alias is provided for backward compatibility only.
 */
export const useStaffManagementRealtime = (currentMonthIndex, options) => {
  console.warn(
    "⚠️  useStaffManagementRealtime is deprecated. " +
      "Use useStaffRealtime instead for the correct Supabase integration.",
  );

  return useStaffRealtime(currentMonthIndex, options);
};

export default useStaffManagementRealtime;
