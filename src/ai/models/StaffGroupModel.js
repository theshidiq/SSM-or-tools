/**
 * StaffGroupModel.js
 * 
 * Model classes for staff group definitions and conflict management.
 * Provides structured representation of staff groups and their relationships.
 */

import { STAFF_CONFLICT_GROUPS } from '../core/ConstraintEngine';

/**
 * Class representing a staff group with conflict rules
 */
export class StaffGroup {
  constructor(name, members = [], conflictRules = {}) {
    this.name = name;
    this.members = [...members];
    this.conflictRules = {
      maxSimultaneousOff: 1,
      maxSimultaneousEarly: 1,
      allowsConflict: false,
      ...conflictRules
    };
    this.priority = 'medium';
    this.description = '';
    this.active = true;
  }

  /**
   * Add a member to the group
   * @param {string} memberName - Name of the staff member
   */
  addMember(memberName) {
    if (!this.members.includes(memberName)) {
      this.members.push(memberName);
    }
  }

  /**
   * Remove a member from the group
   * @param {string} memberName - Name of the staff member
   */
  removeMember(memberName) {
    this.members = this.members.filter(member => member !== memberName);
  }

  /**
   * Check if a staff member belongs to this group
   * @param {string} memberName - Name of the staff member
   * @returns {boolean} True if member is in the group
   */
  hasMember(memberName) {
    return this.members.includes(memberName);
  }

  /**
   * Update conflict rules for the group
   * @param {Object} newRules - New conflict rules to apply
   */
  updateConflictRules(newRules) {
    this.conflictRules = { ...this.conflictRules, ...newRules };
  }

  /**
   * Check if the group has a conflict on a specific date
   * @param {Object} scheduleData - Schedule data for all staff
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {Array} staffMembers - Array of staff member objects
   * @returns {Object} Conflict check result
   */
  checkConflict(scheduleData, dateKey, staffMembers) {
    const groupSchedule = this.getGroupScheduleForDate(scheduleData, dateKey, staffMembers);
    
    const offCount = groupSchedule.filter(member => 
      member.shift === '×' || member.shift === 'off' || member.shift === '★'
    ).length;
    
    const earlyCount = groupSchedule.filter(member => 
      member.shift === '△' || member.shift === 'early'
    ).length;

    const conflicts = [];

    // Check off day conflicts
    if (offCount > this.conflictRules.maxSimultaneousOff) {
      conflicts.push({
        type: 'simultaneous_off',
        count: offCount,
        limit: this.conflictRules.maxSimultaneousOff,
        excess: offCount - this.conflictRules.maxSimultaneousOff,
        members: groupSchedule.filter(m => 
          m.shift === '×' || m.shift === 'off' || m.shift === '★'
        ).map(m => m.name)
      });
    }

    // Check early shift conflicts
    if (earlyCount > this.conflictRules.maxSimultaneousEarly) {
      conflicts.push({
        type: 'simultaneous_early',
        count: earlyCount,
        limit: this.conflictRules.maxSimultaneousEarly,
        excess: earlyCount - this.conflictRules.maxSimultaneousEarly,
        members: groupSchedule.filter(m => 
          m.shift === '△' || m.shift === 'early'
        ).map(m => m.name)
      });
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      groupSchedule
    };
  }

  /**
   * Get group members' schedule for a specific date
   * @param {Object} scheduleData - Schedule data for all staff
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {Array} staffMembers - Array of staff member objects
   * @returns {Array} Array of group member schedules
   */
  getGroupScheduleForDate(scheduleData, dateKey, staffMembers) {
    return this.members.map(memberName => {
      const staff = staffMembers.find(s => s.name === memberName);
      if (staff && scheduleData[staff.id] && scheduleData[staff.id][dateKey] !== undefined) {
        return {
          name: memberName,
          staffId: staff.id,
          shift: scheduleData[staff.id][dateKey],
          position: staff.position
        };
      }
      return {
        name: memberName,
        staffId: null,
        shift: null,
        position: 'Unknown'
      };
    }).filter(member => member.staffId !== null);
  }

