/**
 * ScheduleParser - Converts OCR results to schedule data structure
 * Maps detected text and symbols to staff schedules
 */

import { format, parse, isValid } from 'date-fns';
import { ja } from 'date-fns/locale';

class ScheduleParser {
  constructor() {
    // Mapping for shift symbols
    this.shiftSymbolMap = {
      '△': '△',     // Early shift - triangle
      '○': '',      // Normal shift - show as blank (default for regular staff)
      '▽': 'late',  // Late shift - inverted triangle (stored as 'late')
      '×': '×',     // Day off - cross
      'X': '×',     // Day off - X
      'x': '×'      // Day off - lowercase x
    };

    // Common Japanese name patterns for staff recognition
    this.staffNamePatterns = [
      /^[ぁ-んァ-ヶー々〇〻\u3400-\u9FFF]+$/,  // Japanese characters
      /^[a-zA-Zぁ-んァ-ヶー々〇〻\u3400-\u9FFF\s]+$/  // Mixed Japanese/English
    ];

    // Date patterns (Japanese format)
    this.datePatterns = [
      /(\d{1,2})[月](\d{1,2})[日]/,     // 1月2日
      /(\d{1,2})[月](\d{1,2})/,         // 1月2
      /(\d{1,2})\/(\d{1,2})/,           // 1/2
      /(\d{1,2})-(\d{1,2})/,            // 1-2
      /(\d{1,2})\.(\d{1,2})/,           // 1.2
      /(\d{1,2})\s+(\d{1,2})/,          // 1 2 (space separated)
      /(\d{1,2})_(\d{1,2})/             // 1_2 (underscore)
    ];
  }

  /**
   * Parse OCR results into schedule data structure
   * @param {Object} ocrResults - Results from ImageProcessor
   * @param {Array} existingStaff - Current staff members
   * @param {Array} dateRange - Current period date range
   * @returns {Object} Parsed schedule data and staff
   */
  parseScheduleData(ocrResults, existingStaff = [], dateRange = []) {
    try {
      console.log('🔍 OCR Results for parsing:', ocrResults);
      const { tableStructure, shiftSymbols, detectedTexts, fullText } = ocrResults;
      
      console.log('📋 Detected texts:', detectedTexts);
      console.log('🔶 Shift symbols:', shiftSymbols);
      console.log('📊 Table structure:', tableStructure);
      console.log('📝 Full text:', fullText);
      
      // Extract staff names and dates from table structure
      const staffNames = this.extractStaffNames(tableStructure, detectedTexts);
      console.log('👥 Extracted staff names:', staffNames);
      
      const dates = this.extractDates(tableStructure, detectedTexts, dateRange);
      console.log('📅 Extracted dates:', dates);
      
      // Map staff names to existing staff or create new ones
      const mappedStaff = this.mapStaffMembers(staffNames, existingStaff);
      console.log('🗺️ Mapped staff:', mappedStaff);
      
      // Parse shift assignments
      const scheduleData = this.parseShiftAssignments(
        tableStructure, 
        shiftSymbols, 
        mappedStaff, 
        dates
      );
      console.log('📋 Schedule data:', scheduleData);

      const result = {
        staff: mappedStaff,
        schedule: scheduleData,
        dates: dates,
        confidence: ocrResults.confidence,
        warnings: this.generateWarnings(mappedStaff, dates, scheduleData)
      };
      
      console.log('✅ Final parsing result:', result);
      return result;

    } catch (error) {
      console.error('❌ Schedule parsing failed:', error);
      throw new Error(`Failed to parse schedule: ${error.message}`);
    }
  }

  /**
   * Extract staff names from table structure
   * @param {Object} tableStructure - Detected table structure
   * @param {Array} detectedTexts - All detected text elements
   * @returns {Array} Array of detected staff names
   */
  extractStaffNames(tableStructure, detectedTexts) {
    const staffNames = [];
    const { rows, cells } = tableStructure;

    if (rows.length === 0) {
      // Fallback: try to find names in all detected texts
      return this.findStaffNamesInText(detectedTexts);
    }

    // Assume first column contains staff names (skip header row if exists)
    const startRow = this.detectHeaderRow(rows) ? 1 : 0;
    
    for (let rowIndex = startRow; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (row.length > 0) {
        const firstCell = row[0];
        if (firstCell && this.isStaffName(firstCell.text)) {
          staffNames.push({
            name: firstCell.text.trim(),
            confidence: firstCell.confidence || 0.8,
            position: { row: rowIndex, col: 0 }
          });
        }
      }
    }

    return staffNames;
  }

