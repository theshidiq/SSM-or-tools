// Application version and metadata
export const APP_VERSION = "1.0.0";
export const APP_NAME = "シフト管理システム";
export const APP_NAME_EN = "Shift Management System";
export const APP_DESCRIPTION = "Japanese Restaurant Staff Scheduling System";

// Staff members configuration
export const STAFF_MEMBERS = [
  {
    id: "chef",
    name: "料理長",
    nameEn: "Head Chef",
    position: "chef",
    department: "kitchen",
    color: "red",
    priority: 1,
    maxConsecutiveDays: 6,
    restrictions: {
      unavailableDays: [], // 0 = Sunday, 1 = Monday, etc.
      maxHoursPerWeek: 40,
      preferredShifts: ["early", "normal"],
    },
  },
  {
    id: "iseki",
    name: "井関",
    nameEn: "Iseki",
    position: "chef",
    department: "kitchen",
    color: "red",
    priority: 2,
    maxConsecutiveDays: 6,
    restrictions: {
      unavailableDays: [0], // Not available on Sunday
      maxHoursPerWeek: 40,
      preferredShifts: ["normal"],
    },
  },
  {
    id: "yogi",
    name: "与儀",
    nameEn: "Yogi",
    position: "server",
    department: "front",
    color: "amber",
    priority: 3,
    maxConsecutiveDays: 5,
    restrictions: {
      unavailableDays: [],
      maxHoursPerWeek: 35,
      preferredShifts: ["normal", "early"],
    },
  },
  {
    id: "tanabe",
    name: "田辺",
    nameEn: "Tanabe",
    position: "server",
    department: "front",
    color: "amber",
    priority: 4,
    maxConsecutiveDays: 5,
    restrictions: {
      unavailableDays: [1], // Not available on Monday
      maxHoursPerWeek: 32,
      preferredShifts: ["normal"],
    },
  },
  {
    id: "koto",
    name: "古藤",
    nameEn: "Koto",
    position: "host",
    department: "front",
    color: "orange",
    priority: 5,
    maxConsecutiveDays: 5,
    restrictions: {
      unavailableDays: [],
      maxHoursPerWeek: 30,
      preferredShifts: ["normal", "early"],
    },
  },
  {
    id: "koike",
    name: "小池",
    nameEn: "Koike",
    position: "server",
    department: "front",
    color: "amber",
    priority: 6,
    maxConsecutiveDays: 5,
    restrictions: {
      unavailableDays: [0, 6], // Not available on weekends
      maxHoursPerWeek: 25,
      preferredShifts: ["early"],
    },
  },
  {
    id: "kishi",
    name: "岸",
    nameEn: "Kishi",
    position: "prep",
    department: "kitchen",
    color: "green",
    priority: 7,
    maxConsecutiveDays: 6,
    restrictions: {
      unavailableDays: [],
      maxHoursPerWeek: 40,
      preferredShifts: ["early", "normal"],
    },
  },
  {
    id: "kamal",
    name: "カマル",
    nameEn: "Kamal",
    position: "server",
    department: "front",
    color: "amber",
    priority: 8,
    maxConsecutiveDays: 5,
    restrictions: {
      unavailableDays: [5], // Not available on Friday
      maxHoursPerWeek: 30,
      preferredShifts: ["normal"],
    },
  },
  {
    id: "takano",
    name: "高野",
    nameEn: "Takano",
    position: "dishwasher",
    department: "kitchen",
    color: "blue",
    priority: 9,
    maxConsecutiveDays: 6,
    restrictions: {
      unavailableDays: [],
      maxHoursPerWeek: 35,
      preferredShifts: ["normal", "early"],
    },
  },
  {
    id: "yasui",
    name: "安井",
    nameEn: "Yasui",
    position: "prep",
    department: "kitchen",
    color: "green",
    priority: 10,
    maxConsecutiveDays: 5,
    restrictions: {
      unavailableDays: [0, 3], // Not available on Sunday and Wednesday
      maxHoursPerWeek: 30,
      preferredShifts: ["early"],
    },
  },
  {
    id: "nakata",
    name: "中田",
    nameEn: "Nakata",
    position: "manager",
    department: "management",
    color: "purple",
    priority: 11,
    maxConsecutiveDays: 6,
    restrictions: {
      unavailableDays: [],
      maxHoursPerWeek: 45,
      preferredShifts: ["normal", "early"],
    },
  },
];