  /**
   * Get potential conflict resolution suggestions
   * @param {Object} conflictResult - Result from checkConflict method
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @returns {Array} Array of resolution suggestions
   */
  getConflictResolutions(conflictResult, dateKey) {
    const resolutions = [];

    conflictResult.conflicts.forEach(conflict => {
      if (conflict.type === 'simultaneous_off') {
        // Suggest changing some off days to working days
        const membersToChange = conflict.members.slice(0, conflict.excess);
        resolutions.push({
          type: 'change_off_to_work',
          action: 'Change off days to working days',
          affectedMembers: membersToChange,
          priority: 'high',
          description: `Change ${membersToChange.join(', ')} from off to working on ${dateKey}`
        });

        // Suggest moving off days to different dates
        resolutions.push({
          type: 'reschedule_off_days',
          action: 'Move off days to different dates',
          affectedMembers: membersToChange,
          priority: 'medium',
          description: `Reschedule off days for ${membersToChange.join(', ')} to different dates`
        });
      }

      if (conflict.type === 'simultaneous_early') {
        // Suggest changing some early shifts to normal or late
        const membersToChange = conflict.members.slice(0, conflict.excess);
        resolutions.push({
          type: 'change_early_to_normal',
          action: 'Change early shifts to normal shifts',
          affectedMembers: membersToChange,
          priority: 'high',
          description: `Change ${membersToChange.join(', ')} from early to normal shift on ${dateKey}`
        });

        resolutions.push({
          type: 'change_early_to_late',
          action: 'Change early shifts to late shifts',
          affectedMembers: membersToChange,
          priority: 'medium',
          description: `Change ${membersToChange.join(', ')} from early to late shift on ${dateKey}`
        });
      }
    });

    return resolutions;
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON representation of the staff group
   */
  toJSON() {
    return {
      name: this.name,
      members: [...this.members],
      conflictRules: { ...this.conflictRules },
      priority: this.priority,
      description: this.description,
      active: this.active
    };
  }

  /**
   * Create StaffGroup from JSON
   * @param {Object} json - JSON representation
   * @returns {StaffGroup} New StaffGroup instance
   */
  static fromJSON(json) {
    const group = new StaffGroup(json.name, json.members, json.conflictRules);
    group.priority = json.priority || 'medium';
    group.description = json.description || '';
    group.active = json.active !== undefined ? json.active : true;
    return group;
  }
}

/**
 * Manager class for handling multiple staff groups
 */
export class StaffGroupManager {
  constructor() {
    this.groups = new Map();
    this.conflictHistory = [];
    this.initializeDefaultGroups();
  }

  /**
   * Initialize default staff groups from constraint engine
   */
  initializeDefaultGroups() {
    STAFF_CONFLICT_GROUPS.forEach(groupDef => {
      const group = new StaffGroup(groupDef.name, groupDef.members, {
        maxSimultaneousOff: 1,
        maxSimultaneousEarly: 1,
        allowsConflict: false
      });
      group.description = `Default conflict group: ${groupDef.members.join(', ')}`;
      group.priority = 'high';
      this.groups.set(groupDef.name, group);
    });
  }

  /**
   * Add a new staff group
   * @param {StaffGroup} group - Staff group to add
   */
  addGroup(group) {
    this.groups.set(group.name, group);
  }

  /**
   * Remove a staff group
   * @param {string} groupName - Name of the group to remove
   */
  removeGroup(groupName) {
    this.groups.delete(groupName);
  }

  /**
   * Get a staff group by name
   * @param {string} groupName - Name of the group
   * @returns {StaffGroup|null} The staff group or null if not found
   */
  getGroup(groupName) {
    return this.groups.get(groupName) || null;
  }

  /**
   * Get all staff groups
   * @returns {Array} Array of all staff groups
   */
  getAllGroups() {
    return Array.from(this.groups.values());
  }

  /**
   * Get groups that contain a specific staff member
   * @param {string} memberName - Name of the staff member
   * @returns {Array} Array of groups containing the member
   */
  getGroupsForMember(memberName) {
    return Array.from(this.groups.values()).filter(group => 
      group.hasMember(memberName) && group.active
    );
  }

  /**
   * Check all groups for conflicts on a specific date
   * @param {Object} scheduleData - Schedule data for all staff
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {Array} staffMembers - Array of staff member objects
   * @returns {Object} Complete conflict analysis
   */
  checkAllGroupConflicts(scheduleData, dateKey, staffMembers) {
    const conflictResults = {
      hasConflicts: false,
      date: dateKey,
      groupConflicts: [],
      affectedGroups: [],
      totalConflicts: 0,
      resolutions: []
    };

    Array.from(this.groups.values()).forEach(group => {
      if (group.active) {
        const conflictResult = group.checkConflict(scheduleData, dateKey, staffMembers);
        
        if (conflictResult.hasConflict) {
          conflictResults.hasConflicts = true;
          conflictResults.totalConflicts += conflictResult.conflicts.length;
          conflictResults.affectedGroups.push(group.name);
          
          const groupConflictInfo = {
            groupName: group.name,
            conflicts: conflictResult.conflicts,
            groupSchedule: conflictResult.groupSchedule,
            resolutions: group.getConflictResolutions(conflictResult, dateKey)
          };
          
          conflictResults.groupConflicts.push(groupConflictInfo);
          conflictResults.resolutions.push(...groupConflictInfo.resolutions);
        }
      }
    });

    // Record conflict in history
    if (conflictResults.hasConflicts) {
      this.conflictHistory.push({
        date: dateKey,
        timestamp: new Date().toISOString(),
        conflicts: conflictResults.groupConflicts.length,
        affectedGroups: [...conflictResults.affectedGroups]
      });

      // Keep only last 100 conflict records
      if (this.conflictHistory.length > 100) {
        this.conflictHistory = this.conflictHistory.slice(-100);
      }
    }

    return conflictResults;
  }