  /**
   * Extract dates from table structure
   * @param {Object} tableStructure - Detected table structure
   * @param {Array} detectedTexts - All detected text elements
   * @param {Array} dateRange - Expected date range
   * @returns {Array} Array of detected dates
   */
  extractDates(tableStructure, detectedTexts, dateRange) {
    const dates = [];
    const { rows } = tableStructure;

    if (rows.length === 0) {
      return this.findDatesInText(detectedTexts, dateRange);
    }

    // Assume first row contains dates (skip first column if it contains row headers)
    const headerRow = rows[0];
    const startCol = this.detectRowHeaderColumn(headerRow) ? 1 : 0;

    for (let colIndex = startCol; colIndex < headerRow.length; colIndex++) {
      const cell = headerRow[colIndex];
      if (cell) {
        const dateInfo = this.parseDate(cell.text, dateRange);
        if (dateInfo) {
          dates.push({
            ...dateInfo,
            confidence: cell.confidence || 0.8,
            position: { row: 0, col: colIndex }
          });
        }
      }
    }

    return dates;
  }

  /**
   * Map detected staff names to existing staff or create new ones
   * @param {Array} detectedStaffNames - Names detected from OCR
   * @param {Array} existingStaff - Current staff members
   * @returns {Array} Mapped staff members with IDs
   */
  mapStaffMembers(detectedStaffNames, existingStaff) {
    const mappedStaff = [];

    detectedStaffNames.forEach((detectedStaff, index) => {
      // Try to find exact match first
      let existingMatch = existingStaff.find(staff => 
        staff.name === detectedStaff.name
      );

      // Try fuzzy matching if no exact match
      if (!existingMatch) {
        existingMatch = existingStaff.find(staff => 
          this.calculateSimilarity(staff.name, detectedStaff.name) > 0.8
        );
      }

      if (existingMatch) {
        // Map to existing staff member
        mappedStaff.push({
          ...existingMatch,
          detectedName: detectedStaff.name,
          confidence: detectedStaff.confidence,
          isExisting: true
        });
      } else {
        // Create new staff member
        mappedStaff.push({
          id: `import-staff-${Date.now()}-${index}`,
          name: detectedStaff.name,
          position: 'スタッフ',
          status: '社員',
          detectedName: detectedStaff.name,
          confidence: detectedStaff.confidence,
          isExisting: false,
          isNew: true
        });
      }
    });

    return mappedStaff;
  }

  /**
   * Parse shift assignments from table structure
   * @param {Object} tableStructure - Detected table structure
   * @param {Array} shiftSymbols - Detected shift symbols
   * @param {Array} mappedStaff - Mapped staff members
   * @param {Array} dates - Detected dates
   * @returns {Object} Schedule data structure
   */
  parseShiftAssignments(tableStructure, shiftSymbols, mappedStaff, dates) {
    const scheduleData = {};
    const { cells } = tableStructure;

    // Initialize schedule for all staff
    mappedStaff.forEach(staff => {
      scheduleData[staff.id] = {};
    });

    if (!cells || cells.length === 0) {
      return scheduleData;
    }

    // Skip header row and column
    const startRow = 1;
    const startCol = 1;

    for (let rowIndex = startRow; rowIndex < cells.length; rowIndex++) {
      const staffIndex = rowIndex - startRow;
      if (staffIndex >= mappedStaff.length) continue;

      const staff = mappedStaff[staffIndex];
      const row = cells[rowIndex];

      for (let colIndex = startCol; colIndex < row.length; colIndex++) {
        const dateIndex = colIndex - startCol;
        if (dateIndex >= dates.length) continue;

        const cell = row[colIndex];
        const date = dates[dateIndex];

        if (cell && date && date.dateKey) {
          // Determine shift value from cell content
          const shiftValue = this.parseShiftValue(cell.text, shiftSymbols, staff);
          scheduleData[staff.id][date.dateKey] = shiftValue;
        }
      }
    }

    return scheduleData;
  }