// Position definitions with Japanese and English names
export const POSITIONS = {
  chef: {
    id: "chef",
    nameJa: "料理人",
    nameEn: "Chef",
    department: "kitchen",
    color: "red",
    priority: 1,
    requiredSkills: ["cooking", "knife_skills", "food_safety"],
    hourlyRate: 1500,
  },
  server: {
    id: "server",
    nameJa: "サーバー",
    nameEn: "Server",
    department: "front",
    color: "amber",
    priority: 2,
    requiredSkills: ["customer_service", "japanese", "pos_system"],
    hourlyRate: 1200,
  },
  host: {
    id: "host",
    nameJa: "ホスト",
    nameEn: "Host",
    department: "front",
    color: "orange",
    priority: 3,
    requiredSkills: ["customer_service", "japanese", "reservation_system"],
    hourlyRate: 1300,
  },
  prep: {
    id: "prep",
    nameJa: "仕込み",
    nameEn: "Prep Cook",
    department: "kitchen",
    color: "green",
    priority: 4,
    requiredSkills: ["food_prep", "knife_skills", "food_safety"],
    hourlyRate: 1100,
  },
  dishwasher: {
    id: "dishwasher",
    nameJa: "洗い場",
    nameEn: "Dishwasher",
    department: "kitchen",
    color: "blue",
    priority: 5,
    requiredSkills: ["cleaning", "organization"],
    hourlyRate: 1000,
  },
  manager: {
    id: "manager",
    nameJa: "マネージャー",
    nameEn: "Manager",
    department: "management",
    color: "purple",
    priority: 0,
    requiredSkills: ["leadership", "japanese", "excel", "scheduling"],
    hourlyRate: 1800,
  },
};

// Department definitions
export const DEPARTMENTS = {
  kitchen: {
    id: "kitchen",
    nameJa: "キッチン",
    nameEn: "Kitchen",
    color: "red",
    minStaffPerShift: 2,
    maxStaffPerShift: 4,
  },
  front: {
    id: "front",
    nameJa: "フロント",
    nameEn: "Front of House",
    color: "amber",
    minStaffPerShift: 2,
    maxStaffPerShift: 5,
  },
  management: {
    id: "management",
    nameJa: "管理",
    nameEn: "Management",
    color: "purple",
    minStaffPerShift: 1,
    maxStaffPerShift: 2,
  },
};

// Shift symbols and their meanings
export const SHIFT_SYMBOLS = {
  early: {
    symbol: "△",
    label: "Early Shift",
    labelJa: "早番",
    time: "10:00-18:00",
    duration: 8,
    breakTime: 60,
    color: "amber",
    priority: 1,
  },
  normal: {
    symbol: "○",
    label: "Normal Shift",
    labelJa: "通常番",
    time: "11:00-20:00",
    duration: 9,
    breakTime: 60,
    color: "green",
    priority: 2,
  },
  late: {
    symbol: "◇",
    label: "Late Shift",
    labelJa: "遅番",
    time: "15:00-23:00",
    duration: 8,
    breakTime: 60,
    color: "purple",
    priority: 3,
  },
  off: {
    symbol: "×",
    label: "Off",
    labelJa: "休み",
    time: "Rest Day",
    duration: 0,
    breakTime: 0,
    color: "gray",
    priority: 0,
  },
  holiday: {
    symbol: "祝",
    label: "Holiday",
    labelJa: "祝日",
    time: "Public Holiday",
    duration: 0,
    breakTime: 0,
    color: "red",
    priority: 0,
  },
  sick: {
    symbol: "病",
    label: "Sick Leave",
    labelJa: "病欠",
    time: "Sick Day",
    duration: 0,
    breakTime: 0,
    color: "yellow",
    priority: 0,
  },
  vacation: {
    symbol: "休",
    label: "Vacation",
    labelJa: "有休",
    time: "Paid Leave",
    duration: 0,
    breakTime: 0,
    color: "blue",
    priority: 0,
  },
};

