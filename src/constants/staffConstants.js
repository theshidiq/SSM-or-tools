// Default staff members configuration - Updated from database record e441d551-f393-4d01-903c-1341757300a6
export const defaultStaffMembersArray = [
  {
    id: "01934d2c-8a7b-7d34-88b6-efbc1589baef",
    name: "料理長",
    position: "Head Chef",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2021, month: 1, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-738f-8717-d27e2345b63e",
    name: "井関",
    position: "Sous Chef",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2021, month: 1, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-7cfb-8e11-c2b2373ce903",
    name: "与儀",
    position: "Choushoku",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2021, month: 1, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-7ee1-82d1-94e2cc524843",
    name: "田辺",
    position: "Shashimi",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2021, month: 1, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-784e-8e78-af02ddb8c4a9",
    name: "古藤",
    position: "Nikata",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2018, month: 4, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-71b5-82bd-71fb67ea5915",
    name: "小池",
    position: "Shasimi",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2021, month: 1, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-701b-8422-b928bbdc20c",
    name: "岸",
    position: "Zensai",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2021, month: 1, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-780a-8933-895ff3468d0a",
    name: "カマル",
    position: "Choushoku",
    color: "position-server",
    status: "社員",
    startPeriod: { year: 2024, month: 11, day: 1 },
    endPeriod: null,
  },
  {
    id: "01934d2c-8a7b-76ca-8100-a1183e709ad7",
    name: "金子",
    position: "Prep",
    color: "position-server",
    status: "派遣",
    startPeriod: { year: 2025, month: 1, day: 1 },
    endPeriod: { year: 2025, month: 4, day: 6 },
  },
  {
    id: "01934d2c-8a7b-7fe7-8135-783adf94f4cb",
    name: "遠藤",
    position: "Prep",
    color: "position-server",
    status: "派遣",
    startPeriod: { year: 2025, month: 1, day: 29 },
    endPeriod: { year: 2025, month: 4, day: 6 },
  },
  {
    id: "01934d2c-8a7b-7898-812b-883de12aaccf",
    name: "中田",
    position: "Cook",
    color: "position-server",
    status: "パート",
    startPeriod: { year: 2021, month: 1, day: 1 },
    endPeriod: null,
  },
];

// Staff position types
export const staffPositions = {
  HEAD_CHEF: "Head Chef",
  SOUS_CHEF: "Sous Chef",
  SERVER: "Server",
  STAFF: "Staff",
  MANAGER: "Manager",
};

// Staff status types
export const staffStatus = {
  EMPLOYEE: "社員",
  TEMP: "派遣",
};

// Position color mappings
export const positionColors = {
  "position-chef": "#8B4513",
  "position-sous-chef": "#CD853F",
  "position-server": "#4169E1",
  "position-staff": "#32CD32",
  "position-manager": "#FF6347",
};