  /**
   * Parse shift value from cell text
   * @param {string} cellText - Text content of cell
   * @param {Array} shiftSymbols - Detected shift symbols
   * @param {Object} staff - Staff member info
   * @returns {string} Shift value for schedule data
   */
  parseShiftValue(cellText, shiftSymbols, staff) {
    if (!cellText || cellText.trim() === '') {
      return ''; // Empty cell
    }

    const cleanText = cellText.trim();

    // Check for exact symbol matches
    for (let symbol in this.shiftSymbolMap) {
      if (cleanText === symbol) {
        const shiftValue = this.shiftSymbolMap[symbol];
        
        // Handle special case for normal shift based on staff type
        if (symbol === '○') {
          return staff.status === 'パート' ? '○' : '';
        }
        
        return shiftValue;
      }
    }

    // Check for symbols within text
    for (let symbol in this.shiftSymbolMap) {
      if (cleanText.includes(symbol)) {
        const shiftValue = this.shiftSymbolMap[symbol];
        
        if (symbol === '○') {
          return staff.status === 'パート' ? '○' : '';
        }
        
        return shiftValue;
      }
    }

    // If no symbol found but text exists, treat as custom text
    if (cleanText.length <= 5) { // Reasonable limit for custom text
      return cleanText;
    }

    return ''; // Default to empty if text is too long
  }

  /**
   * Check if text is likely a staff name
   * @param {string} text - Text to check
   * @returns {boolean} True if likely a staff name
   */
  isStaffName(text) {
    if (!text || text.trim().length < 1) return false;
    
    const cleanText = text.trim();
    
    // Skip very short text
    if (cleanText.length < 1) return false;
    
    // Skip common schedule elements that aren't names
    const nonNamePatterns = [
      /^\d+[月日\/\-\.]/,  // Dates like 1月, 1日, 1/2, 1-2
      /^[△○▽×]+$/,       // Only shift symbols
      /^\d+:\d+$/,        // Times like 9:00
      /^[0-9]+$/,         // Pure numbers
      /^[A-Z]+$/,         // All caps English (likely headers)
      /曜日|月|火|水|木|金|土|日/, // Day names
      /時間|シフト|スケジュール|予定/, // Schedule-related terms
      /調理場|厨房|ホール|キッチン|フロア/, // Workplace areas
      /部門|部署|担当|責任者|マネージャー/, // Department/position terms
      /早番|遅番|夜勤|日勤|休み/, // Shift type terms
      /^[あ-ん]{1}$/, // Single hiragana characters (likely particles)
      /^[ア-ン]{1}$/, // Single katakana characters
      /^[ー・、。]+$/, // Only punctuation marks
      /スタッフ|従業員|社員|パート|アルバイト/, // Employee type terms
      /合計|小計|計|総計/, // Total/sum terms
      /^\s*$/ // Only whitespace
    ];
    
    // Return false if it matches any non-name pattern
    if (nonNamePatterns.some(pattern => pattern.test(cleanText))) {
      console.log(`❌ "${cleanText}" matches non-name pattern`);
      return false;
    }
    
    // Check length constraints for names (Japanese names are typically 2-4 characters)
    if (cleanText.length > 6) {
      console.log(`❌ "${cleanText}" too long for a name`);
      return false;
    }
    
    // More flexible name patterns for handwritten text
    const flexibleNamePatterns = [
      /^[ぁ-んァ-ヶー々〇〻\u3400-\u9FFF]{2,4}$/,  // Japanese characters 2-4 chars
      /^[a-zA-Z]{2,8}$/,  // English names 2-8 chars
      /^[ァ-ヶー]{2,4}$/,  // Katakana names 2-4 chars
      /^[ひ-ん]{2,4}$/  // Hiragana names 2-4 chars
    ];
    
    // Check against flexible name patterns
    const isName = flexibleNamePatterns.some(pattern => pattern.test(cleanText));
    
    console.log(`🔍 Checking if "${cleanText}" is a staff name:`, isName);
    return isName;
  }