// Day names in Japanese and English
export const DAY_NAMES = {
  ja: {
    full: [
      "日曜日",
      "月曜日",
      "火曜日",
      "水曜日",
      "木曜日",
      "金曜日",
      "土曜日",
    ],
    short: ["日", "月", "火", "水", "木", "金", "土"],
    abbreviated: ["日", "月", "火", "水", "木", "金", "土"],
  },
  en: {
    full: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    abbreviated: ["S", "M", "T", "W", "T", "F", "S"],
  },
};

// Month names in Japanese and English
export const MONTH_NAMES = {
  ja: {
    full: [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
    ],
    short: [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
    ],
  },
  en: {
    full: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    short: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
  },
};

// Date ranges and periods
export const DATE_RANGES = {
  current: {
    start: new Date(2024, 6, 21), // July 21, 2024
    end: new Date(2024, 7, 20), // August 20, 2024
    days: 31,
  },
  previous: {
    start: new Date(2024, 5, 21), // June 21, 2024
    end: new Date(2024, 6, 20), // July 20, 2024
    days: 30,
  },
  next: {
    start: new Date(2024, 7, 21), // August 21, 2024
    end: new Date(2024, 8, 20), // September 20, 2024
    days: 31,
  },
};

// Japanese holidays for 2024
export const JAPANESE_HOLIDAYS = {
  "2024-01-01": { name: "元旦", nameEn: "New Year's Day" },
  "2024-01-08": { name: "成人の日", nameEn: "Coming of Age Day" },
  "2024-02-11": { name: "建国記念の日", nameEn: "National Foundation Day" },
  "2024-02-12": {
    name: "建国記念の日 振替休日",
    nameEn: "National Foundation Day (Observed)",
  },
  "2024-02-23": { name: "天皇誕生日", nameEn: "Emperor's Birthday" },
  "2024-03-20": { name: "春分の日", nameEn: "Vernal Equinox Day" },
  "2024-04-29": { name: "昭和の日", nameEn: "Showa Day" },
  "2024-05-03": { name: "憲法記念日", nameEn: "Constitution Memorial Day" },
  "2024-05-04": { name: "みどりの日", nameEn: "Greenery Day" },
  "2024-05-05": { name: "こどもの日", nameEn: "Children's Day" },
  "2024-05-06": {
    name: "みどりの日 振替休日",
    nameEn: "Greenery Day (Observed)",
  },
  "2024-07-15": { name: "海の日", nameEn: "Marine Day" },
  "2024-08-11": { name: "山の日", nameEn: "Mountain Day" },
  "2024-08-12": { name: "山の日 振替休日", nameEn: "Mountain Day (Observed)" },
  "2024-09-16": { name: "敬老の日", nameEn: "Respect for the Aged Day" },
  "2024-09-22": { name: "秋分の日", nameEn: "Autumnal Equinox Day" },
  "2024-09-23": {
    name: "秋分の日 振替休日",
    nameEn: "Autumnal Equinox Day (Observed)",
  },
  "2024-10-14": { name: "スポーツの日", nameEn: "Sports Day" },
  "2024-11-03": { name: "文化の日", nameEn: "Culture Day" },
  "2024-11-04": { name: "文化の日 振替休日", nameEn: "Culture Day (Observed)" },
  "2024-11-23": { name: "勤労感謝の日", nameEn: "Labor Thanksgiving Day" },
  "2024-12-31": { name: "大晦日", nameEn: "New Year's Eve" },
};

