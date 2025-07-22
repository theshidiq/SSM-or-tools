# 🍣 Shift Schedule Manager

A comprehensive React application for managing shift schedules specifically designed for Japanese restaurants. Features interactive table editing, multiple export formats, Google Sheets integration, and mobile-responsive design.

## 📋 Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Google Sheets Integration](#google-sheets-integration)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### Core Functionality
- **Interactive Schedule Table** - Click-to-edit cells with keyboard navigation
- **11 Japanese Staff Members** - Pre-configured with authentic Japanese names and positions
- **Shift Symbols** - △ (early), ○ (normal), ▽ (late), × (off)
- **Date Range Management** - July 21 - August 20 with Japanese date formatting
- **Real-time Auto-save** - Automatic localStorage persistence

### Export & Integration
- **Multiple Export Formats** - CSV, TSV, PDF with custom formatting
- **Google Sheets Integration** - Bi-directional sync with Google Apps Script
- **Clipboard Operations** - Quick copy for external applications
- **Bulk Operations** - Multi-select and batch editing

### Advanced Features
- **Mobile Responsive** - Touch-friendly interface with responsive design
- **Statistics Dashboard** - Comprehensive analytics and reporting
- **Error Handling** - Robust error boundaries with retry mechanisms
- **Performance Optimization** - Memoization, debouncing, and virtual scrolling
- **Accessibility** - Full ARIA support and keyboard navigation

### User Experience
- **Japanese Localization** - Native Japanese interface and date formatting
- **Connection Status** - Real-time Google Sheets connection monitoring
- **Setup Wizard** - Guided Google Apps Script configuration
- **Dark Mode Support** - Automatic theme detection

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/shift-schedule-manager.git

# Navigate to project directory
cd shift-schedule-manager

# Install dependencies
npm install

# Start development server
npm start
```

The application will open at `http://localhost:3000`.

## 📦 Installation

### Prerequisites

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0 or **yarn** >= 1.22.0
- Modern web browser with ES2020 support

### Dependencies

```bash
# Core dependencies
npm install react react-dom typescript
npm install date-fns lucide-react tailwindcss
npm install file-saver xlsx react-error-boundary

# Development dependencies
npm install --save-dev @testing-library/react jest eslint prettier
```

### Browser Support

- Chrome >= 88
- Firefox >= 85
- Safari >= 14
- Edge >= 88

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application Configuration
REACT_APP_NAME=Shift Schedule Manager
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=development

# Google Sheets Integration
REACT_APP_GOOGLE_SHEETS_API_KEY=your_api_key_here
REACT_APP_GOOGLE_APPS_SCRIPT_URL=your_script_url_here

# Performance Monitoring
REACT_APP_ENABLE_PERFORMANCE_MONITORING=true
REACT_APP_ENABLE_ERROR_REPORTING=true

# Feature Flags
REACT_APP_ENABLE_DARK_MODE=true
REACT_APP_ENABLE_STATISTICS=true
REACT_APP_ENABLE_EXPORT_PDF=true
```

### Application Settings

Customize the application in `src/utils/constants.js`:

```javascript
// Staff configuration
export const STAFF_MEMBERS = [
  { id: 'chef', name: '料理長', position: 'Head Chef', department: 'kitchen' },
  { id: 'iseki', name: '井関', position: 'Cook', department: 'kitchen' },
  // ... add your staff members
];

// Date range configuration
export const DATE_RANGES = {
  current: {
    start: new Date('2024-07-21'),
    end: new Date('2024-08-20')
  }
};

// Shift symbols
export const SHIFT_SYMBOLS = {
  early: { symbol: '△', label: 'Early', labelJa: '早番' },
  normal: { symbol: '○', label: 'Normal', labelJa: '通常' },
  late: { symbol: '▽', label: 'Late', labelJa: '遅番' },
  off: { symbol: '×', label: 'Off', labelJa: '休み' }
};
```

## 📊 Google Sheets Integration

### Setup Process

1. **Create Google Spreadsheet**
   - Open [Google Sheets](https://sheets.google.com)
   - Create a new spreadsheet named "シフト管理"
   - Note the spreadsheet ID from the URL

2. **Configure Google Apps Script**
   - In your spreadsheet: Extensions → Apps Script
   - Replace default code with the generated script from the export menu
   - Save the project

3. **Deploy as Web App**
   - Click "Deploy" → "New deployment"
   - Type: Web app
   - Execute as: Me
   - Access: Anyone
   - Copy the Web App URL

4. **Configure Application**
   - Go to Settings tab in the application
   - Enter the Web App URL and Spreadsheet ID
   - Test the connection

### Apps Script Code Template

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID').getActiveSheet();
    
    // Clear existing data
    sheet.clear();
    
    // Write headers
    const headers = ['Staff', ...data.dates];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Write schedule data
    data.staff.forEach((staff, index) => {
      const row = [staff.name, ...data.dates.map(date => 
        data.schedule[staff.id]?.[date] || ''
      )];
      sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID').getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        data: data 
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 📖 Usage Guide

### Basic Operations

#### Editing Shifts
1. Click on any cell in the schedule table
2. Use keyboard arrows to navigate between cells
3. Press Enter or Space to cycle through shift types
4. Changes are automatically saved

#### Bulk Editing
1. Click "複数選択" (Multi-select) button
2. Click cells to select multiple shifts
3. Choose shift type from dropdown
4. Click "適用" (Apply) to update all selected cells

#### Exporting Data
1. Click "エクスポート" (Export) button
2. Choose format:
   - **CSV** - Download file for Excel/Numbers
   - **TSV** - Copy to clipboard for Google Sheets
   - **PDF** - Generate printable document
   - **Google Sheets** - Direct sync to configured spreadsheet

### Advanced Features

#### Statistics View
- View shift distribution by staff member
- Analyze work patterns and coverage
- Export statistical reports
- Visual charts and progress bars

#### Mobile Usage
- Touch-friendly buttons (minimum 44px touch targets)
- Horizontal table scrolling
- Responsive navigation menu
- Optimized for portrait and landscape modes

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Arrow Keys` | Navigate between cells |
| `Enter` | Edit selected cell |
| `Space` | Cycle shift type |
| `Tab` | Move to next cell |
| `Shift + Tab` | Move to previous cell |
| `Esc` | Cancel editing |
| `Ctrl/Cmd + S` | Force save |
| `Ctrl/Cmd + E` | Open export menu |