  /**
   * Parse date from text
   * @param {string} text - Text containing date
   * @param {Array} dateRange - Expected date range for context
   * @returns {Object|null} Parsed date info or null
   */
  parseDate(text, dateRange = []) {
    if (!text) return null;

    const cleanText = text.trim();
    
    // Try each date pattern
    for (let pattern of this.datePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        
        // Validate month and day
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          // Find matching date in expected range
          const matchingDate = dateRange.find(date => {
            return date.getMonth() + 1 === month && date.getDate() === day;
          });

          if (matchingDate) {
            return {
              text: cleanText,
              month,
              day,
              dateKey: matchingDate.toISOString().split('T')[0],
              date: matchingDate
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find staff names in text when table structure detection fails
   * @param {Array} detectedTexts - All detected text elements
   * @returns {Array} Array of potential staff names
   */
  findStaffNamesInText(detectedTexts) {
    console.log('🔍 Fallback: Finding staff names in all detected text');
    const staffNames = [];
    const usedNames = new Set();
    
    // First, try to find a concatenated staff list (like "・井関田辺古藤小池岸カル")
    const concatenatedStaff = this.extractConcatenatedStaffNames(detectedTexts);
    if (concatenatedStaff.length > 0) {
      console.log('✅ Found concatenated staff names:', concatenatedStaff);
      return concatenatedStaff;
    }
    
    // Sort by Y position (top to bottom) to get names in order
    const sortedTexts = [...detectedTexts].sort((a, b) => {
      const aY = this.getAverageY(a.bounds || []);
      const bY = this.getAverageY(b.bounds || []);
      return aY - bY;
    });
    
    sortedTexts.forEach((text, index) => {
      const cleanName = text.text.trim();
      
      console.log(`🔍 Checking text: "${cleanName}"`);
      
      if (this.isStaffName(cleanName) && !usedNames.has(cleanName)) {
        console.log(`✅ Found potential staff name: "${cleanName}"`);
        staffNames.push({
          name: cleanName,
          confidence: text.confidence || 0.6,
          position: { index, y: this.getAverageY(text.bounds || []) }
        });
        usedNames.add(cleanName);
      }
    });

    console.log('📋 All potential staff names found:', staffNames);
    return staffNames;
  }
  
  /**
   * Extract staff names from concatenated text (like "・井関田辺古藤小池岸カル")
   * @param {Array} detectedTexts - All detected text elements
   * @returns {Array} Array of staff names extracted from concatenated text
   */
  extractConcatenatedStaffNames(detectedTexts) {
    const staffNames = [];
    
    // Look for text that contains multiple Japanese names concatenated
    for (const textItem of detectedTexts) {
      const text = textItem.text.trim();
      
      // Skip if too short or contains non-name characters
      if (text.length < 4) continue;
      
      // Remove common prefixes like "・" or "●"
      const cleanText = text.replace(/^[・●◦▪▫◾◽▴▾◂▸⬢⬡]+/, '');
      
      // Check if this looks like concatenated Japanese names
      if (this.looksLikeConcatenatedNames(cleanText)) {
        console.log(`🎯 Found concatenated names text: "${cleanText}"`);
        const names = this.splitConcatenatedNames(cleanText);
        
        names.forEach((name, index) => {
          if (this.isStaffName(name)) {
            staffNames.push({
              name: name,
              confidence: (textItem.confidence || 0.8) * 0.9, // Slightly lower confidence
              position: { concatenated: true, index }
            });
          }
        });
        
        // If we found names in concatenated text, return them
        if (staffNames.length > 0) {
          break;
        }
      }
    }
    
    return staffNames;
  }
  
  /**
   * Check if text looks like concatenated Japanese names
   * @param {string} text - Text to check
   * @returns {boolean} True if looks like concatenated names
   */
  looksLikeConcatenatedNames(text) {
    // Must be all Japanese characters
    if (!/^[ぁ-んァ-ヶー々〇〻\u3400-\u9FFF]+$/.test(text)) {
      return false;
    }
    
    // Should be longer than a single name but not too long
    if (text.length < 4 || text.length > 20) {
      return false;
    }
    
    // Should not contain workplace terms
    if (/調理場|厨房|ホール|キッチン|フロア|部門|部署/.test(text)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Split concatenated names into individual names
   * @param {string} text - Concatenated names text
   * @returns {Array} Array of individual names
   */
  splitConcatenatedNames(text) {
    const names = [];
    let currentName = '';
    
    // Common Japanese surname characters that often start names
    const surnameStarters = [
      '田', '佐', '山', '中', '小', '松', '井', '木', '林', '森',
      '石', '高', '竹', '青', '赤', '白', '黒', '金', '銀', '水',
      '火', '土', '大', '上', '下', '前', '後', '東', '西', '南',
      '北', '川', '河', '橋', '村', '町', '市', '国', '野', '原',
      '藤', '辺', '関', '池', '岸', '浜', '島', '谷', '沢', '渡'
    ];
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // If we encounter a likely surname starter and we have a current name,
      // save the current name and start a new one
      if (surnameStarters.includes(char) && currentName.length >= 2) {
        names.push(currentName);
        currentName = char;
      } else {
        currentName += char;
      }
      
      // If current name is getting too long (>4 chars), start a new name
      if (currentName.length > 4) {
        // Take first 2-3 chars as a name
        const nameToSave = currentName.substring(0, Math.min(3, currentName.length - 1));
        names.push(nameToSave);
        currentName = currentName.substring(nameToSave.length);
      }
    }
    
    // Add the last name if it exists
    if (currentName.length >= 2) {
      names.push(currentName);
    }
    
    console.log(`🔄 Split "${text}" into names:`, names);
    return names;
  }
  
  /**
   * Extract multiple dates from a long text string
   * @param {string} text - Text that might contain multiple dates
   * @param {Array} dateRange - Expected date range
   * @returns {Array} Array of extracted date info
   */
  extractMultipleDatesFromText(text, dateRange) {
    const dates = [];
    const usedDates = new Set();
    
    // Try all date patterns against the full text
    this.datePatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, 'g');
      
      while ((match = regex.exec(text)) !== null) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const matchingDate = dateRange.find(date => {
            return date.getMonth() + 1 === month && date.getDate() === day;
          });

          if (matchingDate && !usedDates.has(matchingDate.toISOString().split('T')[0])) {
            dates.push({
              text: match[0],
              month,
              day,
              dateKey: matchingDate.toISOString().split('T')[0],
              date: matchingDate
            });
            usedDates.add(matchingDate.toISOString().split('T')[0]);
          }
        }
      }
    });
    
    return dates;
  }
  