  /**
   * Get conflict statistics
   * @returns {Object} Conflict statistics and trends
   */
  getConflictStatistics() {
    const stats = {
      totalConflictDays: this.conflictHistory.length,
      averageConflictsPerDay: 0,
      mostConflictedGroups: {},
      conflictTrends: {
        increasing: false,
        stable: false,
        decreasing: false
      },
      recentConflicts: this.conflictHistory.slice(-10)
    };

    if (this.conflictHistory.length > 0) {
      const totalConflicts = this.conflictHistory.reduce((sum, record) => sum + record.conflicts, 0);
      stats.averageConflictsPerDay = totalConflicts / this.conflictHistory.length;

      // Count most conflicted groups
      this.conflictHistory.forEach(record => {
        record.affectedGroups.forEach(groupName => {
          stats.mostConflictedGroups[groupName] = (stats.mostConflictedGroups[groupName] || 0) + 1;
        });
      });

      // Analyze trends (last 10 vs previous 10)
      if (this.conflictHistory.length >= 20) {
        const recent10 = this.conflictHistory.slice(-10);
        const previous10 = this.conflictHistory.slice(-20, -10);
        
        const recentAvg = recent10.reduce((sum, r) => sum + r.conflicts, 0) / 10;
        const previousAvg = previous10.reduce((sum, r) => sum + r.conflicts, 0) / 10;
        
        if (recentAvg > previousAvg * 1.1) {
          stats.conflictTrends.increasing = true;
        } else if (recentAvg < previousAvg * 0.9) {
          stats.conflictTrends.decreasing = true;
        } else {
          stats.conflictTrends.stable = true;
        }
      }
    }

    return stats;
  }

  /**
   * Update a staff member's name across all groups
   * @param {string} oldName - Current name
   * @param {string} newName - New name
   */
  updateMemberName(oldName, newName) {
    Array.from(this.groups.values()).forEach(group => {
      if (group.hasMember(oldName)) {
        group.removeMember(oldName);
        group.addMember(newName);
      }
    });
  }

  /**
   * Create a custom group with specific conflict rules
   * @param {string} name - Group name
   * @param {Array} members - Array of member names
   * @param {Object} conflictRules - Custom conflict rules
   * @returns {StaffGroup} Created group
   */
  createCustomGroup(name, members, conflictRules = {}) {
    const group = new StaffGroup(name, members, {
      maxSimultaneousOff: 1,
      maxSimultaneousEarly: 1,
      allowsConflict: false,
      ...conflictRules
    });
    
    group.priority = 'custom';
    group.description = `Custom group created with ${members.length} members`;
    
    this.addGroup(group);
    return group;
  }

  /**
   * Export all groups to JSON
   * @returns {Object} JSON representation of all groups
   */
  exportToJSON() {
    const exported = {
      exportedAt: new Date().toISOString(),
      groups: {},
      conflictHistory: [...this.conflictHistory]
    };

    Array.from(this.groups.entries()).forEach(([name, group]) => {
      exported.groups[name] = group.toJSON();
    });

    return exported;
  }

  /**
   * Import groups from JSON
   * @param {Object} jsonData - JSON data to import
   */
  importFromJSON(jsonData) {
    this.groups.clear();
    this.conflictHistory = jsonData.conflictHistory || [];

    Object.entries(jsonData.groups || {}).forEach(([name, groupData]) => {
      const group = StaffGroup.fromJSON(groupData);
      this.groups.set(name, group);
    });
  }

  /**
   * Get recommendations for reducing conflicts
   * @returns {Array} Array of recommendations
   */
  getConflictReductionRecommendations() {
    const recommendations = [];
    const stats = this.getConflictStatistics();

    // Recommend based on most conflicted groups
    Object.entries(stats.mostConflictedGroups).forEach(([groupName, conflictCount]) => {
      if (conflictCount > 5) {
        const group = this.getGroup(groupName);
        if (group) {
          recommendations.push({
            type: 'group_optimization',
            groupName,
            conflictCount,
            priority: 'high',
            suggestion: `Consider adjusting ${groupName} conflict rules or member assignments`,
            details: {
              currentMembers: group.members,
              conflictRules: group.conflictRules,
              suggestions: [
                'Increase maxSimultaneousOff limit',
                'Reassign some members to different groups',
                'Implement rotation system within group'
              ]
            }
          });
        }
      }
    });

    // Recommend based on trends
    if (stats.conflictTrends.increasing) {
      recommendations.push({
        type: 'trend_alert',
        priority: 'high',
        suggestion: 'Conflicts are increasing. Review group assignments and rules.',
        details: {
          recentConflicts: stats.recentConflicts,
          suggestions: [
            'Review recent schedule changes',
            'Consider temporary rule adjustments',
            'Analyze staff availability patterns'
          ]
        }
      });
    }

    // Recommend for high conflict days
    if (stats.averageConflictsPerDay > 2) {
      recommendations.push({
        type: 'general_optimization',
        priority: 'medium',
        suggestion: 'High average conflicts per day. Consider systematic review.',
        details: {
          averageConflicts: stats.averageConflictsPerDay,
          suggestions: [
            'Implement more flexible group rules',
            'Create overlap groups for busy periods',
            'Consider staff cross-training'
          ]
        }
      });
    }

    return recommendations;
  }
}