## 🔧 API Reference

### Core Components

#### ShiftScheduleEditor
```jsx
<ShiftScheduleEditor
  staffMembers={staffMembers}
  dateRange={dateRange}
  schedule={schedule}
  shiftSymbols={shiftSymbols}
  onScheduleChange={(staffId, date, shift) => {}}
  onStaffUpdate={(updatedStaff) => {}}
/>
```

#### ScheduleTable
```jsx
<ScheduleTable
  staffMembers={staffMembers}
  dateRange={dateRange}
  schedule={schedule}
  onScheduleChange={handleChange}
  highlightWeekends={true}
  showPositions={true}
/>
```

#### ExportOptions
```jsx
<ExportOptions
  staffMembers={staffMembers}
  dateRange={dateRange}
  schedule={schedule}
  shiftSymbols={shiftSymbols}
  onExportComplete={(format, result) => {}}
  googleSheetsUrl={webAppUrl}
/>
```

## 🔍 Troubleshooting

### Common Issues

#### Installation Problems

**Error: "Module not found"**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Error: "React Scripts not found"**
```bash
# Install React Scripts explicitly
npm install react-scripts@latest
```

#### Google Sheets Integration

**Error: "Access denied"**
- Verify Apps Script deployment permissions
- Check Web App access settings ("Anyone" permission required)
- Ensure correct Spreadsheet ID

**Error: "Script timeout"**
- Increase timeout in advanced settings
- Check spreadsheet size (recommended < 1000 rows)
- Verify internet connection stability

**Error: "Invalid data format"**
- Check Apps Script code matches template
- Verify spreadsheet structure
- Test with smaller dataset first

#### Performance Issues

**Slow rendering with large datasets**
```javascript
// Enable virtual scrolling
import { useVirtualScroll } from './utils/performance';

const { visibleItems } = useVirtualScroll(
  largeStaffList, 
  containerHeight, 
  itemHeight
);
```

### Browser-Specific Issues

#### Safari
- Enable "Prevent cross-site tracking" exception for Google Sheets
- Allow clipboard access for export features

#### Firefox
- Enable localStorage in private browsing
- Allow popup windows for file downloads

#### Mobile Browsers
- Ensure minimum 16px font size to prevent zoom
- Test touch targets are minimum 44px
- Verify horizontal scroll works on tables

## 🚢 Deployment

### Production Build

```bash
# Create optimized production build
npm run build

# Analyze bundle size
npm run build:analyze

# Test production build locally
npm run serve
```

### Deployment Platforms

#### Netlify
```bash
# Deploy to Netlify
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=build
```

#### Vercel
```bash
# Deploy to Vercel
npm install -g vercel
npm run build
vercel --prod
```

#### GitHub Pages
```bash
# Deploy to GitHub Pages
npm install -g gh-pages
npm run deploy
```

## 👨‍💻 Development

### Development Setup

```bash
# Install development dependencies
npm install

# Start development server with hot reload
npm run dev

# Run tests in watch mode
npm run test:watch

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Format code
npm run format
```

### Project Structure

```
src/
├── components/           # React components
│   ├── ShiftScheduleEditor.jsx
│   ├── ScheduleTable.jsx
│   ├── ExportOptions.jsx
│   ├── ConnectionStatus.jsx
│   ├── Statistics.jsx
│   ├── SetupPanel.jsx
│   └── __tests__/       # Component tests
├── hooks/               # Custom React hooks
│   └── useGoogleSheets.js
├── utils/               # Utility functions
│   ├── constants.js     # Application constants
│   ├── exportHelpers.js # Export utilities
│   ├── errorHandling.js # Error management
│   └── performance.js   # Performance utilities
├── styles/              # CSS and styling
│   ├── index.css
│   └── responsive.css   # Mobile responsive styles
├── App.js              # Main application component
└── index.js            # Application entry point
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Getting Started
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team** - For the amazing React framework
- **Tailwind CSS** - For the utility-first CSS framework
- **Lucide React** - For the beautiful icon library
- **Date-fns** - For comprehensive date utilities
- **Google Apps Script** - For seamless spreadsheet integration

## 📞 Support

- **Documentation**: [Wiki](https://github.com/your-username/shift-schedule-manager/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/shift-schedule-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/shift-schedule-manager/discussions)
- **Email**: support@your-domain.com

---

Made with ❤️ for Japanese restaurant management