  /**
   * Get average X coordinate from bounds (helper for date sorting)
   * @param {Array} bounds - Array of vertex coordinates
   * @returns {number} Average X coordinate
   */
  getAverageX(bounds) {
    if (!bounds || bounds.length === 0) return 0;
    const xValues = bounds.map(vertex => (vertex && vertex.x) || 0);
    return xValues.reduce((sum, x) => sum + x, 0) / xValues.length;
  }
  
  /**
   * Get average Y coordinate from bounds (helper for fallback method)
   * @param {Array} bounds - Array of vertex coordinates
   * @returns {number} Average Y coordinate
   */
  getAverageY(bounds) {
    if (!bounds || bounds.length === 0) return 0;
    const yValues = bounds.map(vertex => (vertex && vertex.y) || 0);
    return yValues.reduce((sum, y) => sum + y, 0) / yValues.length;
  }

  /**
   * Find dates in text when table structure detection fails
   * @param {Array} detectedTexts - All detected text elements
   * @param {Array} dateRange - Expected date range
   * @returns {Array} Array of detected dates
   */
  findDatesInText(detectedTexts, dateRange) {
    const dates = [];
    const usedDates = new Set();
    
    // Sort by X position (left to right) to get dates in chronological order
    const sortedTexts = [...detectedTexts].sort((a, b) => {
      const aX = this.getAverageX(a.bounds || []);
      const bX = this.getAverageX(b.bounds || []);
      return aX - bX;
    });
    
    sortedTexts.forEach((text, index) => {
      const dateInfo = this.parseDate(text.text, dateRange);
      if (dateInfo && !usedDates.has(dateInfo.dateKey)) {
        console.log(`📅 Found date: "${text.text}" -> ${dateInfo.dateKey}`);
        dates.push({
          ...dateInfo,
          confidence: text.confidence || 0.6,
          position: { index }
        });
        usedDates.add(dateInfo.dateKey);
      }
    });
    
    // Also try to extract dates from longer text that might contain multiple elements
    detectedTexts.forEach((text, index) => {
      if (text.text.length > 10 && /\d/.test(text.text)) {
        const extractedDates = this.extractMultipleDatesFromText(text.text, dateRange);
        extractedDates.forEach(dateInfo => {
          if (!usedDates.has(dateInfo.dateKey)) {
            console.log(`📅 Extracted date from long text: "${dateInfo.text}" -> ${dateInfo.dateKey}`);
            dates.push({
              ...dateInfo,
              confidence: (text.confidence || 0.6) * 0.8, // Lower confidence for extracted
              position: { index, extracted: true }
            });
            usedDates.add(dateInfo.dateKey);
          }
        });
      }
    });

    return dates;
  }

