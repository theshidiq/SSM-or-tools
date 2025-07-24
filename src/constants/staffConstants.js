// Default staff members configuration
export const defaultStaffMembersArray = [
  { 
    id: '01934d2c-8a7b-7000-8000-1a2b3c4d5e6f', 
    name: '料理長', 
    position: 'Head Chef', 
    color: 'position-chef',
    status: '社員',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7001-8001-2b3c4d5e6f7a', 
    name: '井関', 
    position: 'Sous Chef', 
    color: 'position-sous-chef',
    status: '社員',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7002-8002-3c4d5e6f7a8b', 
    name: '與儀', 
    position: 'Server', 
    color: 'position-server',
    status: '社員',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7003-8003-4d5e6f7a8b9c', 
    name: '田辺', 
    position: 'Server', 
    color: 'position-server',
    status: '社員',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7004-8004-5e6f7a8b9c0d', 
    name: '小島', 
    position: 'Staff', 
    color: 'position-staff',
    status: '派遣',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7005-8005-6f7a8b9c0d1e', 
    name: '小池', 
    position: 'Staff', 
    color: 'position-staff',
    status: '派遣',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7006-8006-7a8b9c0d1e2f', 
    name: '岸', 
    position: 'Staff', 
    color: 'position-staff',
    status: '派遣',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7007-8007-8b9c0d1e2f3a', 
    name: 'Kamal', 
    position: 'Staff', 
    color: 'position-staff',
    status: '派遣',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7008-8008-9c0d1e2f3a4b', 
    name: '高野', 
    position: 'Staff', 
    color: 'position-staff',
    status: '派遣',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-7009-8009-0d1e2f3a4b5c', 
    name: '安井', 
    position: 'Staff', 
    color: 'position-staff',
    status: '派遣',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  },
  { 
    id: '01934d2c-8a7b-700a-800a-1e2f3a4b5c6d', 
    name: '中田', 
    position: 'Manager', 
    color: 'position-manager',
    status: '社員',
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null
  }
];

// Staff position types
export const staffPositions = {
  HEAD_CHEF: 'Head Chef',
  SOUS_CHEF: 'Sous Chef',
  SERVER: 'Server', 
  STAFF: 'Staff',
  MANAGER: 'Manager'
};

// Staff status types
export const staffStatus = {
  EMPLOYEE: '社員',
  TEMP: '派遣'
};

// Position color mappings
export const positionColors = {
  'position-chef': '#8B4513',
  'position-sous-chef': '#CD853F', 
  'position-server': '#4169E1',
  'position-staff': '#32CD32',
  'position-manager': '#FF6347'
};