// Export formats and their configurations
export const EXPORT_FORMATS = {
  csv: {
    id: "csv",
    name: "CSV",
    nameJa: "CSV形式",
    extension: "csv",
    mimeType: "text/csv",
    separator: ",",
    description:
      "Comma-separated values for Excel and other spreadsheet applications",
    descriptionJa: "Excelやスプレッドシートアプリケーション用のCSV形式",
    icon: "FileText",
    useFor: ["excel", "numbers", "calc"],
  },
  tsv: {
    id: "tsv",
    name: "TSV",
    nameJa: "TSV形式",
    extension: "tsv",
    mimeType: "text/tab-separated-values",
    separator: "\t",
    description: "Tab-separated values optimized for Google Sheets",
    descriptionJa: "Googleスプレッドシート用に最適化されたタブ区切り形式",
    icon: "Table",
    useFor: ["google_sheets"],
  },
  json: {
    id: "json",
    name: "JSON",
    nameJa: "JSON形式",
    extension: "json",
    mimeType: "application/json",
    separator: null,
    description: "JavaScript Object Notation for API integration",
    descriptionJa: "API統合用のJavaScript Object Notation",
    icon: "Code",
    useFor: ["api", "backup", "integration"],
  },
  pdf: {
    id: "pdf",
    name: "PDF",
    nameJa: "PDF形式",
    extension: "pdf",
    mimeType: "application/pdf",
    separator: null,
    description: "Portable Document Format for printing",
    descriptionJa: "印刷用のPortable Document Format",
    icon: "Printer",
    useFor: ["print", "archive", "distribution"],
  },
};