  /**
   * Detect if first row is a header row
   * @param {Array} rows - Table rows
   * @returns {boolean} True if first row appears to be header
   */
  detectHeaderRow(rows) {
    if (rows.length === 0) return false;
    
    const firstRow = rows[0];
    // Check if first row contains dates
    return firstRow.some(cell => this.parseDate(cell.text) !== null);
  }

  /**
   * Detect if first column contains row headers
   * @param {Array} headerRow - First row
   * @returns {boolean} True if first column appears to be row header
   */
  detectRowHeaderColumn(headerRow) {
    if (headerRow.length === 0) return false;
    
    const firstCell = headerRow[0];
    // Check if first cell is not a date (likely staff name or empty)
    return !this.parseDate(firstCell.text);
  }

  /**
   * Calculate string similarity for fuzzy matching
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Generate warnings for parsing results
   * @param {Array} mappedStaff - Mapped staff members
   * @param {Array} dates - Detected dates
   * @param {Object} scheduleData - Parsed schedule data
   * @returns {Array} Array of warning messages
   */
  generateWarnings(mappedStaff, dates, scheduleData) {
    const warnings = [];

    // Check for low confidence staff
    const lowConfidenceStaff = mappedStaff.filter(staff => staff.confidence < 0.7);
    if (lowConfidenceStaff.length > 0) {
      warnings.push({
        type: 'low_confidence_staff',
        message: `Low confidence staff names detected: ${lowConfidenceStaff.map(s => s.name).join(', ')}`,
        items: lowConfidenceStaff
      });
    }

    // Check for new staff members
    const newStaff = mappedStaff.filter(staff => staff.isNew);
    if (newStaff.length > 0) {
      warnings.push({
        type: 'new_staff',
        message: `New staff members will be created: ${newStaff.map(s => s.name).join(', ')}`,
        items: newStaff
      });
    }

    // Check for missing dates
    if (dates.length === 0) {
      warnings.push({
        type: 'no_dates',
        message: 'No dates detected in the image. Please verify the date range.',
        items: []
      });
    }

    // Check for sparse schedule data
    const totalCells = mappedStaff.length * dates.length;
    const filledCells = Object.values(scheduleData).reduce((count, staff) => {
      return count + Object.values(staff).filter(shift => shift !== '').length;
    }, 0);
    
    if (totalCells > 0 && filledCells / totalCells < 0.3) {
      warnings.push({
        type: 'sparse_data',
        message: 'Most cells appear empty. Check if the image quality is sufficient.',
        items: []
      });
    }

    return warnings;
  }
}

export default ScheduleParser;