/**
 * DebugPatch.jsx
 * 
 * Temporary patch to add debug tester to the main app
 * This will be removed once we identify the issue
 */

import React from 'react';
import AIAssistantDebugTester from './AIAssistantDebugTester';

// Higher-order component that adds debug functionality
export const withDebugTester = (WrappedComponent) => {
  return function DebugPatched(props) {
    const {
      scheduleData,
      staffMembers,
      currentMonthIndex,
      updateSchedule
    } = props;

    return (
      <>
        <WrappedComponent {...props} />
        {/* Add debug tester only in development */}
        {process.env.NODE_ENV === 'development' && (
          <AIAssistantDebugTester
            scheduleData={scheduleData}
            staffMembers={staffMembers}
            currentMonthIndex={currentMonthIndex}
            updateSchedule={updateSchedule}
          />
        )}
      </>
    );
  };
};

export default withDebugTester;