// API endpoints and configuration
export const API_ENDPOINTS = {
  base: process.env.REACT_APP_API_BASE_URL || "http://localhost:3001",

  // Google Apps Script Web App
  googleAppsScript: {
    webAppUrl: process.env.REACT_APP_GOOGLE_WEBAPP_URL || "",
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  // Local API endpoints
  schedule: {
    get: "/api/schedule",
    post: "/api/schedule",
    put: "/api/schedule",
    delete: "/api/schedule",
  },

  staff: {
    get: "/api/staff",
    post: "/api/staff",
    put: "/api/staff/:id",
    delete: "/api/staff/:id",
  },

  export: {
    csv: "/api/export/csv",
    tsv: "/api/export/tsv",
    pdf: "/api/export/pdf",
    json: "/api/export/json",
  },

  import: {
    csv: "/api/import/csv",
    tsv: "/api/import/tsv",
    json: "/api/import/json",
  },

  // External integrations
  integrations: {
    googleSheets: "/api/integrations/google-sheets",
    slack: "/api/integrations/slack",
    email: "/api/integrations/email",
  },
};

// Application settings and preferences
export const APP_SETTINGS = {
  defaultLanguage: "ja",
  supportedLanguages: ["ja", "en"],

  // Theme configuration
  theme: {
    primary: "red",
    secondary: "amber",
    accent: "orange",
    success: "green",
    warning: "yellow",
    error: "red",
    info: "blue",
  },

  // Schedule display settings
  schedule: {
    defaultView: "week",
    showWeekends: true,
    highlightHolidays: true,
    showPositions: true,
    compactMode: false,
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
  },

  // Export settings
  export: {
    defaultFormat: "tsv",
    includeMetadata: true,
    includeStatistics: true,
    dateFormat: "M/d",
    filenamePrefix: "shift-schedule",
  },

  // Validation rules
  validation: {
    maxConsecutiveDays: 6,
    maxHoursPerWeek: 40,
    minRestBetweenShifts: 8, // hours
    maxStaffPerShift: 10,
    minStaffPerShift: 1,
  },
};

// Error messages
export const ERROR_MESSAGES = {
  ja: {
    CONNECTION_FAILED: "接続に失敗しました",
    INVALID_DATA: "無効なデータです",
    SAVE_FAILED: "保存に失敗しました",
    LOAD_FAILED: "読み込みに失敗しました",
    EXPORT_FAILED: "エクスポートに失敗しました",
    IMPORT_FAILED: "インポートに失敗しました",
    VALIDATION_ERROR: "検証エラー",
    NETWORK_ERROR: "ネットワークエラー",
    PERMISSION_DENIED: "権限が拒否されました",
    NOT_FOUND: "見つかりません",
    TIMEOUT: "タイムアウト",
    UNKNOWN_ERROR: "不明なエラー",
  },
  en: {
    CONNECTION_FAILED: "Connection failed",
    INVALID_DATA: "Invalid data",
    SAVE_FAILED: "Save failed",
    LOAD_FAILED: "Load failed",
    EXPORT_FAILED: "Export failed",
    IMPORT_FAILED: "Import failed",
    VALIDATION_ERROR: "Validation error",
    NETWORK_ERROR: "Network error",
    PERMISSION_DENIED: "Permission denied",
    NOT_FOUND: "Not found",
    TIMEOUT: "Timeout",
    UNKNOWN_ERROR: "Unknown error",
  },
};

// Success messages
export const SUCCESS_MESSAGES = {
  ja: {
    SAVED: "保存されました",
    LOADED: "読み込まれました",
    EXPORTED: "エクスポートされました",
    IMPORTED: "インポートされました",
    COPIED: "コピーされました",
    SYNCED: "同期されました",
    DELETED: "削除されました",
    UPDATED: "更新されました",
    CONNECTED: "接続されました",
  },
  en: {
    SAVED: "Saved successfully",
    LOADED: "Loaded successfully",
    EXPORTED: "Exported successfully",
    IMPORTED: "Imported successfully",
    COPIED: "Copied to clipboard",
    SYNCED: "Synced successfully",
    DELETED: "Deleted successfully",
    UPDATED: "Updated successfully",
    CONNECTED: "Connected successfully",
  },
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  // Navigation
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",

  // Editing
  ENTER: "Enter",
  ESCAPE: "Escape",
  SPACE: " ",

  // Shift quick keys
  EARLY_SHIFT: ["1", "e", "E"],
  NORMAL_SHIFT: ["2", "n", "N"],
  LATE_SHIFT: ["3", "l", "L"],
  OFF_DAY: ["0", "o", "O", "x", "X"],

  // System shortcuts
  SAVE: "Ctrl+S",
  COPY: "Ctrl+C",
  PASTE: "Ctrl+V",
  UNDO: "Ctrl+Z",
  REDO: "Ctrl+Y",

  // Application shortcuts
  EXPORT: "Ctrl+E",
  IMPORT: "Ctrl+I",
  SETTINGS: "Ctrl+,",
  HELP: "F1",
};

// Local storage keys
export const STORAGE_KEYS = {
  SCHEDULE_DATA: "shift_schedule_data",
  STAFF_DATA: "shift_staff_data",
  SETTINGS: "shift_settings",
  LAST_SYNC: "shift_last_sync",
  GOOGLE_SHEETS_CONFIG: "shift_google_config",
  BACKUP_DATA: "shift_backup_data",
  USER_PREFERENCES: "shift_user_preferences",
};

// Default export containing all constants
export default {
  APP_VERSION,
  APP_NAME,
  APP_NAME_EN,
  APP_DESCRIPTION,
  STAFF_MEMBERS,
  POSITIONS,
  DEPARTMENTS,
  SHIFT_SYMBOLS,
  DAY_NAMES,
  MONTH_NAMES,
  DATE_RANGES,
  JAPANESE_HOLIDAYS,
  EXPORT_FORMATS,
  API_ENDPOINTS,
  APP_SETTINGS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  KEYBOARD_SHORTCUTS,
  STORAGE_KEYS,
};
