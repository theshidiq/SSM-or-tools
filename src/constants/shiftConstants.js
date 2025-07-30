// Shift symbols and their properties
export const shiftSymbols = {
  early: { symbol: "△", label: "Early Shift", color: "text-blue-600" },
  normal: { symbol: "", label: "Normal Shift", color: "text-gray-600" },
  late: { symbol: "◇", label: "Late Shift", color: "text-purple-600" },
  special: { symbol: "●", label: "Special Shift", color: "text-green-600" },
  medamayaki: { symbol: "◎", label: "目玉焼き", color: "text-orange-600" },
  zensai: { symbol: "▣", label: "前菜", color: "text-teal-600" },
  off: { symbol: "×", label: "Day Off", color: "text-red-600" },
  holiday: {
    symbol: "★",
    label: "Designated Holiday",
    color: "text-yellow-600",
  },
  unavailable: { symbol: "⊘", label: "Unavailable", color: "text-red-800" },
};

// Staff status types
export const staffStatus = {
  EMPLOYEE: "社員",
  TEMP: "派遣",
  PART_TIME: "パート",
};

// Shift access rules based on staff status
export const getAvailableShifts = (status) => {
  // Ensure status is valid
  if (!status) status = "派遣";

  if (status === "社員") {
    // 社員 staff get late shift + new options (目玉焼き, 前菜)
    return [
      "normal",
      "off",
      "early",
      "late",
      "medamayaki",
      "zensai",
      "holiday",
    ];
  } else if (status === "パート") {
    // パート staff get special limited options: unavailable, normal (circle), cross
    return ["unavailable", "normal", "off"];
  } else {
    // 派遣 staff get standard options (no late shift, no special symbols)
    return ["normal", "off", "early", "holiday"];
  }
};

// Alternative function for specific staff member checks (if needed later)
export const getAvailableShiftsForStaff = (staffName, staffMembers) => {
  // Special cases for specific staff members
  if (staffName === "松田" || staffName === "宮地") {
    return ["normal", "off", "early", "unavailable"];
  }

  // For other staff, check if they are 社員 to show late shift option
  if (!Array.isArray(staffMembers)) {
    return getAvailableShifts("派遣"); // fallback
  }

  const staff = staffMembers.find((s) => s.name === staffName);
  const status = staff?.status || "派遣";

  return getAvailableShifts(status);
};

// Month periods for scheduling
export const monthPeriods = [
  {
    name: "3月 (March)",
    start: new Date(2024, 2, 25),
    end: new Date(2024, 3, 24),
  },
  {
    name: "4月 (April)",
    start: new Date(2024, 3, 25),
    end: new Date(2024, 4, 24),
  },
  {
    name: "5月 (May)",
    start: new Date(2024, 4, 25),
    end: new Date(2024, 5, 24),
  },
  {
    name: "6月 (June)",
    start: new Date(2024, 5, 25),
    end: new Date(2024, 6, 24),
  },
  {
    name: "7月 (July)",
    start: new Date(2024, 6, 25),
    end: new Date(2024, 7, 24),
  },
  {
    name: "8月 (August)",
    start: new Date(2024, 7, 25),
    end: new Date(2024, 8, 24),
  },
  {
    name: "9月 (September)",
    start: new Date(2024, 8, 25),
    end: new Date(2024, 9, 24),
  },
  {
    name: "10月 (October)",
    start: new Date(2024, 9, 25),
    end: new Date(2024, 10, 24),
  },
  {
    name: "11月 (November)",
    start: new Date(2024, 10, 25),
    end: new Date(2024, 11, 24),
  },
  {
    name: "12月 (December)",
    start: new Date(2024, 11, 25),
    end: new Date(2025, 0, 24),
  },
  {
    name: "1月 (January)",
    start: new Date(2025, 0, 25),
    end: new Date(2025, 1, 24),
  },
  {
    name: "2月 (February)",
    start: new Date(2025, 1, 25),
    end: new Date(2025, 2, 24),
  },
];
